export function formatCOP(n: number | null | undefined): string {
  if (n == null) return "$0";
  return "$" + n.toLocaleString("es-CO");
}

export { padNumber, formatTicketNumber } from "./raffle-domain";

/** @deprecated Pass raffle digits to padNumber for new code. */
export function pad2(n: number | null | undefined): string {
  const safe = Number.isFinite(Number(n)) ? Number(n) : 0;
  return safe.toString().padStart(2, "0");
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });
}

export function buildWhatsAppUrl(phone: string, message: string): string {
  const clean = phone.replace(/[^\d]/g, "");
  return `https://wa.me/${clean}?text=${encodeURIComponent(message)}`;
}
