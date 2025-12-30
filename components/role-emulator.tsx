"use client"
import { useState, useEffect, useMemo } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FSMEmulator } from "@/components/fsm-emulator"
import { useLanguage } from "@/lib/language-context"
import {
  mockLockers,
  mockOrders,
  mockCouriers,
  mockOrderTracking,
  mockOrderDetails,
  mockDriverExchangeOrders,
  mockDriverAssignedOrders,
  mockLockerCells, // Assuming mockLockerCells is available for free cell lookup
} from "@/lib/mock-data"
import { v4 as uuidv4 } from 'uuid';

interface RoleEmulatorProps {
  addLog: (log: any) => void
  currentTest: any
  onModeChange?: (mode: "create" | "run") => void
  onTabChange?: (tab: string) => void
}

export function RoleEmulator({ addLog, currentTest, onModeChange, onTabChange }: RoleEmulatorProps) {
  const [mode, setMode] = useState<"create" | "run">("create")
  const [selectedClientId, setSelectedClientId] = useState<string>("1001")
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>("2001")
  const [selectedCourierId, setSelectedCourierId] = useState<string>("100")
  const [selectedDriverId, setSelectedDriverId] = useState<string>("200")

  const [clientOrders, setClientOrders] = useState<
    Array<{
      id: number
      parcelType: string
      cellSize: string
      status: string
      canCancel: boolean
      correlationId?: string
      isLoading?: boolean
    }>
  >([])

  const [createdOrderId, setCreatedOrderId] = useState<number | null>(null)
  const [parcelType, setParcelType] = useState("")
  const [cellSize, setCellSize] = useState("")
  const [senderDelivery, setSenderDelivery] = useState("")
  const [recipientDelivery, setRecipientDelivery] = useState("")

  const [recipientOrderInfo, setRecipientOrderInfo] = useState<{
    orderId: number
    locker: string
    cell: string
  } | null>(null)

  const [availableOrders, setAvailableOrders] = useState(
    mockOrders.filter((o) => o.status === "available_for_pickup" && !o.courierId),
  )
  const [assignedOrders, setAssignedOrders] = useState(mockOrders.filter((o) => o.courierId === 100))

  const [driverAvailableOrders, setDriverAvailableOrders] = useState(mockDriverExchangeOrders)
  const [driverAssignedOrders, setDriverAssignedOrders] = useState(mockDriverAssignedOrders)
  const [tripState, setTripState] = useState<"at_from_locker" | "in_transit" | "at_to_locker">("at_from_locker")

  const [tripFeedFilter, setTripFeedFilter] = useState<"all" | "active" | "archive">("active")
  const [showPlacedOrders, setShowPlacedOrders] = useState(false)

  const [hasActiveTrip, setHasActiveTrip] = useState(false)
  const [activeTripId, setActiveTripId] = useState<number | null>(null)

  const [lockerFrom, setLockerFrom] = useState("")
  const [lockerTo, setLockerTo] = useState("")
  const [tripId, setTripId] = useState<number | null>(null)
  const [directOrders, setDirectOrders] = useState<any[]>([])
  const [reverseOrders, setReverseOrders] = useState<any[]>([])
  const [freeCells, setFreeCells] = useState<any[]>([])
  const [selectedDirectOrders, setSelectedDirectOrders] = useState<number[]>([])
  const [selectedReverseOrders, setSelectedReverseOrders] = useState<number[]>([])
  const [takenDirectOrders, setTakenDirectOrders] = useState<number[]>([])
  const [takenReverseOrders, setTakenReverseOrders] = useState<number[]>([])
  const [placedParcels, setPlacedParcels] = useState<{
    [cellNumber: string]: { orderId: number; originalSize: string }
  }>({})

  const [expandedLockers, setExpandedLockers] = useState<number[]>([])
  const [lockerOrders, setLockerOrders] = useState<{ [key: number]: any[] }>({})
  const [selectedCouriers, setSelectedCouriers] = useState<{ [key: number]: string }>({})
  const [selectedDrivers, setSelectedDrivers] = useState<{ [key: number]: string }>({})

  const [currentStep, setCurrentStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [highlightedTab, setHighlightedTab] = useState<string | null>(null)
  const [highlightedAction, setHighlightedAction] = useState<string | null>(null)
  const [selectedTestId, setSelectedTestId] = useState<string>("1")
  const [executionMode, setExecutionMode] = useState<"step" | "auto">("step")
  const [delaySeconds, setDelaySeconds] = useState("2")
  const [totalSteps, setTotalSteps] = useState(5)
  const { t, language } = useLanguage()

  const [recipientOrderId, setRecipientOrderId] = useState("")
  const [recipientTracking, setRecipientTracking] = useState<Array<{ status: string; date: string; time: string }>>([])
  const [recipientOrderDetails, setRecipientOrderDetails] = useState<{
    id: number
    locker: string
    cell: string
    recipientDelivery: "self" | "courier"
    currentStatus: string
  } | null>(null)

  const [courierOrdersFilter, setCourierOrdersFilter] = useState<"all" | "active" | "archive">("active")

  type CourierDeliveryStatus =
    | "assigned"
    | "taken_by_courier"
    | "waiting_for_code"
    | "code_received"
    | "locker_opened"
    | "parcel_placed"
    | "waiting_for_close"
    | "locker_closed"
    | "locker_did_not_open"
    | "locker_did_not_close"
    | "taken_from_exchange"
    | "placed_in_cell"
    | "waiting_for_code_retry" // New status
    | "code_received_retry" // New status
    | "request_code_again" // New status

  useEffect(() => {
    const activeTrip =
      driverAssignedOrders.find((order) => order.tripStatus === "in_transit") ||
      driverAssignedOrders.find((order) => order.tripStatus === "at_to_locker") ||
      driverAssignedOrders.find((order) => order.tripStatus === "at_from_locker")

    if (activeTrip && !tripId) {
      // Set trip ID and state
      setActiveTripId(activeTrip.tripId)
      setTripId(activeTrip.tripId)
      setTripState(activeTrip.tripStatus as "at_from_locker" | "in_transit" | "at_to_locker")

      // Find orders associated with this trip
      const tripOrders = mockOrders.filter((o) => o.tripId === activeTrip.tripId && o.status === "taken_by_driver")

      if (tripOrders.length > 0) {
        // Set direct orders (orders being transported)
        setDirectOrders(tripOrders)

        // Mark all orders as taken
        const takenOrderIds = tripOrders.map((o) => o.id)
        setTakenDirectOrders(takenOrderIds)

        // Set locker from/to based on trip
        setLockerFrom(activeTrip.lockerId.toString())
        const toLockerId = mockLockers.find((l) => l.id !== activeTrip.lockerId)?.id || activeTrip.lockerId
        setLockerTo(toLockerId.toString())

        // If at destination, load free cells
        if (activeTrip.tripStatus === "at_to_locker") {
          const cells = mockLockerCells.filter((c) => c.lockerId === toLockerId && c.status === "free")
          setFreeCells(cells)
        }
      }
    }
  }, [driverAssignedOrders]) // Rerun when driverAssignedOrders changes

  useEffect(() => {
    if (mode === "run" && executionMode === "auto" && isPlaying) {
      const delay = Number.parseInt(delaySeconds) * 1000 || 2000
      const interval = setInterval(() => {
        if (currentStep < totalSteps - 1) {
          setCurrentStep((prev) => prev + 1)
        } else {
          setIsPlaying(false)
        }
      }, delay)
      return () => clearInterval(interval)
    }
  }, [mode, executionMode, isPlaying, currentStep, totalSteps, delaySeconds])

  useEffect(() => {
    if (mode === "run" && currentTest && currentTest.steps[currentStep]) {
      const step = currentTest.steps[currentStep]
      setHighlightedTab(step.role || "fsm")
      setHighlightedAction(step.action)
      setTimeout(() => {
        setHighlightedTab(null)
        setHighlightedAction(null)
      }, 1000)
    }
  }, [currentStep, mode, currentTest])

  useEffect(() => {
    if (parcelType === "letter") {
      setCellSize("P")
    }
  }, [parcelType])

  useEffect(() => {
    const activeTrip = driverAssignedOrders.find(
      (order) =>
        order.tripStatus === "in_transit" ||
        order.tripStatus === "at_to_locker" ||
        order.tripStatus === "at_from_locker",
    )
    if (activeTrip) {
      setHasActiveTrip(true)
      setActiveTripId(activeTrip.tripId)
    } else {
      setHasActiveTrip(false)
      setActiveTripId(null)
    }
  }, [driverAssignedOrders])

  const handleAction = (role: string, action: string, extraData?: any) => {
    console.log(`[API] POST /${role}/${action}`, extraData || {})
    addLog({
      role,
      action,
      data: extraData,
      result: "OK",
    })
  }

  const startOrderPolling = (correlationId: string, tempOrderId: number) => {
  const intervalId = setInterval(async () => {
    try {
      const response = await fetch(`/api/proxy/api/orders?correlation_id=${correlationId}`)
      if (!response.ok) {
        throw new Error('Failed to fetch orders')
      }
      const orders = await response.json()
      if (orders && orders.length > 0) {
        const realOrder = orders[0]
        setClientOrders(prevOrders =>
          prevOrders.map(order =>
            order.correlationId === correlationId
              ? {
                  ...order,
                  id: realOrder.id,
                  status: realOrder.status || "active",
                  canCancel: realOrder.can_cancel !== false,
                  isLoading: false,  // ДОБАВЛЕНО - завершаем загрузку
                }
              : order
          )
        )
        setCreatedOrderId(realOrder.id)  // ДОБАВЛЕНО - устанавливаем реальный ID
        clearInterval(intervalId)
      }
    } catch (error) {
      console.error('Error polling order:', error)
    }
  }, 5000)

  setTimeout(() => {
    clearInterval(intervalId)
    // ДОБАВЛЕНО - обработка таймаута
    setClientOrders(prevOrders =>
      prevOrders.map(order =>
        order.correlationId === correlationId && order.isLoading
          ? { ...order, isLoading: false, status: "error" }
          : order
      )
    )
  }, 5 * 60 * 1000)
}

  const handleCreateOrder = async () => {
    const correlationId = uuidv4()
    const tempOrderId = Math.floor(Math.random() * 10000) + 1000
    const data = {
      client_user_id: parseInt(selectedClientId),
      parcel_type: parcelType,
      cell_size: cellSize,
      sender_delivery: senderDelivery,
      recipient_delivery: recipientDelivery,
      correlation_id: correlationId,
    }

    try {
      const response = await fetch('/api/proxy/api/client/create_order_request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error('Network response was not ok')
      }

      const result = await response.json()


      // Добавить заказ в список клиента с correlationId
      setClientOrders([
        ...clientOrders,
        {
          id: tempOrderId,
          parcelType: parcelType,
          cellSize: cellSize,
          status: "processing",
          canCancel: false, // Пока не можем отменить, так как заказ ещё не создан
          correlationId: correlationId,
          isLoading: true,
        },
      ])

      // Запустить polling для отслеживания заказа
      startOrderPolling(correlationId, tempOrderId)

      handleAction("client", "create_order", { ...result, correlation_id: correlationId })
    } catch (error) {
      console.error('Error creating order:', error)
      // Здесь можно добавить уведомление об ошибке пользователю
    }
  }

  const handleTakeOrder = async (orderId: number) => {
    const data = {
      entity_type: "order",
      entity_id: orderId,
      process_name: "courier_take_order",
      user_id: parseInt(selectedCourierId),
    }

    try {
      const response = await fetch('/api/proxy/api/fsm/enqueue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error('Network response was not ok')
      }

      const result = await response.json()

      // Обновляем локальное состояние
      const order = availableOrders.find((o) => o.id === orderId)
      if (order) {
        setAssignedOrders([...assignedOrders, { ...order, status: "taken_by_courier" }])
        setAvailableOrders(availableOrders.filter((o) => o.id !== orderId))
      }

      handleAction("courier", "take_order", result)
    } catch (error) {
      console.error('Error taking order:', error)
      // Возможно, показать ошибку пользователю
    }
  }

  const handleCourierDeliveryAction = async (orderId: number, action: string) => {
    let processName = ""
    if (action === "confirm_placed") {
      processName = "courier_place_in_cell"
    }

    if (processName) {
      const data = {
        entity_type: "order",
        entity_id: orderId,
        process_name: processName,
        user_id: parseInt(selectedCourierId),
      }

      try {
        const response = await fetch('/api/proxy/api/fsm/enqueue', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        })

        if (!response.ok) {
          throw new Error('Network response was not ok')
        }

        const result = await response.json()
        handleAction("courier", action, result)
      } catch (error) {
        console.error('Error performing delivery action:', error)
        return // Не обновляем состояние, если ошибка
      }
    }

    // Обновляем локальное состояние
    setAssignedOrders(
      assignedOrders.map((order) => {
        if (order.id !== orderId) return order

        switch (action) {
          case "get_code":
            return { ...order, status: "waiting_for_code" }
          case "open_locker":
            return { ...order, status: "locker_opened" }
          case "confirm_placed":
            return { ...order, status: "parcel_placed" }
          case "close_locker":
            return { ...order, status: "waiting_for_close" }
          case "finish_delivery":
            return { ...order, status: "locker_closed" }
          case "locker_did_not_open":
            return { ...order, status: "locker_did_not_open" }
          case "locker_did_not_close":
            return { ...order, status: "locker_did_not_close" }
          case "retry_open":
            return { ...order, status: "code_received" } // Assuming retry_open leads to code_received state
          case "get_new_code":
            return { ...order, status: "waiting_for_code" } // Use waiting_for_code for requesting new code
          case "retry_close":
            return { ...order, status: "parcel_placed" } // Assuming retry_close leads to parcel_placed state
          case "reopen":
            return { ...order, status: "code_received" } // Assuming reopen leads to code_received state
          // New cases for waiting_for_code_retry
          case "code_received_retry":
            return { ...order, status: "code_received" }
          case "request_code_again":
            return { ...order, status: "waiting_for_code" } // Transition back to waiting for code
          default:
            return order
        }
      }),
    )

    if (!processName) {
      handleAction("courier", action, { order_id: orderId })
    }
  }

  // New driver order handling functions
  const handleTakeDriverOrder = async (orderId: number) => {
    const data = {
      entity_type: "trip",
      entity_id: orderId,
      process_name: "trip_assign_driver",
      user_id: parseInt(selectedDriverId),
    }

    try {
      const response = await fetch('/api/proxy/api/fsm/enqueue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error('Network response was not ok')
      }

      const result = await response.json()

      // Обновляем локальное состояние
      const order = driverAvailableOrders.find((o) => o.id === orderId)
      if (order) {
        setDriverAvailableOrders(driverAvailableOrders.filter((o) => o.id !== orderId))
        setDriverAssignedOrders([
          ...driverAssignedOrders,
          { ...order, driverId: parseInt(selectedDriverId), status: "taken_from_exchange_driver" },
        ])
      }

      handleAction("driver", "take_order", result)
    } catch (error) {
      console.error('Error taking driver order:', error)
      // Возможно, показать ошибку пользователю
    }
  }

  const handleCancelDriverOrder = async (orderId: number) => {
    const data = {
      entity_type: "order",
      entity_id: orderId,
      process_name: "cancel_order",
      user_id: parseInt(selectedDriverId),
    }

    try {
      const response = await fetch('/api/proxy/api/fsm/enqueue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error('Network response was not ok')
      }

      const result = await response.json()

      // Обновляем локальное состояние
      const order = driverAssignedOrders.find((o) => o.id === orderId)
      if (order) {
        setDriverAssignedOrders(driverAssignedOrders.filter((o) => o.id !== orderId))
        setDriverAvailableOrders([...driverAvailableOrders, { ...order, driverId: null, status: "available_for_driver" }])
      }

      handleAction("driver", "cancel_order", result)
    } catch (error) {
      console.error('Error cancelling driver order:', error)
      // Возможно, показать ошибку пользователю
    }
  }

  const handleGenerateTrip = () => {
    const newTripId = Math.floor(Math.random() * 1000) + 100
    setTripId(newTripId)
    setTripState("at_from_locker")

    const fromLockerId = Number.parseInt(lockerFrom)
    const toLockerId = Number.parseInt(lockerTo)

    const direct = mockOrders.filter((o) => o.lockerId === fromLockerId).slice(0, 5)
    const reverse = mockOrders.filter((o) => o.lockerId === toLockerId).slice(0, 3)

    setDirectOrders(direct)
    setReverseOrders(reverse)
    setSelectedDirectOrders([])
    setSelectedReverseOrders([])
    setTakenDirectOrders([])
    setTakenReverseOrders([])

    handleAction("driver", "generate_trip", { trip_id: newTripId, from: fromLockerId, to: toLockerId })
  }

  // Updated handleStartTrip signature to accept tripId
  const handleStartTrip = async (tripId: number) => {
    const data = {
      entity_type: "trip",
      entity_id: tripId,
      process_name: "start_trip",
      user_id: parseInt(selectedDriverId),
    }

    try {
      const response = await fetch('/api/proxy/api/fsm/enqueue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error('Network response was not ok')
      }

      const result = await response.json()

      // Обновляем локальное состояние
      // Find an order associated with the tripId. Assuming each order in driverAssignedOrders has a tripId.
      // If not, this logic might need adjustment based on how driverAssignedOrders is structured for trips.
      const order = driverAssignedOrders.find((o) => o.tripId === tripId)
      if (!order) return

      setActiveTripId(tripId)
      setTripId(tripId)
      setTripState("at_from_locker")
      setHasActiveTrip(true)

      const fromLockerId = order.lockerId
      const toLockerId = mockLockers.find((l) => l.id !== fromLockerId)?.id || fromLockerId

      setLockerFrom(fromLockerId.toString())
      setLockerTo(toLockerId.toString())

      const direct = mockOrders.filter((o) => o.lockerId === fromLockerId).slice(0, 5)
      const reverse = mockOrders.filter((o) => o.lockerId === toLockerId).slice(0, 3)

      setDirectOrders(direct)
      setReverseOrders(reverse)
      setSelectedDirectOrders([])
      setSelectedReverseOrders([])
      setTakenDirectOrders([])
      setTakenReverseOrders([])
      setFreeCells([]) // Clear free cells when starting a new trip

      setDriverAssignedOrders(
        driverAssignedOrders.map((o) => (o.tripId === tripId ? { ...o, tripStatus: "at_from_locker" } : o)),
      )

      handleAction("driver", "start_trip", result)
    } catch (error) {
      console.error('Error starting trip:', error)
      // Возможно, показать ошибку пользователю
    }
  }

  const handleTakeSelectedOrders = () => {
    const allSelected = [...selectedDirectOrders, ...selectedReverseOrders]
    setTakenDirectOrders([...takenDirectOrders, ...selectedDirectOrders])
    setTakenReverseOrders([...takenReverseOrders, ...selectedReverseOrders])
    if (allSelected.length > 0) {
      setTripState("in_transit")
      if (activeTripId) {
        setDriverAssignedOrders(
          driverAssignedOrders.map((o) => (o.tripId === activeTripId ? { ...o, tripStatus: "in_transit" } : o)),
        )
      }
    }
    handleAction("driver", "take_orders", { order_ids: allSelected })
  }

  const handleChangeTripState = async (newState: "at_from_locker" | "in_transit" | "at_to_locker") => {
    if (tripState === "in_transit" && newState === "at_from_locker") return
    if (tripState === "at_to_locker" && (newState === "at_from_locker" || newState === "in_transit")) return

    if (newState === "at_to_locker") {
      const data = {
        entity_type: "trip",
        entity_id: tripId || activeTripId,
        process_name: "arrive_at_destination",
        user_id: parseInt(selectedDriverId),
      }

      try {
        const response = await fetch('/api/proxy/api/fsm/enqueue', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(data),
        })

        if (!response.ok) {
          throw new Error('Network response was not ok')
        }

        const result = await response.json()
        handleAction("driver", "arrive_at_destination", result)
      } catch (error) {
        console.error('Error arriving at destination:', error)
        return // Не обновляем состояние, если ошибка
      }
    }

    setTripState(newState)

    if (newState === "at_to_locker") {
      const toLockerId = Number.parseInt(lockerTo)
      const cells = mockLockerCells.filter((c) => c.lockerId === toLockerId && c.status === "free")
      setFreeCells(cells)

      if (activeTripId) {
        setDriverAssignedOrders(
          driverAssignedOrders.map((o) => (o.tripId === activeTripId ? { ...o, tripStatus: "at_to_locker" } : o)),
        )
      }
    }

    if (newState !== "at_to_locker") {
      handleAction("driver", "change_trip_state", { trip_id: tripId, state: newState })
    }
  }

  const handlePlaceParcelInCell = async (orderId: number, cellNumber: string) => {
    const data = {
      entity_type: "order",
      entity_id: orderId,
      process_name: "open_cell",
      user_id: parseInt(selectedDriverId),
    }

    try {
      const response = await fetch('/api/proxy/api/fsm/enqueue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error('Network response was not ok')
      }

      const result = await response.json()

      // Обновляем локальное состояние
      const order = [...directOrders, ...reverseOrders].find((o) => o.id === orderId)
      if (!order) return

      const cell = freeCells.find((c) => c.number === cellNumber)
      if (!cell) return

      const sizeOrder = { P: 1, S: 2, M: 3, L: 4 }
      const orderSize = sizeOrder[order.size as keyof typeof sizeOrder] || 0
      const cellSizeValue = sizeOrder[cell.size as keyof typeof sizeOrder] || 0

      if (orderSize > cellSizeValue) {
        console.log("[v0] Cannot place larger parcel in smaller cell")
        return
      }

      // Remove order from taken orders
      setTakenDirectOrders(takenDirectOrders.filter((id) => id !== orderId))
      setTakenReverseOrders(takenReverseOrders.filter((id) => id !== orderId))

      setPlacedParcels({ ...placedParcels, [cellNumber]: { orderId, originalSize: order.size } })
      setFreeCells(freeCells.filter((c) => c.number !== cellNumber))

      handleAction("driver", "place_parcel_in_cell", result)
    } catch (error) {
      console.error('Error placing parcel in cell:', error)
      // Возможно, показать ошибку пользователю
    }
  }

  const handleCancelClientOrder = async (orderId: number) => {
    const data = {
      entity_type: "order",
      entity_id: orderId,
      process_name: "client_cancel_order",
      user_id: parseInt(selectedClientId),
    }

    try {
      const response = await fetch('/api/proxy/api/fsm/enqueue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      // if (!response.ok) {
      //   if (response.status === 404) {
      //     // Заказ нельзя отменить
      //     setClientOrders(
      //       clientOrders.map((order) => (order.id === orderId ? { ...order, status: "cannot_cancel", canCancel: false } : order)),
      //     )
      //     console.error('Order cannot be cancelled (404)')
      //     return
      //   }
      //   throw new Error('Network response was not ok')
      // }

      const result = await response.json()

      // Проверяем, если бэкенд вернул ошибку в теле ответа
      if (result.error || result.status === 'error' || result.message?.includes('cannot')) {
        setClientOrders(
          clientOrders.map((order) => (order.id === orderId ? { ...order, status: "cannot_cancel", canCancel: false } : order)),
        )
        console.error('Order cannot be cancelled:', result.message || 'Unknown error')
        return
      }

      // Обновляем локальный статус
      setClientOrders(
        clientOrders.map((order) => (order.id === orderId ? { ...order, status: "cancelled", canCancel: false } : order)),
      )

      handleAction("client", "cancel_order", result)
    } catch (error) {
      console.error('Error cancelling order:', error)
      // Возможно, показать ошибку пользователю
    }
  }

  const handleCancelCourierOrder = async (orderId: number) => {
    const data = {
      entity_type: "order",
      entity_id: orderId,
      process_name: "courier_cancel_order",
      user_id: parseInt(selectedCourierId),
    }

    try {
      const response = await fetch('/api/proxy/api/fsm/enqueue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error('Network response was not ok')
      }

      const result = await response.json()

      // Обновляем локальное состояние
      const order = assignedOrders.find((o) => o.id === orderId)
      if (order) {
        setAssignedOrders(assignedOrders.filter((o) => o.id !== orderId))
        setAvailableOrders([...availableOrders, { ...order, courierId: null, status: "available_for_pickup" }])
      }

      handleAction("courier", "cancel_order", result)
    } catch (error) {
      console.error('Error cancelling order:', error)
      // Возможно, показать ошибку пользователю
    }
  }

  const toggleLocker = (lockerId: number) => {
    if (expandedLockers.includes(lockerId)) {
      setExpandedLockers(expandedLockers.filter((id) => id !== lockerId))
    } else {
      setExpandedLockers([...expandedLockers, lockerId])
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
    setAssignedOrders(assignedOrders.map((order) => (order.id === orderId ? { ...order, courierId: null } : order)))
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

  const handleStepForward = () => {
    if (currentStep < totalSteps - 1) {
      setCurrentStep((prev) => prev + 1)
    }
  }

  const handleStepBackward = () => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1)
    }
  }

  const handlePlayPause = () => {
    if (executionMode === "auto") {
      setIsPlaying(!isPlaying)
    } else {
      handleStepForward()
    }
  }

  const handleRecipientLookup = () => {
    const orderId = Number.parseInt(recipientOrderId)
    const tracking = mockOrderTracking[orderId]
    const details = mockOrderDetails[orderId]

    if (tracking && details) {
      setRecipientTracking(tracking)
      setRecipientOrderDetails(details)
      handleAction("recipient", "lookup_order", { order_id: orderId })
    } else {
      setRecipientTracking([])
      setRecipientOrderDetails(null)
    }
  }

  const handleCloseOrder = () => {
    if (activeTripId) {
      setDriverAssignedOrders(
        driverAssignedOrders.map((o) => (o.tripId === activeTripId ? { ...o, tripStatus: "completed" } : o)),
      )
      setHasActiveTrip(false)
      setActiveTripId(null)
      setTripId(null)
      setPlacedParcels({})
      handleAction("driver", "close_order", { trip_id: activeTripId })
    }
  }

  const progress = totalSteps > 0 ? ((currentStep + 1) / totalSteps) * 100 : 0

  const handleModeChange = (newMode: "create" | "run") => {
    setMode(newMode)
    onModeChange?.(newMode)
  }

  const getCourierStatusLabel = (status: string) => {
    const statusMap: Record<string, { en: string; ru: string }> = {
      assigned: { en: t.courier.statusAssigned, ru: t.courier.statusAssigned },
      taken_by_courier: { en: t.courier.statusTakenByCourier, ru: t.courier.statusTakenByCourier },
      waiting_for_code: { en: t.courier.statusWaitingForCode, ru: t.courier.statusWaitingForCode },
      code_received: { en: t.courier.statusCodeReceived, ru: t.courier.statusCodeReceived },
      locker_opened: { en: t.courier.statusLockerOpened, ru: t.courier.statusLockerOpened },
      parcel_placed: { en: t.courier.statusParcelPlaced, ru: t.courier.statusParcelPlaced },
      waiting_for_close: { en: t.courier.statusWaitingForClose, ru: t.courier.statusWaitingForClose },
      locker_closed: { en: t.courier.statusLockerClosed, ru: t.courier.statusLockerClosed },
      locker_did_not_open: { en: t.courier.statusLockerDidNotOpen, ru: t.courier.statusLockerDidNotOpen },
      locker_did_not_close: { en: t.courier.statusLockerDidNotClose, ru: t.courier.statusLockerDidNotClose },
      taken_from_exchange: { en: language === "ru" ? "Взят с биржи" : "Taken from exchange", ru: "Взят с биржи" },
      placed_in_cell: { en: language === "ru" ? "Положен в ячейку" : "Placed in cell", ru: "Положен в ячейку" },
      // New status translations
      waiting_for_code_retry: { en: "Waiting for code (retry)", ru: "Ожидание кода (повтор)" },
      code_received_retry: { en: "Code received (retry)", ru: "Код получен (повтор)" },
      request_code_again: { en: "Request code again", ru: "Запросить код снова" },
    }
    return statusMap[status]?.[language] || status
  }

  const filteredAssignedOrders = useMemo(() => {
    if (courierOrdersFilter === "all") {
      return assignedOrders
    } else if (courierOrdersFilter === "active") {
      return assignedOrders.filter((order) => order.status !== "locker_closed")
    } else {
      return assignedOrders.filter((order) => order.status === "locker_closed")
    }
  }, [assignedOrders, courierOrdersFilter])

  const renderCourierActionButtons = (order: any) => {
    const canCancel = !["parcel_placed", "waiting_for_close", "locker_closed"].includes(order.status)

    return (
      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          {/* Primary action button based on status */}
          {["taken_by_courier", "taken_from_exchange", "assigned_by_operator"].includes(order.status) && (
            <Button size="sm" onClick={() => handleCourierDeliveryAction(order.id, "get_code")}>
              {t.courier.getLockerCode}
            </Button>
          )}
          {order.status === "waiting_for_code" && (
            <Button size="sm" onClick={() => handleCourierDeliveryAction(order.id, "code_received")}>
              {t.courier.codeReceived}
            </Button>
          )}
          {order.status === "code_received" && (
            <Button size="sm" onClick={() => handleCourierDeliveryAction(order.id, "open_locker")}>
              {t.courier.enterCodeOpenLocker}
            </Button>
          )}
          {order.status === "waiting_for_code_retry" && (
            <>
              <Button size="sm" onClick={() => handleCourierDeliveryAction(order.id, "code_received_retry")}>
                {t.courier.codeReceived}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleCourierDeliveryAction(order.id, "request_code_again")}
              >
                {t.courier.requestCodeAgain}
              </Button>
            </>
          )}
          {order.status === "locker_opened" && (
            <Button size="sm" onClick={() => handleCourierDeliveryAction(order.id, "confirm_placed")}>
              {t.courier.confirmParcelPlaced}
            </Button>
          )}
          {order.status === "parcel_placed" && (
            <Button size="sm" onClick={() => handleCourierDeliveryAction(order.id, "close_locker")}>
              {t.courier.closeLocker}
            </Button>
          )}
          {order.status === "waiting_for_close" && (
            <Button size="sm" onClick={() => handleCourierDeliveryAction(order.id, "finish_delivery")}>
              {t.courier.finishDelivery}
            </Button>
          )}
          {order.status === "locker_closed" && (
            <Button size="sm" disabled>
              {t.courier.finishDelivery}
            </Button>
          )}

          {/* Cancel button */}
          {canCancel && (
            <Button size="sm" variant="outline" onClick={() => handleCancelCourierOrder(order.id)}>
              {t.courier.cancelOrder}
            </Button>
          )}
        </div>

        {/* Technical error actions */}
        {order.status === "locker_did_not_open" && (
          <div className="flex gap-2 mt-1">
            <Button size="sm" variant="destructive" onClick={() => handleCourierDeliveryAction(order.id, "retry_open")}>
              {t.courier.retryOpenLocker}
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleCourierDeliveryAction(order.id, "get_new_code")}
            >
              {t.courier.getNewCode}
            </Button>
          </div>
        )}
        {order.status === "locker_did_not_close" && (
          <div className="flex gap-2 mt-1">
            <Button
              size="sm"
              variant="destructive"
              onClick={() => handleCourierDeliveryAction(order.id, "retry_close")}
            >
              {t.courier.retryCloseLocker}
            </Button>
            <Button size="sm" variant="destructive" onClick={() => handleCourierDeliveryAction(order.id, "reopen")}>
              {t.courier.reopenLocker}
            </Button>
          </div>
        )}

        {/* Show "Locker did not open" only after trying to open (locker_opened state) */}
        {order.status === "locker_opened" && (
          <Button
            size="sm"
            variant="ghost"
            className="text-xs"
            onClick={() => {
              handleCourierDeliveryAction(order.id, "locker_did_not_open")
              // Transition to a new state for handling this specific error
              setAssignedOrders((prevOrders) =>
                prevOrders.map((o) => (o.id === order.id ? { ...o, status: "waiting_for_code_retry" } : o)),
              )
            }}
          >
            {t.courier.lockerDidNotOpen}
          </Button>
        )}
        {order.status === "waiting_for_close" && (
          <Button
            size="sm"
            variant="ghost"
            className="text-xs"
            onClick={() => handleCourierDeliveryAction(order.id, "locker_did_not_close")}
          >
            {t.courier.lockerDidNotClose}
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="p-4 border-b border-border bg-card">
        <RadioGroup value={mode} onValueChange={handleModeChange} className="flex gap-4">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="create" id="create" />
            <Label htmlFor="create">{t.modes.create}</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="run" id="run" />
            <Label htmlFor="run">{t.modes.run}</Label>
          </div>
        </RadioGroup>

        {mode === "run" && (
          <div className="mt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="test-id" className="text-xs">
                  {t.execution.testId}
                </Label>
                <Select
                  value={selectedTestId}
                  onValueChange={(v) => {
                    setSelectedTestId(v)
                    const test = mockTests.find((t) => t.id.toString() === v)
                    if (test) setTotalSteps(test.steps)
                    setCurrentStep(0)
                  }}
                >
                  <SelectTrigger id="test-id" className="h-8">
                    <SelectValue placeholder={t.execution.selectTest} />
                  </SelectTrigger>
                  <SelectContent>
                    {mockTests.map((test) => (
                      <SelectItem key={test.id} value={test.id.toString()}>
                        {test.id} - {test.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="exec-mode" className="text-xs">
                  {t.execution.stepByStep} / {t.execution.auto}
                </Label>
                <Select value={executionMode} onValueChange={(v) => setExecutionMode(v as "step" | "auto")}>
                  <SelectTrigger id="exec-mode" className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="step">{t.execution.stepByStep}</SelectItem>
                    <SelectItem value="auto">{t.execution.auto}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {executionMode === "auto" && (
              <div>
                <Label htmlFor="delay" className="text-xs">
                  {t.execution.delayBetweenSteps}
                </Label>
                <Input
                  id="delay"
                  type="number"
                  min="1"
                  max="10"
                  value={delaySeconds}
                  onChange={(e) => setDelaySeconds(e.target.value)}
                  className="h-8"
                />
              </div>
            )}

            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={handleStepBackward} disabled={currentStep === 0}>
                ⏮
              </Button>
              <Button size="sm" variant="outline" onClick={handlePlayPause}>
                {executionMode === "auto" && isPlaying ? "⏸" : "▶"}
              </Button>
              <Button size="sm" variant="outline" onClick={handleStepForward} disabled={currentStep >= totalSteps - 1}>
                ⏭
              </Button>
              <span className="text-sm text-muted-foreground ml-2">
                {t.execution.step} {currentStep + 1}/{totalSteps}
              </span>
            </div>
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>{t.execution.progress}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          </div>
        )}
      </div>

      <Tabs
        defaultValue="client"
        className="flex-1 flex flex-col overflow-hidden"
        onValueChange={(value) => onTabChange?.(value)}
      >
        <TabsList className="w-full justify-start px-4 pt-2 bg-background">
          <TabsTrigger
            value="client"
            className={highlightedTab === "client" ? "animate-pulse bg-primary text-primary-foreground" : ""}
          >
            {t.roles.client}
          </TabsTrigger>
          <TabsTrigger
            value="recipient"
            className={highlightedTab === "recipient" ? "animate-pulse bg-primary text-primary-foreground" : ""}
          >
            {t.roles.recipient}
          </TabsTrigger>
          <TabsTrigger
            value="courier"
            className={highlightedTab === "courier" ? "animate-pulse bg-primary text-primary-foreground" : ""}
          >
            {t.roles.courier}
          </TabsTrigger>
          <TabsTrigger
            value="driver"
            className={highlightedTab === "driver" ? "animate-pulse bg-primary text-primary-foreground" : ""}
          >
            {t.roles.driver}
          </TabsTrigger>
          <TabsTrigger
            value="operator"
            className={highlightedTab === "operator" ? "animate-pulse bg-primary text-primary-foreground" : ""}
          >
            {t.roles.operator}
          </TabsTrigger>
          <TabsTrigger
            value="fsm"
            className={highlightedTab === "fsm" ? "animate-pulse bg-primary text-primary-foreground" : ""}
          >
            {t.roles.fsm}
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-auto p-4">
          <TabsContent value="client" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle>{t.client.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {mode === "create" && (
                  <div>
                    <Label htmlFor="client-user-id">{t.client.userId}</Label>
                    <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                      <SelectTrigger id="client-user-id">
                        <SelectValue placeholder={t.client.selectUserId} />
                      </SelectTrigger>
                      <SelectContent>
                        {[1001, 1002, 1003, 1004, 1005].map((id) => (
                          <SelectItem key={id} value={id.toString()}>
                            {language === "ru" ? "Клиент" : "Client"} #{id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {createdOrderId && !clientOrders.some(o => o.isLoading) && (
                  <div>
                    <Badge variant="default" className="bg-green-600">
                      {t.client.orderId}: {createdOrderId}
                    </Badge>
                  </div>
                )}

                <div className="grid gap-4">
                  <div>
                    <Label htmlFor="parcel-type">{t.client.parcelType}</Label>
                    <Select value={parcelType} onValueChange={setParcelType}>
                      <SelectTrigger id="parcel-type">
                        <SelectValue placeholder={t.client.selectParcelType} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="parcel">{t.client.parcel}</SelectItem>
                        <SelectItem value="letter">{t.client.letter}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="cell-size">{t.client.cellSize}</Label>
                    <Select value={cellSize} onValueChange={setCellSize} disabled={parcelType === "letter"}>
                      <SelectTrigger id="cell-size">
                        <SelectValue placeholder={t.client.selectCellSize} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="S">S</SelectItem>
                        <SelectItem value="M">M</SelectItem>
                        <SelectItem value="L">L</SelectItem>
                        <SelectItem value="P">P (Letter)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="sender-delivery">{t.client.senderDelivery}</Label>
                    <Select value={senderDelivery} onValueChange={setSenderDelivery}>
                      <SelectTrigger id="sender-delivery">
                        <SelectValue placeholder={t.client.selectDeliveryType} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="courier">{t.client.courier}</SelectItem>
                        <SelectItem value="self">{t.client.selfService}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="recipient-delivery">{t.client.recipientDelivery}</Label>
                    <Select value={recipientDelivery} onValueChange={setRecipientDelivery}>
                      <SelectTrigger id="recipient-delivery">
                        <SelectValue placeholder={t.client.selectDeliveryType} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="courier">{t.client.courier}</SelectItem>
                        <SelectItem value="self">{t.client.selfService}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  <Button
                    onClick={handleCreateOrder}
                    disabled={!parcelType || !cellSize || !senderDelivery || !recipientDelivery}
                    className={highlightedAction === "create_order" ? "animate-pulse" : ""}
                  >
                    {t.client.createOrder}
                  </Button>
                </div>

                {clientOrders.length > 0 && (
                  <div className="mt-6">
                    <h3 className="font-semibold mb-3">{t.client.myOrders}</h3>
                    <div className="border rounded-lg overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t.client.orderId}</TableHead>
                            <TableHead className="hidden md:table-cell">{t.client.parcelType}</TableHead>
                            <TableHead className="hidden md:table-cell">{t.client.cellSize}</TableHead>
                            <TableHead>{t.client.status}</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {clientOrders.map((order) => (
                            <TableRow key={order.correlationId || order.id}>  {/* ИЗМЕНЕНО - используем correlationId как ключ */}
                              <TableCell>
                                {order.isLoading ? (  // ДОБАВЛЕНО - индикатор загрузки
                                  <div className="flex items-center gap-2">
                                    <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                                    <span className="text-sm text-muted-foreground">
                                      {language === "ru" ? "Создание..." : "Creating..."}
                                    </span>
                                  </div>
                                ) : (
                                  order.id
                                )}
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                {order.isLoading ? (  // ДОБАВЛЕНО - заглушка для типа посылки
                                  <div className="h-4 w-16 bg-muted animate-pulse rounded" />
                                ) : (
                                  order.parcelType === "parcel" ? t.client.parcel : t.client.letter
                                )}
                              </TableCell>
                              <TableCell className="hidden md:table-cell">
                                {order.isLoading ? (  // ДОБАВЛЕНО - заглушка для размера
                                  <div className="h-4 w-8 bg-muted animate-pulse rounded" />
                                ) : (
                                  order.cellSize
                                )}
                              </TableCell>
                              <TableCell>
                                {order.isLoading ? (  // ДОБАВЛЕНО - заглушка для статуса
                                  <div className="h-5 w-24 bg-muted animate-pulse rounded-full" />
                                ) : (
                                  <Badge variant={order.status === "cancelled" ? "destructive" : order.status === "processing" ? "secondary" : "default"}>
                                    {order.status === "processing" ? t.client.statusProcessing : order.status}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell>
                                {!order.isLoading && (  // ДОБАВЛЕНО - скрываем кнопки во время загрузки
                                  order.canCancel ? (
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => handleCancelClientOrder(order.id)}
                                      className={highlightedAction === "cancel_order" ? "animate-pulse" : ""}
                                    >
                                      {t.client.cancelOrder}
                                    </Button>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">{t.client.cannotCancel}</span>
                                  )
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="recipient" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle>{t.recipient.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">{t.recipient.testOrders}</h3>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">{t.recipient.testOrdersDesc}</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="bg-blue-600">
                        101
                      </Badge>
                      <span className="text-sm text-blue-800 dark:text-blue-200">
                        {language === "ru"
                          ? 'Поступил в постамат получения (Самовывоз) → кнопка "Забрать"'
                          : 'Arrived at Recipient Locker (Self-pickup) → "Pick Up" button'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="bg-blue-600">
                        102
                      </Badge>
                      <span className="text-sm text-blue-800 dark:text-blue-200">
                        {language === "ru"
                          ? 'Доставлен курьером → кнопка "Подтвердить"'
                          : 'Delivered by Courier → "Confirm" button'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="default" className="bg-blue-600">
                        103
                      </Badge>
                      <span className="text-sm text-blue-800 dark:text-blue-200">
                        {language === "ru" ? "В пути → кнопки неактивны" : "In Transit → buttons inactive"}
                      </span>
                    </div>
                  </div>
                </div>

                {mode === "create" && (
                  <div>
                    <Label htmlFor="recipient-user-id">{t.recipient.userId}</Label>
                    <Select value={selectedRecipientId} onValueChange={setSelectedRecipientId}>
                      <SelectTrigger id="recipient-user-id">
                        <SelectValue placeholder={t.recipient.selectUserId} />
                      </SelectTrigger>
                      <SelectContent>
                        {[2001, 2002, 2003, 2004, 2005].map((id) => (
                          <SelectItem key={id} value={id.toString()}>
                            {language === "ru" ? "Получатель" : "Recipient"} #{id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <Label htmlFor="recipient-order-id">{t.recipient.orderId}</Label>
                    <div className="flex gap-2">
                      <Input
                        id="recipient-order-id"
                        type="number"
                        placeholder={t.recipient.enterOrderId}
                        value={recipientOrderId}
                        onChange={(e) => setRecipientOrderId(e.target.value)}
                      />
                      <Button onClick={handleRecipientLookup} disabled={!recipientOrderId}>
                        {t.recipient.trackingHistory}
                      </Button>
                    </div>
                  </div>

                  {recipientOrderDetails && (
                    <div className="space-y-3 p-4 bg-muted rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{t.recipient.orderId}:</span>
                        <Badge variant="default">{recipientOrderDetails.id}</Badge>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{t.recipient.locker}:</span>
                        <span>{recipientOrderDetails.locker}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{t.recipient.cell}:</span>
                        <Badge variant="outline">{recipientOrderDetails.cell}</Badge>
                      </div>
                    </div>
                  )}

                  {recipientTracking.length > 0 ? (
                    <div>
                      <h3 className="font-semibold mb-3">{t.recipient.trackingHistory}</h3>
                      <div className="border rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>{t.recipient.status}</TableHead>
                              <TableHead>{t.recipient.date}</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {recipientTracking.map((track, idx) => (
                              <TableRow key={idx}>
                                <TableCell>
                                  <Badge variant={idx === recipientTracking.length - 1 ? "default" : "secondary"}>
                                    {track.status}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {track.date} {track.time}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  ) : (
                    recipientOrderId && (
                      <div className="text-sm text-muted-foreground p-4 bg-muted rounded-lg">
                        {t.recipient.noTracking}
                      </div>
                    )
                  )}
                </div>

                <div className="flex gap-2 flex-wrap">
                  {recipientOrderDetails &&
                    recipientOrderDetails.currentStatus === "Поступил в постамат получения" &&
                    recipientOrderDetails.recipientDelivery === "self" && (
                      <Button
                        onClick={() =>
                          handleAction("recipient", "pickup_from_locker", { order_id: recipientOrderDetails.id })
                        }
                        className={highlightedAction === "pickup_from_locker" ? "animate-pulse" : ""}
                      >
                        {t.recipient.pickupFromLocker}
                      </Button>
                    )}

                  {recipientOrderDetails &&
                    recipientOrderDetails.currentStatus === "Доставлен курьером" &&
                    recipientOrderDetails.recipientDelivery === "courier" && (
                      <Button
                        onClick={() =>
                          handleAction("recipient", "confirm_delivery", { order_id: recipientOrderDetails.id })
                        }
                        className={highlightedAction === "confirm_delivery" ? "animate-pulse" : ""}
                      >
                        {t.recipient.confirmDelivery}
                      </Button>
                    )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="courier" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle>{t.courier.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {mode === "create" && (
                  <div>
                    <Label htmlFor="courier-id">{t.courier.courierId}</Label>
                    <Select value={selectedCourierId} onValueChange={setSelectedCourierId}>
                      <SelectTrigger id="courier-id">
                        <SelectValue placeholder={t.courier.selectCourierId} />
                      </SelectTrigger>
                      <SelectContent>
                        {mockCouriers.map((courier) => (
                          <SelectItem key={courier.id} value={courier.id.toString()}>
                            {courier.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <h3 className="font-semibold mb-3">{t.courier.availableOrders}</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t.courier.orderId}</TableHead>
                          <TableHead>{t.courier.locker}</TableHead>
                          <TableHead>{t.courier.cell}</TableHead>
                          <TableHead>{t.courier.size}</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {availableOrders.map((order) => (
                          <TableRow key={order.id}>
                            <TableCell>{order.id}</TableCell>
                            <TableCell>{mockLockers.find((l) => l.id === order.lockerId)?.address}</TableCell>
                            <TableCell>{order.cell}</TableCell>
                            <TableCell>{order.size}</TableCell>
                            <TableCell>
                              <Button size="sm" onClick={() => handleTakeOrder(order.id)}>
                                {t.courier.takeOrder}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{t.courier.assignedOrders}</h3>
                    <div className="flex gap-1">
                      <Button
                        variant={courierOrdersFilter === "all" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCourierOrdersFilter("all")}
                      >
                        {t.driver.all}
                      </Button>
                      <Button
                        variant={courierOrdersFilter === "active" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCourierOrdersFilter("active")}
                      >
                        {t.driver.active}
                      </Button>
                      <Button
                        variant={courierOrdersFilter === "archive" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCourierOrdersFilter("archive")}
                      >
                        {t.driver.archive}
                      </Button>
                    </div>
                  </div>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t.courier.orderId}</TableHead>
                          <TableHead>{t.courier.status}</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredAssignedOrders.map((order) => (
                          <TableRow key={order.id}>
                            <TableCell>{order.id}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  ["locker_did_not_open", "locker_did_not_close"].includes(order.status)
                                    ? "destructive"
                                    : order.status === "locker_closed"
                                      ? "secondary"
                                      : "default"
                                }
                              >
                                {getCourierStatusLabel(order.status)}
                              </Badge>
                            </TableCell>
                            <TableCell>{renderCourierActionButtons(order)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="driver" className="mt-0">
            <Card>
              <CardHeader>
                <CardTitle>{t.driver.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {mode === "create" && (
                  <div>
                    <Label htmlFor="driver-id">{t.driver.driverId}</Label>
                    <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
                      <SelectTrigger id="driver-id">
                        <SelectValue placeholder={t.driver.selectDriverId} />
                      </SelectTrigger>
                      <SelectContent>
                        {[200, 201, 202, 203, 204].map((id) => (
                          <SelectItem key={id} value={id.toString()}>
                            {language === "ru" ? "Водитель" : "Driver"} #{id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div>
                  <h3 className="font-semibold mb-3">{t.driver.tripExchange}</h3>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t.driver.tripId}</TableHead>
                          <TableHead>{t.driver.locker}</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {driverAvailableOrders.map((order) => (
                          <TableRow key={order.id}>
                            <TableCell>{order.tripId}</TableCell>
                            <TableCell>{mockLockers.find((l) => l.id === order.lockerId)?.address}</TableCell>
                            <TableCell>
                              <Button size="sm" onClick={() => handleTakeDriverOrder(order.id)}>
                                {t.driver.takeOrder}
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-semibold">{t.driver.tripFeed}</h3>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={tripFeedFilter === "all" ? "default" : "outline"}
                        onClick={() => setTripFeedFilter("all")}
                      >
                        {t.driver.all}
                      </Button>
                      <Button
                        size="sm"
                        variant={tripFeedFilter === "active" ? "default" : "outline"}
                        onClick={() => setTripFeedFilter("active")}
                      >
                        {t.driver.active}
                      </Button>
                      <Button
                        size="sm"
                        variant={tripFeedFilter === "archive" ? "default" : "outline"}
                        onClick={() => setTripFeedFilter("archive")}
                      >
                        {t.driver.archive}
                      </Button>
                    </div>
                  </div>
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t.driver.tripId}</TableHead>
                          <TableHead>{t.driver.status}</TableHead>
                          <TableHead>{t.driver.tripStatus}</TableHead>
                          <TableHead></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {driverAssignedOrders
                          .filter((order) => {
                            if (tripFeedFilter === "active") {
                              return order.tripStatus !== "completed"
                            } else if (tripFeedFilter === "archive") {
                              return order.tripStatus === "completed"
                            }
                            return true
                          })
                          .map((order) => (
                            <TableRow key={order.id}>
                              <TableCell>{order.tripId}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={order.status === "taken_from_exchange_driver" ? "default" : "secondary"}
                                >
                                  {order.status === "taken_from_exchange_driver"
                                    ? language === "ru"
                                      ? "Взят с биржи"
                                      : "Taken from exchange"
                                    : language === "ru"
                                      ? "Назначен оператором"
                                      : "Assigned by operator"}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {order.tripStatus === "at_from_locker"
                                    ? t.driver.atLockerFrom
                                    : order.tripStatus === "in_transit"
                                      ? t.driver.inTransit
                                      : order.tripStatus === "at_to_locker"
                                        ? t.driver.atLockerTo
                                        : language === "ru"
                                          ? "Завершен"
                                          : "Completed"}
                                </Badge>
                              </TableCell>
                              <TableCell className="space-x-2">
                                {/* CHANGE: Show different buttons based on trip status */}
                                {order.tripStatus === "in_transit" ? (
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      setActiveTripId(order.tripId)
                                      setTripId(order.tripId)
                                      handleChangeTripState("at_to_locker")
                                    }}
                                  >
                                    {t.driver.arrived}
                                  </Button>
                                ) : order.tripStatus !== "completed" && order.tripStatus !== "at_to_locker" ? (
                                  <Button
                                    size="sm"
                                    onClick={() => handleStartTrip(order.tripId)}
                                    disabled={hasActiveTrip}
                                  >
                                    {t.driver.startTrip}
                                  </Button>
                                ) : null}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleCancelDriverOrder(order.id)}
                                  disabled={order.tripStatus === "completed"}
                                >
                                  {t.driver.cancelOrder}
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>

                {tripId && (
                  <div className="border-t pt-6">
                    <h3 className="font-semibold mb-4">{t.driver.activeTrip}</h3>
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <Badge variant="default" className="bg-blue-600">
                          {t.driver.tripId}: {tripId}
                        </Badge>
                        <Badge variant="outline" className="text-base px-3 py-1">
                          {tripState === "at_from_locker"
                            ? t.driver.atLockerFrom
                            : tripState === "in_transit"
                              ? t.driver.inTransit
                              : t.driver.atLockerTo}
                        </Badge>
                      </div>

                      <div>
                        <h3 className="font-semibold mb-3">{t.driver.directOrders}</h3>
                        <div className="border rounded-lg overflow-hidden">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead className="w-12"></TableHead>
                                <TableHead>{t.driver.orderId}</TableHead>
                                <TableHead>{t.driver.cellFrom}</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {directOrders.map((order) => {
                                const isTaken = takenDirectOrders.includes(order.id)
                                const canCheck = tripState === "at_from_locker" && !isTaken
                                return (
                                  <TableRow key={order.id}>
                                    <TableCell>
                                      <Checkbox
                                        checked={selectedDirectOrders.includes(order.id) || isTaken}
                                        disabled={!canCheck}
                                        onCheckedChange={(checked) => {
                                          if (checked) {
                                            setSelectedDirectOrders([...selectedDirectOrders, order.id])
                                          } else {
                                            setSelectedDirectOrders(
                                              selectedDirectOrders.filter((id) => id !== order.id),
                                            )
                                          }
                                        }}
                                      />
                                    </TableCell>
                                    <TableCell>{order.id}</TableCell>
                                    <TableCell>
                                      {order.cell}
                                      {isTaken && (
                                        <Badge variant="secondary" className="ml-2">
                                          {language === "ru" ? "Взят" : "Taken"}
                                        </Badge>
                                      )}
                                    </TableCell>
                                  </TableRow>
                                )
                              })}
                            </TableBody>
                          </Table>
                        </div>
                        <div className="flex gap-2 mt-3">
                          {tripState === "at_from_locker" && (
                            <Button
                              size="sm"
                              onClick={handleTakeSelectedOrders}
                              disabled={selectedDirectOrders.length === 0}
                              className={highlightedAction === "take_orders" ? "animate-pulse" : ""}
                            >
                              {t.driver.takeSelected}
                            </Button>
                          )}
                          {tripState === "in_transit" && (
                            <Button
                              size="sm"
                              onClick={() => handleChangeTripState("at_to_locker")}
                              className={highlightedAction === "arrive_at_locker" ? "animate-pulse" : ""}
                            >
                              {t.driver.arrived}
                            </Button>
                          )}
                        </div>
                      </div>

                      {tripState !== "at_to_locker" ? (
                        <div>
                          <h3 className="font-semibold mb-3">{t.driver.reverseOrders}</h3>
                          <div className="border rounded-lg overflow-hidden">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-12"></TableHead>
                                  <TableHead>{t.driver.orderId}</TableHead>
                                  <TableHead>{t.driver.cellFrom}</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {reverseOrders.map((order) => {
                                  const isTaken = takenReverseOrders.includes(order.id)
                                  const canCheck = tripState === "at_to_locker" && !isTaken
                                  return (
                                    <TableRow key={order.id}>
                                      <TableCell>
                                        <Checkbox
                                          checked={selectedReverseOrders.includes(order.id) || isTaken}
                                          disabled={!canCheck}
                                          onCheckedChange={(checked) => {
                                            if (checked) {
                                              setSelectedReverseOrders([...selectedReverseOrders, order.id])
                                            } else {
                                              setSelectedReverseOrders(
                                                selectedReverseOrders.filter((id) => id !== order.id),
                                              )
                                            }
                                          }}
                                        />
                                      </TableCell>
                                      <TableCell>{order.id}</TableCell>
                                      <TableCell>
                                        {order.cell}
                                        {isTaken && (
                                          <Badge variant="secondary" className="ml-2">
                                            {language === "ru" ? "Взят" : "Taken"}
                                          </Badge>
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  )
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold">{t.driver.freeCells}</h3>
                            <Button size="sm" variant="outline" onClick={() => setShowPlacedOrders(!showPlacedOrders)}>
                              {t.driver.showPlacedOrders}
                            </Button>
                          </div>

                          {showPlacedOrders ? (
                            <div className="border rounded-lg overflow-hidden">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>{t.driver.cell}</TableHead>
                                    <TableHead>{t.driver.size}</TableHead>
                                    <TableHead>{t.driver.orderId}</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {Object.entries(placedParcels).map(([cellNumber, parcel]) => (
                                    <TableRow key={cellNumber}>
                                      <TableCell>{cellNumber}</TableCell>
                                      <TableCell>{parcel.originalSize}</TableCell>
                                      <TableCell>
                                        <Badge variant="default">#{parcel.orderId}</Badge>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          ) : (
                            <div className="border rounded-lg overflow-hidden">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>{t.driver.cell}</TableHead>
                                    <TableHead>{t.driver.size}</TableHead>
                                    <TableHead>
                                      {t.driver.orderId} / {t.driver.placeInCell}
                                    </TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {freeCells.map((cell) => {
                                    const sizeOrder = { P: 1, S: 2, M: 3, L: 4 }
                                    const cellSizeValue = sizeOrder[cell.size as keyof typeof sizeOrder] || 0

                                    const availableOrders = [...takenDirectOrders, ...takenReverseOrders]
                                      .map((orderId) => {
                                        const order = [...directOrders, ...reverseOrders].find((o) => o.id === orderId)
                                        return order
                                      })
                                      .filter((order) => {
                                        if (!order) return false
                                        const orderSize = sizeOrder[order.size as keyof typeof sizeOrder] || 0
                                        // Only show orders of the same size as the cell
                                        return orderSize <= cellSizeValue && order.size === cell.size
                                      })

                                    return (
                                      <TableRow key={cell.number}>
                                        <TableCell>{cell.number}</TableCell>
                                        <TableCell>{cell.size}</TableCell>
                                        <TableCell>
                                          {placedParcels[cell.number] ? (
                                            <Badge variant="default">#{placedParcels[cell.number].orderId}</Badge>
                                          ) : availableOrders.length > 0 ? (
                                            <Select
                                              onValueChange={(orderId) =>
                                                handlePlaceParcelInCell(Number.parseInt(orderId), cell.number)
                                              }
                                            >
                                              <SelectTrigger className="w-40">
                                                <SelectValue placeholder={t.driver.placeInCell} />
                                              </SelectTrigger>
                                              <SelectContent>
                                                {availableOrders.map((order) => (
                                                  <SelectItem key={order!.id} value={order!.id.toString()}>
                                                    {language === "ru" ? "Заказ" : "Order"} #{order!.id}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          ) : (
                                            <span className="text-xs text-muted-foreground">
                                              {language === "ru" ? "Нет заказов" : "No orders"}
                                            </span>
                                          )}
                                        </TableCell>
                                      </TableRow>
                                    )
                                  })}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                          <div className="flex gap-2 mt-3">
                            {takenDirectOrders.length === 0 &&
                              takenReverseOrders.length === 0 &&
                              Object.keys(placedParcels).length > 0 && (
                                <Button
                                  onClick={handleCloseOrder}
                                  className={highlightedAction === "close_order" ? "animate-pulse" : ""}
                                >
                                  {t.driver.closeOrder}
                                </Button>
                              )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="operator" className="mt-0">
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
                          <TableHead>{t.operator.tripId}</TableHead>
                          <TableHead>{t.operator.locker}</TableHead>
                          <TableHead>{t.operator.status}</TableHead>
                          <TableHead>{t.operator.waitingTime}</TableHead>
                          <TableHead>{t.operator.driver}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {/* Sort by waiting time (newest first) */}
                        {[...driverAvailableOrders, ...driverAssignedOrders]
                          .filter((trip) => trip.tripStatus !== "completed")
                          .sort((a, b) => {
                            // Mock creation dates for sorting
                            const dateA = new Date(2025, 0, 20, 10, 0)
                            const dateB = new Date(2025, 0, 20, 11, 0)
                            return dateB.getTime() - dateA.getTime()
                          })
                          .map((trip) => {
                            const locker = mockLockers.find((l) => l.id === trip.lockerId)
                            const waitTime = calculateWaitingTime(new Date(2025, 0, 20, 10, 0))
                            const hasDrive = trip.driverId !== null && trip.driverId !== undefined

                            return (
                              <TableRow key={trip.tripId}>
                                <TableCell>{trip.tripId}</TableCell>
                                <TableCell>{locker?.address}</TableCell>
                                <TableCell>
                                  <Badge variant={trip.status === "available_for_driver" ? "secondary" : "default"}>
                                    {trip.status === "available_for_driver"
                                      ? language === "ru"
                                        ? "Доступен"
                                        : "Available"
                                      : trip.status === "taken_from_exchange_driver"
                                        ? language === "ru"
                                          ? "Взят с биржи"
                                          : "Taken from exchange"
                                        : language === "ru"
                                          ? "Назначен оператором"
                                          : "Assigned by operator"}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  {waitTime.hours > 0 && `${waitTime.hours}${t.operator.hours} `}
                                  {waitTime.minutes}
                                  {t.operator.minutes}
                                </TableCell>
                                <TableCell className="space-x-2">
                                  {hasDrive ? (
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm">
                                        {language === "ru" ? "Водитель" : "Driver"} #{trip.driverId}
                                      </span>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleRemoveDriver(trip.tripId)}
                                      >
                                        {t.operator.remove}
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <Select
                                        value={selectedDrivers[trip.tripId] || ""}
                                        onValueChange={(v) =>
                                          setSelectedDrivers({ ...selectedDrivers, [trip.tripId]: v })
                                        }
                                      >
                                        <SelectTrigger className="w-40">
                                          <SelectValue placeholder={t.operator.selectDriver} />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {[200, 201, 202, 203, 204].map((driverId) => (
                                            <SelectItem key={driverId} value={driverId.toString()}>
                                              {language === "ru" ? "Водитель" : "Driver"} #{driverId}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      <Button
                                        size="sm"
                                        onClick={() => handleAssignDriver(trip.tripId)}
                                        disabled={!selectedDrivers[trip.tripId]}
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
          </TabsContent>

          <TabsContent value="fsm" className="mt-0">
            <FSMEmulator addLog={addLog} highlightedAction={highlightedAction} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

const mockTests = [
  { id: 1, name: "Client creates order", steps: 5 },
  { id: 2, name: "FSM: reserve_cell on order", steps: 4 },
  { id: 3, name: "Driver bulk delivery", steps: 6 },
]
