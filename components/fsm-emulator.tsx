"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { fetchFsmEntities, fetchFsmEntityActions, fetchFsmEntityHistory } from "@/lib/api"

interface FSMEmulatorProps {
  addLog: (log: any) => void
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

interface HistoryEntry {
  id: number
  action_name: string
  from_state: string
  to_state: string
  user_id: number
  created_at: string
}

interface EntityHistory {
  entity_type: string
  entity_id: number
  history: HistoryEntry[]
  count: number
}

export function FSMEmulator({ addLog }: FSMEmulatorProps) {
  const [entities, setEntities] = useState<FsmEntity[]>([])
  const [selectedEntity, setSelectedEntity] = useState<FsmEntity | null>(null)
  const [selectedAction, setSelectedAction] = useState<Record<number, string>>({})
  const [entityActions, setEntityActions] = useState<Record<number, EntityActions>>({})
  const [entityHistory, setEntityHistory] = useState<Record<number, EntityHistory>>({})
  const [loadingActions, setLoadingActions] = useState<Record<number, boolean>>({})
  const [loadingHistory, setLoadingHistory] = useState<Record<number, boolean>>({})
  const [filterType, setFilterType] = useState<string>("all")
  const [filterState, setFilterState] = useState<string>("all")
  const [historyOpen, setHistoryOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [availableTypes, setAvailableTypes] = useState<string[]>([])
  const [availableStatuses, setAvailableStatuses] = useState<string[]>([])

  // Загрузка данных при изменении фильтров
  useEffect(() => {
    const loadEntities = async () => {
      setIsLoading(true)
      try {
        const data = await fetchFsmEntities(filterType, filterState, 50)
        setEntities(data)

        // Извлекаем уникальные типы сущностей
        const types = new Set<string>()
        const statuses = new Set<string>()
        
        data.forEach((entity) => {
          if (entity.entity_type) types.add(entity.entity_type)
          if (entity.status) statuses.add(entity.status)
        })

        setAvailableTypes(Array.from(types).sort())
        setAvailableStatuses(Array.from(statuses).sort())
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

  // Загрузка истории для сущности
  const loadEntityHistory = async (entity: FsmEntity) => {
    if (entityHistory[entity.id]) return // Уже загружено

    setLoadingHistory((prev) => ({ ...prev, [entity.id]: true }))
    try {
      const data = await fetchFsmEntityHistory(entity.entity_type, entity.id)
      setEntityHistory((prev) => ({ ...prev, [entity.id]: data }))
    } catch (error) {
      console.error("Error loading entity history:", error)
    } finally {
      setLoadingHistory((prev) => ({ ...prev, [entity.id]: false }))
    }
  }

  const handleOpenChange = (open: boolean) => {
    setHistoryOpen(open)
    if (open && selectedEntity) {
      loadEntityActions(selectedEntity)
      loadEntityHistory(selectedEntity)
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
              {availableTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterState} onValueChange={setFilterState}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filter by state" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All States</SelectItem>
              {availableStatuses.map((status) => (
                <SelectItem key={status} value={status}>
                  {status}
                </SelectItem>
              ))}
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
                    loadEntityHistory(entity)
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
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                History - {selectedEntity?.entity_type} #{selectedEntity?.id}
              </DialogTitle>
            </DialogHeader>
            {loadingHistory[selectedEntity?.id || 0] ? (
              <p className="text-muted-foreground">Loading history...</p>
            ) : entityHistory[selectedEntity?.id || 0]?.history ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>From State</TableHead>
                    <TableHead>To State</TableHead>
                    <TableHead>Created At</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entityHistory[selectedEntity?.id || 0].history.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">{entry.action_name}</TableCell>
                      <TableCell>{entry.from_state}</TableCell>
                      <TableCell>{entry.to_state}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {entry.created_at ? new Date(entry.created_at).toLocaleString() : "-"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground">No history available</p>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
