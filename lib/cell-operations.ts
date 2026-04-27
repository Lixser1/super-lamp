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

// Статусы для определения leg при снятии курьера
// order_courier1_assigned -> pickup, order_courier2_assigned -> delivery
export const COURIER2_ASSIGN_STATUSES = [
  'order_courier2_assigned',
] as const;

export type Courier2AssignStatus = typeof COURIER2_ASSIGN_STATUSES[number];

/**
 * Определяет process_name и leg для снятия курьера на основе статуса заказа
 * @param status - статус заказа
 * @returns process_name "remove_executor" и соответствующий leg
 */
export function getRemoveExecutorProcessAndLeg(status: string): { process_name: 'remove_executor'; leg: 'pickup' | 'delivery' } {
  // Для снятия курьера:
  // - "order_courier2_assigned" для postamatu2 -> "delivery"
  // - "order_courier1_assigned" для postamatu1 -> "pickup"
  const leg = COURIER2_ASSIGN_STATUSES.includes(status as Courier2AssignStatus) ? "delivery" : "pickup";
  return {
    process_name: 'remove_executor',
    leg
  };
}

/**
 * Определяет process_name и leg для назначения курьера на основе статуса заказа
 * @param status - статус заказа
 * @returns process_name и leg для assign_executor
 */
export function getAssignExecutorProcessAndLeg(status: string): { process_name: 'assign_executor'; leg: 'pickup' | 'delivery' } {
  // Для назначения курьера используем leg на основе статуса:
  // - "order_created" для postamatu1 -> "pickup"
  // - "order_parcel_confirmed_post2" для postamatu2 -> "delivery"
  const leg = status === 'order_parcel_confirmed_post2' ? "delivery" : "pickup";
  return {
    process_name: 'assign_executor',
    leg
  };
}
