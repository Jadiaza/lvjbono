export const BONO_STATUSES = [
  "disponible",
  "asignado",
  "reservado",
  "vendido",
  "pagado",
  "devuelto",
  "anulado",
] as const;

export type BonoStatus = (typeof BONO_STATUSES)[number];

export function padBonoNumber(value: number, digits = 3) {
  return Math.trunc(value).toString().padStart(digits, "0");
}

export function generateDualBonoPairs(totalBonos: number, random = Math.random) {
  if (!Number.isInteger(totalBonos) || totalBonos < 1 || totalBonos > 500) {
    throw new Error("La cantidad de bonos debe estar entre 1 y 500.");
  }
  const numbers = Array.from({ length: 1000 }, (_, index) => index);
  for (let index = numbers.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(random() * (index + 1));
    [numbers[index], numbers[swapIndex]] = [numbers[swapIndex], numbers[index]];
  }
  return Array.from({ length: totalBonos }, (_, index) => ({
    serial: index + 1,
    numbers: [numbers[index * 2], numbers[index * 2 + 1]] as [number, number],
  }));
}

const RESPONSIBLE_TRANSITIONS: Record<BonoStatus, readonly BonoStatus[]> = {
  disponible: [],
  asignado: ["reservado", "vendido"],
  reservado: ["asignado", "vendido"],
  vendido: ["pagado"],
  pagado: [],
  devuelto: [],
  anulado: [],
};

export function canResponsibleTransition(from: BonoStatus, to: BonoStatus) {
  return RESPONSIBLE_TRANSITIONS[from].includes(to);
}

export function calculateBonoSummary(
  bonos: Array<{ status: BonoStatus; sale_value?: number | null; amount_paid?: number | null }>,
) {
  const counts = Object.fromEntries(BONO_STATUSES.map((status) => [status, 0])) as Record<
    BonoStatus,
    number
  >;
  let soldValue = 0;
  let paidValue = 0;
  for (const bono of bonos) {
    counts[bono.status]++;
    if (bono.status === "vendido" || bono.status === "pagado") soldValue += bono.sale_value ?? 0;
    paidValue += bono.amount_paid ?? 0;
  }
  return { counts, soldValue, paidValue, pending: Math.max(0, soldValue - paidValue) };
}
