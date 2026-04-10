import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { makeFsmEnqueueRequest, enqueueFsmRequest, fetchFsmUserErrorsFiltered } from './api'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Тип для заказа с ошибкой FSM
export type OrderWithFsmError = {
  id: number;
  fsmError?: string | null;
  [key: string]: any;
};

// Универсальная функция загрузки ошибок FSM для заказов
export async function loadOrdersFsmErrors<T extends OrderWithFsmError>(
  userId: number,
  orders: T[],
  processNames: string[]
): Promise<T[]> {
  if (!userId || orders.length === 0) return orders;

  try {
    console.log('[loadOrdersFsmErrors] Fetching errors for userId:', userId, 'orders:', orders.length, 'processNames:', processNames);
    const result = await fetchFsmUserErrorsFiltered(userId, 50);
    console.log('[loadOrdersFsmErrors] Result:', result);
    
    if (result?.success && Array.isArray(result.errors)) {
      const orderIds = orders.map(o => Number(o.id ?? o.order_id));
      console.log('[loadOrdersFsmErrors] Order IDs to check:', orderIds);
      const errorsMap: Record<number, string> = {};
      
      result.errors.forEach((err: any) => {
        console.log('[loadOrdersFsmErrors] Checking error:', err.entity_id, err.process_name, err.fsm_state, err.last_error);
        if (err.fsm_state === "FAILED" && err.last_error && err.entity_id) {
          if (!processNames.includes(err.process_name)) {
            console.log('[loadOrdersFsmErrors] Skipping - process not in list:', err.process_name);
            return;
          }
          
          const orderId = Number(err.entity_id);
          if (orderIds.includes(orderId)) {
            console.log('[loadOrdersFsmErrors] Found error for order:', orderId, err.last_error);
            if (!errorsMap[orderId]) {
              errorsMap[orderId] = err.last_error;
            }
          }
        }
      });

      console.log('[loadOrdersFsmErrors] Errors map:', errorsMap);
      return orders.map(order => ({
        ...order,
        fsmError: errorsMap[Number(order.id ?? order.order_id)] || null,
      }));
    }
  } catch (error) {
    console.error('Error loading order FSM errors:', error);
  }
  
  return orders;
}

export async function performCellOperation(
  orderId: number,
  userId: number,
  processName: string,
  metadata: Record<string, unknown> = {},
  userRole: string = 'client',
  options: {
    entityType?: 'order' | 'locker';
    targetRole?: string;
    leg?: 'pickup' | 'delivery';
  } = {},
  targetUserId?: number
) {
  const { entityType = 'order', targetRole, leg } = options;
  
  // Для водителя: код (access code) - order, ячейки (open/close) - locker
  let finalEntityType = entityType;
  if (userRole === 'driver') {
    if (processName.includes('code') || processName === 'request_locker_access_code') {
      finalEntityType = 'order';
    } else {
      finalEntityType = 'locker';
    }
  }
  
  // Добавляем leg в metadata если передан
  const finalMetadata = leg ? { ...metadata, leg } : metadata;
  
  console.log('performCellOperation called with:', { orderId, userId, processName, metadata: finalMetadata, userRole, entityType: finalEntityType, targetUserId });
  const requestData = makeFsmEnqueueRequest({
    entity_type: finalEntityType,
    entity_id: orderId,
    process_name: processName,
    user_id: userId,
    target_user_id: targetUserId ?? userId,
    target_role: targetRole,
    user_role: userRole,
    metadata: finalMetadata,
  });
  console.log('requestData:', requestData);
  const result = await enqueueFsmRequest(requestData);
  console.log('enqueueFsmRequest result:', result);
  return result;
}
