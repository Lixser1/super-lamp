// Получение кода для подтверждения заказа. Работа с ячейками
export async function fetchAccessCodeView(
  order_id: number,
  leg: string,
  user_id: number
) {
  const params = new URLSearchParams({
    order_id: String(order_id),
    leg: leg,
    user_id: String(user_id),
  });

  const url = `/api/proxy/access-code/view?${params.toString()}`;
  console.log('Sending GET to:', url);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    console.error(`Request fetchAccessCodeView failed: ${response.status} ${response.statusText}`);
    throw new Error(`Request fetchAccessCodeView failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function fetchOrdersByCourier(courier_id: string | number) {
  const response = await fetch(`/api/proxy/courier/exchange?courier_id=${courier_id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  // Новый endpoint возвращает объект с ключом orders
  const orders = data.orders || [];
  
  // Маппим поля для совместимости с UI
  return orders.map((order: any) => ({
    ...order,
    // Для pickup заказов - адрес и ячейка отправителя
    // Для delivery заказов - адрес и ячейка получателя
    lockerAddress: order.type === 'pickup' ? order.source_address : order.dest_address,
    cell: order.type === 'pickup' ? order.source_cell_code : order.dest_cell_code,
    size: order.cell_size,
  }));
}

// Получение заказов курьера через api/orders/courier/{courier_id}
export async function fetchOrdersByCourier2(courier_id: string | number) {
  const response = await fetch(`/api/proxy/orders/courier/${courier_id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  const orders = await response.json();
  
  // Маппим поля для совместимости с UI
  return orders.map((order: any) => ({
    ...order,
    // Используем leg из заказа для определения типа операции
    leg: order.leg || 'pickup',
    // Для pickup - адрес и ячейка отправителя, для delivery - получателя
    lockerAddress: order.leg === 'pickup' ? order.source_cell_id : order.dest_cell_id,
    cell: order.leg === 'pickup' ? order.source_cell_id : order.dest_cell_id,
    size: order.description,
  }));
}

export async function fetchOrdersByClient(client_id: string | number) {
  const response = await fetch(`/api/orders/user/${client_id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function fetchOrdersByRecipient(recipient_id: string | number) {
  const response = await fetch(`/api/proxy/orders/recipient/${recipient_id}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function fetchUsers() {
  const response = await fetch('/api/proxy/users', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Получение резервов водителя по driver_id
export async function fetchDriverReservations(driverId: string | number) {
  const response = await fetch(`/api/proxy/driver/${driverId}/reservations`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Request fetchDriverReservations failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Начать погрузку по резерву
export async function startDriverLoading(reservationId: number, driverUserId: number) {
  const url = `/api/proxy/driver/reservation/${reservationId}/start-loading?driver_user_id=${driverUserId}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Request startDriverLoading failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Начать рейс по направлению
export async function startDriverTrip(directionId: number, driverUserId: number) {
  const url = `/api/proxy/driver/direction/${directionId}/start-trip?driver_user_id=${driverUserId}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Request startDriverTrip failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Получить данные о рейсе по direction_id
export async function fetchDriverTripData(directionId: number, driverUserId: number) {
  const url = `/api/proxy/driver/direction/${directionId}/start-trip?driver_user_id=${driverUserId}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Request fetchDriverTripData failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}
export type FsmEnqueueRequest = {
  entity_type: 'order' | 'trip' | string
  entity_id: number
  process_name: string
  user_id: number
  target_user_id?: number
  target_role?: string
  user_role?: string
  metadata?: Record<string, unknown>
}

// Типы для операций с исполнителями
export type AssignExecutorRequest = {
  entity_type: 'order' | 'trip'
  entity_id: number
  user_id: number
  target_user_id: number
  target_role: 'courier' | 'driver'
  leg?: 'pickup' | 'delivery' // Опционально для trip
}

export type RemoveExecutorRequest = {
  entity_type: 'order' | 'trip'
  entity_id: number
  user_id: number
  target_user_id: number
  target_role: 'courier' | 'driver'
  leg?: 'pickup' | 'delivery' // Опционально для trip
}

export function makeFsmEnqueueRequest(
  params: {
    entity_type: FsmEnqueueRequest['entity_type']
    entity_id: number
    process_name: string
    user_id: number
    target_user_id?: number
    target_role?: string
    user_role?: string
    metadata?: Record<string, unknown>
  }
): FsmEnqueueRequest {
  return {
    entity_type: params.entity_type,
    entity_id: params.entity_id,
    process_name: params.process_name,
    user_id: params.user_id,
    target_user_id: params.target_user_id ?? params.user_id,
    target_role: params.target_role,
    user_role: params.user_role,
    metadata: params.metadata ?? {},
  }
}

export async function enqueueFsmRequest(data: FsmEnqueueRequest) {
  const response = await fetch('/api/proxy/fsm/enqueue', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => null)
    throw new Error(errorData?.message || `Request enqueueFsmRequest failed: ${response.status} ${response.statusText}`)
  }

  const result = await response.json();
  console.log('[enqueueFsmRequest] Response:', result);
  console.log('[enqueueFsmRequest] instance_id:', result?.data?.instance_id || result?.instance_id);
  return result;
}
// Получение сущностей для FSM эмулятора
export async function fetchFsmEntities(
  entityType: string = "all",
  status: string = "all",
  limit: number = 50
) {
  const params = new URLSearchParams({
    entity_type: entityType,
    status: status,
    limit: String(limit),
  });

  const response = await fetch(`/api/proxy/fsm/emulator/entities?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Request fetchFsmEntities failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Получение доступных действий для конкретной сущности
export async function fetchFsmEntityActions(entityType: string, entityId: number) {
  const response = await fetch(`/api/proxy/fsm/emulator/entities/${entityType}/${entityId}/actions`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Request fetchFsmEntityActions failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Получение истории действий для конкретной сущности
export async function fetchFsmEntityHistory(entityType: string, entityId: number) {
  const response = await fetch(`/api/proxy/fsm/emulator/entities/${entityType}/${entityId}/history`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Request fetchFsmEntityHistory failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Получение трекинга заказа
export async function fetchOrderTrack(order_id: number) {
  const response = await fetch(`/api/proxy/orders/${order_id}/track`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Request fetchOrderTrack failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Получение рейсов оператора
export async function fetchOperatorTrips() {
  const response = await fetch('/api/proxy/operator/trips', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Request fetchOperatorTrips failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Получение локеров оператора
export async function fetchOperatorLockers() {
  const response = await fetch('/api/proxy/operator/lockers', {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Request fetchOperatorLockers failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Получение FSM instances для пользователя с фильтрацией по process_name
export type FsmInstance = {
  id: number
  entity_type: string
  entity_id: number
  process_name: string
  fsm_state: string
  last_error: string | null
  created_at: string
  updated_at: string
}

export async function fetchFsmInstances(
  userId: number,
  limit: number = 50,
  processNames?: string[],
  entityTypes?: string[]
) {
  const params = new URLSearchParams({
    user_id: String(userId),
    limit: String(limit),
  });

  if (processNames && processNames.length > 0) {
    params.set('process_names', processNames.join(','));
  }

  if (entityTypes && entityTypes.length > 0) {
    params.set('entity_types', entityTypes.join(','));
  }

  const url = `/api/proxy/fsm/instances?${params.toString()}`;
  console.log('Fetching FSM instances:', url);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Request fetchFsmInstances failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Получение FSM instance по ID
export async function fetchFsmInstance(instanceId: number) {
  const response = await fetch(`/api/proxy/fsm/instance/${instanceId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Request fetchFsmInstance failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Получение ошибок FSM для пользователя с фильтрацией
export async function fetchFsmUserErrorsFiltered(
  userId: number,
  limit: number = 50
) {
  const params = new URLSearchParams({
    user_id: String(userId),
    limit: String(limit),
  });

  const response = await fetch(`/api/proxy/fsm/instances?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Request fetchFsmUserErrorsFiltered failed: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  
  // Фильтруем только FAILED инстансы с last_error
  const errors = (data.instances || []).filter((inst: any) => 
    inst.fsm_state === 'FAILED' && inst.last_error && inst.last_error !== ''
  );
  
  return {
    success: true,
    errors: errors
  };
}

// Получение активных рейсов водителя
export async function fetchActiveDriverTrips(driverUserId: number) {
  const url = `/api/proxy/driver/${driverUserId}/trips/in-progress`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Request fetchActiveDriverTrips failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

// Подписка на SSE события для instance
export function subscribeToFsmInstanceEvents(
  instanceId: number,
  onMessage: (data: { event_type?: string; message?: string; [key: string]: any }) => void,
  onError: (error: string) => void
) {
  const eventUrl = `/api/proxy/fsm/instance/${instanceId}/stream`;
  console.log('[SSE] Subscribing to:', eventUrl);

  const eventSource = new EventSource(eventUrl);
  let hasReceivedMessage = false;

  eventSource.onopen = () => {
    console.log('[SSE] Connection opened');
  };

  // Обработка события success
  eventSource.addEventListener("success", (event: any) => {
    console.log('[SSE] Success event:', event.data);
    hasReceivedMessage = true;
    try {
      // event.data может быть строкой "SUCCESS" или JSON с полем data
      if (typeof event.data === 'string') {
        // Если это просто строка, пытаемся распарсить как JSON
        try {
          const parsed = JSON.parse(event.data);
          onMessage({
            event_type: "success",
            message: parsed.data || parsed.message || event.data
          });
        } catch {
          // Если не JSON, используем как есть
          onMessage({
            event_type: "success",
            message: event.data
          });
        }
      } else if (typeof event.data === 'object' && event.data !== null) {
        // Если это объект, извлекаем message/data
        onMessage({
          event_type: "success",
          message: event.data.message || event.data.data || JSON.stringify(event.data)
        });
      }
    } catch (e) {
      console.error('[SSE] Error parsing success event:', e);
      onMessage({
        event_type: "success",
        message: 'Success'
      });
    }
  });

  // Обработка события error (backend может использовать event: error или event: error_event)
  const handleErrorEvent = (event: any) => {
    hasReceivedMessage = true;
    if (event?.data !== undefined && event?.data !== null) {
      console.log('[SSE] Error event:', event.data);
      // event.data может быть строкой "NO_FREE_CELLS" или JSON с полем data
      if (typeof event.data === 'string') {
        // Если это просто строка, пытаемся распарсить как JSON
        try {
          const parsed = JSON.parse(event.data);
          onMessage({
            event_type: "error",
            message: parsed.data || parsed.message || event.data
          });
        } catch {
          // Если не JSON, используем как есть (это и есть текст ошибки)
          onMessage({
            event_type: "error",
            message: event.data
          });
        }
      } else if (typeof event.data === 'object' && event.data !== null) {
        // Если это объект, извлекаем message/data
        onMessage({
          event_type: "error",
          message: event.data.data || event.data.message || JSON.stringify(event.data)
        });
      }
    } else {
      console.log('[SSE] Error event with no data', event);
    }
  };

  eventSource.addEventListener("error", handleErrorEvent as (ev: MessageEvent) => void);
  eventSource.addEventListener("error_event", handleErrorEvent as (ev: MessageEvent) => void);

  // Fallback обработка для generic onmessage (если backend использует стандартный формат SSE)
  eventSource.onmessage = (event) => {
    console.log('[SSE] Generic message:', event.data);
    try {
      const data = JSON.parse(event.data);
      onMessage(data);
    } catch (e) {
      onMessage({ message: event.data });
    }
  };

  eventSource.onerror = (event: any) => {
    console.log('[SSE] Connection closed:', event);
    // Не вызываем onError если мы уже получили сообщение - это нормальное закрытие
    if (!hasReceivedMessage) {
      onError('SSE connection error');
    }
  };

  return {
    close: () => {
      console.log('[SSE] Unsubscribing');
      eventSource.close();
    }
  };
}

// Функции для назначения и снятия исполнителей через единый процесс

/**
 * Создает запрос на назначение исполнителя (курьера/водителя) через процесс assign_executor
 */
export function createAssignExecutorRequest(
  params: AssignExecutorRequest
): FsmEnqueueRequest {
  return {
    entity_type: params.entity_type,
    entity_id: params.entity_id,
    process_name: 'assign_executor',
    user_id: params.user_id,
    target_user_id: params.target_user_id,
    target_role: params.target_role,
    metadata: params.leg ? { leg: params.leg } : {},
  }
}

/**
 * Создает запрос на снятие исполнителя (курьера/водителя) через процесс remove_executor
 */
export function createRemoveExecutorRequest(
  params: RemoveExecutorRequest
): FsmEnqueueRequest {
  return {
    entity_type: params.entity_type,
    entity_id: params.entity_id,
    process_name: 'remove_executor',
    user_id: params.user_id,
    target_user_id: params.target_user_id,
    target_role: params.target_role,
    metadata: params.leg ? { leg: params.leg } : {},
  }
}

