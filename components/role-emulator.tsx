"use client"
import React, { useState, useEffect, useMemo, useRef } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FSMEmulator } from "@/components/fsm-emulator"
import { useLanguage } from "@/lib/language-context"
import { enqueueFsmRequest, fetchOrderTrack, makeFsmEnqueueRequest, fetchOrdersByClient, startDriverLoading, fetchDriverReservations } from "@/lib/api"
import {
  mockLockers,
  mockOrders,
  mockCouriers,
  mockOrderTracking,
  mockOrderDetails,
  mockDriverExchangeOrders,
  mockDriverAssignedOrders,
  mockLockerCells,
} from "@/lib/mock-data"
import { ClientForm } from "./client-form"
import { CourierForm } from "./courier-form";
import { DriverForm } from "./driver-form"
import { RecipientForm } from "./recipient-form"
import { OperatorForm } from "./operator-form"
interface RoleEmulatorProps {
  addLog: (log: any) => void
  currentTest: any
  onModeChange?: (mode: "create" | "run") => void
  onTabChange?: (tab: string) => void
}

interface User {
  id: number;
  name: string;
  role_name: string;
  city: string | null;
  phone: string | null;
}

export function RoleEmulator({ addLog, currentTest, onModeChange, onTabChange }: RoleEmulatorProps) {
  const [mode, setMode] = useState<"create" | "run">("create")
  const [selectedClientId, setSelectedClientId] = useState<string>("1001")
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>("2001")
  const [selectedCourierId, setSelectedCourierId] = useState<string>("100")
  const [selectedDriverId, setSelectedDriverId] = useState<string>("200")
  const [ordersFilter, setOrdersFilter] = useState<"in" | "out">("in");
  const [recipientUserId, setRecipientUserId] = useState<string>("");
  const [selectedCity, setSelectedCity] = useState<string>("");
const [users, setUsers] = useState<User[]>([]);
const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [clientOrders, setClientOrders] = useState<
    Array<{
      id: number
      description: string
      status: string
      canCancel: boolean
      correlationId?: string
      isLoading?: boolean
    }>
  >([])
  const [orderMessage, setOrderMessage] = useState<string | null>(null)
  const [courierMessage, setCourierMessage] = useState<string | null>(null)
  const [parcelType, setParcelType] = useState("")
  const [cellSize, setCellSize] = useState("")
  const [senderDelivery, setSenderDelivery] = useState("")
  const [recipientDelivery, setRecipientDelivery] = useState("")

  const [availableOrders, setAvailableOrders] = useState<any[]>([])
  const [assignedOrders, setAssignedOrders] = useState<any[]>([])

  const [driverAvailableOrders, setDriverAvailableOrders] = useState<any[]>(mockDriverExchangeOrders)
  const [driverAssignedOrders, setDriverAssignedOrders] = useState<any[]>(mockDriverAssignedOrders)
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

  const [reserves, setReserves] = useState<{ [orderId: number]: string }>({})
  const [driverReservations, setDriverReservations] = useState<any[]>([])
  const [loadingOrders, setLoadingOrders] = useState<any[]>([])
  const [currentDirectionId, setCurrentDirectionId] = useState<number | null>(null)

  const [currentStep, setCurrentStep] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [highlightedTab, setHighlightedTab] = useState<string | null>(null)
  const [highlightedAction, setHighlightedAction] = useState<string | null>(null)
  const [selectedTestId, setSelectedTestId] = useState<string>("1")
  const [executionMode, setExecutionMode] = useState<"step" | "auto">("step")
  const [delaySeconds, setDelaySeconds] = useState("2")
  const [totalSteps, setTotalSteps] = useState(5)
  const { t, language } = useLanguage()

  const [courierOrdersFilter, setCourierOrdersFilter] = useState<"all" | "active" | "archive">("active")
const [isRefreshingCourier, setIsRefreshingCourier] = useState(false)
const [isRefreshingDriver, setIsRefreshingDriver] = useState(false)
const [isRefreshingDriverReservations, setIsRefreshingDriverReservations] = useState(false)
const [isRefreshingDriverExchange, setIsRefreshingDriverExchange] = useState(false)
const [isRefreshingClient, setIsRefreshingClient] = useState(false)
const [isTabActive, setIsTabActive] = useState(true)
const [pollingInterval, setPollingInterval] = useState(20000)
const [lastFetchTime, setLastFetchTime] = useState<{ [key: string]: number }>({})

  const courierIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const clientIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const driverReservationsIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const driverExchangeIntervalRef = useRef<NodeJS.Timeout | null>(null)
  
useEffect(() => {
  fetchUsers();
}, []);

useEffect(() => {
  if (!isTabActive) return
  refreshCourierOrders();
    const doPoll = async () => {
    const now = Date.now()
    const lastFetch = lastFetchTime['courier'] || 0
    
    if (now - lastFetch < pollingInterval - 1000) {
      return
    }
    
    setLastFetchTime(prev => ({ ...prev, courier: now }))
    
    const startTime = Date.now()
    await refreshCourierOrders()
    const duration = Date.now() - startTime
    
    if (duration > 3000) {
      console.warn('Slow courier request, increasing interval')
      setPollingInterval(prev => Math.min(prev * 1.5, 60000))
    } else if (duration < 500 && pollingInterval > 20000) {
      setPollingInterval(20000)
    }
  }
  
  if (courierIntervalRef.current) clearInterval(courierIntervalRef.current)
  courierIntervalRef.current = setInterval(doPoll, pollingInterval)
  
  return () => {
    if (courierIntervalRef.current) clearInterval(courierIntervalRef.current)
  }
}, [selectedCourierId, isTabActive, pollingInterval, lastFetchTime])

useEffect(() => {
  if (selectedClientId) {
    loadClientOrders();
  }
}, [selectedClientId]);

useEffect(() => {
  if (!isTabActive || !selectedClientId) return;

  loadClientOrders();

  if (clientIntervalRef.current) clearInterval(clientIntervalRef.current);
  clientIntervalRef.current = setInterval(loadClientOrders, pollingInterval);

  return () => {
    if (clientIntervalRef.current) clearInterval(clientIntervalRef.current);
  };
}, [selectedClientId, isTabActive, pollingInterval, lastFetchTime]);

// ========== УМНЫЙ POLLING ДЛЯ КЛИЕНТА ==========
useEffect(() => {
  if (clientOrders.length === 0 || !isTabActive) return

  loadClientOrders()

  
  const doPoll = async () => {
    const now = Date.now()
    const lastFetch = lastFetchTime['client'] || 0

    
    if (now - lastFetch < pollingInterval - 1000) {
      return 
    }

    setLastFetchTime(prev => ({ ...prev, client: now }))

    const startTime = Date.now()
    await loadClientOrders()
    const duration = Date.now() - startTime

    if (duration > 3000) {
      console.warn('Slow client request, increasing interval')
      setPollingInterval(prev => Math.min(prev * 1.5, 60000))
    } else if (duration < 1000 && pollingInterval > 5000) {
      setPollingInterval(prev => Math.max(prev / 1.5, 5000))
    }
  }

  if (clientIntervalRef.current) clearInterval(clientIntervalRef.current)
  clientIntervalRef.current = setInterval(doPoll, pollingInterval)

  return () => {
    if (clientIntervalRef.current) clearInterval(clientIntervalRef.current)
  }
}, [clientOrders.length, isTabActive, pollingInterval, lastFetchTime])

useEffect(() => {
  const handleVisibilityChange = () => {
    setIsTabActive(!document.hidden)
  }
  
  document.addEventListener('visibilitychange', handleVisibilityChange)
  return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
}, [])

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

        if (activeTrip.tripStatus === "at_to_locker") {
          const cells = mockLockerCells.filter((c) => c.lockerId === toLockerId && c.status === "free")
          setFreeCells(cells)
        }
      }
    }
  }, [driverAssignedOrders]) 

  useEffect(() => {
    refreshDriverOrders();
  }, [selectedCity, isTabActive]);

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

const fetchAllOrders = async () => {
  try {
    // Получаем courier_id из мок-данных
    const courier = mockCouriers.find((c) => c.id === parseInt(selectedCourierId));
    if (!courier) {
      throw new Error('Courier not found');
    }

    // Формируем URL с параметром courier_id
    const response = await fetch(`/api/proxy/courier/exchange?courier_id=${courier.id}`);
    if (!response.ok) throw new Error('Failed to fetch orders');

    const data = await response.json();
    console.log("Fetched orders from backend:", data); // Лог для отладки
    
    // Маппим поля для совместимости с UI
    const orders = (data.orders || []).map((order: any) => ({
      ...order,
      // Для pickup заказов - адрес и ячейка отправителя
      // Для delivery заказов - адрес и ячейка получателя
      lockerAddress: order.type === 'pickup' ? order.source_address : order.dest_address,
      cell: order.type === 'pickup' ? order.source_cell_code : order.dest_cell_code,
      size: order.cell_size,
    }));
    
    return { ...data, orders };
  } catch (error) {
    console.error('Error fetching orders:', error);
    return mockOrders; // Возвращаем мок-данные только в случае ошибки
  }
};

const fetchClientOrdersByUserId = async (userId: string) => {
  try {
    const orders = await fetchOrdersByClient(userId);
    return orders.map((order: any) => ({
      id: order.id,
      status: order.status,
      description: order.description,
      parcel_type: order.parcel_type,
      pickup_type: order.pickup_type,
      delivery_type: order.delivery_type,
      source_cell_id: order.source_cell_id,
      dest_cell_id: order.dest_cell_id,
      created_at: order.created_at ? new Date(order.created_at).toISOString() : null,
      updated_at: order.updated_at ? new Date(order.updated_at).toISOString() : null,
    }));
  } catch (error) {
    console.error("Error fetching client orders:", error);
    return [];
  }
};

const loadClientOrders = async () => {
  if (isRefreshingClient) return;
  setIsRefreshingClient(true);

  try {
    const now = Date.now();
    const lastFetch = lastFetchTime['client'] || 0;

    if (now - lastFetch < pollingInterval - 1000) {
      return;
    }

    setLastFetchTime(prev => ({ ...prev, client: now }));

    const startTime = Date.now();
    const orders = await fetchClientOrdersByUserId(selectedClientId);
    const filteredOrders = orders.filter((order: any) => order.status !== "order_cancelled");

    setClientOrders(
      filteredOrders.map((order: any) => ({
        id: order.id,
        description: order.description,
        status: order.status,
        canCancel: ["order_created", "order_reserved"].includes(order.status),
        isLoading: false,
      }))
    );

    const duration = Date.now() - startTime;

    if (duration > 3000) {
      console.warn('Slow client request, increasing interval');
      setPollingInterval(prev => Math.min(prev * 1.5, 60000));
    } else if (duration < 1000 && pollingInterval > 5000) {
      setPollingInterval(prev => Math.max(prev / 1.5, 5000));
    }
  } catch (error) {
    console.error('Error refreshing client orders:', error);
    setPollingInterval(prev => Math.min(prev * 2, 60000));
  } finally {
    setIsRefreshingClient(false);
  }
};

const refreshCourierOrders = async () => {
  if (isRefreshingCourier) return;
  setIsRefreshingCourier(true);
  const startTime = Date.now();

  try {
    const response = await fetchAllOrders();
    const allOrders = response.orders || [];

    // Сохраняем ВСЕ заказы без фильтрации
    setAvailableOrders(allOrders);

    // Логика для динамического изменения интервала опроса
    const duration = Date.now() - startTime;
    if (duration > 3000) {
      setPollingInterval(prev => Math.min(prev * 1.5, 60000));
    } else if (duration < 1000 && pollingInterval > 5000) {
      setPollingInterval(prev => Math.max(prev / 1.5, 5000));
    }
  } catch (error) {
    console.error('Error refreshing courier orders:', error);
    setPollingInterval(prev => Math.min(prev * 2, 60000));
  } finally {
    setIsRefreshingCourier(false);
  }
};


const refreshDriverOrders = async () => {
  if (isRefreshingDriver) return;
  setIsRefreshingDriver(true);

  try {
    // Получаем заказы с биржи водителя
    const exchangeOrders = await fetchDriverExchangeOrders(selectedCity);
    setDriverAvailableOrders(exchangeOrders);
    console.log("Driver exchange orders updated:", exchangeOrders.length, "orders");
  } catch (error) {
    console.error("Error refreshing driver orders:", error);
  } finally {
    setIsRefreshingDriver(false);
  }
};

const refreshDriverReservations = async () => {
  if (isRefreshingDriverReservations) return;
  setIsRefreshingDriverReservations(true);

  try {
    const reservations = await fetchDriverReservations(selectedDriverId);
    setDriverReservations(Array.isArray(reservations) ? reservations : []);
  } catch (error) {
    console.error("Error refreshing driver reservations:", error);
  } finally {
    setIsRefreshingDriverReservations(false);
  }
};

// Polling для резервов водителя
useEffect(() => {
  if (!selectedDriverId || !isTabActive) return;

  refreshDriverReservations();

  const doPoll = async () => {
    const now = Date.now();
    const lastFetch = lastFetchTime['driverReservations'] || 0;

    if (now - lastFetch < pollingInterval - 1000) {
      return;
    }

    setLastFetchTime(prev => ({ ...prev, driverReservations: now }));
    await refreshDriverReservations();
  };

  if (driverReservationsIntervalRef.current) clearInterval(driverReservationsIntervalRef.current);
  driverReservationsIntervalRef.current = setInterval(doPoll, pollingInterval);

  return () => {
    if (driverReservationsIntervalRef.current) clearInterval(driverReservationsIntervalRef.current);
  };
}, [selectedDriverId, isTabActive, pollingInterval, lastFetchTime]);

// Polling для биржи направлений водителя
useEffect(() => {
  if (!selectedCity || !isTabActive) return;

  refreshDriverOrders();

  const doPoll = async () => {
    const now = Date.now();
    const lastFetch = lastFetchTime['driverExchange'] || 0;

    if (now - lastFetch < pollingInterval - 1000) {
      return;
    }

    setLastFetchTime(prev => ({ ...prev, driverExchange: now }));
    await refreshDriverOrders();
  };

  if (driverExchangeIntervalRef.current) clearInterval(driverExchangeIntervalRef.current);
  driverExchangeIntervalRef.current = setInterval(doPoll, pollingInterval);

  return () => {
    if (driverExchangeIntervalRef.current) clearInterval(driverExchangeIntervalRef.current);
  };
}, [selectedCity, isTabActive, pollingInterval, lastFetchTime]);

  const handleTakeOrder = async (orderId: number) => {
  setCourierMessage(null);

  const requestData = makeFsmEnqueueRequest({
    entity_type: "order",
    entity_id: orderId,
    process_name: "order_assign_courier1", // Исправлено на нужный процесс
    user_id: parseInt(selectedCourierId),
    target_user_id: parseInt(selectedCourierId), // Оба ID совпадают
  });

  try {
    const result = await enqueueFsmRequest(requestData);
    setCourierMessage(result.message || "Действие выполнено");
    handleAction("courier", "take_order", result);
    await refreshCourierOrders();
  } catch (error) {
    console.error("Error taking order:", error);
    setCourierMessage("Ошибка при взятии заказа");
  }
};

  const handleCourierDeliveryAction = async (orderId: number, action: string) => {
    setCourierMessage(null);
    let processName = ""
    if (action === "confirm_placed") {
      processName = "courier_place_in_cell"
    }

    if (processName) {
      const requestData = makeFsmEnqueueRequest({
        entity_type: "order",
        entity_id: orderId,
        process_name: processName,
        user_id: parseInt(selectedCourierId),
        target_user_id: parseInt(selectedCourierId),
      })

      try {
        const result = await enqueueFsmRequest(requestData)
        setCourierMessage(result.message || 'Действие выполнено');
        handleAction("courier", action, result)
      } catch (error) {
        console.error('Error performing delivery action:', error)
        setCourierMessage('Ошибка при выполнении действия');
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

  const handleTakeDriverOrder = async (orderId: number) => {
  const requestData = makeFsmEnqueueRequest({
    entity_type: "trip",
    entity_id: orderId,
    process_name: "trip_assign_driver",
    user_id: parseInt(selectedDriverId),
    target_user_id: parseInt(selectedDriverId),
    target_role: "driver",
    metadata: {},
  });

  try {
    const result = await enqueueFsmRequest(requestData);
    handleAction("driver", "take_order", result);
    await refreshDriverOrders();
  } catch (error) {
    console.error("Error taking driver order:", error);
  }
};


  const handleCancelDriverOrder = async (orderId: number) => {
  const requestData = makeFsmEnqueueRequest({
    entity_type: "order",
    entity_id: orderId,
    process_name: "cancel_order", // Универсальный процесс для отмены
    user_id: parseInt(selectedDriverId),
    target_user_id: parseInt(selectedDriverId), // Оба ID совпадают
  });

  try {
    const result = await enqueueFsmRequest(requestData);

    // Обновляем локальное состояние
    const order = driverAssignedOrders.find((o) => o.id === orderId);
    if (order) {
      setDriverAssignedOrders(driverAssignedOrders.filter((o) => o.id !== orderId));
      setDriverAvailableOrders([...driverAvailableOrders, { ...order, driverId: null, status: "available_for_driver" }]);
    }

    handleAction("driver", "cancel_order", result);
    await refreshDriverOrders();
  } catch (error) {
    console.error("Error cancelling driver order:", error);
  }
};

  const handleReserveDirection = async (directionId: number, capacity: string) => {
    const capacityNum = parseInt(capacity);
    if (isNaN(capacityNum) || capacityNum <= 0) {
      console.error("Invalid capacity value");
      return;
    }

    const requestData = makeFsmEnqueueRequest({
      entity_type: "direction",
      entity_id: directionId,
      process_name: "direction_reserve_slot",
      user_id: parseInt(selectedDriverId),
      target_user_id: parseInt(selectedDriverId),
      target_role: "driver",
      metadata: { capacity: capacityNum },
    });

    try {
      const result = await enqueueFsmRequest(requestData);
      handleAction("driver", "reserve_direction", result);
      setReserves({ ...reserves, [directionId]: "" }); // Очистить инпут после успешного запроса
    } catch (error) {
      console.error("Error reserving direction:", error);
    }
  };

  const handleStartLoading = async (reservationId: number) => {
    try {
      const result = await startDriverLoading(reservationId, parseInt(selectedDriverId));
      handleAction("driver", "start_loading", result);
      // Сохраняем заказы из ответа
      if (result.orders && Array.isArray(result.orders)) {
        setLoadingOrders(result.orders);
      }
    } catch (error) {
      console.error("Error starting loading:", error);
    }
  };

  const handleCompleteLoading = async (directionId: number) => {
    const requestData = makeFsmEnqueueRequest({
      entity_type: "direction",
      entity_id: directionId,
      process_name: "direction_complete_loading",
      user_id: parseInt(selectedDriverId),
      target_user_id: parseInt(selectedDriverId),
      target_role: "driver",
      metadata: {},
    });

    try {
      const result = await enqueueFsmRequest(requestData);
      handleAction("driver", "complete_loading", result);
      // Очищаем заказы для погрузки после завершения погрузки
      setLoadingOrders([]);
    } catch (error) {
      console.error("Error completing loading:", error);
    }
  };

  const handleCancelReserve = async (reservationId: number) => {
    const requestData = makeFsmEnqueueRequest({
      entity_type: "driver_reservations",
      entity_id: reservationId,
      process_name: "driver_reservation_cancel",
      user_id: parseInt(selectedDriverId),
      target_user_id: parseInt(selectedDriverId),
      target_role: "driver",
    });

    try {
      const result = await enqueueFsmRequest(requestData);
      handleAction("driver", "cancel_reserve", result);
    } catch (error) {
      console.error("Error cancelling reserve:", error);
    }
  };
const fetchUsers = async () => {
  setIsLoadingUsers(true);
  try {
    const response = await fetch('/api/proxy/users');
    if (!response.ok) throw new Error('Failed to fetch users');
    const data = await response.json();
    console.log('Fetched users data:', data);
    // Проверяем структуру данных
    if (Array.isArray(data)) {
      console.log('Users cities:', data.map((u: any) => ({ id: u.id, name: u.name, role: u.role_name, city: u.city, cityType: typeof u.city })));
    }
    // Фильтруем только водителей с корректными городами
    const validDrivers = data.filter((u: any) => u.role_name === "driver" && u.city && typeof u.city === "string" && u.city.trim() !== "");
    console.log('Valid drivers:', validDrivers);
    setUsers(data);
  } catch (error) {
    console.error('Error fetching users:', error);
  } finally {
    setIsLoadingUsers(false);
  }
};

  const handleStartTrip = async (tripId: number) => {
    const requestData = makeFsmEnqueueRequest({
      entity_type: "order",
      entity_id: tripId, // это на самом деле order_id
      process_name: "start_trip",
      user_id: parseInt(selectedDriverId),
      target_user_id: parseInt(selectedDriverId),
    })

    try {
      const result = await enqueueFsmRequest(requestData)
      handleAction("driver", "start_trip", result)
      await refreshDriverOrders()
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
  if (newState === "at_to_locker") {
    const requestData = makeFsmEnqueueRequest({
      entity_type: "order",
      entity_id: tripId || activeTripId!,
      process_name: "arrive_at_destination", // Процесс для прибытия
      user_id: parseInt(selectedDriverId),
      target_user_id: parseInt(selectedDriverId), // Оба ID совпадают
    });

    try {
      const result = await enqueueFsmRequest(requestData);
      handleAction("driver", "arrive_at_destination", result);
    } catch (error) {
      console.error("Error arriving at destination:", error);
      return;
    }
  }

  setTripState(newState);

  if (newState === "at_to_locker") {
    const toLockerId = Number.parseInt(lockerTo);
    const cells = mockLockerCells.filter((c) => c.lockerId === toLockerId && c.status === "free");
    setFreeCells(cells);

    if (activeTripId) {
      setDriverAssignedOrders(
        driverAssignedOrders.map((o) => (o.tripId === activeTripId ? { ...o, tripStatus: "at_to_locker" } : o)),
      );
    }
  }

  if (newState !== "at_to_locker") {
    handleAction("driver", "change_trip_state", { trip_id: tripId, state: newState });
  }
};


  const handlePlaceParcelInCell = async (orderId: number, cellNumber: string, pin: string) => {
    const requestData = makeFsmEnqueueRequest({
      entity_type: "locker",
      entity_id: orderId,
      process_name: "place_parcel_in_cell", // Процесс для размещения посылки в ячейке
      user_id: parseInt(selectedDriverId),
      target_user_id: parseInt(selectedDriverId),
      target_role: "driver",
      metadata: { pin, leg: "pickup" },
    });

    try {
      const result = await enqueueFsmRequest(requestData);

      // Обновляем локальное состояние
      const order = [...directOrders, ...reverseOrders].find((o) => o.id === orderId);
      if (!order) return;

      const cell = freeCells.find((c) => c.number === cellNumber);
      if (!cell) return;

      const sizeOrder = { P: 1, S: 2, M: 3, L: 4 };
      const orderSize = sizeOrder[order.size as keyof typeof sizeOrder] || 0;
      const cellSizeValue = sizeOrder[cell.size as keyof typeof sizeOrder] || 0;

      if (orderSize > cellSizeValue) {
        console.log("[v0] Cannot place larger parcel in smaller cell");
        return;
      }

      setTakenDirectOrders(takenDirectOrders.filter((id) => id !== orderId));
      setTakenReverseOrders(takenReverseOrders.filter((id) => id !== orderId));

      setPlacedParcels({ ...placedParcels, [cellNumber]: { orderId, originalSize: order.size } });
      setFreeCells(freeCells.filter((c) => c.number !== cellNumber));

      handleAction("driver", "place_parcel_in_cell", result);
    } catch (error) {
      console.error("Error placing parcel in cell:", error);
    }
  };

  const handleCancelCourierOrder = async (orderId: number) => {
    setCourierMessage(null); // Сбрасываем предыдущее сообщение
    const requestData = makeFsmEnqueueRequest({
      entity_type: "order",
      entity_id: orderId,
      process_name: "cancel_order",
      user_id: parseInt(selectedCourierId),
      target_user_id: parseInt(selectedCourierId),
    })

    try {
      const result = await enqueueFsmRequest(requestData)
      setCourierMessage(result.message || 'Заказ отменен');

      // Обновляем локальное состояние
      const order = assignedOrders.find((o) => o.id === orderId)
      if (order) {
        setAssignedOrders(assignedOrders.filter((o) => o.id !== orderId))
        setAvailableOrders([...availableOrders, { ...order, courierId: null, status: "available_for_pickup" }])
      }

      handleAction("courier", "cancel_order", result)

	  await refreshCourierOrders()
    } catch (error) {
      console.error('Error cancelling order:', error)
      setCourierMessage('Ошибка при отмене заказа');
    }
  }
const filteredAvailableOrders = availableOrders.filter((o: any) => {
  if (ordersFilter === "in") {
    // "в" - заказы на доставку (delivery) или новые заказы (order_created)
    return o.type === "delivery" || o.status === "order_created";
  } else if (ordersFilter === "out") {
    // "из" - заказы на выдачу (pickup), которые не order_created
    return o.type === "pickup" && o.status !== "order_created";
  }
  return false;
});


  const fetchDriverExchangeOrders = async (city: string) => {
  try {
    // Передаём выбранное значение напрямую без маппинга
    const response = await fetch(`/api/proxy/driver/exchange?city=${encodeURIComponent(city)}`);
    if (!response.ok) throw new Error("Failed to fetch orders");
    const data = await response.json();
    console.log("Fetched orders:", data);
    return data;
  } catch (error) {
    console.error("Error fetching driver exchange orders:", error);
    return [];
  }
};

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

  const handleRecipientLookup = async () => {
    if (!recipientOrderId) return;

    try {
      const data = await fetchOrderTrack(parseInt(recipientOrderId));

      // Обработка path: фильтруем статусы с is_completed или is_current
      const tracking = data.path
        .filter((item: any) => item.is_completed || item.is_current)
        .map((item: any) => ({
          status: item.status,
          isCurrent: item.is_current,
          date: '', // Пустые, так как в данных нет даты
          time: ''
        }));

      // Обновляем детали заказа
      setRecipientOrderDetails({
        id: data.order_id,
        locker: '', // Нет в данных
        cell: '', // Нет в данных
        recipientDelivery: data.delivery_type === 'courier' ? 'courier' : 'self', // Предполагаем на основе delivery_type
        currentStatus: data.current_status
      });

      setRecipientTracking(tracking);
      handleAction("recipient", "lookup_order", { order_id: parseInt(recipientOrderId) });
    } catch (error) {
      console.error('Error fetching order track:', error);
      setRecipientTracking([]);
      setRecipientOrderDetails(null);
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
    return assignedOrders.filter((order) => order.status !== "locker_closed" && order.status !== "order_cancelled")
  } else {
    return assignedOrders.filter((order) => order.status === "locker_closed" || order.status === "order_cancelled")
  }
}, [assignedOrders, courierOrdersFilter])

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
  <ClientForm addLog={addLog} />
</TabsContent>


          <TabsContent value="recipient" className="mt-0">
  <RecipientForm
    selectedRecipientId={selectedRecipientId}
    setSelectedRecipientId={setSelectedRecipientId}
    mode={mode}
    t={t}
    language={language}
    users={users}
    addLog={addLog}
    highlightedAction={highlightedAction}
  />

          </TabsContent>

          <TabsContent value="courier" className="mt-0">
  <CourierForm
    selectedCourierId={selectedCourierId}
    setSelectedCourierId={setSelectedCourierId}
    availableOrders={filteredAvailableOrders}
    assignedOrders={filteredAssignedOrders}
    courierOrdersFilter={courierOrdersFilter}
    setCourierOrdersFilter={setCourierOrdersFilter}
    ordersFilter={ordersFilter}
    setOrdersFilter={setOrdersFilter}
    courierMessage={courierMessage}
    mode={mode}
    t={t}
    language={language}
    users={users}
    handleTakeOrder={handleTakeOrder}
    handleCancelCourierOrder={handleCancelCourierOrder}
    handleCourierDeliveryAction={handleCourierDeliveryAction}
    getCourierStatusLabel={getCourierStatusLabel}
  />
</TabsContent>



          <TabsContent value="driver" className="mt-0">
  <DriverForm
    selectedDriverId={selectedDriverId}
    setSelectedDriverId={setSelectedDriverId}
    selectedCity={selectedCity}
    setSelectedCity={setSelectedCity}
    driverAvailableOrders={driverAvailableOrders}
    driverReservations={driverReservations}
    setDriverReservations={setDriverReservations}
    loadingOrders={loadingOrders}
    setLoadingOrders={setLoadingOrders}
    tripState={tripState}
    setTripState={setTripState}
    activeTripId={activeTripId}
    setActiveTripId={setActiveTripId}
    tripId={tripId}
    setTripId={setTripId}
    hasActiveTrip={hasActiveTrip}
    setHasActiveTrip={setHasActiveTrip}
    lockerFrom={lockerFrom}
    setLockerFrom={setLockerFrom}
    lockerTo={lockerTo}
    setLockerTo={setLockerTo}
    directOrders={directOrders}
    setDirectOrders={setDirectOrders}
    reverseOrders={reverseOrders}
    setReverseOrders={setReverseOrders}
    freeCells={freeCells}
    setFreeCells={setFreeCells}
    selectedDirectOrders={selectedDirectOrders}
    setSelectedDirectOrders={setSelectedDirectOrders}
    selectedReverseOrders={selectedReverseOrders}
    setSelectedReverseOrders={setSelectedReverseOrders}
    takenDirectOrders={takenDirectOrders}
    setTakenDirectOrders={setTakenDirectOrders}
    takenReverseOrders={takenReverseOrders}
    setTakenReverseOrders={setTakenReverseOrders}
    placedParcels={placedParcels}
    setPlacedParcels={setPlacedParcels}
    reserves={reserves}
    setReserves={setReserves}
    showPlacedOrders={showPlacedOrders}
    setShowPlacedOrders={setShowPlacedOrders}
    isRefreshingDriverExchange={isRefreshingDriver}
    onRefreshDriverExchange={refreshDriverOrders}
    mode={mode}
    t={t}
    language={language}
    users={users}
    handleTakeDriverOrder={handleTakeDriverOrder}
    handleCancelDriverOrder={handleCancelDriverOrder}
    handleStartTrip={handleStartTrip}
    handleChangeTripState={handleChangeTripState}
    handleTakeSelectedOrders={handleTakeSelectedOrders}
    handlePlaceParcelInCell={handlePlaceParcelInCell}
    handleReserveDirection={handleReserveDirection}
    handleStartLoading={handleStartLoading}
    handleCompleteLoading={handleCompleteLoading}
    currentDirectionId={currentDirectionId}
    setCurrentDirectionId={setCurrentDirectionId}
    handleCancelReserve={handleCancelReserve}
    handleCloseOrder={handleCloseOrder}
  />
          </TabsContent>

          <TabsContent value="operator" className="mt-0">
            <OperatorForm
              addLog={addLog}
              driverAvailableOrders={driverAvailableOrders}
              driverAssignedOrders={driverAssignedOrders}
              setDriverAssignedOrders={setDriverAssignedOrders}
            />
          </TabsContent>

          <TabsContent value="fsm" className="mt-0">
            <FSMEmulator addLog={addLog} highlightedAction={highlightedAction} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
