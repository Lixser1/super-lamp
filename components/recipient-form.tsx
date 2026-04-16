"use client"
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { enqueueFsmRequest, fetchAccessCodeView, fetchOrderTrack, fetchOrdersByRecipient, makeFsmEnqueueRequest, subscribeToFsmInstanceEvents } from "@/lib/api";
import { performCellOperation } from "@/lib/utils";
import { useEffect, useState, useRef } from "react";
import { getLegFromStatus } from "@/lib/cell-operations";
import { SSEErrorTracker } from "@/components/sse-error-tracker";

interface RecipientFormProps {
  selectedRecipientId: string;
  setSelectedRecipientId: (id: string) => void;
  mode: "create" | "run";
  t: any;
  language: string;
  users: Array<{ id: number; name: string; role_name: string }>;
  addLog: (log: any) => void;
  highlightedAction: string | null;
}


export function RecipientForm({
  selectedRecipientId,
  setSelectedRecipientId,
  mode,
  t,
  language,
  users,
  addLog,
  highlightedAction,
}: RecipientFormProps) {

  const [recipientOrderId, setRecipientOrderId] = useState("")
  const [recipientTracking, setRecipientTracking] = useState<Array<{ status: string; isCurrent: boolean; date?: string; time?: string }>>([])
  const [recipientOrderDetails, setRecipientOrderDetails] = useState<{
    id: number;
    locker: string;
    cell: string;
    recipientDelivery: "self" | "courier";
    deliveryType?: string;
    currentStatus: string;
    isCompleted?: boolean;
    isOpeningCell?: boolean;
    isClosingCell?: boolean;
    isRequestingError?: boolean;
  } | null>(null)
  const [recipientLeg, setRecipientLeg] = useState<"pickup" | "delivery">("pickup")
  const [pinDisplay, setPinDisplay] = useState<string | null>(null)

  const [recipientOrders, setRecipientOrders] = useState<any[]>([])
  const [isLoadingRecipientOrders, setIsLoadingRecipientOrders] = useState(false)

  // Состояния для SSE отслеживания
  const [currentInstanceId, setCurrentInstanceId] = useState<number | null>(null)
  const [sseLastError, setSseLastError] = useState<string | null>(null)
  const [sseSuccess, setSseSuccess] = useState(false)
  const sseSubscriptionRef = useRef<any>(null)

  const loadRecipientOrders = async (recipientId: string) => {
    if (!recipientId) {
      setRecipientOrders([])
      return
    }

    setIsLoadingRecipientOrders(true)
    try {
      const orders = await fetchOrdersByRecipient(recipientId)
      const normalized = orders.map((order: any) => ({
        ...order,
        isOpeningCell: false,
        isClosingCell: false,
        isRequestingError: false,
        isRequestingCode: false,
        isGettingCode: false,
        isSubmittingError: false,
        pin: "",
        accessCode: undefined,
      }))
      setRecipientOrders(normalized)
    } catch (error) {
      console.error("Error loading recipient orders:", error)
      setRecipientOrders([])
    } finally {
      setIsLoadingRecipientOrders(false)
    }
  }

  const handleRecipientLookup = async () => {
    const orderIdToLookup = recipientOrderId
    if (!orderIdToLookup) return;

    try {
      const data = await fetchOrderTrack(parseInt(orderIdToLookup));

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
      const isCompleted = !!data.path?.find(
        (item: any) => item.status === 'order_parcel_confirmed_post2' && item.is_completed,
      )
      const leg: "pickup" | "delivery" = getLegFromStatus(data.current_status)

      setRecipientOrderDetails({
        id: data.order_id,
        locker: '', // Нет в данных
        cell: '', // Нет в данных
        recipientDelivery: data.delivery_type === 'courier' ? 'courier' : 'self',
        deliveryType: data.delivery_type,
        currentStatus: data.current_status,
        isCompleted,
        isOpeningCell: false,
        isClosingCell: false,
        isRequestingError: false,
      });
      setRecipientLeg(leg)
      setPinDisplay(null); // Сброс PIN при новом поиске

      setRecipientTracking(tracking);
      addLog({
        role: "recipient",
        action: "lookup_order",
        order_id: parseInt(recipientOrderId),
      });
    } catch (error) {
      console.error('Error fetching order track:', error);
      setRecipientTracking([]);
      setRecipientOrderDetails(null);
      setRecipientLeg("pickup")
      setPinDisplay(null);
    }
  };

    
  // Загрузка заказов выбранного получателя
  useEffect(() => {
    if (selectedRecipientId) {
      loadRecipientOrders(selectedRecipientId)
    } else {
      setRecipientOrders([])
    }
  }, [selectedRecipientId])

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

  // Функция для отправки запроса на создание пина (request_locker_access_code)
  const handleCreatePin = async () => {
    if (!recipientOrderDetails) return;

    const requestData = makeFsmEnqueueRequest({
      entity_type: "order",
      entity_id: recipientOrderDetails.id,
      process_name: "request_locker_access_code",
      user_id: parseInt(selectedRecipientId),
      target_user_id: parseInt(selectedRecipientId),
      user_role: "recipient",
      metadata: {
        leg: recipientLeg,
      },
    });

    try {
      const result = await enqueueFsmRequest(requestData);
      addLog({
        role: "recipient",
        action: "request_locker_access_code",
        order_id: recipientOrderDetails.id,
        result,
      });

      // Извлекаем instance_id из data.instance_id
      const instanceId = result?.data?.instance_id || result?.instance_id;
      
      // Если есть instance_id, подписываемся на SSE
      if (instanceId) {
        setCurrentInstanceId(instanceId);
      }
    } catch (error) {
      console.error('Error creating pin:', error);
      addLog({
        role: "recipient",
        action: "request_locker_access_code_error",
        order_id: recipientOrderDetails.id,
        error: String(error),
      });
    }
  };

  // Функция для получения PIN-кода
  const handleShowPin = async () => {
    if (!recipientOrderDetails) return;

    try {
      const data = await fetchAccessCodeView(
        recipientOrderDetails.id,
        recipientLeg,
        parseInt(selectedRecipientId)
      );
      setPinDisplay(data.pin);
      addLog({
        role: "recipient",
        action: "show_pin",
        order_id: recipientOrderDetails.id,
        pin: data.pin,
      });
    } catch (error) {
      console.error('Error fetching PIN:', error);
      setPinDisplay(null);
      addLog({
        role: "recipient",
        action: "show_pin_error",
        order_id: recipientOrderDetails.id,
        error: String(error),
      });
    }
  };

  // Открыть ячейку
  const handleOpenCell = async () => {
    if (!recipientOrderDetails) return;

    setRecipientOrderDetails(prev => prev ? { ...prev, isOpeningCell: true } : null);

    const requestData = makeFsmEnqueueRequest({
      entity_type: "order",
      entity_id: recipientOrderDetails.id,
      process_name: "open_cell",
      user_id: parseInt(selectedRecipientId),
      target_user_id: parseInt(selectedRecipientId),
      user_role: "recipient",
      metadata: {},
    });

    try {
      const result = await enqueueFsmRequest(requestData);
      addLog({
        role: "recipient",
        action: "open_cell",
        order_id: recipientOrderDetails.id,
        data: result,
      });

      // Извлекаем instance_id из data.instance_id
      const instanceId = result?.data?.instance_id || result?.instance_id;
      
      // Если есть instance_id, подписываемся на SSE
      if (instanceId) {
        setCurrentInstanceId(instanceId);
      }
    } catch (error) {
      console.error('Error opening cell:', error);
    } finally {
      setRecipientOrderDetails(prev => prev ? { ...prev, isOpeningCell: false } : null);
    }
  };

  // Закрыть ячейку
  const handleCloseCell = async () => {
    if (!recipientOrderDetails) return;

    setRecipientOrderDetails(prev => prev ? { ...prev, isClosingCell: true } : null);

    const requestData = makeFsmEnqueueRequest({
      entity_type: "order",
      entity_id: recipientOrderDetails.id,
      process_name: "close_cell",
      user_id: parseInt(selectedRecipientId),
      target_user_id: parseInt(selectedRecipientId),
      user_role: "recipient",
      metadata: {},
    });

    try {
      const result = await enqueueFsmRequest(requestData);
      addLog({
        role: "recipient",
        action: "close_cell",
        order_id: recipientOrderDetails.id,
        data: result,
      });

      // Извлекаем instance_id из data.instance_id
      const instanceId = result?.data?.instance_id || result?.instance_id;
      
      // Если есть instance_id, подписываемся на SSE
      if (instanceId) {
        setCurrentInstanceId(instanceId);
      }
    } catch (error) {
      console.error('Error closing cell:', error);
    } finally {
      setRecipientOrderDetails(prev => prev ? { ...prev, isClosingCell: false } : null);
    }
  };

  const updateRecipientOrderById = (orderId: number, patch: Partial<any>) => {
    setRecipientOrders(prev =>
      prev.map(order =>
        order.id === orderId
          ? { ...order, ...patch }
          : order
      )
    )
  }

  const handleRequestError = async () => {
    if (!recipientOrderDetails) return;

    setRecipientOrderDetails(prev => prev ? { ...prev, isRequestingError: true } : null);

    const requestData = makeFsmEnqueueRequest({
      entity_type: "order",
      entity_id: recipientOrderDetails.id,
      process_name: "request_locker_access_code",
      user_id: parseInt(selectedRecipientId),
      target_user_id: parseInt(selectedRecipientId),
      user_role: "recipient",
      metadata: {},
    });

    try {
      const result = await enqueueFsmRequest(requestData);
      addLog({
        role: "recipient",
        action: "request_locker_access_code",
        order_id: recipientOrderDetails.id,
        data: result,
      });
    } catch (error) {
      console.error('Error requesting error:', error);
    } finally {
      setRecipientOrderDetails(prev => prev ? { ...prev, isRequestingError: false } : null);
    }
  };

  const handleRequestErrorOrder = async (order: any) => {
    updateRecipientOrderById(order.id, { isRequestingError: true });

    const requestData = makeFsmEnqueueRequest({
      entity_type: "order",
      entity_id: order.id,
      process_name: "request_locker_access_code",
      user_id: parseInt(selectedRecipientId),
      target_user_id: parseInt(selectedRecipientId),
      user_role: "recipient",
      metadata: {},
    });

    try {
      const result = await enqueueFsmRequest(requestData);
      addLog({
        role: "recipient",
        action: "request_locker_access_code",
        order_id: order.id,
        data: result,
      });
    } catch (error) {
      console.error('Error requesting error for order:', error);
    } finally {
      updateRecipientOrderById(order.id, { isRequestingError: false });
    }
  };

  const handleRequestAccessCodeForOrder = async (order: any) => {
    updateRecipientOrderById(order.id, { isRequestingCode: true });

    try {
      const leg = getLegFromStatus(order.status);
      const result = await performCellOperation(order.id, parseInt(selectedRecipientId), "request_locker_access_code", { leg }, "recipient");
      updateRecipientOrderById(order.id, { accessCode: result?.pin || order.accessCode });
      const instanceId = result?.data?.instance_id || result?.instance_id;
      if (instanceId) {
        setCurrentInstanceId(instanceId);
      }
      addLog({
        role: "recipient",
        action: "request_access_code",
        order_id: order.id,
        data: result,
      });
    } catch (error) {
      console.error('Error requesting access code for order:', error);
    } finally {
      updateRecipientOrderById(order.id, { isRequestingCode: false });
    }
  };

  const handleGetOrderAccessCode = async (order: any) => {
    updateRecipientOrderById(order.id, { isGettingCode: true });

    try {
      const leg = getLegFromStatus(order.status);
      const result = await fetchAccessCodeView(order.id, leg, parseInt(selectedRecipientId));
      updateRecipientOrderById(order.id, { accessCode: result.pin, isGettingCode: false });
    } catch (error) {
      console.error('Error getting access code for order:', error);
      updateRecipientOrderById(order.id, { isGettingCode: false });
    }
  };

  const handleOpenOrderCell = async (order: any) => {
    updateRecipientOrderById(order.id, { isOpeningCell: true });

    try {
      const leg = getLegFromStatus(order.status);
      const result = await performCellOperation(order.id, parseInt(selectedRecipientId), "open_cell", { pin: order.pin, leg }, "recipient");
      const instanceId = result?.data?.instance_id || result?.instance_id;
      if (instanceId) {
        setCurrentInstanceId(instanceId);
      }
      addLog({ role: "recipient", action: "open_cell", order_id: order.id, data: result });
    } catch (error) {
      console.error('Error opening cell for order:', error);
    } finally {
      updateRecipientOrderById(order.id, { isOpeningCell: false });
    }
  };

  const handleCloseOrderCell = async (order: any) => {
    updateRecipientOrderById(order.id, { isClosingCell: true });

    try {
      const result = await performCellOperation(order.id, parseInt(selectedRecipientId), "close_cell", {}, "recipient");
      const instanceId = result?.data?.instance_id || result?.instance_id;
      if (instanceId) {
        setCurrentInstanceId(instanceId);
      }
      addLog({ role: "recipient", action: "close_cell", order_id: order.id, data: result });
    } catch (error) {
      console.error('Error closing cell for order:', error);
    } finally {
      updateRecipientOrderById(order.id, { isClosingCell: false });
    }
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.recipient.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg">
          <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
            {t.recipient.testOrders}
          </h3>
          <p className="text-sm text-blue-700 dark:text-blue-300 mb-3">
            {t.recipient.testOrdersDesc}
          </p>
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
                {users.filter((user) => user.role_name === "recipient" || user.role_name === "client").map((user) => (
                  <SelectItem key={user.id} value={user.id.toString()}>
                    {language === "ru" ? "Получатель" : "Recipient"} #{user.id}
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
                value={recipientOrderId}
                onChange={(e) => setRecipientOrderId(e.target.value)}
                placeholder={t.recipient.orderId}
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

              {/* SSE ошибки в реальном времени */}
              {currentInstanceId && (
                <SSEErrorTracker
                  instanceId={currentInstanceId}
                  language={language}
                  onClear={() => {
                    setCurrentInstanceId(null);
                    setSseLastError(null);
                    setSseSuccess(false);
                  }}
                />
              )}
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recipientTracking.map((track, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <Badge variant={track.isCurrent ? "default" : "secondary"}>
                            {track.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {recipientOrderDetails && (
                <div className="mt-4 flex gap-2 items-center">
                  <Button onClick={handleCreatePin}>
                    {language === "ru" ? "Создать PIN" : "Create PIN"}
                  </Button>
                  <Button onClick={handleShowPin} variant="outline">
                    {language === "ru" ? "Отобразить PIN" : "Show PIN"}
                  </Button>
                  {pinDisplay && (
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">{language === "ru" ? "PIN:" : "PIN:"}</span>
                      <Badge variant="default" className="text-lg px-3 py-1">
                        {pinDisplay}
                      </Badge>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            recipientOrderId && (
              <div className="text-sm text-muted-foreground p-4 bg-muted rounded-lg">
                {t.recipient.noTracking}
              </div>
            )
          )}

          {recipientOrders.length > 0 && (
            <div className="mb-4">
              <h3 className="font-semibold mb-3">{language === "ru" ? "Заказы получателя" : "Recipient Orders"}</h3>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.recipient.orderId}</TableHead>
                      <TableHead>{t.recipient.status}</TableHead>
                      <TableHead>{t.recipient.description}</TableHead>
                      <TableHead>{t.recipient.deliveryType || "Delivery"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recipientOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>{order.id}</TableCell>
                        <TableCell>{order.status}</TableCell>
                        <TableCell>{order.description}</TableCell>
                        <TableCell>{order.delivery_type}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 flex-wrap">
          {recipientOrderDetails &&
            recipientOrderDetails.currentStatus === "Поступил в постамат получения" &&
            recipientOrderDetails.recipientDelivery === "self" && (
              <Button
                onClick={() =>
                  addLog({
                    role: "recipient",
                    action: "pickup_from_locker",
                    order_id: recipientOrderDetails.id
                  })
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
                onClick={handleCreatePin}
                className={highlightedAction === "confirm_delivery" ? "animate-pulse" : ""}
              >
                {t.recipient.confirmDelivery}
              </Button>
            )}

          {/* Кнопки для delivery_type === "self" */}
          {recipientOrderDetails && recipientOrderDetails.deliveryType === "self" && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={handleOpenCell}
                disabled={!selectedRecipientId || recipientOrderDetails.isOpeningCell || recipientOrderDetails.isClosingCell || recipientOrderDetails.isRequestingError}
              >
                {recipientOrderDetails.isOpeningCell ? (language === "ru" ? "Открываю..." : "Opening...") : t.client.openCell}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCloseCell}
                disabled={!selectedRecipientId || recipientOrderDetails.isClosingCell || recipientOrderDetails.isOpeningCell || recipientOrderDetails.isRequestingError}
              >
                {recipientOrderDetails.isClosingCell ? (language === "ru" ? "Закрываю..." : "Closing...") : t.client.closeCell}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={handleRequestError}
                disabled={!selectedRecipientId || recipientOrderDetails.isRequestingError || recipientOrderDetails.isOpeningCell || recipientOrderDetails.isClosingCell}
              >
                {recipientOrderDetails.isRequestingError ? (language === "ru" ? "Отправка..." : "Sending...") : t.client.error}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
