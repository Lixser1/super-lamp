"use client"

import React, { useState, useEffect, Fragment, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useLanguage } from "@/lib/language-context"
import { mockDriverExchangeOrders, mockDriverAssignedOrders } from "@/lib/mock-data"
import { fetchOperatorTrips, fetchOperatorLockers, fetchUsers, enqueueFsmRequest, fetchAccessCodeView, subscribeToFsmInstanceEvents, fetchFsmUserErrorsFiltered, createAssignExecutorRequest, createRemoveExecutorRequest } from "@/lib/api"
import { performCellOperation } from "@/lib/utils"
import { getLegFromStatus, getAssignExecutorProcessAndLeg, getRemoveExecutorProcessAndLeg } from "@/lib/cell-operations"
import { SSEErrorTracker } from "@/components/sse-error-tracker"

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
  const [selectedCouriers, setSelectedCouriers] = useState<{ [key: number]: string }>({})
  const [selectedDrivers, setSelectedDrivers] = useState<{ [key: number]: string }>({})
  const [operatorTrips, setOperatorTrips] = useState<any[]>([])
  const [loadingOperatorTrips, setLoadingOperatorTrips] = useState(false)
  const [lockers, setLockers] = useState<any[]>([])
  const [loadingLockers, setLoadingLockers] = useState(false)
  const [users, setUsers] = useState<any[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [operatorId, setOperatorId] = useState<number | null>(null)

  // Polling состояния
  const [pollingInterval, setPollingInterval] = useState(5000)
  const [isTabActive, setIsTabActive] = useState(true)
  const lockersIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const tripsIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Состояния для работы с ячейками и пинами
  const [orderCellStates, setOrderCellStates] = useState<{
    [key: number]: {
      accessCode?: string;
      isRequestingCode?: boolean;
      isGettingCode?: boolean;
      isOpeningCell?: boolean;
      isClosingCell?: boolean;
      isRequestingError?: boolean;
    }
  }>({})
  const [tripCellStates, setTripCellStates] = useState<{
    [tripId: number]: {
      accessCode?: string;
      isRequestingCode?: boolean;
      isGettingCode?: boolean;
      isOpeningCell?: boolean;
      isClosingCell?: boolean;
      isRequestingError?: boolean;
    }
  }>({})
  const [pins, setPins] = useState<{ [key: number]: string }>({})
  const [tripPins, setTripPins] = useState<{ [tripId: number]: string }>({})

  // State для ошибок FSM заказов
  const [orderFsmErrors, setOrderFsmErrors] = useState<Record<number, string>>({});
  
  // SSE состояния для отслеживания ошибок
  const [currentInstanceId, setCurrentInstanceId] = useState<number | null>(null);
  const [sseLastError, setSseLastError] = useState<string | null>(null);
  const [sseSuccess, setSseSuccess] = useState(false);
  const sseSubscriptionRef = useRef<any>(null);

  // Process names для оператора
  const operatorProcessNames = [
    "order_remove_courier1",
    "order_remove_courier2",
    "trip_remove_driver",
    "trip_assign_driver",
    "request_locker_access_code",
    "open_cell",
    "close_cell",
  ];

  // Загрузка ошибок FSM - только после действий оператора
  const loadOrderFsmErrors = async (targetOrderId?: number) => {
    if (!operatorId) return;
    
    // Если передан конкретный orderId - загружаем ошибки для него (лимит 1)
    if (targetOrderId) {
      const result = await fetchFsmUserErrorsFiltered(operatorId, 1);
      if (result?.success && Array.isArray(result.errors)) {
        const orderIds = [targetOrderId];
        result.errors.forEach((err: any) => {
          if (err.fsm_state === "FAILED" && err.last_error && err.entity_id) {
            if (!operatorProcessNames.includes(err.process_name)) return;
            const orderId = Number(err.entity_id);
            if (orderIds.includes(orderId)) {
              setOrderFsmErrors(prev => ({ ...prev, [orderId]: err.last_error }));
            }
          }
        });
      }
      return;
    }
    
    // Иначе загружаем для всех заказов в текущих локерах
    if (!lockers || lockers.length === 0) return;
    
    const allOrders: any[] = [];
    lockers.forEach((locker: any) => {
      if (locker.orders && Array.isArray(locker.orders)) {
        locker.orders.forEach((order: any) => {
          allOrders.push({ id: order.order_id, order_id: order.order_id });
        });
      }
    });
    
    if (allOrders.length === 0) return;
  };

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

  // Загрузка локеров оператора при монтировании компонента
  useEffect(() => {
    const loadOperatorLockers = async () => {
      setLoadingLockers(true)
      try {
        const lockersData = await fetchOperatorLockers()
        setLockers(lockersData)
      } catch (error) {
        console.error('Error loading operator lockers:', error)
      } finally {
        setLoadingLockers(false)
      }
    }

    loadOperatorLockers()
  }, [])

  // Загрузка списка пользователей
  useEffect(() => {
    const loadUsers = async () => {
      setLoadingUsers(true)
      try {
        const usersData = await fetchUsers()
        setUsers(usersData)
        
        // Находим id оператора
        const operator = usersData.find((u: any) => u.role_name === 'operator')
        if (operator) {
          setOperatorId(operator.id)
        }
      } catch (error) {
        console.error('Error loading users:', error)
      } finally {
        setLoadingUsers(false)
      }
    }

    loadUsers()
  }, [])

  // Очистка polling при размонтировании
  useEffect(() => {
    return () => {
      if (lockersIntervalRef.current) clearInterval(lockersIntervalRef.current)
      if (tripsIntervalRef.current) clearInterval(tripsIntervalRef.current)
    }
  }, [])

  // Отслеживание видимости вкладки
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabActive(!document.hidden)
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  // Polling для локеров
  useEffect(() => {
    if (!isTabActive) return

    const doPollLockers = async () => {
      try {
        const lockersData = await fetchOperatorLockers()
        setLockers(lockersData)
      } catch (error) {
        console.error('Error polling lockers:', error)
      }
    }

    lockersIntervalRef.current = setInterval(doPollLockers, pollingInterval)

    return () => {
      if (lockersIntervalRef.current) clearInterval(lockersIntervalRef.current)
    }
  }, [isTabActive, pollingInterval])

  // Polling для рейсов
  useEffect(() => {
    if (!isTabActive) return

    const doPollTrips = async () => {
      try {
        const trips = await fetchOperatorTrips()
        setOperatorTrips(trips)
      } catch (error) {
        console.error('Error polling trips:', error)
      }
    }

    tripsIntervalRef.current = setInterval(doPollTrips, pollingInterval)

    return () => {
      if (tripsIntervalRef.current) clearInterval(tripsIntervalRef.current)
    }
  }, [isTabActive, pollingInterval])

  // Эффект для подписки на SSE события
  useEffect(() => {
    if (!currentInstanceId) {
      if (sseSubscriptionRef.current) {
        sseSubscriptionRef.current.close();
        sseSubscriptionRef.current = null;
      }
      setSseLastError(null);
      setSseSuccess(false);
      return;
    }

    sseSubscriptionRef.current = subscribeToFsmInstanceEvents(
      currentInstanceId,
      (data) => {
        // Обработка нового формата с event_type
        if (data.event_type === "error") {
          setSseLastError(data.message || "Unknown error");
          setSseSuccess(false);
        } else if (data.event_type === "success") {
          setSseSuccess(true);
          setSseLastError(null);
        }
        // Fallback для старого формата
        else if (data.last_error && data.last_error !== "") {
          setSseLastError(data.last_error);
          setSseSuccess(false);
        } else if (data.fsm_state === "COMPLETED" || data.fsm_state === "SUCCESS") {
          setSseSuccess(true);
          setSseLastError(null);
        }
      },
      (error) => {
        setSseLastError(error);
        setSseSuccess(false);
      }
    );

    return () => {
      if (sseSubscriptionRef.current) {
        sseSubscriptionRef.current.close();
      }
    };
  }, [currentInstanceId]);
  
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
      const trip = operatorTrips.find(t => t.trip_id === tripId)
      const driverUserId = trip?.driver_user_id
      
      // Для снятия водителя используем remove_executor (для trip metadata пустой)
      const request = createRemoveExecutorRequest({
        entity_type: 'trip',
        entity_id: tripId,
        user_id: operatorId!,
        target_user_id: driverUserId!,
        target_role: 'driver'
      })

      const result = await enqueueFsmRequest(request)
      
      // Извлекаем instance_id из ответа
      const instanceId = result?.data?.instance_id || result?.instance_id;
      
      // Если есть instance_id, подписываемся на SSE
      if (instanceId) {
        setCurrentInstanceId(instanceId);
      } else {
        // Если нет instance_id, обновляем список рейсов сразу
        const updatedTrips = await fetchOperatorTrips()
        setOperatorTrips(updatedTrips)
      }
    } catch (error: any) {
      console.error('Error removing trip:', error)
      const errorMessage = error?.response?.data?.message || error?.message || (language === "ru" ? "Ошибка снятия рейса" : "Error removing trip")
      setSseLastError(errorMessage)
    }
  }
      
  const toggleLocker = (lockerId: number) => {
    if (expandedLockers.includes(lockerId)) {
      setExpandedLockers(expandedLockers.filter((id) => id !== lockerId))
    } else {
      setExpandedLockers([...expandedLockers, lockerId])
    }
  }

  const handleAssignCourier = async (orderId: number, lockerId: number) => {
    const courierId = selectedCouriers[orderId]
    if (courierId) {
      // Получаем информацию о заказе чтобы узнать его статус
      const locker = lockers.find(l => l.locker_id === lockerId)
      const order = locker?.orders?.find((o: any) => o.order_id === orderId)
      const status = order?.status || ''
      
      // Определяем process_name и leg на основе статуса:
      // - "order_parcel_confirmed_post2" для postamatu2 -> "delivery"
      // - "order_created" для postamatu1 -> "pickup"
      const { leg } = getAssignExecutorProcessAndLeg(status)

      const request = createAssignExecutorRequest({
        entity_type: 'order',
        entity_id: orderId,
        user_id: operatorId!,
        target_user_id: parseInt(courierId),
        target_role: 'courier',
        leg
      })

      try {
        const result = await enqueueFsmRequest(request)
        
        // Извлекаем instance_id и подписываемся на SSE
        const instanceId = result?.data?.instance_id || result?.instance_id;
        if (instanceId) {
          setCurrentInstanceId(instanceId);
        }
        
        handleAction("operator", "assign_courier", { order_id: orderId, courier_id: courierId })
        
        // Обновляем список локеров после успешного назначения
        const updatedLockers = await fetchOperatorLockers()
        setLockers(updatedLockers)
        
        // Очищаем выбранного курьера
        setSelectedCouriers({ ...selectedCouriers, [orderId]: '' })
      } catch (error: any) {
        console.error('Error assigning courier:', error)
        const errorMessage = error?.response?.data?.message || error?.message || (language === "ru" ? "Ошибка назначения курьера" : "Error assigning courier")
        setSseLastError(errorMessage)
      }
    }
  }

  const handleAssignDriver = async (tripId: number) => {
    const driverId = selectedDrivers[tripId]
    if (driverId) {
      // Для назначения водителя используем assign_executor (для trip metadata пустой)
      const request = createAssignExecutorRequest({
        entity_type: 'trip',
        entity_id: tripId,
        user_id: operatorId!,
        target_user_id: Number(driverId),
        target_role: 'driver'
      })

      try {
        const result = await enqueueFsmRequest(request)
        
        // Извлекаем instance_id и подписываемся на SSE
        const instanceId = result?.data?.instance_id || result?.instance_id;
        if (instanceId) {
          setCurrentInstanceId(instanceId);
        }
        
        // Обновляем список рейсов после успешного назначения
        const updatedTrips = await fetchOperatorTrips()
        setOperatorTrips(updatedTrips)
        
        // Очищаем выбранного водителя
        setSelectedDrivers({ ...selectedDrivers, [tripId]: '' })
      } catch (error: any) {
        console.error('Error assigning driver:', error)
        const errorMessage = error?.response?.data?.message || error?.message || (language === "ru" ? "Ошибка назначения водителя" : "Error assigning driver")
        setSseLastError(errorMessage)
      }
    }
  }

  const handleRemoveCourier = async (order: any) => {
    const orderId = order.order_id
    const courierId = order.delivery_courier_id
    const status = order.status
    
    // Определяем process_name и leg на основе статуса заказа:
    // - "order_courier2_assigned" для postamatu2 -> "delivery"
    // - "order_courier1_assigned" для postamatu1 -> "pickup"
    const { process_name, leg } = getRemoveExecutorProcessAndLeg(status)
    
    const request = createRemoveExecutorRequest({
      entity_type: 'order',
      entity_id: orderId,
      user_id: operatorId!,
      target_user_id: courierId,
      target_role: 'courier',
      leg
    })
    
    try {
      const result = await enqueueFsmRequest(request)
      
      // Извлекаем instance_id из ответа
      const instanceId = result?.data?.instance_id || result?.instance_id;
      
      // Если есть instance_id, подписываемся на SSE
      if (instanceId) {
        setCurrentInstanceId(instanceId);
      } else {
        // Если нет instance_id, обновляем список локеров сразу
        const updatedLockers = await fetchOperatorLockers()
        setLockers(updatedLockers)
      }
    } catch (error: any) {
      console.error('Error removing courier:', error)
      const errorMessage = error?.response?.data?.message || error?.message || (language === "ru" ? "Ошибка снятия курьера" : "Error removing courier")
      setSseLastError(errorMessage)
    }
  }
      
  const handleRemoveDriver = (tripId: number) => {
    setDriverAssignedOrders(
      driverAssignedOrders.map((order) => (order.tripId === tripId ? { ...order, driverId: null } : order)),
    )
    handleAction("operator", "remove_driver", { trip_id: tripId })
  }

  // Функции для работы с ячейками заказов в постаматах
  const handleRequestCode = async (orderId: number, cellId: number, status: string, targetUserId: number) => {
    if (!operatorId) return
    const leg = getLegFromStatus(status)
    setOrderCellStates(prev => ({
      ...prev,
      [orderId]: { ...prev[orderId], isRequestingCode: true }
    }))

    try {
      const result = await performCellOperation(orderId, operatorId, "request_locker_access_code", { leg }, "operator", { targetRole: "courier", leg, entityType: "order" }, targetUserId)
      const instanceId = result?.data?.instance_id || result?.instance_id;
      if (instanceId) {
        setCurrentInstanceId(instanceId);
      }
      
      // Загружаем ошибки после действия
      loadOrderFsmErrors(orderId);
    } catch (error) {
      console.error('Error requesting code:', error)
    } finally {
      setOrderCellStates(prev => ({
        ...prev,
        [orderId]: { ...prev[orderId], isRequestingCode: false }
      }))
    }
  }

  const handleGetCode = async (orderId: number, cellId: number, status: string, targetUserId: number) => {
    if (!operatorId) return
    const leg = getLegFromStatus(status)
    setOrderCellStates(prev => ({
      ...prev,
      [orderId]: { ...prev[orderId], isGettingCode: true }
    }))

    try {
      const result = await fetchAccessCodeView(orderId, leg, operatorId)
      setOrderCellStates(prev => ({
        ...prev,
        [orderId]: { ...prev[orderId], accessCode: result.pin, isGettingCode: false }
      }))
    } catch (error) {
      console.error('Error getting code:', error)
      setOrderCellStates(prev => ({
        ...prev,
        [orderId]: { ...prev[orderId], isGettingCode: false }
      }))
    }
  }

  const handleOpenCell = async (orderId: number, cellId: number, status: string, targetUserId: number) => {
    if (!operatorId) return
    const leg = getLegFromStatus(status)
    setOrderCellStates(prev => ({
      ...prev,
      [orderId]: { ...prev[orderId], isOpeningCell: true }
    }))

    try {
      const result = await performCellOperation(orderId, operatorId, "open_cell", { pin: pins[orderId] }, "operator", { targetRole: "courier", leg, entityType: "order" }, targetUserId)
      const instanceId = result?.data?.instance_id || result?.instance_id;
      if (instanceId) {
        setCurrentInstanceId(instanceId);
      }
      await performCellOperation(orderId, operatorId, "open_cell", { pin: pins[orderId], leg }, "operator", { targetRole: "courier", leg, entityType: "order" }, targetUserId)
    } catch (error) {
      console.error('Error opening cell:', error)
    } finally {
      setOrderCellStates(prev => ({
        ...prev,
        [orderId]: { ...prev[orderId], isOpeningCell: false }
      }))
    }
  }

  const handleCloseCell = async (orderId: number, cellId: number, status: string, targetUserId: number) => {
    if (!operatorId) return
    const leg = getLegFromStatus(status)
    setOrderCellStates(prev => ({
      ...prev,
      [orderId]: { ...prev[orderId], isClosingCell: true }
    }))

    try {
      const result = await performCellOperation(orderId, operatorId, "close_cell", { leg }, "operator", { targetRole: "courier", leg, entityType: "order" }, targetUserId)
      const instanceId = result?.data?.instance_id || result?.instance_id;
      if (instanceId) {
        setCurrentInstanceId(instanceId);
      }
    } catch (error) {
      console.error('Error closing cell:', error)
    } finally {
      setOrderCellStates(prev => ({
        ...prev,
        [orderId]: { ...prev[orderId], isClosingCell: false }
      }))
    }
  }

  const handleCellError = async (orderId: number, cellId: number, status: string, targetUserId: number) => {
    if (!operatorId) return
    const leg = getLegFromStatus(status)
    setOrderCellStates(prev => ({
      ...prev,
      [orderId]: { ...prev[orderId], isRequestingError: true }
    }))

    try {
      const result = await performCellOperation(orderId, operatorId, "request_locker_access_code", { leg }, "operator", { targetRole: "courier", leg, entityType: "order" }, targetUserId)
      const instanceId = result?.data?.instance_id || result?.instance_id;
      if (instanceId) {
        setCurrentInstanceId(instanceId);
      }
      
      // Загружаем ошибки после действия
      loadOrderFsmErrors(orderId);
    } catch (error) {
      console.error('Error requesting error:', error)
    } finally {
      setOrderCellStates(prev => ({
        ...prev,
        [orderId]: { ...prev[orderId], isRequestingError: false }
      }))
    }
  }

  // Функции для работы с ячейками рейсов
  const handleTripRequestCode = async (tripId: number, cellId: number, targetUserId: number) => {
    if (!operatorId) return
    setTripCellStates(prev => ({
      ...prev,
      [tripId]: { ...prev[tripId], isRequestingCode: true }
    }))

    try {
      const result = await performCellOperation(tripId, operatorId, "request_locker_access_code", { leg: "pickup" }, "operator", { targetRole: "driver", leg: "pickup" }, targetUserId)
      const instanceId = result?.data?.instance_id || result?.instance_id;
      if (instanceId) {
        setCurrentInstanceId(instanceId);
      }
      
      // Если в ответе есть pin, сохраняем его
      if (result?.pin) {
        setTripCellStates(prev => ({
          ...prev,
          [tripId]: { ...prev[tripId], accessCode: result.pin }
        }))
      }
    } catch (error) {
      console.error('Error requesting code:', error)
    } finally {
      setTripCellStates(prev => ({
        ...prev,
        [tripId]: { ...prev[tripId], isRequestingCode: false }
      }))
    }
  }

  const handleTripGetCode = async (tripId: number, cellId: number, targetUserId: number) => {
    if (!operatorId) return
    setTripCellStates(prev => ({
      ...prev,
      [tripId]: { ...prev[tripId], isGettingCode: true }
    }))

    try {
      const result = await fetchAccessCodeView(tripId, "pickup", operatorId)
      setTripCellStates(prev => ({
        ...prev,
        [tripId]: { ...prev[tripId], accessCode: result.pin, isGettingCode: false }
      }))
    } catch (error) {
      console.error('Error getting code:', error)
      setTripCellStates(prev => ({
        ...prev,
        [tripId]: { ...prev[tripId], isGettingCode: false }
      }))
    }
  }

  const handleTripOpenCell = async (tripId: number, cellId: number, targetUserId: number) => {
    if (!operatorId) return
    setTripCellStates(prev => ({
      ...prev,
      [tripId]: { ...prev[tripId], isOpeningCell: true }
    }))

    try {
      const result = await performCellOperation(cellId, operatorId, "open_cell", { pin: tripPins[tripId] }, "operator", { targetRole: "driver", leg: "pickup" }, targetUserId)
      const instanceId = result?.data?.instance_id || result?.instance_id;
      if (instanceId) {
        setCurrentInstanceId(instanceId);
      }
    } catch (error) {
      console.error('Error opening cell:', error)
    } finally {
      setTripCellStates(prev => ({
        ...prev,
        [tripId]: { ...prev[tripId], isOpeningCell: false }
      }))
    }
  }

  const handleTripCloseCell = async (tripId: number, cellId: number, targetUserId: number) => {
    if (!operatorId) return
    setTripCellStates(prev => ({
      ...prev,
      [tripId]: { ...prev[tripId], isClosingCell: true }
    }))

    try {
      const result = await performCellOperation(cellId, operatorId, "close_cell", { leg: "pickup" }, "operator", { targetRole: "driver", leg: "pickup" }, targetUserId)
      const instanceId = result?.data?.instance_id || result?.instance_id;
      if (instanceId) {
        setCurrentInstanceId(instanceId);
      }
    } catch (error) {
      console.error('Error closing cell:', error)
    } finally {
      setTripCellStates(prev => ({
        ...prev,
        [tripId]: { ...prev[tripId], isClosingCell: false }
      }))
    }
  }

  const handleTripCellError = async (tripId: number, cellId: number, targetUserId: number) => {
    if (!operatorId) return
    setTripCellStates(prev => ({
      ...prev,
      [tripId]: { ...prev[tripId], isRequestingError: true }
    }))

    try {
      const leg = "pickup"
      const result = await performCellOperation(tripId, operatorId, "request_locker_access_code", { leg }, "operator", { targetRole: "courier", leg, entityType: "order" }, targetUserId)
      const instanceId = result?.data?.instance_id || result?.instance_id;
      if (instanceId) {
        setCurrentInstanceId(instanceId);
      }
    } catch (error) {
      console.error('Error requesting error:', error)
    } finally {
      setTripCellStates(prev => ({
        ...prev,
        [tripId]: { ...prev[tripId], isRequestingError: false }
      }))
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.operator.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* SSE ошибки в реальном времени - в самом верху */}
        {currentInstanceId && (
          <div className="pb-2">
            <SSEErrorTracker
              instanceId={currentInstanceId}
              language={language}
              onClear={() => {
                setCurrentInstanceId(null);
                setSseLastError(null);
                setSseSuccess(false);
              }}
            />
          </div>
        )}

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
                  <TableHead>{language === "ru" ? "Действие" : "Action"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {operatorTrips.map((trip) => {
                  // Фильтруем пользователей по роли driver
                  const drivers = users?.filter((u: any) => {
                    return u.role_name === 'driver';
                  }) || []

                  const hasDriver = trip.driver_user_id !== null && trip.driver_user_id !== undefined

                  return (
                    <TableRow key={trip.trip_id}>
                      <TableCell>{trip.trip_id}</TableCell>
                      <TableCell>{trip.driver_user_id || "-"}</TableCell>
                      <TableCell>{trip.from_city}</TableCell>
                      <TableCell>{trip.to_city}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{trip.status}</Badge>
                      </TableCell>
                      <TableCell>{trip.created_at}</TableCell>
                      <TableCell className="space-x-2">
                        {!hasDriver ? (
                          <div className="flex items-center gap-2">
                            <Select
                              value={selectedDrivers[trip.trip_id] || ""}
                              onValueChange={(v) =>
                                setSelectedDrivers({ ...selectedDrivers, [trip.trip_id]: v })
                              }
                            >
                              <SelectTrigger className="w-40">
                                <SelectValue placeholder={language === "ru" ? "Выбрать" : "Select"} />
                              </SelectTrigger>
                              <SelectContent>
                                {drivers && drivers.length > 0 ? (
                                  drivers
                                    .filter((d: any) => d.id !== undefined && d.id !== null && d.id !== '' && d.name)
                                    .map((driver: any) => (
                                      <SelectItem
                                        key={`driver-${trip.trip_id}-${driver.id}`}
                                        value={String(driver.id)}
                                      >
                                        {driver.name}
                                      </SelectItem>
                                    ))
                                ) : (
                                  <div className="p-2 text-sm text-muted-foreground">
                                    {language === "ru" ? "Нет доступных водителей" : "No drivers available"}
                                  </div>
                                )}
                              </SelectContent>
                            </Select>
                            <Button
                              size="sm"
                              onClick={() => handleAssignDriver(trip.trip_id)}
                              disabled={!selectedDrivers[trip.trip_id]}
                            >
                              {language === "ru" ? "Назначить" : "Assign"}
                            </Button>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleRemoveTrip(trip.trip_id)}
                              >
                                {language === "ru" ? "Снять" : "Remove"}
                              </Button>
                            </div>
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
                {lockers && lockers.length > 0 ? lockers.map((locker) => {
                  const isExpanded = expandedLockers.includes(locker.locker_id)

                  return (
                    <Fragment key={locker.locker_id}>
                      <TableRow>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => toggleLocker(locker.locker_id)}>
                            {isExpanded ? "▼" : "▶"}
                          </Button>
                        </TableCell>
                        <TableCell>
                          {locker.locker_id} / {locker.city}
                        </TableCell>
                        <TableCell>{locker.orders_waiting_courier ?? 0}</TableCell>
                        <TableCell>{locker.orders_assigned ?? 0}</TableCell>
                      </TableRow>
                      {isExpanded && locker.orders && locker.orders.length > 0 && (
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
                                  {locker.orders.map((order: any) => {
                                    const updatedAt = order.updated_at ? new Date(order.updated_at) : new Date()
                                    const now = new Date()
                                    const diffMs = now.getTime() - updatedAt.getTime()
                                    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
                                    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
                                    
                                    const hasCourier = order.delivery_courier_id !== null && order.delivery_courier_id !== undefined

                                    // Фильтруем пользователей по роли courier
                                    const couriers = users?.filter((u: any) => {
                                      const role = u.role_name || u.role || u.user_role || '';
                                      return String(role).toLowerCase().includes('courier');
                                    }) || []

                                    const courierKey = `courier-${locker.locker_id}-${order.order_id}`

                                    return (
                                      <TableRow key={order.order_id}>
                                        <TableCell>{order.order_id}</TableCell>
                                        <TableCell>{order.dest_cell_id}</TableCell>
                                        <TableCell>
                                          <div className="flex flex-col gap-1">
                                            <Badge variant="secondary">
                                              {order.status}
                                            </Badge>
                                            {orderFsmErrors[order.order_id] && (
                                              <Badge variant="destructive" className="text-xs whitespace-normal">
                                                {orderFsmErrors[order.order_id]}
                                              </Badge>
                                            )}
                                          </div>
                                        </TableCell>
                                        <TableCell>
                                          {diffHours > 0 && `${diffHours}${t.operator.hours} `}
                                          {diffMinutes}
                                          {t.operator.minutes}
                                        </TableCell>
                                        <TableCell className="space-x-2">
                                          {hasCourier ? (
                                            <div className="flex flex-col gap-2">
                                              <div className="flex items-center gap-2">
                                                <span className="text-sm">
                                                  {language === "ru" ? "Курьер" : "Courier"} #{order.delivery_courier_id}
                                                </span>
                                                <Button
                                                  size="sm"
                                                  variant="outline"
                                                  onClick={() => handleRemoveCourier(order)}
                                                >
                                                  {t.operator.remove}
                                                </Button>
                                              </div>
                                              {/* Кнопки работы с ячейками */}
                                              <div className="flex flex-col gap-1 p-2 border rounded bg-muted/30">
                                                <div className="text-xs font-medium mb-1">{language === "ru" ? "Управление ячейкой" : "Cell Control"}</div>
                                                <div className="flex flex-wrap gap-1">
                                                  <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleRequestCode(order.order_id, order.dest_cell_id, order.status, order.delivery_courier_id)}
                                                    disabled={!operatorId || orderCellStates[order.order_id]?.isRequestingCode || orderCellStates[order.order_id]?.isGettingCode || orderCellStates[order.order_id]?.isOpeningCell || orderCellStates[order.order_id]?.isClosingCell || orderCellStates[order.order_id]?.isRequestingError}
                                                  >
                                                    {orderCellStates[order.order_id]?.isRequestingCode ? (language === "ru" ? "Запрос..." : "Request...") : (language === "ru" ? "Запросить код" : "Request Code")}
                                                  </Button>
                                                  <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleGetCode(order.order_id, order.dest_cell_id, order.status, order.delivery_courier_id)}
                                                    disabled={!operatorId || orderCellStates[order.order_id]?.isGettingCode || orderCellStates[order.order_id]?.isRequestingCode}
                                                  >
                                                    {orderCellStates[order.order_id]?.isGettingCode ? (language === "ru" ? "Получ..." : "Getting...") : (language === "ru" ? "Получить код" : "Get Code")}
                                                  </Button>
                                                </div>
                                                {orderCellStates[order.order_id]?.accessCode && (
                                                  <div className="flex items-center gap-1 mt-1">
                                                    <Badge variant="default" className="text-xs">
                                                      {language === "ru" ? "Код:" : "Code:"} {orderCellStates[order.order_id].accessCode}
                                                    </Badge>
                                                  </div>
                                                )}
                                                <div className="flex items-center gap-1 mt-1">
                                                  <Input
                                                    type="text"
                                                    placeholder="PIN"
                                                    value={pins[order.order_id] || ""}
                                                    onChange={(e) => setPins({ ...pins, [order.order_id]: e.target.value })}
                                                    className="w-20 h-7 text-xs"
                                                  />
                                                  <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleOpenCell(order.order_id, order.dest_cell_id, order.status, order.delivery_courier_id)}
                                                    disabled={!operatorId || orderCellStates[order.order_id]?.isOpeningCell || orderCellStates[order.order_id]?.isClosingCell || orderCellStates[order.order_id]?.isRequestingError || !pins[order.order_id]}
                                                  >
                                                    {orderCellStates[order.order_id]?.isOpeningCell ? (language === "ru" ? "Открываю..." : "Opening...") : (language === "ru" ? "Открыть" : "Open")}
                                                  </Button>
                                                  <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => handleCloseCell(order.order_id, order.dest_cell_id, order.status, order.delivery_courier_id)}
                                                    disabled={!operatorId || orderCellStates[order.order_id]?.isClosingCell || orderCellStates[order.order_id]?.isOpeningCell || orderCellStates[order.order_id]?.isRequestingError}
                                                  >
                                                    {orderCellStates[order.order_id]?.isClosingCell ? (language === "ru" ? "Закрываю..." : "Closing...") : (language === "ru" ? "Закрыть" : "Close")}
                                                  </Button>
                                                  <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    onClick={() => handleCellError(order.order_id, order.dest_cell_id, order.status, order.delivery_courier_id)}
                                                    disabled={!operatorId || orderCellStates[order.order_id]?.isRequestingError || orderCellStates[order.order_id]?.isOpeningCell || orderCellStates[order.order_id]?.isClosingCell}
                                                  >
                                                    {orderCellStates[order.order_id]?.isRequestingError ? (language === "ru" ? "Отпр..." : "Sending...") : (language === "ru" ? "Ошибка" : "Error")}
                                                  </Button>
                                                </div>
                                              </div>
                                            </div>
                                          ) : (
                                            <div className="flex items-center gap-2">
                                              <Select
                                                value={selectedCouriers[order.order_id] || ""}
                                                onValueChange={(v) =>
                                                  setSelectedCouriers({ ...selectedCouriers, [order.order_id]: v })
                                                }
                                              >
                                                <SelectTrigger className="w-40">
                                                  <SelectValue placeholder={t.operator.selectCourier} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  {couriers && couriers.length > 0 ? (
                                                    couriers
                                                      .filter((c: any) => (c.user_id ?? c.id) !== undefined && (c.user_id ?? c.id) !== null && (c.user_id ?? c.id) !== '')
                                                      .map((courier: any) => {
                                                        const courierId = courier.user_id ?? courier.id;
                                                        return (
                                                          <SelectItem
                                                            key={`${courierKey}-${courierId}`}
                                                            value={String(courierId)}
                                                          >
                                                            {courier.name || courier.login || `Courier #${courierId}`}
                                                          </SelectItem>
                                                        );
                                                      })
                                                  ) : (
                                                    <div className="p-2 text-sm text-muted-foreground">
                                                      {language === "ru" ? "Нет доступных курьеров" : "No couriers available"}
                                                    </div>
                                                  )}
                                                </SelectContent>
                                              </Select>
                                              <Button
                                                size="sm"
                                                onClick={() => handleAssignCourier(order.order_id, locker.locker_id)}
                                                disabled={!selectedCouriers[order.order_id]}
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
                    </Fragment>
                  )
                }) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-4">
                      {language === "ru" ? "Загрузка постаматов..." : "Loading lockers..."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}