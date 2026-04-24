"use client"
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { enqueueFsmRequest, fetchAccessCodeView, fetchOrderTrack, fetchOrdersByRecipient, makeFsmEnqueueRequest, subscribeToFsmInstanceEvents } from "@/lib/api";
import { performCellOperation } from "@/lib/utils";
import { useEffect, useState, useRef } from "react";
import { getLegFromStatus } from "@/lib/cell-operations";
import { SSEErrorTracker } from "@/components/sse-error-tracker";
import { useLanguage } from "@/lib/language-context";

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
  const { t: tCommon } = useLanguage();

  const [recipientOrderId, setRecipientOrderId] = useState("")
  const [recipientTracking, setRecipientTracking] = useState<Array<{ status: string; isCurrent: boolean; isCompleted: boolean; date?: string; time?: string }>>([])
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
  const [recipientLeg, setRecipientLeg] = useState<"pickup" | "delivery">("delivery")
  const [pinDisplay, setPinDisplay] = useState<string | null>(null)

  const [recipientOrders, setRecipientOrders] = useState<any[]>([])
  const [isLoadingRecipientOrders, setIsLoadingRecipientOrders] = useState(false)
  const [selectedOrderForCell, setSelectedOrderForCell] = useState<any>(null)

  // Состояния для SSE отслеживания
  const [currentInstanceId, setCurrentInstanceId] = useState<number | null>(null)
  const [sseLastError, setSseLastError] = useState<string | null>(null)
  const [sseSuccess, setSseSuccess] = useState(false)
  const sseSubscriptionRef = useRef<any>(null)

  // Состояния для модала ошибки
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false)
  const [selectedErrorType, setSelectedErrorType] = useState<string>("")
  const [currentOrderId, setCurrentOrderId] = useState<number | null>(null)

  // Полинг для заказов получателя
  const recipientIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const [isTabActive, setIsTabActive] = useState(true)
  const [pollingInterval, setPollingInterval] = useState(20000)
  const [lastFetchTime, setLastFetchTime] = useState<{ [key: string]: number }>({})

  // Типы ошибок для получателя
  const recipientErrorTypes = [
    { value: "parcel_missing", label: language === "ru" ? "Посылка не найдена" : "Parcel missing" },
    { value: "parcel_damaged", label: language === "ru" ? "Посылка повреждена" : "Parcel damaged" },
    { value: "wrong_parcel", label: language === "ru" ? "Не та посылка" : "Wrong parcel" },
    { value: "cancelled_by_client", label: language === "ru" ? "Отменено клиентом" : "Cancelled by client" },
    { value: "manual_override", label: language === "ru" ? "Ручное вмешательство" : "Manual override" },
    { value: "other", label: language === "ru" ? "Другая ошибка" : "Other" },
  ]

  const loadRecipientOrders = async (recipientId: string) => {
    if (!recipientId) {
      setRecipientOrders([])
      return
    }

    setIsLoadingRecipientOrders(true)
    try {
      const now = Date.now()
      const lastFetch = lastFetchTime['recipient'] || 0

      if (now - lastFetch < pollingInterval - 1000) {
        return
      }

      setLastFetchTime(prev => ({ ...prev, recipient: now }))
      const startTime = Date.now()

      const orders = await fetchOrdersByRecipient(recipientId)
      const normalized = orders.map((order: any) => ({
        ...order,
        pin: "",
        accessCode: undefined,
        isRequestingCode: false,
        isGettingCode: false,
        isOpeningCell: false,
        isClosingCell: false,
        isSubmittingError: false,
        fsmError: null,
      }))
      setRecipientOrders(normalized)

      const duration = Date.now() - startTime

      if (duration > 3000) {
        console.warn('Slow recipient request, increasing interval')
        setPollingInterval(prev => Math.min(prev * 1.5, 60000))
      } else if (duration < 1000 && pollingInterval > 5000) {
        setPollingInterval(prev => Math.max(prev / 1.5, 5000))
      }
    } catch (error) {
      console.error("Error loading recipient orders:", error)
      setRecipientOrders([])
      setPollingInterval(prev => Math.min(prev * 2, 60000))
    } finally {
      setIsLoadingRecipientOrders(false)
    }
  }

  const handleRecipientLookup = async () => {
    const orderIdToLookup = recipientOrderId
    if (!orderIdToLookup) return;

    try {
      const data = await fetchOrderTrack(parseInt(orderIdToLookup));

      // Обработка path: показываем ВСЕ статусы с пометками
      const tracking = data.path.map((item: any) => ({
        status: item.status,
        isCurrent: item.is_current,
        isCompleted: item.is_completed,
        date: '',
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

  // Полинг для заказов получателя
  useEffect(() => {
    if (!selectedRecipientId || !isTabActive) return;

    loadRecipientOrders(selectedRecipientId);

    const doPoll = async () => {
      const now = Date.now();
      const lastFetch = lastFetchTime['recipient'] || 0;

      if (now - lastFetch < pollingInterval - 1000) {
        return;
      }

      setLastFetchTime(prev => ({ ...prev, recipient: now }));
      await loadRecipientOrders(selectedRecipientId);
    };

    if (recipientIntervalRef.current) clearInterval(recipientIntervalRef.current);
    recipientIntervalRef.current = setInterval(doPoll, pollingInterval);

    return () => {
      if (recipientIntervalRef.current) clearInterval(recipientIntervalRef.current);
    };
  }, [selectedRecipientId, isTabActive, pollingInterval, lastFetchTime]);

  // Отслеживание активности вкладки
  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabActive(!document.hidden)
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

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

  const updateRecipientOrderById = (orderId: number, patch: Partial<any>) => {
    setRecipientOrders(prev =>
      prev.map(order =>
        order.id === orderId
          ? { ...order, ...patch }
          : order
      )
    )
  }

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
      updateRecipientOrderById(order.id, { accessCode: result.code || result.pin, isGettingCode: false });
    } catch (error) {
      console.error('Error getting access code for order:', error);
      updateRecipientOrderById(order.id, { isGettingCode: false });
    }
  };

  const handleOpenOrderCell = async (order: any) => {
    const orderData = recipientOrders.find(o => o.id === order.id);
    if (!orderData) return;

    updateRecipientOrderById(order.id, { isOpeningCell: true });

    try {
      const leg = getLegFromStatus(order.status);
      const result = await performCellOperation(order.id, parseInt(selectedRecipientId), "open_cell", { pin: orderData.pin, leg }, "recipient");
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
      const leg = getLegFromStatus(order.status);
      const result = await performCellOperation(order.id, parseInt(selectedRecipientId), "close_cell", { leg }, "recipient");
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

  const handleRequestError = (orderId: number) => {
    setCurrentOrderId(orderId);
    setSelectedErrorType("");
    setIsErrorModalOpen(true);
  }

  // Функция для отправки ошибки
  const handleSubmitError = async () => {
    if (!currentOrderId || !selectedErrorType) return;

    updateRecipientOrderById(currentOrderId, { isSubmittingError: true });

    try {
      const requestData = makeFsmEnqueueRequest({
        entity_type: "order",
        entity_id: currentOrderId,
        process_name: "report_error",
        user_id: parseInt(selectedRecipientId),
        metadata: { error_type: selectedErrorType },
      });

      const result = await enqueueFsmRequest(requestData);

      addLog({
        role: "recipient",
        action: "report_error",
        data: result,
      });

      // Извлекаем instance_id из data.instance_id
      const instanceId = result?.data?.instance_id || result?.instance_id;
      
      // Если есть instance_id, подписываемся на SSE
      if (instanceId) {
        setCurrentInstanceId(instanceId);
      }

      setIsErrorModalOpen(false);
      setCurrentOrderId(null);
      setSelectedErrorType("");
    } catch (error) {
      console.error('Error reporting error:', error);
    } finally {
      updateRecipientOrderById(currentOrderId, { isSubmittingError: false });
    }
  }

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

          {recipientOrders.length > 0 && (
            <div className="mb-4">
              <h3 className="font-semibold mb-3">{language === "ru" ? "Заказы получателя" : "Recipient Orders"}</h3>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t.recipient.orderId}</TableHead>
                      <TableHead>{t.recipient.status}</TableHead>
                      <TableHead>{t.recipient.description}</TableHead>
                      <TableHead>Доставка</TableHead>
                      <TableHead>Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recipientOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>{order.id}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{order.status}</Badge>
                        </TableCell>
                        <TableCell>{order.description}</TableCell>
                        <TableCell>{order.delivery_type}</TableCell>
                        <TableCell>
                          <div className="flex flex-col gap-2">
                            {order.accessCode && (
                              <div className="text-xs">
                                <span className="font-medium">{language === "ru" ? "Код доступа: " : "Access Code: "}</span>
                                <span>{order.accessCode}</span>
                              </div>
                            )}
                            <div className="flex flex-row flex-wrap gap-2 items-center">
                              <Button
                                size="sm"
                                onClick={() => handleRequestAccessCodeForOrder(order)}
                                disabled={order.isRequestingCode || order.isGettingCode || order.isSubmittingError || order.isOpeningCell || order.isClosingCell || (order.delivery_type === 'courier' && order.status !== 'order_courier2_parcel_delivered') || (order.delivery_type === 'self' && order.status !== 'order_parcel_confirmed_post2')}
                              >
                                {order.isRequestingCode ? (language === "ru" ? "Запрос..." : "Requesting...") : (language === "ru" ? "Запросить код" : "Request code")}
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleGetOrderAccessCode(order)}
                                disabled={order.isGettingCode || order.isRequestingCode || order.isSubmittingError || order.isOpeningCell || order.isClosingCell || (order.delivery_type === 'courier' && order.status !== 'order_courier2_parcel_delivered') || (order.delivery_type === 'self' && order.status !== 'order_parcel_confirmed_post2')}
                              >
                                {order.isGettingCode ? (language === "ru" ? "Получаю..." : "Getting...") : (language === "ru" ? "Получить код" : "Get code")}
                              </Button>
                              <Input
                                type="text"
                                placeholder={language === "ru" ? "Введите PIN" : "Enter PIN"}
                                value={order.pin || ""}
                                onChange={(e) => updateRecipientOrderById(order.id, { pin: e.target.value })}
                                className="w-24 h-8 text-xs"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenOrderCell(order)}
                                disabled={order.isOpeningCell || order.isClosingCell || order.isSubmittingError || order.delivery_type !== 'self' || (order.status !== 'order_parcel_confirmed_post2' && order.status !== 'order_delivered_to_client')}
                              >
                                {order.isOpeningCell ? (language === "ru" ? "Открываю..." : "Opening...") : (language === "ru" ? "Открыть ячейку" : "Open cell")}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCloseOrderCell(order)}
                                disabled={order.isClosingCell || order.isOpeningCell || order.isSubmittingError || order.delivery_type !== 'self' || order.status !== 'order_delivered_to_client'}
                              >
                                {order.isClosingCell ? (language === "ru" ? "Закрываю..." : "Closing...") : (language === "ru" ? "Закрыть ячейку" : "Close cell")}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleRequestError(order.id)}
                                disabled={order.isSubmittingError || order.isOpeningCell || order.isClosingCell}
                              >
                                {order.isSubmittingError ? (language === "ru" ? "Отправка..." : "Sending...") : (language === "ru" ? "Сообщить об ошибке" : "Report error")}
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
        </div>
      </CardContent>

      {/* Модальное окно для сообщения об ошибке */}
      <Dialog open={isErrorModalOpen} onOpenChange={setIsErrorModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{language === "ru" ? "Сообщить об ошибке" : "Report Error"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="error-type">{language === "ru" ? "Тип ошибки" : "Error Type"}</Label>
              <Select value={selectedErrorType} onValueChange={setSelectedErrorType}>
                <SelectTrigger id="error-type">
                  <SelectValue placeholder={language === "ru" ? "Выберите тип ошибки" : "Select error type"} />
                </SelectTrigger>
                <SelectContent>
                  {recipientErrorTypes.map((errorType) => (
                    <SelectItem key={errorType.value} value={errorType.value}>
                      {errorType.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsErrorModalOpen(false)}>
              {language === "ru" ? "Отмена" : "Cancel"}
            </Button>
            <Button onClick={handleSubmitError} disabled={!selectedErrorType}>
              {language === "ru" ? "Отправить" : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
