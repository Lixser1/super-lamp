export const mockLockers = [
  { id: 1, address: "Москва, Ленина 10" },
  { id: 2, address: "Москва, Пушкина 5" },
  { id: 3, address: "Москва, Гагарина 15" },
  { id: 4, address: "Санкт-Петербург, Невский 20" },
  { id: 5, address: "Санкт-Петербург, Литейный 8" },
  { id: 6, address: "Казань, Баумана 12" },
  { id: 7, address: "Екатеринбург, Ленина 30" },
  { id: 8, address: "Новосибирск, Красный 25" },
  { id: 9, address: "Краснодар, Красная 18" },
  { id: 10, address: "Владивосток, Светланская 40" },
]

export const mockLockerCells = [
  { lockerId: 1, number: "S-01", size: "S", status: "free" },
  { lockerId: 1, number: "M-01", size: "M", status: "occupied" },
  { lockerId: 1, number: "L-01", size: "L", status: "free" },
  { lockerId: 1, number: "P-01", size: "P", status: "free", letterCapacity: 50, currentLetters: 12 },
  { lockerId: 1, number: "S-02", size: "S", status: "repair" },
  { lockerId: 1, number: "S-03", size: "S", status: "free" },
  { lockerId: 1, number: "M-02", size: "M", status: "free" },
  { lockerId: 1, number: "L-02", size: "L", status: "free" },
  { lockerId: 2, number: "M-01", size: "M", status: "free" },
  { lockerId: 2, number: "L-01", size: "L", status: "occupied" },
  { lockerId: 2, number: "S-01", size: "S", status: "free" },
  { lockerId: 2, number: "P-01", size: "P", status: "occupied", letterCapacity: 50, currentLetters: 35 },
  { lockerId: 2, number: "S-02", size: "S", status: "free" },
  { lockerId: 2, number: "M-02", size: "M", status: "free" },
  { lockerId: 3, number: "S-01", size: "S", status: "free" },
  { lockerId: 3, number: "M-01", size: "M", status: "free" },
  { lockerId: 3, number: "P-01", size: "P", status: "free", letterCapacity: 50, currentLetters: 0 },
  { lockerId: 3, number: "L-01", size: "L", status: "free" },
]

export const mockOrders = [
  {
    id: 101,
    lockerId: 1,
    cell: "S-01",
    size: "S",
    status: "available_for_pickup",
    courierId: null,
    parcelType: "Посылка",
  },
  {
    id: 102,
    lockerId: 1,
    cell: "M-01",
    size: "M",
    status: "available_for_pickup",
    courierId: null,
    parcelType: "Письмо",
  },
  {
    id: 103,
    lockerId: 2,
    cell: "L-01",
    size: "L",
    status: "available_for_pickup",
    courierId: null,
    parcelType: "Посылка",
  },
  {
    id: 104,
    lockerId: 1,
    cell: "S-03",
    size: "S",
    status: "taken_from_exchange",
    courierId: 100,
    parcelType: "Посылка",
  },
  {
    id: 105,
    lockerId: 2,
    cell: "M-02",
    size: "M",
    status: "taken_from_exchange",
    courierId: 100,
    parcelType: "Письмо",
  },
  {
    id: 111,
    lockerId: 3,
    cell: "L-01",
    size: "L",
    status: "assigned_by_operator",
    courierId: 100,
    parcelType: "Посылка",
  },
  {
    id: 106,
    lockerId: 3,
    cell: "S-01",
    size: "S",
    status: "assigned_to_pudo",
    courierId: null,
    parcelType: "Посылка",
  },
  {
    id: 107,
    lockerId: 3,
    cell: "M-01",
    size: "M",
    status: "assigned_to_pudo",
    courierId: null,
    parcelType: "Посылка",
  },
  {
    id: 108,
    lockerId: 4,
    cell: "L-01",
    size: "L",
    status: "assigned_to_pudo",
    courierId: null,
    parcelType: "Посылка",
  },
  {
    id: 109,
    lockerId: 1,
    cell: "S-04",
    size: "S",
    status: "in_transit",
    courierId: 101,
    parcelType: "Письмо",
  },
  {
    id: 110,
    lockerId: 2,
    cell: "M-03",
    size: "M",
    status: "in_transit",
    courierId: 102,
    parcelType: "Посылка",
  },
  {
    id: 201,
    lockerId: 2,
    cell: "S-01",
    size: "S",
    status: "taken_by_driver",
    tripId: 305,
    driverId: 200,
    parcelType: "Посылка",
  },
  {
    id: 202,
    lockerId: 2,
    cell: "M-01",
    size: "M",
    status: "taken_by_driver",
    tripId: 305,
    driverId: 200,
    parcelType: "Посылка",
  },
  {
    id: 203,
    lockerId: 2,
    cell: "L-01",
    size: "L",
    status: "taken_by_driver",
    tripId: 305,
    driverId: 200,
    parcelType: "Посылка",
  },
]

export const mockDriverExchangeOrders = [
  {
    id: 301,
    tripId: 301,
    lockerId: 1,
    status: "available_for_driver",
    driverId: null,
    parcelType: "Рейс",
  },
  {
    id: 302,
    tripId: 302,
    lockerId: 2,
    status: "available_for_driver",
    driverId: null,
    parcelType: "Рейс",
  },
]

export const mockDriverAssignedOrders = [
  {
    id: 304,
    tripId: 304,
    lockerId: 1,
    status: "taken_from_exchange_driver",
    tripStatus: "at_from_locker",
    driverId: 200,
    parcelType: "Рейс",
  },
  {
    id: 305,
    tripId: 305,
    lockerId: 2,
    status: "taken_from_exchange_driver",
    tripStatus: "in_transit",
    driverId: 200,
    parcelType: "Рейс",
  },
  {
    id: 306,
    tripId: 306,
    lockerId: 3,
    status: "assigned_by_operator_driver",
    tripStatus: "at_from_locker",
    driverId: 200,
    parcelType: "Рейс",
  },
  {
    id: 303,
    tripId: 303,
    lockerId: 3,
    status: "completed",
    tripStatus: "completed",
    driverId: 200,
    parcelType: "Рейс",
  },
]

export const mockCouriers = [
  { id: 100, name: "Курьер #100" },
  { id: 101, name: "Курьер #101" },
  { id: 102, name: "Курьер #102" },
  { id: 103, name: "Курьер #103" },
  { id: 104, name: "Курьер #104" },
]

export const mockOrderTracking: { [key: number]: Array<{ status: string; date: string; time: string }> } = {
  101: [
    { status: "Создан", date: "2025-01-20", time: "10:30" },
    { status: "Забран курьером у отправителя", date: "2025-01-20", time: "14:15" },
    { status: "В пути", date: "2025-01-20", time: "15:00" },
    { status: "Поступил в постамат получения", date: "2025-01-21", time: "09:00" },
  ],
  102: [
    { status: "Создан", date: "2025-01-19", time: "11:00" },
    { status: "Забран курьером у отправителя", date: "2025-01-19", time: "16:30" },
    { status: "В пути", date: "2025-01-19", time: "17:00" },
    { status: "Прибыл в город получателя", date: "2025-01-20", time: "08:00" },
    { status: "Доставлен курьером", date: "2025-01-20", time: "10:45" },
  ],
  103: [
    { status: "Создан", date: "2025-01-18", time: "09:15" },
    { status: "Забран курьером у отправителя", date: "2025-01-18", time: "13:00" },
    { status: "В пути", date: "2025-01-18", time: "14:30" },
  ],
}

export const mockOrderDetails: {
  [key: number]: {
    id: number
    locker: string
    cell: string
    recipientDelivery: "self" | "courier"
    currentStatus: string
  }
} = {
  101: {
    id: 101,
    locker: "Москва, Ленина 10",
    cell: "S-01",
    recipientDelivery: "self",
    currentStatus: "Поступил в постамат получения",
  },
  102: {
    id: 102,
    locker: "Москва, Пушкина 5",
    cell: "M-01",
    recipientDelivery: "courier",
    currentStatus: "Доставлен курьером",
  },
  103: {
    id: 103,
    locker: "Санкт-Петербург, Невский 20",
    cell: "L-01",
    recipientDelivery: "self",
    currentStatus: "В пути",
  },
}
