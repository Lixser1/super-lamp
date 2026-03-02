"use client"
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface RecipientFormProps {
  selectedRecipientId: string;
  setSelectedRecipientId: (id: string) => void;
  recipientOrderId: string;
  setRecipientOrderId: (id: string) => void;
  recipientTracking: Array<{ status: string; date: string; time: string }>;
  setRecipientTracking: (tracking: Array<{ status: string; date: string; time: string }>) => void;
  recipientOrderDetails: {
    id: number;
    locker: string;
    cell: string;
    recipientDelivery: "self" | "courier";
    currentStatus: string;
  } | null;
  setRecipientOrderDetails: (details: {
    id: number;
    locker: string;
    cell: string;
    recipientDelivery: "self" | "courier";
    currentStatus: string;
  } | null) => void;
  mode: "create" | "run";
  t: any;
  language: string;
  users: Array<{ id: number; name: string; role_name: string }>;
  handleRecipientLookup: () => void;
  handleAction: (role: string, action: string, extraData?: any) => void;
  highlightedAction: string | null;
}

export function RecipientForm({
  selectedRecipientId,
  setSelectedRecipientId,
  recipientOrderId,
  setRecipientOrderId,
  recipientTracking,
  setRecipientTracking,
  recipientOrderDetails,
  setRecipientOrderDetails,
  mode,
  t,
  language,
  users,
  handleRecipientLookup,
  handleAction,
  highlightedAction,
}: RecipientFormProps) {

  // Функция для отправки запроса на подтверждение доставки
  const handleConfirmDelivery = async () => {
    if (!recipientOrderDetails) return;

    const requestData = {
      entity_type: "order",
      entity_id: recipientOrderDetails.id,
      process_name: "request_locker_access_code",
      user_id: parseInt(selectedRecipientId),
      target_user_id: parseInt(selectedRecipientId),
      user_role: "recipient",
      metadata: {
        leg: "delivery"
      }
    };

    try {
      const response = await fetch('/api/proxy/fsm/enqueue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const result = await response.json();
      handleAction("recipient", "confirm_delivery", { order_id: recipientOrderDetails.id, result });
    } catch (error) {
      console.error('Error confirming delivery:', error);
      handleAction("recipient", "confirm_delivery_error", { order_id: recipientOrderDetails.id, error: String(error) });
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
                onClick={handleConfirmDelivery}
                className={highlightedAction === "confirm_delivery" ? "animate-pulse" : ""}
              >
                {t.recipient.confirmDelivery}
              </Button>
            )}
        </div>
      </CardContent>
    </Card>
  );
}
