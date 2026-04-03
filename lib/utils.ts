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
    const result = await fetchFsmUserErrorsFiltered(userId, 1);
    
    if (result?.success && Array.isArray(result.errors)) {
      const orderIds = orders.map(o => o.id);
      const errorsMap: Record<number, string> = {};
      
      result.errors.forEach((err: any) => {
        if (err.fsm_state === "FAILED" && err.last_error && err.entity_id) {
          // Фильтруем по process_name
          if (!processNames.includes(err.process_name)) return;
          
          const orderId = Number(err.entity_id);
          // Фильтруем по entity_id (только заказы пользователя)
          if (orderIds.includes(orderId)) {
            if (!errorsMap[orderId]) {
              errorsMap[orderId] = err.last_error;
            }
          }
        }
      });

      return orders.map(order => ({
        ...order,
        fsmError: errorsMap[order.id] || null,
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
