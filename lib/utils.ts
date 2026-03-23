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
  userRole: string = 'client'
) {
  console.log('performCellOperation called with:', { orderId, userId, processName, metadata, userRole });
  const requestData = makeFsmEnqueueRequest({
    entity_type: "order",
    entity_id: orderId,
    process_name: processName,
    user_id: userId,
    target_user_id: userId,
    user_role: userRole,
    metadata,
  });
  console.log('requestData:', requestData);
  const result = await enqueueFsmRequest(requestData);
  console.log('enqueueFsmRequest result:', result);
  return result;
}
