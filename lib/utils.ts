import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { makeFsmEnqueueRequest, enqueueFsmRequest } from './api'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
