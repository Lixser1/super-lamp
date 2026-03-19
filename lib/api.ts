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
  const response = await fetch(`/api/proxy/orders/courier/${courier_id}`, {
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

// Получение заказов водителя по driver_id
export async function fetchDriverTrips(driverId: string | number) {
  const response = await fetch(`/api/proxy/trips/driver/${driverId}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Request fetchDriverTrips failed: ${response.status} ${response.statusText}`);
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