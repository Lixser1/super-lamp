"use client"
import React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface DriverFormProps {
  selectedDriverId: string;
  setSelectedDriverId: (id: string) => void;
  selectedCity: string;
  setSelectedCity: (city: string) => void;
  driverAvailableOrders: any[];
  driverAssignedOrders: any[];
  tripFeedFilter: "all" | "active" | "archive";
  setTripFeedFilter: (filter: "all" | "active" | "archive") => void;
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
  showPlacedOrders: boolean;
  setShowPlacedOrders: (show: boolean) => void;
  mode: "create" | "run";
  t: any;
  language: string;
  users: Array<{ id: number; name: string; role_name: string }>;
  handleTakeDriverOrder: (orderId: number) => void;
  handleCancelDriverOrder: (orderId: number) => void;
  handleStartTrip: (tripId: number) => void;
  handleChangeTripState: (newState: "at_from_locker" | "in_transit" | "at_to_locker") => void;
  handleTakeSelectedOrders: () => void;
  handlePlaceParcelInCell: (orderId: number, cellNumber: string) => void;
  handleCloseOrder: () => void;
}

export function DriverForm({
  selectedDriverId,
  setSelectedDriverId,
  selectedCity,
  setSelectedCity,
  driverAvailableOrders,
  driverAssignedOrders,
  tripFeedFilter,
  setTripFeedFilter,
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
  showPlacedOrders,
  setShowPlacedOrders,
  mode,
  t,
  language,
  users,
  handleTakeDriverOrder,
  handleCancelDriverOrder,
  handleStartTrip,
  handleChangeTripState,
  handleTakeSelectedOrders,
  handlePlaceParcelInCell,
  handleCloseOrder,
}: DriverFormProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t.driver.title}</CardTitle>
      </CardHeader>
      <div className="mb-4">
        <Label htmlFor="city-select">{language === "ru" ? "Город" : "City"}</Label>
        <Select value={selectedCity} onValueChange={setSelectedCity}>
          <SelectTrigger id="city-select" className="w-[180px]">
            <SelectValue placeholder={language === "ru" ? "Выберите город" : "Select city"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="МСК">МСК</SelectItem>
            <SelectItem value="СПБ">СПБ</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <CardContent className="space-y-6">
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
          </div>
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>{language === "ru" ? "Откуда" : "From"}</TableHead>
                  <TableHead>{language === "ru" ? "Куда" : "To"}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {driverAvailableOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell>{order.id}</TableCell>
                    <TableCell>{order.from_city}</TableCell>
                    <TableCell>{order.to_city}</TableCell>
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
                      return order.tripStatus !== "completed";
                    } else if (tripFeedFilter === "archive") {
                      return order.tripStatus === "completed";
                    }
                    return true;
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
                        {order.tripStatus === "in_transit" ? (
                          <Button
                            size="sm"
                            onClick={() => {
                              setActiveTripId(order.tripId);
                              setTripId(order.tripId);
                              handleChangeTripState("at_to_locker");
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
                        const isTaken = takenDirectOrders.includes(order.id);
                        const canCheck = tripState === "at_from_locker" && !isTaken;
                        return (
                          <TableRow key={order.id}>
                            <TableCell>
                              <Checkbox
                                checked={selectedDirectOrders.includes(order.id) || isTaken}
                                disabled={!canCheck}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedDirectOrders([...selectedDirectOrders, order.id]);
                                  } else {
                                    setSelectedDirectOrders(
                                      selectedDirectOrders.filter((id) => id !== order.id),
                                    );
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
                        );
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
                    >
                      {t.driver.takeSelected}
                    </Button>
                  )}
                  {tripState === "in_transit" && (
                    <Button
                      size="sm"
                      onClick={() => handleChangeTripState("at_to_locker")}
                    >
                      {t.driver.arrived}
                    </Button>
                  )}
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
                            <TableHead>{t.driver.cellFrom}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {reverseOrders.map((order) => {
                            const isTaken = takenReverseOrders.includes(order.id);
                            const canCheck = !isTaken;
                            return (
                              <TableRow key={order.id}>
                                <TableCell>
                                  <Checkbox
                                    checked={selectedReverseOrders.includes(order.id) || isTaken}
                                    disabled={!canCheck}
                                    onCheckedChange={(checked) => {
                                      if (checked) {
                                        setSelectedReverseOrders([...selectedReverseOrders, order.id]);
                                      } else {
                                        setSelectedReverseOrders(
                                          selectedReverseOrders.filter((id) => id !== order.id),
                                        );
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
                                  const order = [...directOrders, ...reverseOrders].find((o) => o.id === orderId);
                                  return order;
                                })
                                .filter((order) => {
                                  if (!order) return false;
                                  const orderSize = sizeOrder[order.size as keyof typeof sizeOrder] || 0;
                                  return orderSize <= cellSizeValue && order.size === cell.size;
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
                              );
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
                          >
                            {t.driver.closeOrder}
                          </Button>
                        )}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
