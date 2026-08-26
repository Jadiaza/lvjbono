/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LogOut, Printer } from "lucide-react";
import { toast } from "sonner";
import { responsibleGetDashboard, responsibleUpdateBonos } from "@/lib/bono.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCOP } from "@/lib/format";
import { padBonoNumber } from "@/lib/bono-domain";

export const Route = createFileRoute("/responsable")({ component: ResponsibleDashboard });
function ResponsibleDashboard() {
  const navigate = useNavigate(),
    get = useServerFn(responsibleGetDashboard),
    update = useServerFn(responsibleUpdateBonos),
    qc = useQueryClient();
  const { data, error } = useQuery({
    queryKey: ["responsible-dashboard"],
    queryFn: () => get(),
    retry: false,
  });
  const [search, setSearch] = useState(""),
    [status, setStatus] = useState("todos"),
    [selected, setSelected] = useState<string[]>([]);
  useEffect(() => {
    if (error) {
      toast.error(error instanceof Error ? error.message : "Acceso denegado");
      navigate({ to: "/responsable-login", replace: true });
    }
  }, [error, navigate]);
  const bonos = data?.bonos ?? [];
  const filtered = useMemo(
    () =>
      bonos.filter(
        (b: any) =>
          (status === "todos" || b.status === status) &&
          (!search ||
            padBonoNumber(b.serial).includes(search) ||
            b.raffle_bono_numbers?.some((n: any) => padBonoNumber(n.numero).includes(search))),
      ),
    [bonos, search, status],
  );
  function toggle(id: string) {
    setSelected((x) => (x.includes(id) ? x.filter((v) => v !== id) : [...x, id]));
  }
  async function action(kind: "reserve" | "cancel_reservation" | "sell" | "pay") {
    if (!selected.length) return toast.error("Selecciona uno o más bonos.");
    const payload: any = { bonoIds: selected, action: kind };
    if (kind === "sell") {
      payload.buyer_name = prompt("Nombre del comprador") ?? "";
      payload.buyer_phone = prompt("Teléfono del comprador") ?? "";
      if (!payload.buyer_name || !payload.buyer_phone) return;
    }
    if (kind === "pay") payload.payment_reference = prompt("Referencia de pago (opcional)") ?? "";
    try {
      const r = await update({ data: payload });
      toast.success(`${r.updated} bono(s) actualizados.`);
      setSelected([]);
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  }
  if (!data) return <main className="p-8">Cargando bonos asignados…</main>;
  const s = data.summary;
  return (
    <main className="mx-auto min-h-screen max-w-6xl space-y-6 p-4 sm:p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl text-gold">{data.responsible.display_name}</h1>
          <p className="text-sm text-muted-foreground">Panel privado de bonos</p>
        </div>
        <Button
          variant="ghost"
          onClick={async () => {
            await supabase.auth.signOut();
            navigate({ to: "/responsable-login" });
          }}
        >
          <LogOut className="mr-1 h-4 w-4" />
          Salir
        </Button>
      </header>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        {[
          ["Asignados", s.counts.asignado],
          ["Reservados", s.counts.reservado],
          ["Vendidos", s.counts.vendido],
          ["Pagados", s.counts.pagado],
          ["Recaudo", formatCOP(s.paidValue)],
          ["Pendiente", formatCOP(s.pending)],
          ["Total", bonos.length],
        ].map(([k, v]) => (
          <div key={String(k)} className="rounded-lg border bg-card p-3">
            <p className="text-xs text-muted-foreground">{k}</p>
            <strong>{v}</strong>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Input
          className="max-w-xs"
          placeholder="Buscar bono o número"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="rounded-md border bg-background px-3"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="todos">Todos</option>
          {["asignado", "reservado", "vendido", "pagado"].map((x) => (
            <option key={x}>{x}</option>
          ))}
        </select>
        <Button onClick={() => action("reserve")}>Reservar</Button>
        <Button variant="outline" onClick={() => action("cancel_reservation")}>
          Cancelar reserva
        </Button>
        <Button onClick={() => action("sell")}>Registrar venta</Button>
        <Button onClick={() => action("pay")}>Registrar pago</Button>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="h-4 w-4" />
        </Button>
      </div>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-sm">
          <thead className="bg-secondary">
            <tr>
              <th className="p-3"></th>
              <th>Bono</th>
              <th>Números</th>
              <th>Lote</th>
              <th>Estado</th>
              <th>Comprador</th>
              <th>Pagado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((b: any) => (
              <tr key={b.id} className="border-t">
                <td className="p-3">
                  <input
                    type="checkbox"
                    checked={selected.includes(b.id)}
                    onChange={() => toggle(b.id)}
                  />
                </td>
                <td>{padBonoNumber(b.serial)}</td>
                <td>
                  {(b.raffle_bono_numbers ?? [])
                    .sort((a: any, c: any) => a.option_number - c.option_number)
                    .map((n: any) => padBonoNumber(n.numero))
                    .join(" / ")}
                </td>
                <td>{b.raffle_bono_batches?.code ?? "—"}</td>
                <td className="capitalize">{b.status}</td>
                <td>{b.buyer_name ?? "—"}</td>
                <td>{formatCOP(b.amount_paid ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
