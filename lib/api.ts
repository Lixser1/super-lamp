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