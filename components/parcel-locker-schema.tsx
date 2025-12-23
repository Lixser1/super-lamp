"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useLanguage } from "@/lib/language-context"
import { mockLockers, mockLockerCells, mockOrders } from "@/lib/mock-data"

interface ParcelLockerSchemaProps {
  mode?: "create" | "run"
  activeTab?: string
  addLog?: (log: any) => void
}

type OrderLocation = {
  orderId: number
  status: string
  locationType: "locker" | "courier" | "driver" | "operator"
  locationId?: number
  cell?: string
  role?: string
}

export function ParcelLockerSchema({ mode, activeTab, addLog }: ParcelLockerSchemaProps) {
  const [statusFilter, setStatusFilter] = useState("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [expandedLockerSize, setExpandedLockerSize] = useState<{ lockerId: number; size: string } | null>(null)
  const [cellStatuses, setCellStatuses] = useState<{ [key: string]: string }>({})
  const [orderLocations, setOrderLocations] = useState<{ [orderId: number]: OrderLocation }>(() => {
    // Initialize from mock data
    const locations: { [orderId: number]: OrderLocation } = {}
    mockOrders.forEach((order) => {
      if (order.status === "available_for_pickup" || order.status === "assigned_to_pudo") {
        locations[order.id] = {
          orderId: order.id,
          status: order.status,
          locationType: "locker",
          locationId: order.lockerId,
          cell: order.cell,
        }
      } else if (order.status === "taken_from_exchange" || order.status === "in_transit") {
        locations[order.id] = {
          orderId: order.id,
          status: order.status,
          locationType: "courier",
          locationId: order.courierId || undefined,
          role: "courier",
        }
      } else if (order.status === "taken_by_driver") {
        locations[order.id] = {
          orderId: order.id,
          status: order.status,
          locationType: "driver",
          locationId: order.tripId,
          role: "driver",
        }
      }
    })
    return locations
  })
  const [orderFeedFilter, setOrderFeedFilter] = useState<"active" | "archived">("active")
  const { t } = useLanguage()

  const [selectedOrderId, setSelectedOrderId] = useState<string>("") // Moved useState to top level
  const showCellStatusControls = mode === "create" && activeTab === "operator"

  const operatorOrders = useMemo(() => {
    return Object.values(orderLocations).filter((loc) => loc.locationType === "operator")
  }, [orderLocations])

  const handleChangeCellStatus = (cellNumber: string, lockerId: number, newStatus: string) => {
    const key = `${lockerId}-${cellNumber}`
    const oldStatus = getCellStatus(cellNumber, lockerId, "")

    if (newStatus === "occupied" && oldStatus === "free" && operatorOrders.length > 0) {
      console.log("[v0] Cannot change to occupied without selecting an order")
      return
    }

    if (oldStatus === "occupied" && (newStatus === "free" || newStatus === "repair")) {
      const orderId = getOrderIdForCell(cellNumber, lockerId)
      if (orderId) {
        setOrderLocations((prev) => ({
          ...prev,
          [orderId]: {
            orderId,
            status: "with_operator",
            locationType: "operator",
            role: "operator",
          },
        }))
        addLog?.({
          role: "operator",
          action: "remove_order_from_cell",
          data: { order_id: orderId, cell: cellNumber, locker_id: lockerId },
          result: "OK",
        })
      }
    }

    setCellStatuses({ ...cellStatuses, [key]: newStatus })
    addLog?.({
      role: "operator",
      action: "change_cell_status",
      data: { cell: cellNumber, locker_id: lockerId, old_status: oldStatus, new_status: newStatus },
      result: "OK",
    })
  }

  const handlePlaceOrderInCell = (cellNumber: string, lockerId: number, orderId: string) => {
    const key = `${lockerId}-${cellNumber}`

    // Place order in cell
    setOrderLocations((prev) => ({
      ...prev,
      [Number.parseInt(orderId)]: {
        orderId: Number.parseInt(orderId),
        status: "in_locker",
        locationType: "locker",
        locationId: lockerId,
        cell: cellNumber,
      },
    }))

    // Change cell status to occupied
    setCellStatuses({ ...cellStatuses, [key]: "occupied" })

    addLog?.({
      role: "operator",
      action: "place_order_in_cell",
      data: { order_id: Number.parseInt(orderId), cell: cellNumber, locker_id: lockerId },
      result: "OK",
    })
  }

  const getCellStatus = (cellNumber: string, lockerId: number, defaultStatus: string) => {
    const key = `${lockerId}-${cellNumber}`
    return cellStatuses[key] || defaultStatus
  }

  const filteredLockers = mockLockers.filter((locker) => {
    if (
      searchTerm &&
      !locker.address.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !locker.id.toString().includes(searchTerm)
    ) {
      return false
    }
    return true
  })

  const getCellAggregates = (lockerId: number) => {
    const cells = mockLockerCells.filter((cell) => cell.lockerId === lockerId)
    const aggregates: Record<string, { total: number; occupied: number; free: number; repair: number }> = {}

    cells.forEach((cell) => {
      if (!aggregates[cell.size]) {
        aggregates[cell.size] = { total: 0, occupied: 0, free: 0, repair: 0 }
      }
      aggregates[cell.size].total++
      const status = getCellStatus(cell.number, lockerId, cell.status)
      if (status === "occupied") aggregates[cell.size].occupied++
      if (status === "free") aggregates[cell.size].free++
      if (status === "repair") aggregates[cell.size].repair++
    })

    return aggregates
  }

  const getCellsForSize = (lockerId: number, size: string) => {
    return mockLockerCells.filter((cell) => cell.lockerId === lockerId && cell.size === size)
  }

  const toggleExpand = (lockerId: number, size: string) => {
    if (expandedLockerSize?.lockerId === lockerId && expandedLockerSize?.size === size) {
      setExpandedLockerSize(null)
    } else {
      setExpandedLockerSize({ lockerId, size })
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      free: "default",
      occupied: "secondary",
      repair: "destructive",
    }
    const labels: Record<string, string> = {
      free: t.schema.free,
      occupied: t.schema.occupied,
      repair: t.schema.repair,
    }
    return <Badge variant={variants[status]}>{labels[status]}</Badge>
  }

  const getOrderIdForCell = (cellNumber: string, lockerId: number) => {
    // Check if there's an order in orderLocations for this cell
    const orderInCell = Object.values(orderLocations).find(
      (loc) => loc.locationType === "locker" && loc.locationId === lockerId && loc.cell === cellNumber,
    )
    if (orderInCell) return orderInCell.orderId

    // Fallback to mock data
    const order = mockOrders.find((o) => o.cell === cellNumber && o.lockerId === lockerId)
    return order?.id
  }

  const getOrderFeedData = () => {
    const orders = Object.values(orderLocations)
    if (orderFeedFilter === "active") {
      return orders.filter((order) => order.status !== "delivered" && order.status !== "cancelled")
    } else {
      return orders.filter((order) => order.status === "delivered" || order.status === "cancelled")
    }
  }

  const formatLocation = (location: OrderLocation) => {
    if (location.locationType === "locker") {
      const locker = mockLockers.find((l) => l.id === location.locationId)
      return `${t.schema.locker} #${location.locationId} - ${location.cell}`
    } else if (location.locationType === "courier") {
      return `${t.operator.courier} #${location.locationId}`
    } else if (location.locationType === "driver") {
      return `${t.driver.tripId} #${location.locationId}`
    } else if (location.locationType === "operator") {
      return t.schema.withOperator
    }
    return "-"
  }

  return (
    <div className="h-full overflow-y-auto">
      <Card>
        <CardHeader>
          <CardTitle>{t.schema.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Order Feed Section */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="font-semibold">{t.schema.orderFeed}</h3>
              <div className="flex gap-2">
                <Button
                  variant={orderFeedFilter === "active" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setOrderFeedFilter("active")}
                >
                  {t.schema.activeOrders}
                </Button>
                <Button
                  variant={orderFeedFilter === "archived" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setOrderFeedFilter("archived")}
                >
                  {t.schema.archivedOrders}
                </Button>
              </div>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.schema.orderId}</TableHead>
                    <TableHead>{t.schema.orderStatus}</TableHead>
                    <TableHead>{t.schema.currentLocation}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getOrderFeedData().map((order) => (
                    <TableRow key={order.orderId}>
                      <TableCell className="font-medium">{order.orderId}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{order.status}</Badge>
                      </TableCell>
                      <TableCell>{formatLocation(order)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* Filter Section */}
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder={t.schema.status} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t.schema.allStatus}</SelectItem>
                <SelectItem value="free">{t.schema.free}</SelectItem>
                <SelectItem value="occupied">{t.schema.occupied}</SelectItem>
                <SelectItem value="repair">{t.schema.repair}</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder={t.schema.searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
          </div>

          {/* Locker Tables */}
          <div className="space-y-6">
            {filteredLockers.map((locker) => {
              const aggregates = getCellAggregates(locker.id)

              return (
                <div key={locker.id} className="mb-6">
                  <h3 className="font-semibold text-lg mb-2">
                    {t.schema.locker} #{locker.id} - {locker.address}
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>{t.schema.size}</TableHead>
                        <TableHead>{t.schema.occupied}</TableHead>
                        <TableHead>{t.schema.free}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(aggregates).map(([size, stats]) => {
                        const isExpanded =
                          expandedLockerSize?.lockerId === locker.id && expandedLockerSize?.size === size
                        const cells = getCellsForSize(locker.id, size)

                        return (
                          <>
                            <TableRow key={size} className="cursor-pointer hover:bg-muted/50">
                              <TableCell>
                                <Button variant="ghost" size="sm" onClick={() => toggleExpand(locker.id, size)}>
                                  {isExpanded ? "▼" : "▶"}
                                </Button>
                              </TableCell>
                              <TableCell className="font-medium">
                                {size}
                                {size === "P" && (
                                  <span className="text-xs text-muted-foreground ml-2">({t.schema.letters})</span>
                                )}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">{stats.occupied}</Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="default">{stats.free}</Badge>
                              </TableCell>
                            </TableRow>
                            {isExpanded && (
                              <TableRow>
                                <TableCell colSpan={4} className="bg-muted/30 p-4">
                                  <div className="space-y-2">
                                    <h4 className="font-semibold text-sm mb-2">
                                      {t.schema.cell} {size} - {t.schema.status}
                                    </h4>
                                    <div className="flex flex-col gap-2">
                                      {cells.map((cell) => {
                                        const currentStatus = getCellStatus(cell.number, locker.id, cell.status)
                                        const orderId = getOrderIdForCell(cell.number, locker.id)

                                        return (
                                          <div
                                            key={cell.number}
                                            className="p-3 border rounded-lg bg-background flex items-center justify-between"
                                          >
                                            <div className="flex items-center gap-3 flex-1">
                                              <span className="font-medium">{cell.number}</span>
                                              <div className="flex items-center gap-2 flex-1">
                                                {showCellStatusControls ? (
                                                  currentStatus === "free" && operatorOrders.length > 0 ? (
                                                    // When free with operator orders, show order selection
                                                    <div className="flex items-center gap-2 flex-1">
                                                      <span className="text-sm font-medium">{t.schema.free}:</span>
                                                      <Select
                                                        value={selectedOrderId}
                                                        onValueChange={(orderId) => {
                                                          handlePlaceOrderInCell(cell.number, locker.id, orderId)
                                                          setSelectedOrderId("")
                                                        }}
                                                      >
                                                        <SelectTrigger className="w-[250px]">
                                                          <SelectValue placeholder={t.schema.selectOrderToPlace} />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                          {operatorOrders.map((order) => (
                                                            <SelectItem
                                                              key={order.orderId}
                                                              value={order.orderId.toString()}
                                                            >
                                                              {t.schema.placeOrder} {order.orderId}
                                                            </SelectItem>
                                                          ))}
                                                        </SelectContent>
                                                      </Select>
                                                      <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                          handleChangeCellStatus(cell.number, locker.id, "repair")
                                                        }
                                                      >
                                                        {t.schema.repair}
                                                      </Button>
                                                    </div>
                                                  ) : (
                                                    // Otherwise show status dropdown
                                                    <Select
                                                      value={currentStatus}
                                                      onValueChange={(newStatus) => {
                                                        handleChangeCellStatus(cell.number, locker.id, newStatus)
                                                      }}
                                                    >
                                                      <SelectTrigger className="w-[140px]">
                                                        <SelectValue />
                                                      </SelectTrigger>
                                                      <SelectContent>
                                                        <SelectItem value="free">{t.schema.free}</SelectItem>
                                                        {(currentStatus !== "free" || operatorOrders.length === 0) && (
                                                          <SelectItem value="occupied">{t.schema.occupied}</SelectItem>
                                                        )}
                                                        <SelectItem value="repair">{t.schema.repair}</SelectItem>
                                                      </SelectContent>
                                                    </Select>
                                                  )
                                                ) : (
                                                  // Not in operator mode, just show status badge
                                                  getStatusBadge(currentStatus)
                                                )}
                                              </div>
                                              {currentStatus === "occupied" && orderId && (
                                                <span className="text-sm text-muted-foreground">ID: {orderId}</span>
                                              )}
                                              {cell.size === "P" && cell.letterCapacity && (
                                                <span className="text-sm text-muted-foreground">
                                                  {cell.currentLetters}/{cell.letterCapacity}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
