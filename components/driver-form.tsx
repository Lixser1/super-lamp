"use client"
import React, { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchAccessCodeView, startDriverTrip, fetchDriverReservations, fetchDriverTripData, fetchOperatorTrips, fetchActiveDriverTrips, enqueueFsmRequest, makeFsmEnqueueRequest, subscribeToFsmInstanceEvents } from "@/lib/api";
import { performCellOperation } from "@/lib/utils";
import { getLegFromStatus } from "@/lib/cell-operations";
import { SSEErrorTracker } from "@/components/sse-error-tracker";


interface DriverFormProps {
  selectedDriverId: string;
  setSelectedDriverId: (id: string) => void;
  selectedCity: string;
  setSelectedCity: (city: string) => void;
  driverAvailableOrders: any[];
  driverReservations: any[];
  setDriverReservations: (reservations: any[]) => void;
  loadingOrders: any[];
  setLoadingOrders: (orders: any[]) => void;
  tripState: "at_from_locker" | "in_transit" | "at_to_locker";
  setTripState: (state: "at_from_locker" | "in_transit" | "at_to_locker") => void;
  activeTripId: number | null;
  setActiveTripId: (id: number | null) => void;
  tripId: number | null;
  setTripId: (id: number | null) => void;
  hasActiveTrip: boolean;
  setHasActiveTrip: (hasActive: boolean) => void;
  lockerFrom: string;
  setLockerFrom: (locker: string) => void;
  lockerTo: string;
  setLockerTo: (locker: string) => void;
  directOrders: any[];
  setDirectOrders: (orders: any[]) => void;
  reverseOrders: any[];
  setReverseOrders: (orders: any[]) => void;
  freeCells: any[];
  setFreeCells: (cells: any[]) => void;
  selectedDirectOrders: number[];
  setSelectedDirectOrders: (orders: number[]) => void;
  selectedReverseOrders: number[];
  setSelectedReverseOrders: (orders: number[]) => void;
  takenDirectOrders: number[];
  setTakenDirectOrders: (orders: number[]) => void;
  takenReverseOrders: number[];
  setTakenReverseOrders: (orders: number[]) => void;
  placedParcels: { [cellNumber: string]: { orderId: number; originalSize: string } };
  setPlacedParcels: (parcels: { [cellNumber: string]: { orderId: number; originalSize: string } }) => void;
  reserves: { [orderId: number]: string };
  setReserves: (reserves: { [orderId: number]: string }) => void;
  showPlacedOrders: boolean;
  setShowPlacedOrders: (show: boolean) => void;
  isRefreshingDriverExchange: boolean;
  onRefreshDriverExchange: () => void;
  mode: "create" | "run";
  t: any;
  language: string;
  users: Array<{ id: number; name: string; role_name: string; city: string | null; phone: string | null }>;
  handleTakeDriverOrder: (orderId: number) => void;
  handleCancelDriverOrder: (orderId: number) => void;
  handleChangeTripState: (newState: "at_from_locker" | "in_transit" | "at_to_locker") => void;
  handleTakeSelectedOrders: () => void;
  handlePlaceParcelInCell: (orderId: number, cellNumber: string, pin: string) => void;
  handleReserveDirection: (directionId: number, capacity: string) => void;
  handleStartLoading: (reservationId: number) => void;
  handleCompleteLoading: (directionId: number) => void;
  currentDirectionId: number | null;
  setCurrentDirectionId: (id: number | null) => void;
  handleCancelReserve: (reservationId: number) => void;
  handleCloseOrder: () => void;
}

export function DriverForm({
  selectedDriverId,
  setSelectedDriverId,
  selectedCity,
  setSelectedCity,
  driverAvailableOrders,
  driverReservations,
  setDriverReservations,
  loadingOrders,
  setLoadingOrders,
  tripState,
  setTripState,
  activeTripId,
  setActiveTripId,
  tripId,
  setTripId,
  hasActiveTrip,
  setHasActiveTrip,
  lockerFrom,
  setLockerFrom,
  lockerTo,
  setLockerTo,
  directOrders,
  setDirectOrders,
  reverseOrders,
  setReverseOrders,
  freeCells,
  setFreeCells,
  selectedDirectOrders,
  setSelectedDirectOrders,
  selectedReverseOrders,
  setSelectedReverseOrders,
  takenDirectOrders,
  setTakenDirectOrders,
  takenReverseOrders,
  setTakenReverseOrders,
  placedParcels,
  setPlacedParcels,
  reserves,
  setReserves,
  showPlacedOrders,
  setShowPlacedOrders,
  isRefreshingDriverExchange,
  onRefreshDriverExchange,
  mode,
  t,
  language,
  users,
  handleTakeDriverOrder,
  handleCancelDriverOrder,
  handleChangeTripState,
  handleTakeSelectedOrders,
  handlePlaceParcelInCell,
  handleReserveDirection,
  handleStartLoading,
  handleCompleteLoading,
  currentDirectionId,
  setCurrentDirectionId,
  handleCancelReserve,
  handleCloseOrder,
}: DriverFormProps) {
  const [orderStates, setOrderStates] = useState<{ [orderId: number]: {
    accessCode?: string;
    isRequestingCode?: boolean;
    isGettingCode?: boolean;
    isOpeningCell?: boolean;
    isClosingCell?: boolean;
    isRequestingError?: boolean;
  } }>({});
  const [pins, setPins] = useState<{ [orderId: number]: string }>({});
  const [tripData, setTripData] = useState<{ trip_id: number; orders: Array<{ order_id: number }> } | null>(null);
  const [operatorTrips, setOperatorTrips] = useState<any[]>([]);
  const [loadingOperatorTrips, setLoadingOperatorTrips] = useState(false);
  const [orderFsmErrors, setOrderFsmErrors] = useState<Record<number, string>>({});
  const [loadingActiveTrip, setLoadingActiveTrip] = useState(false);
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [activeTrips, setActiveTrips] = useState<any[]>([]);
  
  // SSE состояния для отслеживания ошибок
  const [currentInstanceId, setCurrentInstanceId] = useState<number | null>(null);
  const [sseLastError, setSseLastError] = useState<string | null>(null);
  const [sseSuccess, setSseSuccess] = useState(false);
  const sseSubscriptionRef = useRef<any>(null);
  const uniqueCities = useMemo(() => {
    const cities = users
      .filter((user) => 
        user.city != null && 
        typeof user.city === "string" && 
        user.city !== "" &&
        user.city.trim() !== "" &&
        user.city.toLowerCase() !== "string"
      )
      .map((user) => user.city as string);
    // Удаляем дубликаты через Set
    return Array.from(new Set(cities));
  }, [users]);

  // Загрузка рейсов оператора при монтировании компонента
  useEffect(() => {
    const loadOperatorTrips = async () => {
      setLoadingOperatorTrips(true);
      try {
        const trips = await fetchOperatorTrips();
        setOperatorTrips(trips);
      } catch (error) {
        console.error('Error loading operator trips:', error);
      } finally {
        setLoadingOperatorTrips(false);
      }
    };

    loadOperatorTrips();
  }, []);

  // Загрузка активных рейсов водителя при изменении selectedDriverId
  // Заполняем directOrders данными из вложенных orders с API
  useEffect(() => {
    if (!selectedDriverId) return;
    
    const loadActiveTripOrders = async () => {
      setLoadingActiveTrip(true);
      try {
        const trips = await fetchActiveDriverTrips(parseInt(selectedDriverId));
        console.log('Active trip orders:', trips);
        
        if (trips && Array.isArray(trips)) {
          // Сохраняем рейсы в новое состояние
          setActiveTrips(trips);
          
          // Собираем все заказы из вложенного поля orders всех рейсов
          const allOrders: any[] = [];
          trips.forEach((trip: any) => {
            if (trip.orders && Array.isArray(trip.orders)) {
              trip.orders.forEach((order: any) => {
                allOrders.push({
                  order_id: order.order_id,
                  trip_id: trip.id,
                  status: order.status,
                  from_city: trip.from_city,
                  to_city: trip.to_city,
                  pickup_locker_id: trip.pickup_locker_id,
                  delivery_locker_id: trip.delivery_locker_id,
                  driver_user_id: trip.driver_user_id,
                  source_cell_id: order.source_cell_id,
                  dest_cell_id: order.dest_cell_id,
                  description: order.description,
                  pickup_type: order.pickup_type,
                  delivery_type: order.delivery_type,
                  client_user_id: order.client_user_id,
                  recipient_user_id: order.recipient_user_id,
                });
              });
            }
          });
          // Устанавливаем как прямые направления
          setDirectOrders(allOrders);
          
          // Выбираем первый рейс по умолчанию
          if (trips.length > 0) {
            setSelectedTripId(trips[0].id);
          }
        } else {
          setDirectOrders([]);
          setActiveTrips([]);
          setSelectedTripId(null);
        }
      } catch (error) {
        console.error('Error loading active trip orders:', error);
        setDirectOrders([]);
        setActiveTrips([]);
        setSelectedTripId(null);
      } finally {
        setLoadingActiveTrip(false);
      }
    };

    loadActiveTripOrders();
  }, [selectedDriverId]);

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



  const handleRequestAccessCode = async (orderId: number) => {
    setOrderStates(prev => ({
      ...prev,
      [orderId]: { ...prev[orderId], isRequestingCode: true }
    }));

    try {
      // Определяем leg на основе статуса заказа
      const order = loadingOrders.find(o => o.order_id === orderId) || 
                    directOrders.find(o => o.order_id === orderId);
      const status = order?.status || '';
      const leg = getLegFromStatus(status);
      
      const result = await performCellOperation(orderId, parseInt(selectedDriverId), "request_locker_access_code", { leg }, "driver", { targetRole: "driver", leg });
      const instanceId = result?.data?.instance_id || result?.instance_id;
      if (instanceId) {
        setCurrentInstanceId(instanceId);
      }
    } catch (error) {
      console.error('Error requesting access code:', error);
    } finally {
      setOrderStates(prev => ({
        ...prev,
        [orderId]: { ...prev[orderId], isRequestingCode: false }
      }));
    }
  };

  const handleGetAccessCode = async (orderId: number) => {
    setOrderStates(prev => ({
      ...prev,
      [orderId]: { ...prev[orderId], isGettingCode: true }
    }));

    try {
      // Определяем leg на основе статуса заказа
      const order = loadingOrders.find(o => o.order_id === orderId) || 
                    directOrders.find(o => o.order_id === orderId);
      const status = order?.status || '';
      const leg = getLegFromStatus(status);
      
      const result = await fetchAccessCodeView(orderId, leg, parseInt(selectedDriverId));
      console.log('fetchAccessCodeView result:', result);
      setOrderStates(prev => ({
        ...prev,
        [orderId]: { ...prev[orderId], accessCode: result.pin, isGettingCode: false }
      }));
    } catch (error) {
      console.error('Error getting access code:', error);
      setOrderStates(prev => ({
        ...prev,
        [orderId]: { ...prev[orderId], isGettingCode: false }
      }));
    }
  };

 const handleOpenCell = async (orderId: number, sourceCellId: number) => {
 setOrderStates(prev => ({
 ...prev,
 [orderId]: { ...prev[orderId], isOpeningCell: true }
 }));

 try {
   // Определяем leg на основе статуса заказа
   const order = loadingOrders.find(o => o.order_id === orderId) || 
                 directOrders.find(o => o.order_id === orderId);
   const status = order?.status || '';
   const leg = getLegFromStatus(status);
   
   // Для open_cell передаем source_cell_id как entity_id
   const result = await performCellOperation(sourceCellId, parseInt(selectedDriverId), "open_cell", { pin: pins[orderId], leg }, "driver", { targetRole: "driver", leg, entityType: "locker" });
   const instanceId = result?.data?.instance_id || result?.instance_id;
   if (instanceId) {
     setCurrentInstanceId(instanceId);
   }
 } catch (error) {
 console.error('Error opening cell:', error);
 } finally {
 setOrderStates(prev => ({
 ...prev,
 [orderId]: { ...prev[orderId], isOpeningCell: false }
 }));
 }
 };

 const handleCloseCell = async (orderId: number, sourceCellId: number) => {
 setOrderStates(prev => ({
 ...prev,
 [orderId]: { ...prev[orderId], isClosingCell: true }
 }));

 try {
   // Определяем leg на основе статуса заказа
   const order = loadingOrders.find(o => o.order_id === orderId) || 
                 directOrders.find(o => o.order_id === orderId);
   const status = order?.status || '';
   const leg = getLegFromStatus(status);
   
   // Для close_cell передаем source_cell_id как entity_id (та же ячейка, что и для open_cell)
   const result = await performCellOperation(sourceCellId, parseInt(selectedDriverId), "close_cell", { leg }, "driver", { targetRole: "driver", leg, entityType: "locker" });
   const instanceId = result?.data?.instance_id || result?.instance_id;
   if (instanceId) {
     setCurrentInstanceId(instanceId);
   }
 } catch (error) {
 console.error('Error closing cell:', error);
 } finally {
 setOrderStates(prev => ({
 ...prev,
 [orderId]: { ...prev[orderId], isClosingCell: false }
 }));
 }
 };

 const handleRequestError = async (orderId: number, sourceCellId: number) => {
 setOrderStates(prev => ({
 ...prev,
 [orderId]: { ...prev[orderId], isRequestingError: true }
 }));

 try {
   // Определяем leg на основе статуса заказа
   const order = loadingOrders.find(o => o.order_id === orderId) || 
                 directOrders.find(o => o.order_id === orderId);
   const status = order?.status || '';
   const leg = getLegFromStatus(status);
   
   const result = await performCellOperation(sourceCellId, parseInt(selectedDriverId), "request_locker_access_code", { leg }, "driver", { targetRole: "driver", leg, entityType: "locker" });
   const instanceId = result?.data?.instance_id || result?.instance_id;
   if (instanceId) {
     setCurrentInstanceId(instanceId);
   }
 } catch (error) {
 console.error('Error requesting error:', error);
 } finally {
 setOrderStates(prev => ({
 ...prev,
 [orderId]: { ...prev[orderId], isRequestingError: false }
 }));
 }
 };

  const handleCompleteTrip = async () => {
    if (!selectedDriverId || !selectedTripId) return;
    
    try {
      const requestData = makeFsmEnqueueRequest({
        entity_type: "trip",
        entity_id: selectedTripId,
        process_name: "complete_trip",
        user_id: parseInt(selectedDriverId),
        target_user_id: parseInt(selectedDriverId),
        target_role: "driver",
        metadata: {},
      });

      const result = await enqueueFsmRequest(requestData);
      console.log('[complete_trip] Result:', result);
      
      const instanceId = result?.data?.instance_id || result?.instance_id;
      if (instanceId) {
        setCurrentInstanceId(instanceId);
      }
      
      // Очищаем данные после успешного завершения рейса
      setDirectOrders([]);
      setReverseOrders([]);
      setTripData(null);
      setTripId(null);
      setTripState("at_from_locker");
      setSelectedTripId(null);
      setActiveTrips([]);
      setTakenDirectOrders([]);
      setSelectedDirectOrders([]);
      setTakenReverseOrders([]);
      setSelectedReverseOrders([]);
      setPlacedParcels({});
    } catch (error: any) {
      console.error('Error completing trip:', error);
      const errorMessage = error?.response?.data?.message || error?.message || (language === "ru" ? "Ошибка завершения рейса" : "Error completing trip");
      setSseLastError(errorMessage);
    }
  };

  const handleStartTrip = async (tripId?: number) => {
 if (!selectedDriverId || !tripId) return;
 try {
 const result = await performCellOperation(
 tripId,
 parseInt(selectedDriverId),
 "complete_trip",
 {},
 "driver",
 { entityType: "trip", targetRole: "driver" }
 );
 console.log('complete_trip result:', result);
 const instanceId = result?.data?.instance_id || result?.instance_id;
 if (instanceId) {
   setCurrentInstanceId(instanceId);
 }
      
 // Очищаем данные после успешного завершения рейса
 setTripData(null);
 setTripId(null);
 setTripState("at_from_locker");
 setTakenDirectOrders([]);
 setSelectedDirectOrders([]);
 setTakenReverseOrders([]);
 setSelectedReverseOrders([]);
 } catch (error: any) {
 console.error('Error completing trip:', error);
 const errorMessage = error?.response?.data?.message || error?.message || (language === "ru" ? "Ошибка завершения рейса" : "Error completing trip");
 alert(errorMessage);
 }
 };

  const handleStartTripByDirection = async (directionId: number) => {
    if (!selectedDriverId) return;
    console.log('handleStartTripByDirection called with directionId:', directionId);
    try {
      // Создаем рейс через FSM enqueue
      const fsmRequest = makeFsmEnqueueRequest({
        entity_type: "direction",
        entity_id: directionId,
        process_name: "start_trip",
        user_id: parseInt(selectedDriverId),
        target_user_id: parseInt(selectedDriverId),
        target_role: "driver",
      });

      const result = await enqueueFsmRequest(fsmRequest);
      console.log('FSM enqueue result:', result);
      
      // После успешного создания, подгружаем активные рейсы через polling
      const trips = await fetchActiveDriverTrips(parseInt(selectedDriverId));
      console.log('Active trips after start:', trips);
      
      if (trips && Array.isArray(trips) && trips.length > 0) {
        // Находим наш рейс (должен быть один в статусе in_transit или только что созданный)
        const newTrip = trips[0];
        
        if (newTrip.trip_id) {
          setTripId(newTrip.trip_id);
          setTripState("in_transit");
          setCurrentDirectionId(directionId);
          
          // Устанавливаем данные рейса из polling ответа
          setTripData({
            trip_id: newTrip.trip_id,
            orders: newTrip.orders || [],
          });
          
          // Очищаем directOrders так как рейс начат
          setDirectOrders([]);
        }
      }
      
      // Обновляем резервы после успешного старта рейса
      const updatedReservations = await fetchDriverReservations(selectedDriverId);
      setDriverReservations(updatedReservations);
    } catch (error) {
      console.error('Error starting trip:', error);
    }
  };

  const handleRemoveTrip = async (tripId: number) => {
    if (!selectedDriverId) return;
    try {
      // Используем унифицированный запрос для снятия рейса
      const request = makeFsmEnqueueRequest({
        entity_type: "trip",
        entity_id: tripId,
        process_name: "trip_assign_driver",
        user_id: parseInt(selectedDriverId),
        target_user_id: parseInt(selectedDriverId),
        target_role: "driver",
        metadata: {
          action: "remove_driver"
        }
      });

      const result = await enqueueFsmRequest(request);
      
      // Извлекаем instance_id из ответа
      const instanceId = result?.data?.instance_id || result?.instance_id;
      
      // Если есть instance_id, подписываемся на SSE
      if (instanceId) {
        setCurrentInstanceId(instanceId);
      } else {
        // Если нет instance_id, обновляем список рейсов сразу
        const updatedTrips = await fetchOperatorTrips();
        setOperatorTrips(updatedTrips);
      }
    } catch (error: any) {
      console.error('Error removing trip:', error);
      const errorMessage = error?.response?.data?.message || error?.message || (language === "ru" ? "Ошибка снятия рейса" : "Error removing trip");
      setSseLastError(errorMessage);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.driver.title}</CardTitle>
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

        <div className="mb-4">
          <Label htmlFor="city-select">{language === "ru" ? "Город" : "City"}</Label>
          <Select value={selectedCity} onValueChange={setSelectedCity}>
            <SelectTrigger id="city-select" className="w-45">
              <SelectValue placeholder={language === "ru" ? "Выберите город" : "Select city"} />
            </SelectTrigger>
            <SelectContent>
              {uniqueCities.map((city) => (
                <SelectItem key={city} value={city}>
                  {city}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {mode === "create" && (
          <div>
            <Label htmlFor="driver-id">{t.driver.driverId}</Label>
            <Select value={selectedDriverId} onValueChange={setSelectedDriverId}>
              <SelectTrigger id="driver-id">
                <SelectValue placeholder={t.driver.selectDriverId} />
              </SelectTrigger>
              <SelectContent>
                {users.filter((user) => user.role_name === "driver").map((user) => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {language === "ru" ? "Водитель" : "Driver"} #{user.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

<div>
<div className="flex items-center justify-between mb-3">
<h3 className="font-semibold">{t.driver.tripExchange}</h3>
<div className="flex items-center gap-2">
{isRefreshingDriverExchange && (
  <span className="text-xs text-muted-foreground animate-pulse">
    {language === "ru" ? "Обновление..." : "Updating..."}
  </span>
)}
</div>
</div>
<div className="border rounded-lg overflow-hidden">
<Table>
<TableHeader>
<TableRow>
<TableHead>ID</TableHead>
<TableHead>{language === "ru" ? "Откуда" : "From"}</TableHead>
<TableHead>{language === "ru" ? "Куда" : "To"}</TableHead>
<TableHead>{language === "ru" ? "Доступно" : "Available"}</TableHead>
<TableHead>{t.driver.reserve}</TableHead>
<TableHead></TableHead>
</TableRow>
</TableHeader>
<TableBody>
 {[...driverAvailableOrders].reverse().map((order) => (
<TableRow key={order.id}>
<TableCell>{order.id}</TableCell>
<TableCell>{order.from_city}</TableCell>
<TableCell>{order.to_city}</TableCell>
<TableCell>
<Badge variant="secondary">{order.orders_available}</Badge>
</TableCell>
<TableCell>
<Input
 type="number"
 min="0"
 className="w-20 h-8"
 placeholder="0"
 value={reserves[order.id] || ""}
 onChange={(e) => setReserves({ ...reserves, [order.id]: e.target.value })}
 />
</TableCell>
<TableCell>
<Button
 size="sm"
 onClick={() => handleReserveDirection(order.id, reserves[order.id] || "")}
 disabled={!reserves[order.id]}
 >
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
          </div>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Reservation ID</TableHead>
                  <TableHead>{language === "ru" ? "Зарезервировано" : "Reserved"}</TableHead>
                  <TableHead>{language === "ru" ? "Направление" : "Direction"}</TableHead>
                  <TableHead></TableHead>
                  <TableHead></TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {driverReservations && driverReservations.length > 0 ? (
                  (() => {
                    // Группировка резервов по direction_id
                    const groupedReservations = driverReservations.reduce((groups: { [key: number]: any[] }, reservation) => {
                      const dirId = reservation.direction_id;
                      if (!groups[dirId]) {
                        groups[dirId] = [];
                      }
                      groups[dirId].push(reservation);
                      return groups;
                    }, {});

                    return Object.entries(groupedReservations).map(([directionId, reservations]) => (
                      <TableRow key={directionId} className="bg-muted/30">
                        <TableCell className="font-medium">
                          {reservations.map((r: any) => (
                            <div key={r.reservation_id}>#{r.reservation_id}</div>
                          ))}
                        </TableCell>
                        <TableCell>
                          {reservations.reduce((sum: number, r: any) => sum + (r.reserved_count || 0), 0)}
                        </TableCell>
                        <TableCell>
                          {reservations[0]?.from_city} → {reservations[0]?.to_city}
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="flex flex-wrap gap-2 items-start">
                            <Button
                              size="sm"
                              onClick={() => handleStartLoading(reservations[0]?.reservation_id)}
                            >
                              {t.driver.startLoading}
                            </Button>
<Button
 size="sm"
 variant="outline"
 onClick={() => {
   handleCompleteLoading(Number(directionId));
   setCurrentDirectionId(Number(directionId));
 }}
 >
 {t.driver.completeLoading}
</Button>
                          </div>
                        </TableCell>
                        <TableCell></TableCell>
                        <TableCell>
                          {reservations.map((r: any) => (
                            <div key={r.reservation_id} className="mb-1">
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleCancelReserve(r.reservation_id)}
                              >
                                {t.driver.cancelReserve} #{r.reservation_id}
                              </Button>
                            </div>
                          ))}
                        </TableCell>
                      </TableRow>
                    ));
                  })()
                ) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      {language === "ru" ? "Нет активных резервов" : "No active reservations"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {loadingOrders && loadingOrders.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">{language === "ru" ? "Заказы для погрузки" : "Orders for loading"}</h3>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>{t.driver.actions || "Actions"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingOrders.map((order: any) => (
                    <TableRow key={order.order_id}>
                      <TableCell className="font-medium">
                        <div className="flex flex-col gap-1">
                          <span>{order.order_id}</span>
                          {orderFsmErrors[order.order_id] && (
                            <Badge variant="destructive" className="text-xs whitespace-normal">
                              {orderFsmErrors[order.order_id]}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-2">
                          {orderStates[order.order_id]?.accessCode && (
                            <div className="text-xs">
                              <span className="font-medium">{t.client.accessCode || "Access Code"}: </span>
                              <span>{orderStates[order.order_id].accessCode}</span>
                            </div>
                          )}
                          <div className="flex flex-row flex-wrap gap-2 items-center">
                            <Button
                              size="sm"
                              onClick={() => handleRequestAccessCode(order.order_id)}
                              disabled={!selectedDriverId || orderStates[order.order_id]?.isRequestingCode || orderStates[order.order_id]?.isGettingCode}
                            >
                              {orderStates[order.order_id]?.isRequestingCode ? (language === "ru" ? "Запрос..." : "Requesting...") : (language === "ru" ? "Запросить код" : "Request code")}
                            </Button>
                            <Input
                              type="text"
                              placeholder="PIN"
                              value={pins[order.order_id] || ""}
                              onChange={(e) => setPins({ ...pins, [order.order_id]: e.target.value })}
                              className="w-20 h-8 text-xs"
                            />
                            <Button
                              size="sm"
                              onClick={() => handleGetAccessCode(order.order_id)}
                              disabled={!selectedDriverId || orderStates[order.order_id]?.isGettingCode || orderStates[order.order_id]?.isRequestingCode}
                            >
                              {orderStates[order.order_id]?.isGettingCode ? (language === "ru" ? "Получаю..." : "Getting...") : (language === "ru" ? "Получить код" : "Get code")}
                            </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleOpenCell(order.order_id, order.source_cell_id)}
                                    disabled={!selectedDriverId || orderStates[order.order_id]?.isOpeningCell || orderStates[order.order_id]?.isClosingCell || orderStates[order.order_id]?.isRequestingError || !pins[order.order_id]}
                                  >
                                    {orderStates[order.order_id]?.isOpeningCell ? (language === "ru" ? "Открываю..." : "Opening...") : t.client.openCell}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleCloseCell(order.order_id, order.source_cell_id)}
                                    disabled={!selectedDriverId || orderStates[order.order_id]?.isClosingCell || orderStates[order.order_id]?.isOpeningCell || orderStates[order.order_id]?.isRequestingError}
                                  >
                                    {orderStates[order.order_id]?.isClosingCell ? (language === "ru" ? "Закрываю..." : "Closing...") : t.client.closeCell}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleRequestError(order.order_id, order.source_cell_id)}
                                    disabled={!selectedDriverId || orderStates[order.order_id]?.isRequestingError || orderStates[order.order_id]?.isOpeningCell || orderStates[order.order_id]?.isClosingCell}
                                  >
                                    {orderStates[order.order_id]?.isRequestingError ? (language === "ru" ? "Отправка..." : "Sending...") : t.client.error}
                                  </Button>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}


          <div className="border-t pt-6">
            <h3 className="font-semibold mb-4">{t.driver.activeTrip}</h3>
            <div className="space-y-4">
              {loadingActiveTrip && (
                <div className="text-center text-muted-foreground py-4">
                  {language === "ru" ? "Загрузка..." : "Loading..."}
                </div>
              )}

              {activeTrips.length > 0 && (
                <div className="mb-4">
                  <Label htmlFor="trip-select">{language === "ru" ? "Выберите рейс" : "Select trip"}</Label>
                  <Select 
                    value={selectedTripId?.toString() || ""} 
                    onValueChange={(value) => setSelectedTripId(Number(value))}
                  >
                    <SelectTrigger id="trip-select" className="w-full">
                      <SelectValue placeholder={language === "ru" ? "Выберите рейс" : "Select trip"} />
                    </SelectTrigger>
                    <SelectContent>
                      {activeTrips.map((trip) => (
                        <SelectItem key={trip.id} value={trip.id.toString()}>
                          {language === "ru" ? "Рейс" : "Trip"} #{trip.id}: {trip.from_city} → {trip.to_city} ({trip.orders?.length || 0} {language === "ru" ? "заказов" : "orders"})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedTripId && activeTrips.find(t => t.id === selectedTripId) && (
                <div className="mb-4 p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant="default" className="bg-blue-600">
                      {t.driver.tripId}: {selectedTripId}
                    </Badge>
                    <span className="text-sm">
                      {activeTrips.find(t => t.id === selectedTripId)?.from_city} → {activeTrips.find(t => t.id === selectedTripId)?.to_city}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {activeTrips.find(t => t.id === selectedTripId)?.orders?.length || 0} {language === "ru" ? "заказов" : "orders"}
                    </span>
                  </div>
                  
                </div>
              )}

              <div>
                <h3 className="font-semibold mb-3">{t.driver.directOrders}</h3>
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12"></TableHead>
                        <TableHead>{t.driver.orderId}</TableHead>
                        <TableHead>{language === "ru" ? "Откуда" : "From"}</TableHead>
                        <TableHead>{language === "ru" ? "Куда" : "To"}</TableHead>
                        <TableHead>{language === "ru" ? "Описание" : "Description"}</TableHead>
                        <TableHead>{language === "ru" ? "Ячейка (откуда)" : "Cell (from)"}</TableHead>
                        <TableHead>{language === "ru" ? "Ячейка (куда)" : "Cell (to)"}</TableHead>
                        <TableHead>{t.driver.actions || "Actions"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {directOrders && directOrders.length > 0 && selectedTripId ? directOrders.filter(order => order.trip_id === selectedTripId).map((order) => {
                        const isTaken = takenDirectOrders.includes(order.order_id);
                        const canCheck = tripState === "at_from_locker" && !isTaken;
                        return (
                          <TableRow key={order.order_id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedDirectOrders.includes(order.order_id) || isTaken}
                                disabled={!canCheck}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedDirectOrders([...selectedDirectOrders, order.order_id]);
                                  } else {
                                    setSelectedDirectOrders(
                                      selectedDirectOrders.filter((id) => id !== order.order_id),
                                    );
                                  }
                                }}
                              />
                            </TableCell>
                            <TableCell className="font-medium">#{order.order_id}</TableCell>
                            <TableCell>{order.from_city}</TableCell>
                            <TableCell>{order.to_city}</TableCell>
                            <TableCell>{order.description}</TableCell>
                            <TableCell>{order.source_cell_id}</TableCell>
                            <TableCell>{order.dest_cell_id}</TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-2">
                                {orderStates[order.order_id]?.accessCode && (
                                  <div className="text-xs">
                                    <span className="font-medium">{t.client.accessCode || "Access Code"}: </span>
                                    <span>{orderStates[order.order_id].accessCode}</span>
                                  </div>
                                )}
                                <div className="flex flex-row flex-wrap gap-2 items-center">
                                  <Button
                                    size="sm"
                                    onClick={() => handleRequestAccessCode(order.order_id)}
                                    disabled={!selectedDriverId || orderStates[order.order_id]?.isRequestingCode || orderStates[order.order_id]?.isGettingCode}
                                  >
                                    {orderStates[order.order_id]?.isRequestingCode ? (language === "ru" ? "Запрос..." : "Requesting...") : (language === "ru" ? "Запросить код" : "Request code")}
                                  </Button>
                                  <Input
                                    type="text"
                                    placeholder="PIN"
                                    value={pins[order.order_id] || ""}
                                    onChange={(e) => setPins({ ...pins, [order.order_id]: e.target.value })}
                                    className="w-20 h-8 text-xs"
                                  />
                                  <Button
                                    size="sm"
                                    onClick={() => handleGetAccessCode(order.order_id)}
                                    disabled={!selectedDriverId || orderStates[order.order_id]?.isGettingCode || orderStates[order.order_id]?.isRequestingCode}
                                  >
                                    {orderStates[order.order_id]?.isGettingCode ? (language === "ru" ? "Получаю..." : "Getting...") : (language === "ru" ? "Получить код" : "Get code")}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleOpenCell(order.order_id, order.source_cell_id)}
                                    disabled={!selectedDriverId || orderStates[order.order_id]?.isOpeningCell || orderStates[order.order_id]?.isClosingCell || orderStates[order.order_id]?.isRequestingError || !pins[order.order_id]}
                                  >
                                    {orderStates[order.order_id]?.isOpeningCell ? (language === "ru" ? "Открываю..." : "Opening...") : t.client.openCell}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleCloseCell(order.order_id, order.source_cell_id)}
                                    disabled={!selectedDriverId || orderStates[order.order_id]?.isClosingCell || orderStates[order.order_id]?.isOpeningCell || orderStates[order.order_id]?.isRequestingError}
                                  >
                                    {orderStates[order.order_id]?.isClosingCell ? (language === "ru" ? "Закрываю..." : "Closing...") : t.client.closeCell}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => handleRequestError(order.order_id, order.source_cell_id)}
                                    disabled={!selectedDriverId || orderStates[order.order_id]?.isRequestingError || orderStates[order.order_id]?.isOpeningCell || orderStates[order.order_id]?.isClosingCell}
                                  >
                                    {orderStates[order.order_id]?.isRequestingError ? (language === "ru" ? "Отправка..." : "Sending...") : t.client.error}
                                  </Button>
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      }) : (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground">
                            {language === "ru" ? "Нет заказов для выбранного рейса" : "No orders for selected trip"}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleStartTripByDirection(currentDirectionId)}
                  >
                    {t.driver.startTrip}
                  </Button>
                    <Button
                      size="sm"
                      onClick={handleCompleteTrip}
                      disabled={!selectedDriverId}
                    >
                      {t.driver.completeTrip || "Завершение рейса"}
                    </Button>
                  
                </div>
              </div>

              {tripState === "at_to_locker" ? (
                <>
                  <div>
                    <h3 className="font-semibold mb-3">{t.driver.reverseOrders}</h3>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12"></TableHead>
                            <TableHead>{t.driver.orderId}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {tripData?.orders.map((order) => {
                            const isTaken = takenReverseOrders.includes(order.order_id);
                            const canCheck = !isTaken;
                            return (
                              <TableRow key={order.order_id}>
                                <TableCell>
                                  <Checkbox
                                    checked={selectedReverseOrders.includes(order.order_id) || isTaken}
                                    disabled={!canCheck}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setSelectedReverseOrders([...selectedReverseOrders, order.order_id]);
                                      } else {
                                        setSelectedReverseOrders(
                                          selectedReverseOrders.filter((id) => id !== order.order_id),
                                        );
                                      }
                                    }}
                                  />
                                </TableCell>
                                <TableCell>{order.order_id}</TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                  <div className="mt-6">
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
                              const sizeOrder = { P: 1, S: 2, M: 3, L: 4 };
                              const cellSizeValue = sizeOrder[cell.size as keyof typeof sizeOrder] || 0;

                              const availableOrders = [...takenDirectOrders, ...takenReverseOrders]
                                .map((orderId) => {
                                  const order = tripData?.orders.find((o) => o.order_id === orderId);
                                  return order;
                                })
                                .filter((order) => {
                                  if (!order) return false;
                                  return true;
                                });

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
                                          handlePlaceParcelInCell(Number.parseInt(orderId), cell.number, pins[Number.parseInt(orderId)] || "")
                                        }
                                      >
                                        <SelectTrigger className="w-40">
                                          <SelectValue placeholder={t.driver.placeInCell} />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {availableOrders.map((order) => (
                                            <SelectItem key={order!.order_id} value={order!.order_id.toString()}>
                                              {language === "ru" ? "Заказ" : "Order"} #{order!.order_id}
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
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                <div className="flex gap-2 mt-3">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleStartTripByDirection(currentDirectionId)}
                  > 
                    {t.driver.startTrip}
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleCompleteTrip}
                    disabled={!selectedDriverId}
                  >
                    {t.driver.completeTrip || "Завершение рейса"}
                  </Button>
                </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
      </CardContent>
    </Card>
  );
}
