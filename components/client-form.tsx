"use client"
import { useEffect, useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { useLanguage } from "@/lib/language-context"
import { fetchOrdersByClient, fetchUsers, enqueueFsmRequest, makeFsmEnqueueRequest, fetchAccessCodeView, subscribeToFsmInstanceEvents } from "@/lib/api"
import { performCellOperation } from "@/lib/utils"
import { getLegFromStatus } from "@/lib/cell-operations"
import { SSEErrorTracker } from "@/components/sse-error-tracker"

export function ClientForm({ addLog }: { addLog: (log: any) => void }) {
  const [selectedClientId, setSelectedClientId] = useState<string>("")
  const [recipientUserId, setRecipientUserId] = useState<string>("")
  const [parcelType, setParcelType] = useState<string>("")
  const [cellSize, setCellSize] = useState<string>("")
  const [senderDelivery, setSenderDelivery] = useState<string>("")
  const [recipientDelivery, setRecipientDelivery] = useState<string>("")
  const [clientOrders, setClientOrders] = useState<Array<{
    id: number
    description: string
    status: string
    canCancel: boolean
    pickupType?: string
    isLoading?: boolean
    accessCode?: string
    isRequestingCode?: boolean
    isGettingCode?: boolean
    isOpeningCell?: boolean
    isClosingCell?: boolean
    isRequestingError?: boolean
    isSubmittingError?: boolean
    pin?: string
    fsmError?: string | null
  }>>([])
  const [orderMessage, setOrderMessage] = useState<string | null>(null)
  const [users, setUsers] = useState<Array<{ id: number; name: string; role_name: string; city: string | null }>>([])
  const [isLoadingUsers, setIsLoadingUsers] = useState(false)
  const [isRefreshingClient, setIsRefreshingClient] = useState(false)
  const { t, language } = useLanguage()

  // Состояния для модала ошибки
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false)
  const [selectedErrorType, setSelectedErrorType] = useState<string>("")
  const [currentOrderId, setCurrentOrderId] = useState<number | null>(null)

  // Состояния для SSE отслеживания ошибок
  const [currentInstanceId, setCurrentInstanceId] = useState<number | null>(null)
  const [sseLastError, setSseLastError] = useState<string | null>(null)
  const [sseSuccess, setSseSuccess] = useState(false)
  const sseSubscriptionRef = useRef<any>(null)

  // Типы ошибок для клиента (заказы)
  const clientErrorTypes = [
    { value: "parcel_missing", label: language === "ru" ? "Посылка не найдена" : "Parcel missing" },
    { value: "parcel_damaged", label: language === "ru" ? "Посылка повреждена" : "Parcel damaged" },
    { value: "wrong_parcel", label: language === "ru" ? "Не та посылка" : "Wrong parcel" },
    { value: "cancelled_by_client", label: language === "ru" ? "Отменено клиентом" : "Cancelled by client" },
    { value: "manual_override", label: language === "ru" ? "Ручное вмешательство" : "Manual override" },
    { value: "other", label: language === "ru" ? "Другая ошибка" : "Other" },
  ]

  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const data = await fetchUsers();
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const loadClientOrders = useCallback(async () => {
    if (isRefreshingClient) return;
    setIsRefreshingClient(true);
    try {
      const orders = await fetchOrdersByClient(selectedClientId);
      // Сохраняем существующие pin и accessCode при перезагрузке через functional update
      setClientOrders(prevOrders => {
        const processedOrders = orders.map((order: any) => {
          const existingOrder = prevOrders.find(o => o.id === order.id);
          return {
            id: order.id,
            description: order.description || `Order ${order.id}`,
            status: order.status,
            canCancel: order.status !== 'cancelled' && order.status !== 'completed',
            pickupType: order.pickup_type,
            pin: existingOrder?.pin || order.pin || "",
            accessCode: existingOrder?.accessCode || order.accessCode || undefined,
            isSubmittingError: false,
          };
        });
        return processedOrders;
      });
    } catch (error) {
      console.error('Error loading client orders:', error);
    } finally {
      setIsRefreshingClient(false);
    }
  }, [selectedClientId, isRefreshingClient]);

  // Удалено - больше не используется
  // const loadClientFsmError = async () => { ... }

  // Очистка ошибки FSM для конкретного заказа (после успешного действия)
  const clearOrderFsmError = (orderId: number) => {
    setClientOrders(prev => prev.map(order =>
      order.id === orderId ? { ...order, fsmError: null } : order
    ));
  };

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
  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (!selectedClientId) return;

    // Запускаем сразу при смене selectedClientId
    loadClientOrders();

    const interval = setInterval(() => {
      loadClientOrders();
    }, 20000); // 20 seconds

    return () => clearInterval(interval);
  }, [selectedClientId, loadClientOrders]);

  useEffect(() => {
    if (parcelType === "letter") {
      setCellSize("P")
    }
  }, [parcelType])

  const handleCreateOrder = async () => {
  setOrderMessage(null);

  // Находим выбранных клиента и получателя
  const selectedClient = users.find(user => user.id === parseInt(selectedClientId));
  const selectedRecipient = users.find(user => user.id === parseInt(recipientUserId));

  // Проверяем, что оба пользователя найдены и у них есть город
  if (!selectedClient || !selectedRecipient) {
    setOrderMessage(language === "ru" ? "Выберите клиента и получателя" : "Select client and recipient");
    return;
  }

  // Проверяем, что города совпадают
  if (selectedClient.city && selectedRecipient.city && selectedClient.city === selectedRecipient.city) {
    setOrderMessage(language === "ru" ? "Клиент и получатель из одного города. Заказ создать нельзя." : "Client and recipient are from the same city. Cannot create order.");
    return;
  }

  const data = {
    client_user_id: parseInt(selectedClientId),
    parcel_type: parcelType,
    cell_size: cellSize,
    sender_delivery: senderDelivery,
    recipient_delivery: recipientDelivery,
    recipient_user_id: parseInt(recipientUserId),
  };

  try {
    const response = await fetch('/api/proxy/client/create_order_request', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    
    console.log('[create_order_request] Result:', result);
    
    // Извлекаем instance_id из data.instance_id
    const instanceId = result?.data?.instance_id || result?.instance_id;
    
    // Если есть instance_id, подписываемся на SSE
    if (instanceId) {
      setCurrentInstanceId(instanceId);
    }
    
    setOrderMessage(result.message || (language === "ru" ? "Неизвестная ошибка" : "Unknown error"));

    if (result.success) {
      setClientOrders([
        ...clientOrders,
        {
          id: Math.floor(Math.random() * 1000000),
          description: `${parcelType} to cell ${cellSize}`,
          status: "processing",
          canCancel: false,
          pickupType: recipientDelivery,
          isLoading: true,
          accessCode: undefined,
          isRequestingCode: false,
          isGettingCode: false,
          isOpeningCell: false,
          isClosingCell: false,
          isRequestingError: false,
          isSubmittingError: false,
          pin: "",
        },
      ]);
    }
  } catch (error) {
    console.error('Error creating order:', error);
    setOrderMessage(language === "ru" ? "Ошибка при создании заказа" : "Error creating order");
  }
};


  const handleCancelClientOrder = async (orderId: number) => {
    const requestData = makeFsmEnqueueRequest({
      entity_type: "order",
      entity_id: orderId,
      process_name: "cancel_order",
      user_id: parseInt(selectedClientId),
    });

    try {
        const result = await enqueueFsmRequest(requestData);

      console.log('[cancel_order] Result:', result);

      // Извлекаем instance_id из data.instance_id
      const instanceId = result?.data?.instance_id || result?.instance_id;
      
      // Если есть instance_id, подписываемся на SSE
      if (instanceId) {
        setCurrentInstanceId(instanceId);
      }

      if (result.error || result.status === 'error' || result.message?.includes('cannot')) {
        setClientOrders(
          clientOrders.map((order) => (order.id === orderId ? { ...order, status: "cannot_cancel", canCancel: false } : order)),
        );
        return;
      }

      setClientOrders(
        clientOrders.filter((order) => order.id !== orderId)
      );

      addLog({
        role: "client",
        action: "cancel_order",
        data: result,
      });
    } catch (error) {
      console.error('Error cancelling order:', error);
      // Handle 404 or other errors
      if ((error as Error).message?.includes('404')) {
        setClientOrders(prev =>
          prev.map(order =>
            order.id === orderId ? { ...order, status: "cannot_cancel", canCancel: false } : order
          )
        );
      }
    }
  }

  const handleRequestAccessCode = async (orderId: number) => {
    setClientOrders(prev =>
      prev.map(order =>
        order.id === orderId ? { ...order, isRequestingCode: true } : order
      )
    );

    try {
      const result = await performCellOperation(orderId, parseInt(selectedClientId), "request_locker_access_code", { leg: "pickup" }, "client");
      addLog({
        role: "client",
        action: "request_access_code",
        data: result,
      });
      const instanceId = result?.data?.instance_id || result?.instance_id;
      if (instanceId) {
        setCurrentInstanceId(instanceId);
      }
      // Сохраняем PIN из ответа, если он есть
      if (result?.pin) {
        setClientOrders(prev =>
          prev.map(order =>
            order.id === orderId ? { ...order, pin: result.pin } : order
          )
        );
      }
    } catch (error) {
      console.error('Error requesting access code:', error);
    } finally {
      setClientOrders(prev =>
        prev.map(order =>
          order.id === orderId ? { ...order, isRequestingCode: false } : order
        )
      );
    }
  }

  const handleGetAccessCode = async (orderId: number) => {
    setClientOrders(prev =>
      prev.map(order =>
        order.id === orderId ? { ...order, isGettingCode: true } : order
      )
    );

    try {
      const order = clientOrders.find(o => o.id === orderId);
      const leg = getLegFromStatus(order?.status || "");
      const result = await fetchAccessCodeView(orderId, leg, parseInt(selectedClientId));
      console.log('[handleGetAccessCode] Result:', result);
      
      // PIN может быть в result.pin или result.data.pin
      const pin = result?.pin || result?.data?.pin;
      const code = result?.code || result?.data?.code;
      
      setClientOrders(prev =>
        prev.map(order =>
          order.id === orderId ? { 
            ...order, 
            accessCode: code || order.accessCode,
            pin: pin || order.pin,
            isGettingCode: false 
          } : order
        )
      );
    } catch (error) {
      console.error('Error getting access code:', error);
      setClientOrders(prev =>
        prev.map(order =>
          order.id === orderId ? { ...order, isGettingCode: false } : order
        )
      );
    }
  }

  const handleOpenCell = async (orderId: number) => {
    const order = clientOrders.find(o => o.id === orderId);
    if (!order) return;

    console.log('handleOpenCell called for orderId:', orderId, 'pin:', order.pin);
    setClientOrders(prev =>
      prev.map(order =>
        order.id === orderId ? { ...order, isOpeningCell: true } : order
      )
    );

    try {
      console.log('Sending open_cell request');
      const leg = getLegFromStatus(order.status);
      const result = await performCellOperation(orderId, parseInt(selectedClientId), "open_cell", { pin: order.pin, leg }, "client");
      console.log('open_cell result:', result);
      addLog({
        role: "client",
        action: "open_cell",
        data: result,
      });
      const instanceId = result?.data?.instance_id || result?.instance_id;
      if (instanceId) {
        setCurrentInstanceId(instanceId);
      }
    } catch (error) {
      console.error('Error opening cell:', error);
    } finally {
      setClientOrders(prev =>
        prev.map(order =>
          order.id === orderId ? { ...order, isOpeningCell: false } : order
        )
      );
    }
  }

  const handleCloseCell = async (orderId: number) => {
    setClientOrders(prev =>
      prev.map(order =>
        order.id === orderId ? { ...order, isClosingCell: true } : order
      )
    );

    try {
      const order = clientOrders.find(o => o.id === orderId);
      const leg = getLegFromStatus(order?.status || "");
      const result = await performCellOperation(orderId, parseInt(selectedClientId), "close_cell", { leg }, "client");
      addLog({
        role: "client",
        action: "close_cell",
        data: result,
      });
      const instanceId = result?.data?.instance_id || result?.instance_id;
      if (instanceId) {
        setCurrentInstanceId(instanceId);
      }
    } catch (error) {
      console.error('Error closing cell:', error);
    } finally {
      setClientOrders(prev =>
        prev.map(order =>
          order.id === orderId ? { ...order, isClosingCell: false } : order
        )
      );
    }
  }

  const handleRequestError = (orderId: number) => {
    setCurrentOrderId(orderId);
    setSelectedErrorType("");
    setIsErrorModalOpen(true);
  }

  // Функция для отправки ошибки
  const handleSubmitError = async () => {
    if (!currentOrderId || !selectedErrorType) return;

    setClientOrders(prev =>
      prev.map(order =>
        order.id === currentOrderId ? { ...order, isSubmittingError: true } : order
      )
    );

    try {
      const requestData = makeFsmEnqueueRequest({
        entity_type: "order",
        entity_id: currentOrderId,
        process_name: "report_error",
        user_id: parseInt(selectedClientId),
        metadata: { error_type: selectedErrorType },
      });

      const result = await enqueueFsmRequest(requestData);

      addLog({
        role: "client",
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
      setClientOrders(prev =>
        prev.map(order =>
          order.id === currentOrderId ? { ...order, isSubmittingError: false } : order
        )
      );
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.client.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
  <Label htmlFor="client-user-id">{t.client.userId}</Label>
  <Select value={selectedClientId} onValueChange={setSelectedClientId}>
    <SelectTrigger id="client-user-id">
      <SelectValue placeholder={t.client.selectUserId} />
    </SelectTrigger>
    <SelectContent>
      {users
        .filter(user => user.role_name === "client")
        .map((user) => (
          <SelectItem key={user.id} value={user.id.toString()}>
            {language === "ru" ? "Клиент" : "Client"} #{user.id} {user.city ? `(${user.city})` : ""}
          </SelectItem>
        ))}
    </SelectContent>
  </Select>
</div>

<div>
  <Label htmlFor="recipient-user-id">{t.client.recipientUserId || "ID получателя"}</Label>
  <Select value={recipientUserId} onValueChange={setRecipientUserId}>
    <SelectTrigger id="recipient-user-id">
      <SelectValue placeholder={t.client.selectRecipientUserId || "Выберите получателя"} />
    </SelectTrigger>
    <SelectContent>
      {users
        .filter(user => user.role_name === "client")
        .map((user) => (
          <SelectItem key={user.id} value={user.id.toString()}>
            {language === "ru" ? "Клиент" : "Client"} #{user.id} {user.city ? `(${user.city})` : ""}
          </SelectItem>
        ))}
    </SelectContent>
  </Select>
</div>


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
            disabled={!parcelType || !cellSize || !senderDelivery || !recipientDelivery || !recipientUserId}
          >
            {t.client.createOrder}
          </Button>
        </div>

        {orderMessage && (
          <div>
            <Badge variant="default" className={orderMessage.includes('успешно') ? 'bg-green-600' : 'bg-red-600'}>
              {orderMessage}
            </Badge>
          </div>
        )}

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

        {clientOrders.length > 0 && (
          <div className="mt-6">
            <h3 className="font-semibold mb-3">{t.client.myOrders}</h3>
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t.client.orderId}</TableHead>
                    <TableHead>{t.client.description}</TableHead>
                    <TableHead>{t.client.status}</TableHead>
                    <TableHead>{t.client.actions || "Actions"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {clientOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell>
                        {order.isLoading ? (
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
                      <TableCell>
                        {order.isLoading ? (
                          <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                        ) : (
                          order.description
                        )}
                      </TableCell>
                      <TableCell>
                        {order.isLoading ? (
                          <div className="h-5 w-24 bg-muted animate-pulse rounded-full" />
                        ) : (
                          <div className="flex flex-col gap-1">
                            <Badge variant={order.status === "cancelled" ? "destructive" : order.status === "processing" ? "secondary" : "default"}>
                              {order.status === "processing" ? t.client.statusProcessing : order.status}
                            </Badge>
                            {order.fsmError && (
                              <Badge variant="destructive" className="text-xs whitespace-normal">
                                {order.fsmError}
                              </Badge>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {!order.isLoading && (
                          <div className="flex flex-col gap-2">
                            {order.accessCode && (
                              <div className="text-xs">
                                <span className="font-medium">{t.client.accessCode || "Access Code"}: </span>
                                <span>{order.accessCode}</span>
                              </div>
                            )}
                            <div className="flex flex-row flex-wrap gap-2 items-center">
                              <Button
                                size="sm"
                                onClick={() => handleRequestAccessCode(order.id)}
                                disabled={!selectedClientId || order.isRequestingCode || order.isGettingCode || order.isSubmittingError || order.pickupType !== "self"}
                              >
                                {order.isRequestingCode ? (language === "ru" ? "Запрос..." : "Requesting...") : (language === "ru" ? "Запросить код" : "Request code")}
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleGetAccessCode(order.id)}
                                disabled={!selectedClientId || order.isGettingCode || order.isRequestingCode || order.isSubmittingError || order.pickupType !== "self"}
                              >
                                {order.isGettingCode ? (language === "ru" ? "Получаю..." : "Getting...") : (language === "ru" ? "Получить код" : "Get code")}
                              </Button>
                              {order.pin && !order.isGettingCode && (
                                <div className="text-xs mt-1">
                                  <span className="font-medium">{language === "ru" ? "PIN: " : "PIN: "}</span>
                                  <span className="text-primary font-mono">{order.pin}</span>
                                </div>
                              )}
                              <Input
                                type="text"
                                placeholder={language === "ru" ? "Введите PIN" : "Enter PIN"}
                                value={order.pin || ""}
                                onChange={(e) => setClientOrders(prev =>
                                  prev.map(o => o.id === order.id ? { ...o, pin: e.target.value } : o)
                                )}
                                className="w-24 h-8 text-xs"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleOpenCell(order.id)}
                                disabled={!selectedClientId || order.isOpeningCell || order.isClosingCell || order.isSubmittingError || order.pickupType !== "self" || !order.pin}
                              >
                                {order.isOpeningCell ? (language === "ru" ? "Открываю..." : "Opening...") : t.client.openCell}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCloseCell(order.id)}
                                disabled={!selectedClientId || order.isClosingCell || order.isOpeningCell || order.isSubmittingError || order.pickupType !== "self"}
                              >
                                {order.isClosingCell ? (language === "ru" ? "Закрываю..." : "Closing...") : t.client.closeCell}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleRequestError(order.id)}
                                disabled={!selectedClientId || order.isSubmittingError || order.isOpeningCell || order.isClosingCell || order.pickupType !== "self"}
                              >
                                {order.isSubmittingError ? (language === "ru" ? "Отправка..." : "Sending...") : (language === "ru" ? "Сообщить об ошибке" : "Report error")}
                              </Button>
                              {order.canCancel ? (
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => handleCancelClientOrder(order.id)}
                                >
                                  {t.client.cancelOrder}
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">{t.client.cannotCancel}</span>
                              )}
                            </div>
                          </div>
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
                  {clientErrorTypes.map((errorType) => (
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
  )
}
