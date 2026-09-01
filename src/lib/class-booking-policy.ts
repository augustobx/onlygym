export function getBookingPlacement(confirmed: number, capacity: number, waiting: number) {
  if (!Number.isInteger(confirmed) || !Number.isInteger(capacity) || !Number.isInteger(waiting) || confirmed < 0 || capacity < 1 || waiting < 0) throw new Error("Estado de cupos inválido");
  return confirmed < capacity
    ? { estado: "confirmada" as const, posicionEspera: null }
    : { estado: "espera" as const, posicionEspera: waiting + 1 };
}

export function normalizeWaitingPositions<T extends { id: number }>(bookings: T[]) {
  return bookings.map((booking, index) => ({ id: booking.id, posicionEspera: index + 1 }));
}
