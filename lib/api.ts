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

  return response.json()
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

// Получение ошибок пользователя для FSM
export async function fetchFsmUserErrors(user_id: number, limit: number) {
  const params = new URLSearchParams({
    user_id: String(user_id),
    limit: String(limit),
  });

  const response = await fetch(`/api/proxy/fsm/user-errors?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Request fetchFsmUserErrors failed: ${response.status} ${response.statusText}`);
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

// Получение ошибок FSM для пользователя (использует /api/proxy/fsm/user-errors)
export async function fetchFsmUserErrorsFiltered(
  userId: number,
  limit: number = 50
) {
  const params = new URLSearchParams({
    user_id: String(userId),
    limit: String(limit),
  });

  const url = `/api/proxy/fsm/user-errors?${params.toString()}`;
  console.log('Fetching FSM user errors:', url);

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Request fetchFsmUserErrorsFiltered failed: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

