"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { fetchFsmEntities, fetchFsmEntityActions } from "@/lib/api"

interface FSMEmulatorProps {
  addLog: (log: any) => void
  highlightedAction?: string | null
}

interface FsmEntity {
  id: number
  status: string
  description: string
  created_at: string
  entity_type: string
}

interface EntityActions {
  entity_type: string
  entity_id: number
  current_state: string
  available_actions: string[]
}

export function FSMEmulator({ addLog, highlightedAction }: FSMEmulatorProps) {
  const [entities, setEntities] = useState<FsmEntity[]>([])
  const [selectedEntity, setSelectedEntity] = useState<FsmEntity | null>(null)
  const [selectedAction, setSelectedAction] = useState<Record<number, string>>({})
  const [entityActions, setEntityActions] = useState<Record<number, EntityActions>>({})
  const [loadingActions, setLoadingActions] = useState<Record<number, boolean>>({})
  const [filterType, setFilterType] = useState<string>("all")
  const [filterState, setFilterState] = useState<string>("all")
  const [historyOpen, setHistoryOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  // Загрузка данных при изменении фильтров
  useEffect(() => {
    const loadEntities = async () => {
      setIsLoading(true)
      try {
        const data = await fetchFsmEntities(filterType, filterState, 50)
        setEntities(data)
      } catch (error) {
        console.error("Error loading FSM entities:", error)
        setEntities([])
      } finally {
        setIsLoading(false)
      }
    }

    loadEntities()
  }, [filterType, filterState])

  // Загрузка доступных действий для сущности
  const loadEntityActions = async (entity: FsmEntity) => {
    if (entityActions[entity.id]) return // Уже загружено

    setLoadingActions((prev) => ({ ...prev, [entity.id]: true }))
    try {
      const data = await fetchFsmEntityActions(entity.entity_type, entity.id)
      setEntityActions((prev) => ({ ...prev, [entity.id]: data }))
    } catch (error) {
      console.error("Error loading entity actions:", error)
    } finally {
      setLoadingActions((prev) => ({ ...prev, [entity.id]: false }))
    }
  }

  const handleOpenChange = (open: boolean) => {
    setHistoryOpen(open)
    if (open && selectedEntity) {
      loadEntityActions(selectedEntity)
    }
  }

  const handlePerformAction = (entity: FsmEntity) => {
    const action = selectedAction[entity.id]
    if (!action) return

    console.log(`[API] POST /fsm/perform`, {
      entity_type: entity.entity_type,
      entity_id: entity.id,
      action_name: action,
      user_id: 100,
    })

    addLog({
      role: "FSM",
      action: `${action} on ${entity.entity_type} #${entity.id}`,
      statusBefore: entity.status,
      statusAfter: "Updated",
      result: "OK",
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>FSM Emulator</CardTitle>
        <div className="flex gap-2 mt-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="order">Order</SelectItem>
              <SelectItem value="stage_order">Stage Order</SelectItem>
              <SelectItem value="trip">Trip</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterState} onValueChange={setFilterState}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by state" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All States</SelectItem>
              <SelectItem value="created">Created</SelectItem>
              <SelectItem value="reserved">Reserved</SelectItem>
              <SelectItem value="assigned">Assigned</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Entity Type</TableHead>
              <TableHead>Entity ID</TableHead>
              <TableHead>Current State</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Available Actions</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : entities.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No entities found
                </TableCell>
              </TableRow>
            ) : (
              entities.map((entity) => (
                <TableRow
                  key={`${entity.entity_type}-${entity.id}`}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => {
                    setSelectedEntity(entity)
                    setHistoryOpen(true)
                    loadEntityActions(entity)
                  }}
                >
                  <TableCell className="font-medium">{entity.entity_type}</TableCell>
                  <TableCell>{entity.id}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-primary/10 text-primary">
                      {entity.status}
                    </span>
                  </TableCell>
                  <TableCell>{entity.description}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    {loadingActions[entity.id] ? (
                      <span className="text-sm text-muted-foreground">Loading...</span>
                    ) : (
                      <Select
                        value={selectedAction[entity.id] || ""}
                        onValueChange={(value) => setSelectedAction((prev) => ({ ...prev, [entity.id]: value }))}
                        onOpenChange={(open) => {
                          if (open) loadEntityActions(entity)
                        }}
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Select action" />
                        </SelectTrigger>
                        <SelectContent>
                          {entityActions[entity.id]?.available_actions?.map((action) => (
                            <SelectItem key={action} value={action}>
                              {action}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Button
                      size="sm"
                      onClick={() => handlePerformAction(entity)}
                      disabled={!selectedAction[entity.id]}
                    >
                      Perform
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        <Dialog open={historyOpen} onOpenChange={handleOpenChange}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Entity Details - {selectedEntity?.entity_type} #{selectedEntity?.id}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <p><strong>Status:</strong> {selectedEntity?.status}</p>
              <p><strong>Description:</strong> {selectedEntity?.description}</p>
              <p><strong>Created:</strong> {selectedEntity?.created_at ? new Date(selectedEntity.created_at).toLocaleString() : "-"}</p>
              {entityActions[selectedEntity?.id || 0]?.available_actions && (
                <div className="mt-4">
                  <strong>Available Actions:</strong>
                  <ul className="mt-2 list-disc list-inside">
                    {entityActions[selectedEntity?.id || 0].available_actions.map((action) => (
                      <li key={action} className="text-sm">{action}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
