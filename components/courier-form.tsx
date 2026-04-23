"use client"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { fetchOrdersByCourier, fetchOrdersByCourier2, fetchAccessCodeView, enqueueFsmRequest, makeFsmEnqueueRequest, subscribeToFsmInstanceEvents } from "@/lib/api"
import { useEffect, useState, useRef } from "react"
import { performCellOperation } from "@/lib/utils"
import { getLegFromStatus } from "@/lib/cell-operations"
import { SSEErrorTracker } from "@/components/sse-error-tracker"

interface CourierFormProps {
  selectedCourierId: string;
  setSelectedCourierId: (id: string) => void;
  availableOrders: any[];
  ordersFilter: "in" | "out";
  setOrdersFilter: (filter: "in" | "out") => void;
  courierOrdersFilter: "all" | "active" | "archive";
  setCourierOrdersFilter: (filter: "all" | "active" | "archive") => void;
  courierMessage: string | null;
  mode: "create" | "run";
  t: any;
  language: string;
  users: Array<{ id: number; name: string; role_name: string; city?: string }>;
  handleTakeOrder: (orderId: number) => void;
  handleCancelCourierOrder: (orderId: number) => void;
  handleCourierDeliveryAction: (orderId: number, action: string) => void;
  getCourierStatusLabel: (status: string) => string;
  addLog: (log: any) => void;
}

export function CourierForm({
  selectedCourierId,
  setSelectedCourierId,
  availableOrders,
  ordersFilter,
  setOrdersFilter,
  courierMessage,
  mode,
  t,
  language,
  users,
  handleTakeOrder,
  handleCancelCourierOrder,
  getCourierStatusLabel,
  addLog,
}: CourierFormProps) {
  // Локальное состояние для заказов курьера
  const [assignedOrders, setAssignedOrders] = useState<any[]>([]);
  const [courierOrdersFilter, setCourierOrdersFilter] = useState<"all" | "active" | "archive">("active");
  const [userErrors, setUserErrors] = useState<any[]>([]);
  const [isErrorModalOpen, setIsErrorModalOpen] = useState(false);
  const [selectedErrorType, setSelectedErrorType] = useState<string>("");
  const [currentOrderId, setCurrentOrderId] = useState<number | null>(null);
  const [isConfirmingDelivery, setIsConfirmingDelivery] = useState<{ [orderId: number]: boolean }>({});
  const [currentInstanceId, setCurrentInstanceId] = useState<number | null>(null);
  const [sseLastError, setSseLastError] = useState<string | null>(null);
  const [sseSuccess, setSseSuccess] = useState(false);
  const sseSubscriptionRef = useRef<any>(null);

  // Типы ошибок для курьера (заказы)
  const courierErrorTypes = [
    { value: "parcel_missing", label: language === "ru" ? "Посылка не найдена" : "Parcel missing" },
    { value: "parcel_damaged", label: language === "ru" ? "Посылка повреждена" : "Parcel damaged" },
    { value: "wrong_parcel", label: language === "ru" ? "Не та посылка" : "Wrong parcel" },
    { value: "other", label: language === "ru" ? "Другая ошибка" : "Other" },
  ];

  // Process names для курьера
  const courierProcessNames = [
    "order_assign_courier1",
    "cancel_order",
    "confirm_courier2_delivery",
    "request_locker_access_code",
    "open_cell",
    "close_cell",
    "report_error",
  ];

  // Загружаем заказы при изменении selectedCourierId
  useEffect(() => {
    const loadCourierOrders = async () => {
      if (!selectedCourierId) return;
      try {
        // Используем новый endpoint fetchOrdersByCourier2
        const orders = await fetchOrdersByCourier2(selectedCourierId);
        setAssignedOrders(orders.map(order => ({
          ...order,
          isRequestingError: false,
          isRequestingCode: false,
          isGettingCode: false,
          isOpeningCell: false,
          isClosingCell: false,
          isSubmittingError: false,
          pin: "",
          accessCode: undefined,
          fsmError: null,
          takenAt: order.taken_at || order.updated_at || new Date().toISOString(),
        })));
      } catch (error) {
        console.error("Ошибка при загрузке заказов:", error);
      }
    };

    loadCourierOrders();
  }, [selectedCourierId]);

  // Подписка на SSE события для текущего instance
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

    console.log('[SSE] Subscribing to instance:', currentInstanceId);
    sseSubscriptionRef.current = subscribeToFsmInstanceEvents(
      currentInstanceId,
      (data) => {
        console.log('[SSE] Received:', data);
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
        console.log('[SSE] Error:', error);
        setSseLastError(error);
        setSseSuccess(false);
      }
    );

    return () => {
      if (sseSubscriptionRef.current) {
        sseSubscriptionRef.current.close();
        sseSubscriptionRef.current = null;
      }
    };
  }, [currentInstanceId]);

  // Фильтруем заказы в зависимости от выбранного фильтра и переворачиваем порядок
  const filteredAssignedOrders = [...assignedOrders]
    .filter((order) => {
      if (courierOrdersFilter === "all") return true;
      if (courierOrdersFilter === "active") return order.status !== "locker_closed" && order.status !== "order_cancelled";
      if (courierOrdersFilter === "archive") return order.status === "locker_closed" || order.status === "order_cancelled";
      return true;
    })
    ;

  // Находим релевантную ошибку
  const relevantError = userErrors.find(e => ["order_assign_courier1", "cancel_order", "confirm_courier2_delivery"].includes(e.process_name));

  // Функция для запроса кода доступа
  const handleRequestAccessCode = async (orderId: number) => {
    setAssignedOrders(prev =>
      prev.map(order =>
        order.id === orderId ? { ...order, isRequestingCode: true } : order
      )
    );

    try {
      const order = assignedOrders.find(o => o.id === orderId);
      const leg = getLegFromStatus(order?.status || "");
      
      const result = await performCellOperation(orderId, parseInt(selectedCourierId), "request_locker_access_code", { leg }, "courier");
      
      console.log('[request_locker_access_code] Result:', result);
      
      // Извлекаем instance_id из data.instance_id
      const instanceId = result?.data?.instance_id || result?.instance_id;
      
      // Если есть instance_id, подписываемся на SSE
      if (instanceId) {
        setCurrentInstanceId(instanceId);
      }

      // Если в ответе есть pin, сохраняем его
      if (result?.pin) {
        setAssignedOrders(prev =>
          prev.map(o =>
            o.id === orderId ? { ...o, accessCode: result.pin } : o
          )
        );
      }
      
      addLog({
        role: "courier",
        action: "request_access_code",
        data: result,
      });
    } catch (error) {
      console.error('Error requesting access code:', error);
    } finally {
      setAssignedOrders(prev =>
        prev.map(order =>
          order.id === orderId ? { ...order, isRequestingCode: false } : order
        )
      );
    }
  }

  // Функция для получения кода доступа
  const handleGetAccessCode = async (orderId: number) => {
    setAssignedOrders(prev =>
      prev.map(order =>
        order.id === orderId ? { ...order, isGettingCode: true } : order
      )
    );

    try {
      const order = assignedOrders.find(o => o.id === orderId);
      const leg = getLegFromStatus(order?.status || "");
      
      const result = await fetchAccessCodeView(orderId, leg, parseInt(selectedCourierId));
      setAssignedOrders(prev =>
        prev.map(order =>
          order.id === orderId ? { ...order, accessCode: result.pin, isGettingCode: false } : order
        )
      );
    } catch (error) {
      console.error('Error getting access code:', error);
      setAssignedOrders(prev =>
        prev.map(order =>
          order.id === orderId ? { ...order, isGettingCode: false } : order
        )
      );
    }
  }

  // Функция для открытия ячейки
  const handleOpenCell = async (orderId: number) => {
    const order = assignedOrders.find(o => o.id === orderId);
    if (!order) return;

    console.log('handleOpenCell called for orderId:', orderId, 'pin:', order.pin);
    setAssignedOrders(prev =>
      prev.map(order =>
        order.id === orderId ? { ...order, isOpeningCell: true } : order
      )
    );

    try {
      console.log('Sending open_cell request');
      const leg = getLegFromStatus(order?.status || "");
      const result = await performCellOperation(orderId, parseInt(selectedCourierId), "open_cell", { pin: order.pin, leg }, "courier");
      console.log('open_cell result:', result);
      addLog({
        role: "courier",
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
      setAssignedOrders(prev =>
        prev.map(order =>
          order.id === orderId ? { ...order, isOpeningCell: false } : order
        )
      );
    }
  };

  // Функция для закрытия ячейки
  const handleCloseCell = async (orderId: number) => {
    setAssignedOrders(prev =>
      prev.map(order =>
        order.id === orderId ? { ...order, isClosingCell: true } : order
      )
    );

    try {
      const result = await performCellOperation(orderId, parseInt(selectedCourierId), "close_cell", {}, "courier");
      addLog({
        role: "courier",
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
      setAssignedOrders(prev =>
        prev.map(order =>
          order.id === orderId ? { ...order, isClosingCell: false } : order
        )
      );
    }
  };

  // Функция для запроса ошибки
  const handleRequestError = (orderId: number) => {
    setCurrentOrderId(orderId);
    setSelectedErrorType("");
    setIsErrorModalOpen(true);
  };

  // Функция для отправки ошибки
  const handleSubmitError = async () => {
    if (!currentOrderId || !selectedErrorType) return;

    setAssignedOrders(prev =>
      prev.map(order =>
        order.id === currentOrderId ? { ...order, isSubmittingError: true } : order
      )
    );

    try {
      const requestData = makeFsmEnqueueRequest({
        entity_type: "order",
        entity_id: currentOrderId,
        process_name: "report_error",
        user_id: parseInt(selectedCourierId),
        metadata: { error_type: selectedErrorType },
      });

      const result = await enqueueFsmRequest(requestData);

      addLog({
        role: "courier",
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
      setAssignedOrders(prev =>
        prev.map(order =>
          order.id === currentOrderId ? { ...order, isSubmittingError: false } : order
        )
      );
    }
  };

  // Функция для подтверждения доставки
  const handleConfirmDelivery = async (orderId: number) => {
    const order = assignedOrders.find(o => o.id === orderId);
    if (!order) return;

    setIsConfirmingDelivery(prev => ({
      ...prev,
      [orderId]: true
    }));

    try {
      const requestData = makeFsmEnqueueRequest({
        entity_type: "order",
        entity_id: orderId,
        process_name: "confirm_courier2_delivery",
        user_id: parseInt(selectedCourierId),
        target_user_id: parseInt(selectedCourierId),
        target_role: "courier",
        metadata: { pin: order.pin || "000000" },
      });

      const result = await enqueueFsmRequest(requestData);

      addLog({
        role: "courier",
        action: "confirm_courier2_delivery",
        data: result,
      });

      // Извлекаем instance_id из data.instance_id
      const instanceId = result?.data?.instance_id || result?.instance_id;
      
      // Если есть instance_id, подписываемся на SSE
      if (instanceId) {
        setCurrentInstanceId(instanceId);
      }
    } catch (error) {
      console.error('Error confirming delivery:', error);
    } finally {
      setIsConfirmingDelivery(prev => ({
        ...prev,
        [orderId]: false
      }));
    }
  };


  // Функция для рендера кнопок действий
  const renderCourierActionButtons = (order: any) => (
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
          disabled={order.isRequestingCode || order.isGettingCode || order.isSubmittingError || isConfirmingDelivery[order.id]}
        >
          {order.isRequestingCode ? (language === "ru" ? "Запрос..." : "Requesting...") : (language === "ru" ? "Запросить код" : "Request code")}
        </Button>
        <Button
          size="sm"
          onClick={() => handleGetAccessCode(order.id)}
          disabled={order.isGettingCode || order.isRequestingCode || order.isSubmittingError || isConfirmingDelivery[order.id]}
        >
          {order.isGettingCode ? (language === "ru" ? "Получаю..." : "Getting...") : (language === "ru" ? "Получить код" : "Get code")}
        </Button>
        <Input
          type="text"
          placeholder={language === "ru" ? "Введите PIN" : "Enter PIN"}
          value={order.pin || ""}
          onChange={(e) => setAssignedOrders(prev =>
            prev.map(o => o.id === order.id ? { ...o, pin: e.target.value } : o)
          )}
          className="w-24 h-8 text-xs"
        />
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleOpenCell(order.id)}
          disabled={order.isOpeningCell || order.isClosingCell || order.isSubmittingError || isConfirmingDelivery[order.id]}
        >
          {order.isOpeningCell ? (language === "ru" ? "Открываю..." : "Opening...") : (language === "ru" ? "Открыть ячейку" : "Open cell")}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleCloseCell(order.id)}
          disabled={order.isClosingCell || order.isOpeningCell || order.isSubmittingError || isConfirmingDelivery[order.id]}
        >
          {order.isClosingCell ? (language === "ru" ? "Закрываю..." : "Closing...") : (language === "ru" ? "Закрыть ячейку" : "Close cell")}
        </Button>
        {order.status === "order_courier2_parcel_delivered" && (
          <Button
            size="sm"
            variant="default"
            onClick={() => handleConfirmDelivery(order.id)}
            disabled={isConfirmingDelivery[order.id]}
          >
            {isConfirmingDelivery[order.id] ? (language === "ru" ? "Подтверждаю..." : "Confirming...") : (language === "ru" ? "Подтвердить доставку" : "Confirm delivery")}
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          onClick={() => handleRequestError(order.id)}
          disabled={order.isSubmittingError || isConfirmingDelivery[order.id]}
        >
          {order.isSubmittingError ? (language === "ru" ? "Отправляю..." : "Submitting...") : (language === "ru" ? "Сообщить об ошибке" : "Report error")}
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => { handleCancelCourierOrder(order.id); }}
        >
          {t.courier.cancelOrder}
        </Button>
      </div>
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.courier.title}</CardTitle>
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

        {mode === "create" && (
          <div>
            <Label htmlFor="courier-id">{t.courier.courierId}</Label>
            <Select value={selectedCourierId} onValueChange={setSelectedCourierId}>
              <SelectTrigger id="courier-id">
                <SelectValue placeholder={t.courier.selectCourierId} />
              </SelectTrigger>
              <SelectContent>
                {users.filter((user) => user.role_name === "courier").map((courier) => (
                  <SelectItem key={courier.id} value={courier.id.toString()}>
                    {courier.name} {courier.city ? `(${courier.city})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {relevantError && (
          <div>
            <Badge variant="destructive">
              {relevantError.last_error}
            </Badge>
          </div>
        )}

        {/* Биржа свободных заказов */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold">{t.courier.availableOrders}</h3>
            <div className="flex gap-1">
              <Button
                variant={ordersFilter === "in" ? "default" : "outline"}
                size="sm"
                onClick={() => setOrdersFilter("in")}
              >
                в
              </Button>
              <Button
                variant={ordersFilter === "out" ? "default" : "outline"}
                size="sm"
                onClick={() => setOrdersFilter("out")}
              >
                из
              </Button>
            </div>
          </div>
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
                {[...availableOrders].reverse().map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>{order.id}</TableCell>
                    <TableCell>{order.lockerAddress || "N/A"}</TableCell>
                    <TableCell>{order.cell || "N/A"}</TableCell>
                    <TableCell>{order.size || "N/A"}</TableCell>
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

        {/* Назначенные заказы */}
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
                      <div className="flex flex-col gap-1">
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
                        {order.fsmError && (
                          <Badge variant="destructive" className="text-xs whitespace-normal">
                            {order.fsmError}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {renderCourierActionButtons(order)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
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
                  {courierErrorTypes.map((errorType) => (
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
