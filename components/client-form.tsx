"use client"
import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { v4 as uuidv4 } from 'uuid'

interface ClientFormProps {
  selectedClientId: string
  setSelectedClientId: (id: string) => void
  recipientUserId: string
  setRecipientUserId: (id: string) => void
  parcelType: string
  setParcelType: (type: string) => void
  cellSize: string
  setCellSize: (size: string) => void
  senderDelivery: string
  setSenderDelivery: (delivery: string) => void
  recipientDelivery: string
  setRecipientDelivery: (delivery: string) => void
  clientOrders: Array<{
    id: number
    description: string
    status: string
    canCancel: boolean
    isLoading?: boolean
  }>
  setClientOrders: React.Dispatch<React.SetStateAction<any[]>>
  orderMessage: string | null
  setOrderMessage: (message: string | null) => void
  language: string
  t: any
  addLog: (log: any) => void
    users: Array<{ id: number; role_name: string }>
}

export function ClientForm({
  selectedClientId,
  setSelectedClientId,
  recipientUserId,
  setRecipientUserId,
  parcelType,
  setParcelType,
  cellSize,
  setCellSize,
  senderDelivery,
  setSenderDelivery,
  recipientDelivery,
  setRecipientDelivery,
  clientOrders,
  setClientOrders,
  orderMessage,
  setOrderMessage,
  language,
  t,
  addLog,
  users,
}: ClientFormProps) {
  React.useEffect(() => {
    if (parcelType === "letter") {
      setCellSize("P")
    }
  }, [parcelType, setCellSize])

  const handleCreateOrder = async () => {
    setOrderMessage(null)

    const data = {
      client_user_id: parseInt(selectedClientId),
      parcel_type: parcelType,
      cell_size: cellSize,
      sender_delivery: senderDelivery,
      recipient_delivery: recipientDelivery,
      recipient_user_id: recipientUserId,
    }

    try {
      const response = await fetch('/api/proxy/client/create_order_request', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      const result = await response.json()
      setOrderMessage(result.message || 'Неизвестная ошибка')

      if (result.success) {
        setClientOrders([
          ...clientOrders,
          {
            description: `${parcelType} to cell ${cellSize}`,
            status: "processing",
            canCancel: false,
            isLoading: true,
          },
        ])
      }
    } catch (error) {
      console.error('Error creating order:', error)
      setOrderMessage('Ошибка при создании заказа')
    }
  }

  const handleCancelClientOrder = async (orderId: number) => {
    const data = {
      entity_type: "order",
      entity_id: orderId,
      process_name: "cancel_order",
      user_id: parseInt(selectedClientId),
    }

    try {
      const response = await fetch('/api/proxy/fsm/enqueue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (response.status === 404) {
        setClientOrders(prev =>
          prev.map(order =>
            order.id === orderId ? { ...order, status: "cannot_cancel", canCancel: false } : order
          )
        )
        return
      }

      const result = await response.json()

      if (result.error || result.status === 'error' || result.message?.includes('cannot')) {
        setClientOrders(
          clientOrders.map((order) => (order.id === orderId ? { ...order, status: "cannot_cancel", canCancel: false } : order)),
        )
        return
      }

      setClientOrders(
        clientOrders.filter((order) => order.id !== orderId)
      )

      addLog({
        role: "client",
        action: "cancel_order",
        data: result,
      })
    } catch (error) {
      console.error('Error cancelling order:', error)
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
              {users.map((user) => (
                <SelectItem key={user.id} value={user.id.toString()}>
                  {language === "ru" ? "Клиент" : "Client"} #{user.id}
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
      {users.map((user) => (
        <SelectItem key={user.id} value={user.id.toString()}>
          {language === "ru" ? "Получатель" : "Recipient"} #{user.id}
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
                    <TableHead></TableHead>
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
                          <Badge variant={order.status === "cancelled" ? "destructive" : order.status === "processing" ? "secondary" : "default"}>
                            {order.status === "processing" ? t.client.statusProcessing : order.status}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {!order.isLoading && (
                          order.canCancel ? (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleCancelClientOrder(order.id)}
                            >
                              {t.client.cancelOrder}
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">{t.client.cannotCancel}</span>
                          )
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
    </Card>
  )
}
