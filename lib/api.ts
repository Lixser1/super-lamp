// Получение кода для подтверждения заказа
export async function fetchAccessCodeView(
  order_id: number,
  leg: string,
  user_id: number
) {
  const params = new URLSearchParams({
    order_id: String(order_id),
    leg: String(leg),
    user_id: String(user_id),
  });

  const response = await fetch(`/api/proxy/access-code/view?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
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

// Все заказы. Временный запрос
export async function fetchOrders() {
  const response = await fetch('/api/proxy/orders', {
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