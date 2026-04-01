// Статусы заказов, для которых используется leg = "delivery"
// В остальных случаях используется leg = "pickup"

export const DELIVERY_LEG_STATUSES = [
  'order_in_transit_to_post2',    // delivery для водителя
  'order_courier2_assigned',      // delivery для курьера
  'order_parcel_confirmed_post2', // delivery для получателя
  'order_courier2_parcel_delivered', // delivery для получателя (подтвердить посылку от курьера
] as const;

export type DeliveryLegStatus = typeof DELIVERY_LEG_STATUSES[number];

/**
 * Определяет leg на основе статуса заказа
 * @param status - статус заказа
 * @returns "delivery" если статус совпадает с одним из DELIVERY_LEG_STATUSES, иначе "pickup"
 */
export function getLegFromStatus(status: string): "pickup" | "delivery" {
  return DELIVERY_LEG_STATUSES.includes(status as DeliveryLegStatus) ? "delivery" : "pickup";
}
