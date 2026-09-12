/* eslint-disable @typescript-eslint/no-explicit-any */
import { MessageCircle, Eye, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCOP } from "@/lib/format";
import { padBonoNumber } from "@/lib/bono-domain";

function normalizeWhatsAppPhone(value?: string | null) {
  const digits = (value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("57") && digits.length >= 12) return digits;
  if (digits.length === 10 && digits.startsWith("3")) return `57${digits}`;
  return digits;
}

function numbersFor(bono: any) {
  return (bono.raffle_bono_numbers ?? [])
    .slice()
    .sort((a: any, b: any) => a.option_number - b.option_number)
    .map((n: any) => padBonoNumber(n.numero));
}

function statusLabel(status: string) {
  if (status === "reservado") return "Reservado";
  if (status === "vendido") return "Pendiente de pago";
  if (status === "pagado") return "Pagado";
  return status;
}

export function ResponsibleBuyersTable({
  bonos,
  raffleById,
  onOpenBono,
  onRegisterPayment,
}: {
  bonos: any[];
  raffleById: (raffleId: string) => any | null;
  onOpenBono: (bono: any) => void;
  onRegisterPayment: (bono: any) => void;
}) {
  const rows = bonos
    .filter((bono) => bono.buyer_name && ["reservado", "vendido", "pagado"].includes(bono.status))
    .sort((a, b) => {
      const priority: Record<string, number> = { vendido: 0, reservado: 1, pagado: 2 };
      return (priority[a.status] ?? 9) - (priority[b.status] ?? 9) || a.serial - b.serial;
    });

  function openWhatsApp(bono: any) {
    const phone = normalizeWhatsAppPhone(bono.buyer_phone);
    if (!phone) return;
    const raffle = raffleById(bono.raffle_id);
    const nums = numbersFor(bono).join(" y ");
    const amount = raffle?.valor_boleta ? formatCOP(raffle.valor_boleta) : "el valor del bono";
    const buyer = bono.buyer_name || "";
    const message = bono.status === "vendido"
      ? `Hola ${buyer}. Te recordamos amablemente el pago pendiente de tu Bono ${padBonoNumber(bono.serial)}, números ${nums}, por valor de ${amount}. Gracias por apoyar la misión de Mensajeros de San Miguel Arcángel.`
      : bono.status === "reservado"
        ? `Hola ${buyer}. Tu Bono ${padBonoNumber(bono.serial)}, números ${nums}, está reservado. Cuando estés listo(a), podemos confirmar la compra y coordinar el pago. Gracias por apoyar nuestra misión.`
        : `Hola ${buyer}. Gracias por tu apoyo. Tu Bono ${padBonoNumber(bono.serial)}, números ${nums}, se encuentra pagado y confirmado.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }

  if (!rows.length) return null;

  return (
    <section className="space-y-3 rounded-2xl border bg-card p-3 sm:p-5">
      <div>
        <h2 className="font-display text-lg sm:text-xl">Seguimiento de compradores</h2>
        <p className="text-sm text-muted-foreground">Reservas, ventas pendientes de pago y pagos confirmados. Puedes contactar al comprador directamente por WhatsApp.</p>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-secondary/70 text-left">
            <tr>
              <th className="px-3 py-3">Comprador</th>
              <th className="px-3 py-3">Teléfono</th>
              <th className="px-3 py-3">Bono</th>
              <th className="px-3 py-3">Números</th>
              <th className="px-3 py-3">Estado</th>
              <th className="px-3 py-3">Valor</th>
              <th className="px-3 py-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((bono) => {
              const raffle = raffleById(bono.raffle_id);
              const nums = numbersFor(bono);
              return (
                <tr key={bono.id} className="border-t align-middle">
                  <td className="px-3 py-3 font-medium">{bono.buyer_name}</td>
                  <td className="px-3 py-3">{bono.buyer_phone || "—"}</td>
                  <td className="px-3 py-3">{padBonoNumber(bono.serial)}</td>
                  <td className="px-3 py-3 font-bold text-red-700">{nums.join(" · ")}</td>
                  <td className="px-3 py-3"><span className="rounded-full bg-secondary px-2 py-1 text-xs font-semibold">{statusLabel(bono.status)}</span></td>
                  <td className="px-3 py-3">{raffle?.valor_boleta ? formatCOP(raffle.valor_boleta) : "—"}</td>
                  <td className="px-3 py-3">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="outline" onClick={() => onOpenBono(bono)}><Eye className="mr-1 h-4 w-4" /> Ver</Button>
                      {bono.buyer_phone && <Button size="sm" variant={bono.status === "vendido" ? "default" : "outline"} onClick={() => openWhatsApp(bono)}><MessageCircle className="mr-1 h-4 w-4" /> {bono.status === "vendido" ? "Recordar pago" : "WhatsApp"}</Button>}
                      {bono.status === "vendido" && <Button size="sm" variant="outline" onClick={() => onRegisterPayment(bono)}><CheckCircle2 className="mr-1 h-4 w-4" /> Registrar pago</Button>}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
