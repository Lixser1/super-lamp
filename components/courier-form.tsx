"use client"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { fetchOrdersByCourier } from "@/lib/api"
import { useEffect, useState } from "react"

interface CourierFormProps {
  selectedCourierId: string;
  setSelectedCourierId: (id: string) => void;
  availableOrders: any[];
  assignedOrders: any[];
  courierOrdersFilter: "all" | "active" | "archive";
  setCourierOrdersFilter: (filter: "all" | "active" | "archive") => void;
  ordersFilter: "in" | "out";
  setOrdersFilter: (filter: "in" | "out") => void;
  courierMessage: string | null;
  mode: "create" | "run";
  t: any;
  language: string;
  users: Array<{ id: number; name: string; role_name: string }>;
  handleTakeOrder: (orderId: number) => void;
  handleCancelCourierOrder: (orderId: number) => void;
  handleCourierDeliveryAction: (orderId: number, action: string) => void;
  getCourierStatusLabel: (status: string) => string;
}

export function CourierForm({
  selectedCourierId,
  setSelectedCourierId,
  availableOrders,
  assignedOrders: externalAssignedOrders,
  courierOrdersFilter,
  setCourierOrdersFilter,
  ordersFilter,
  setOrdersFilter,
  courierMessage,
  mode,
  t,
  language,
  users,
  handleTakeOrder,
  handleCancelCourierOrder,
  handleCourierDeliveryAction,
  getCourierStatusLabel,
}: CourierFormProps) {
  // Локальное состояние для отображения заказов
  const [displayedAssignedOrders, setDisplayedAssignedOrders] = useState<any[]>([]);

  // Загружаем заказы при изменении selectedCourierId
  useEffect(() => {
    const loadCourierOrders = async () => {
      if (!selectedCourierId) return;
      try {
        const orders = await fetchOrdersByCourier(selectedCourierId);
        setDisplayedAssignedOrders(orders);
      } catch (error) {
        console.error("Ошибка при загрузке заказов:", error);
      }
    };

    loadCourierOrders();
  }, [selectedCourierId]);

  // Фильтруем заказы в зависимости от выбранного фильтра
  const filteredAssignedOrders = displayedAssignedOrders.filter((order) => {
    if (courierOrdersFilter === "all") return true;
    if (courierOrdersFilter === "active") return order.status !== "locker_closed" && order.status !== "order_cancelled";
    if (courierOrdersFilter === "archive") return order.status === "locker_closed" || order.status === "order_cancelled";
    return true;
  });

  return (
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
                {users.filter((user) => user.role_name === "courier").map((courier) => (
                  <SelectItem key={courier.id} value={courier.id.toString()}>
                    {courier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {courierMessage && (
          <div>
            <Badge
              variant="default"
              className={
                courierMessage.includes("Ошибка") || courierMessage.includes("не удалось")
                  ? "bg-red-600"
                  : "bg-green-600"
              }
            >
              {courierMessage}
            </Badge>
          </div>
        )}

        {/* Доступные заказы */}
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
                {availableOrders.map((order) => (
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAssignedOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>{order.id}</TableCell>
                    <TableCell>
                      <Badge variant="default">
                        {order.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
