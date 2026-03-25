"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useLanguage } from "@/lib/language-context"
import { mockLockers, mockOrders, mockCouriers, mockDriverExchangeOrders, mockDriverAssignedOrders } from "@/lib/mock-data"
import { fetchOperatorTrips, enqueueFsmRequest, makeFsmEnqueueRequest } from "@/lib/api"

interface OperatorFormProps {
  addLog: (log: any) => void
  driverAvailableOrders: any[]
  driverAssignedOrders: any[]
  setDriverAssignedOrders: (orders: any[]) => void
}

export function OperatorForm({
  addLog,
  driverAvailableOrders,
  driverAssignedOrders,
  setDriverAssignedOrders,
}: OperatorFormProps) {
  const [expandedLockers, setExpandedLockers] = useState<number[]>([])
  const [lockerOrders, setLockerOrders] = useState<{ [key: number]: any[] }>({})
  const [selectedCouriers, setSelectedCouriers] = useState<{ [key: number]: string }>({})
  const [selectedDrivers, setSelectedDrivers] = useState<{ [key: number]: string }>({})
  const [operatorTrips, setOperatorTrips] = useState<any[]>([])
  const [loadingOperatorTrips, setLoadingOperatorTrips] = useState(false)

  // Загрузка рейсов оператора при монтировании компонента
  useEffect(() => {
    const loadOperatorTrips = async () => {
      setLoadingOperatorTrips(true)
      try {
        const trips = await fetchOperatorTrips()
        setOperatorTrips(trips)
      } catch (error) {
        console.error('Error loading operator trips:', error)
      } finally {
        setLoadingOperatorTrips(false)
      }
    }

    loadOperatorTrips()
  }, [])
  const { t, language } = useLanguage()

  const handleAction = (role: string, action: string, extraData?: any) => {
    console.log(`[API] POST /${role}/${action}`, extraData || {})
    addLog({
      role,
      action,
      data: extraData,
      result: "OK",
    })
  }

  const handleRemoveTrip = async (tripId: number) => {
    try {
      // Используем унифицированный запрос для снятия рейса
      const trip = operatorTrips.find(t => t.trip_id === tripId)
      const driverUserId = trip?.driver_user_id
      
      const request = makeFsmEnqueueRequest({
        entity_type: "trip",
        entity_id: tripId,
        process_name: "trip_assign_driver",
        user_id: 777, // оператор
        target_user_id: driverUserId || 777, // водитель из API
        target_role: "driver",
        metadata: {
          action: "remove_driver"
        }
      })

      await enqueueFsmRequest(request)
      
      // Обновляем список рейсов после успешного снятия
      const updatedTrips = await fetchOperatorTrips()
      setOperatorTrips(updatedTrips)
    } catch (error: any) {
      console.error('Error removing trip:', error)
      const errorMessage = error?.response?.data?.message || error?.message || (language === "ru" ? "Ошибка снятия рейса" : "Error removing trip")
      alert(errorMessage)
    }
  }

  const toggleLocker = (lockerId: number) => {
    if (expandedLockers.includes(lockerId)) {
      setExpandedLockers(expandedLockers.filter((id) => id !== lockerId))
    } else {
      setExpandedLockers([...expandedLockers, lockerId])
      // Load orders for this locker
      const orders = mockOrders.filter((o) => o.lockerId === lockerId && o.status === "assigned_to_pudo")
      setLockerOrders({ ...lockerOrders, [lockerId]: orders })
    }
  }

  const handleAssignCourier = (orderId: number, lockerId: number) => {
    const courierId = selectedCouriers[orderId]
    if (courierId) {
      handleAction("operator", "assign_courier", { order_id: orderId, courier_id: courierId })
    }
  }

  const handleAssignDriver = (tripId: number) => {
    const driverId = selectedDrivers[tripId]
    if (driverId) {
      setDriverAssignedOrders(
        driverAssignedOrders.map((order) =>
          order.tripId === tripId
            ? { ...order, driverId: Number.parseInt(driverId), status: "assigned_by_operator_driver" }
            : order,
        ),
      )
      handleAction("operator", "assign_driver", { trip_id: tripId, driver_id: driverId })
    }
  }

  const handleRemoveCourier = (orderId: number) => {
    // Note: This would need access to assignedOrders state, which is in parent
    // For now, just log the action
    handleAction("operator", "remove_courier", { order_id: orderId })
  }

  const handleRemoveDriver = (tripId: number) => {
    setDriverAssignedOrders(
      driverAssignedOrders.map((order) => (order.tripId === tripId ? { ...order, driverId: null } : order)),
    )
    handleAction("operator", "remove_driver", { trip_id: tripId })
  }

  const calculateWaitingTime = (createdDate: Date) => {
    const now = new Date()
    const diffMs = now.getTime() - createdDate.getTime()
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
    return { hours: diffHours, minutes: diffMinutes }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.operator.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h3 className="font-semibold mb-3">{t.operator.tripFeed}</h3>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{language === "ru" ? "Рейс" : "Trip"}</TableHead>
                  <TableHead>{language === "ru" ? "Водитель" : "Driver"}</TableHead>
                  <TableHead>{language === "ru" ? "Откуда" : "From"}</TableHead>
                  <TableHead>{language === "ru" ? "Куда" : "To"}</TableHead>
                  <TableHead>{language === "ru" ? "Статус" : "Status"}</TableHead>
                  <TableHead>{language === "ru" ? "Создан" : "Created"}</TableHead>
                  <TableHead>{language === "ru" ? "Снять" : "Remove"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operatorTrips.map((trip) => (
                  <TableRow key={trip.trip_id}>
                    <TableCell>{trip.trip_id}</TableCell>
                    <TableCell>{trip.driver_user_id || "-"}</TableCell>
                    <TableCell>{trip.from_city}</TableCell>
                    <TableCell>{trip.to_city}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{trip.status}</Badge>
                    </TableCell>
                    <TableCell>{trip.created_at}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleRemoveTrip(trip.trip_id)}
                      >
                        {language === "ru" ? "Снять" : "Remove"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-3">{t.operator.lockersTable}</h3>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12"></TableHead>
                  <TableHead>{t.operator.locker}</TableHead>
                  <TableHead>{t.operator.waitingCourier}</TableHead>
                  <TableHead>{t.operator.assignedCouriers}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {mockLockers
                  .map((locker) => {
                    const waitingOrders = mockOrders.filter(
                      (o) => o.lockerId === locker.id && o.status === "assigned_to_pudo" && !o.courierId,
                    )
                    const assignedCouriers = new Set(
                      mockOrders.filter((o) => o.lockerId === locker.id && o.courierId).map((o) => o.courierId),
                    ).size
                    return { locker, waitingOrders, assignedCouriers }
                  })
                  .sort((a, b) => b.waitingOrders.length - a.waitingOrders.length)
                  .map(({ locker, waitingOrders, assignedCouriers }) => {
                    const isExpanded = expandedLockers.includes(locker.id)

                    return (
                      <>
                        <TableRow key={locker.id}>
                          <TableCell>
                            <Button variant="ghost" size="sm" onClick={() => toggleLocker(locker.id)}>
                              {isExpanded ? "▼" : "▶"}
                            </Button>
                          </TableCell>
                          <TableCell>
                            {locker.id} / {locker.address}
                          </TableCell>
                          <TableCell>{waitingOrders.length}</TableCell>
                          <TableCell>{assignedCouriers}</TableCell>
                        </TableRow>
                        {isExpanded && lockerOrders[locker.id] && (
                          <TableRow>
                            <TableCell colSpan={4} className="bg-muted/50">
                              <div className="p-4">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>{t.operator.orderId}</TableHead>
                                      <TableHead>{t.operator.cell}</TableHead>
                                      <TableHead>{t.operator.status}</TableHead>
                                      <TableHead>{t.operator.waitingTime}</TableHead>
                                      <TableHead>{t.operator.courier}</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {lockerOrders[locker.id].map((order) => {
                                      const waitTime = calculateWaitingTime(new Date(2025, 0, 20, 9, 0))
                                      const hasCourier =
                                        order.courierId !== null && order.courierId !== undefined

                                      return (
                                        <TableRow key={order.id}>
                                          <TableCell>{order.id}</TableCell>
                                          <TableCell>{order.cell}</TableCell>
                                          <TableCell>
                                            <Badge variant="secondary">
                                              {language === "ru" ? "Ожидает курьера" : "Waiting for courier"}
                                            </Badge>
                                          </TableCell>
                                          <TableCell>
                                            {waitTime.hours > 0 && `${waitTime.hours}${t.operator.hours} `}
                                            {waitTime.minutes}
                                            {t.operator.minutes}
                                          </TableCell>
                                          <TableCell className="space-x-2">
                                            {hasCourier ? (
                                              <div className="flex items-center gap-2">
                                                <span className="text-sm">
                                                  {language === "ru" ? "Курьер" : "Courier"} #{order.courierId}
                                                </span>
                                                <Button
                                                  size="sm"
                                                  variant="outline"
                                                  onClick={() => handleRemoveCourier(order.id)}
                                                >
                                                  {t.operator.remove}
                                                </Button>
                                              </div>
                                            ) : (
                                              <div className="flex items-center gap-2">
                                                <Select
                                                  value={selectedCouriers[order.id] || ""}
                                                  onValueChange={(v) =>
                                                    setSelectedCouriers({ ...selectedCouriers, [order.id]: v })
                                                  }
                                                >
                                                  <SelectTrigger className="w-40">
                                                    <SelectValue placeholder={t.operator.selectCourier} />
                                                  </SelectTrigger>
                                                  <SelectContent>
                                                    {mockCouriers.map((courier) => (
                                                      <SelectItem
                                                        key={courier.id}
                                                        value={courier.id.toString()}
                                                      >
                                                        {courier.name}
                                                      </SelectItem>
                                                    ))}
                                                  </SelectContent>
                                                </Select>
                                                <Button
                                                  size="sm"
                                                  onClick={() => handleAssignCourier(order.id, locker.id)}
                                                  disabled={!selectedCouriers[order.id]}
                                                >
                                                  {t.operator.assign}
                                                </Button>
                                              </div>
                                            )}
                                          </TableCell>
                                        </TableRow>
                                      )
                                    })}
                                  </TableBody>
                                </Table>
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
        </div>
      </CardContent>
    </Card>
  )
}