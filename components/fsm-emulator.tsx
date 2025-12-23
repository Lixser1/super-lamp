"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface FSMEmulatorProps {
  addLog: (log: any) => void
  highlightedAction?: string | null
}

const mockEntities = [
  { entityType: "order", entityId: 1, currentState: "created", description: "Order #1 - Electronics" },
  { entityType: "order", entityId: 2, currentState: "reserved", description: "Order #2 - Books" },
  { entityType: "stage_order", entityId: 1, currentState: "assigned", description: "Stage Order #1" },
  { entityType: "trip", entityId: 1, currentState: "in_progress", description: "Trip #1 - Route A" },
]

const stateActions: Record<string, string[]> = {
  created: ["reserve_cell", "cancel"],
  reserved: ["assign_courier", "cancel"],
  assigned: ["pickup_from_cell", "cancel"],
  in_progress: ["confirm_delivery", "mark_failed"],
}

const mockHistory = [
  { action: "reserve_cell", fromState: "created", toState: "reserved", createdAt: "2025-10-24 10:30:00" },
  { action: "assign_courier", fromState: "reserved", toState: "assigned", createdAt: "2025-10-24 10:35:00" },
]

export function FSMEmulator({ addLog, highlightedAction }: FSMEmulatorProps) {
  const [selectedEntity, setSelectedEntity] = useState<any>(null)
  const [selectedAction, setSelectedAction] = useState<Record<number, string>>({})
  const [filterType, setFilterType] = useState<string>("all")
  const [filterState, setFilterState] = useState<string>("all")
  const [historyOpen, setHistoryOpen] = useState(false)

  const filteredEntities = mockEntities.filter((entity) => {
    if (filterType !== "all" && entity.entityType !== filterType) return false
    if (filterState !== "all" && entity.currentState !== filterState) return false
    return true
  })

  const handlePerformAction = (entity: any) => {
    const action = selectedAction[entity.entityId]
    if (!action) return

    console.log(`[API] POST /fsm/perform`, {
      entity_type: entity.entityType,
      entity_id: entity.entityId,
      action_name: action,
      user_id: 100,
    })

    addLog({
      role: "FSM",
      action: `${action} on ${entity.entityType} #${entity.entityId}`,
      statusBefore: entity.currentState,
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
            {filteredEntities.map((entity) => (
              <TableRow
                key={`${entity.entityType}-${entity.entityId}`}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => {
                  setSelectedEntity(entity)
                  setHistoryOpen(true)
                }}
              >
                <TableCell className="font-medium">{entity.entityType}</TableCell>
                <TableCell>{entity.entityId}</TableCell>
                <TableCell>
                  <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium bg-primary/10 text-primary">
                    {entity.currentState}
                  </span>
                </TableCell>
                <TableCell>{entity.description}</TableCell>
                <TableCell>
                  <Select
                    value={selectedAction[entity.entityId] || ""}
                    onValueChange={(value) => setSelectedAction((prev) => ({ ...prev, [entity.entityId]: value }))}
                  >
                    <SelectTrigger
                      className={`w-[180px] ${highlightedAction && stateActions[entity.currentState]?.includes(highlightedAction) ? "animate-pulse border-primary" : ""}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <SelectValue placeholder="Select action" />
                    </SelectTrigger>
                    <SelectContent>
                      {stateActions[entity.currentState]?.map((action) => (
                        <SelectItem key={action} value={action}>
                          {action}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <Button
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      handlePerformAction(entity)
                    }}
                    disabled={!selectedAction[entity.entityId]}
                  >
                    Perform
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Action History - {selectedEntity?.entityType} #{selectedEntity?.entityId}
              </DialogTitle>
            </DialogHeader>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Action</TableHead>
                  <TableHead>From State</TableHead>
                  <TableHead>To State</TableHead>
                  <TableHead>Timestamp</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockHistory.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{item.action}</TableCell>
                    <TableCell>{item.fromState}</TableCell>
                    <TableCell>{item.toState}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{item.createdAt}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
