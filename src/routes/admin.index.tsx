import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { adminListTickets, adminConfirmarPago, adminAnularTicket } from "@/lib/raffle.functions";
import { formatCOP, pad2, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { Check, X, Search, Download, ShieldCheck } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useSelectedRaffle } from "@/hooks/use-selected-raffle";

export const Route = createFileRoute("/admin/")({
  component: AdminTickets,
});

type T = {
  id: string;
  numero: number;
  estado: string;
  nombre: string | null;
  telefono: string | null;
  ciudad: string | null;
  email: string | null;
  medio_pago: string | null;
  valor_pagado: number | null;
  monto_recibido: number | null;
  referencia_pago: string | null;
  fecha_compra: string | null;
  observaciones: string | null;
  codigo_verificacion: string;
};

function AdminTickets() {
  const qc = useQueryClient();
  const list = useServerFn(adminListTickets);
  const confirmar = useServerFn(adminConfirmarPago);
  const anular = useServerFn(adminAnularTicket);
  const { id: selectedId } = useSelectedRaffle();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-tickets", selectedId],
    queryFn: () => list({ data: selectedId ? { raffleId: selectedId } : {} }),
  });
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<
    "todos" | "disponible" | "reservado" | "vendido" | "ganador"
  >("todos");
  const [validar, setValidar] = useState<T | null>(null);
  const [form, setForm] = useState({ referencia: "", monto: 0, obs: "" });
  const [saving, setSaving] = useState(false);

  const tickets: T[] = (data?.tickets ?? []) as T[];
  const filtered = tickets.filter((t) => {
    if (filter !== "todos" && t.estado !== filter) return false;
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      pad2(t.numero).includes(s) ||
      (t.nombre ?? "").toLowerCase().includes(s) ||
      (t.telefono ?? "").includes(s) ||
      (t.ciudad ?? "").toLowerCase().includes(s) ||
      (t.referencia_pago ?? "").toLowerCase().includes(s)
    );
  });

  const stats = {
    total: tickets.length,
    disponibles: tickets.filter((t) => t.estado === "disponible").length,
    reservados: tickets.filter((t) => t.estado === "reservado").length,
    vendidos: tickets.filter((t) => t.estado === "vendido" || t.estado === "ganador").length,
    ingresos: tickets
      .filter((t) => t.estado === "vendido" || t.estado === "ganador")
      .reduce((s, t) => s + (t.monto_recibido ?? t.valor_pagado ?? 0), 0),
    pendientes: tickets
      .filter((t) => t.estado === "reservado")
      .reduce((s, t) => s + (t.valor_pagado ?? 0), 0),
  };

  function openValidar(t: T) {
    setValidar(t);
    setForm({ referencia: "", monto: t.valor_pagado ?? 0, obs: "" });
  }

  async function submitValidar() {
    if (!validar) return;
    if (form.referencia.trim().length < 3) {
      toast.error("Ingresa la referencia del comprobante");
      return;
    }
    if (form.monto <= 0) {
      toast.error("Monto inválido");
      return;
    }
    setSaving(true);
    try {
      await confirmar({
        data: {
          ticketId: validar.id,
          referencia_pago: form.referencia.trim(),
          monto_recibido: Number(form.monto),
          observaciones: form.obs || null,
        },
      });
      toast.success("Pago validado y boleta confirmada");
      setValidar(null);
      qc.invalidateQueries({ queryKey: ["admin-tickets", selectedId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  }

  async function liberar(id: string) {
    if (!confirm("¿Anular esta boleta y liberar el número?")) return;
    try {
      await anular({ data: { ticketId: id } });
      toast.success("Boleta anulada");
      qc.invalidateQueries({ queryKey: ["admin-tickets", selectedId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  }

  function exportCSV() {
    const rows = [
      [
        "Numero",
        "Estado",
        "Nombre",
        "Telefono",
        "Ciudad",
        "Email",
        "MedioPago",
        "ValorBoleta",
        "MontoRecibido",
        "Referencia",
        "Fecha",
        "Codigo",
      ],
      ...tickets
        .filter((t) => t.estado !== "disponible")
        .map((t) => [
          pad2(t.numero),
          t.estado,
          t.nombre ?? "",
          t.telefono ?? "",
          t.ciudad ?? "",
          t.email ?? "",
          t.medio_pago ?? "",
          String(t.valor_pagado ?? ""),
          String(t.monto_recibido ?? ""),
          t.referencia_pago ?? "",
          t.fecha_compra ?? "",
          t.codigo_verificacion,
        ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `boletas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (isLoading) return <p className="text-muted-foreground">Cargando…</p>;
  if (!data?.raffle)
    return (
      <p className="text-muted-foreground">
        No hay rifa configurada. Ve a la pestaña <strong>Rifa</strong>.
      </p>
    );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Stat label="Total" value={String(stats.total)} />
        <Stat label="Disponibles" value={String(stats.disponibles)} tone="success" />
        <Stat label="Reservados" value={String(stats.reservados)} tone="warning" />
        <Stat label="Vendidos" value={String(stats.vendidos)} tone="destructive" />
        <Stat label="Por cobrar" value={formatCOP(stats.pendientes)} tone="warning" />
        <Stat label="Ingresos" value={formatCOP(stats.ingresos)} tone="gold" />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por número, nombre, teléfono, referencia…"
            className="pl-8"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as typeof filter)}
          className="rounded-md bg-secondary border border-border px-3 py-2 text-sm"
        >
          <option value="todos">Todos</option>
          <option value="disponible">Disponibles</option>
          <option value="reservado">Pendientes de validar</option>
          <option value="vendido">Vendidos</option>
          <option value="ganador">Ganadores</option>
        </select>
        <button
          onClick={exportCSV}
          className="inline-flex items-center gap-1 rounded-md bg-secondary px-3 py-2 text-sm hover:bg-accent"
        >
          <Download className="h-4 w-4" /> CSV
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50">
            <tr className="text-left">
              <Th>#</Th>
              <Th>Estado</Th>
              <Th>Nombre</Th>
              <Th>Teléfono</Th>
              <Th>Ciudad</Th>
              <Th>Pago</Th>
              <Th>Referencia</Th>
              <Th>Monto</Th>
              <Th>Fecha</Th>
              <Th>Acciones</Th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id} className="border-t border-border hover:bg-secondary/30">
                <td className="px-3 py-2 font-display text-gold">{pad2(t.numero)}</td>
                <td className="px-3 py-2">
                  <EstadoBadge estado={t.estado} />
                </td>
                <td className="px-3 py-2">{t.nombre ?? "—"}</td>
                <td className="px-3 py-2 font-mono text-xs">{t.telefono ?? "—"}</td>
                <td className="px-3 py-2">{t.ciudad ?? "—"}</td>
                <td className="px-3 py-2">{t.medio_pago ?? "—"}</td>
                <td className="px-3 py-2 font-mono text-xs">{t.referencia_pago ?? "—"}</td>
                <td className="px-3 py-2 text-xs">
                  {t.monto_recibido != null ? (
                    formatCOP(t.monto_recibido)
                  ) : t.valor_pagado != null ? (
                    <span className="text-muted-foreground">{formatCOP(t.valor_pagado)}</span>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-3 py-2 text-xs text-muted-foreground">
                  {formatDate(t.fecha_compra)}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    {t.estado === "reservado" && (
                      <button
                        onClick={() => openValidar(t)}
                        title="Validar pago y confirmar"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded bg-success/20 text-success hover:bg-success/30 text-xs font-semibold"
                      >
                        <ShieldCheck className="h-4 w-4" /> Validar
                      </button>
                    )}
                    {t.estado === "vendido" && (
                      <span title="Confirmado" className="p-1.5 rounded bg-success/10 text-success">
                        <Check className="h-4 w-4" />
                      </span>
                    )}
                    {t.estado !== "disponible" && (
                      <button
                        onClick={() => liberar(t.id)}
                        title="Anular / liberar"
                        className="p-1.5 rounded bg-destructive/20 text-destructive hover:bg-destructive/30"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                    {t.estado !== "disponible" && (
                      <a
                        href={`/boleta/${t.codigo_verificacion}`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-1.5 rounded bg-secondary text-foreground hover:bg-accent text-xs"
                      >
                        Ver
                      </a>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!validar} onOpenChange={(o) => !o && setValidar(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Validar pago · Boleta {validar ? pad2(validar.numero) : ""}</DialogTitle>
            <DialogDescription>
              Verifica el comprobante antes de confirmar. La boleta pasará de{" "}
              <strong>reservada</strong> a <strong>vendida</strong>.
            </DialogDescription>
          </DialogHeader>
          {validar && (
            <div className="space-y-3 text-sm">
              <div className="rounded-md bg-secondary/50 p-3 space-y-1">
                <p>
                  <span className="text-muted-foreground">Cliente:</span>{" "}
                  <strong>{validar.nombre}</strong>
                </p>
                <p>
                  <span className="text-muted-foreground">Teléfono:</span> {validar.telefono}
                </p>
                <p>
                  <span className="text-muted-foreground">Medio de pago declarado:</span>{" "}
                  {validar.medio_pago ?? "—"}
                </p>
                <p>
                  <span className="text-muted-foreground">Valor de la boleta:</span>{" "}
                  <strong className="text-gold">{formatCOP(validar.valor_pagado ?? 0)}</strong>
                </p>
              </div>
              <div>
                <Label>Referencia / comprobante *</Label>
                <Input
                  value={form.referencia}
                  onChange={(e) => setForm({ ...form, referencia: e.target.value })}
                  placeholder="Ej: M12345678 (Nequi), transacción #..."
                />
              </div>
              <div>
                <Label>Monto recibido (COP) *</Label>
                <Input
                  type="number"
                  value={form.monto}
                  onChange={(e) => setForm({ ...form, monto: Number(e.target.value) })}
                />
              </div>
              <div>
                <Label>Observaciones (opcional)</Label>
                <Input
                  value={form.obs}
                  onChange={(e) => setForm({ ...form, obs: e.target.value })}
                  placeholder="Nota interna"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setValidar(null)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              onClick={submitValidar}
              disabled={saving}
              className="bg-gold-gradient text-primary-foreground font-semibold"
            >
              <ShieldCheck className="h-4 w-4 mr-1" /> {saving ? "Validando…" : "Confirmar pago"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-3 py-2 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
      {children}
    </th>
  );
}
function Stat({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning" | "destructive" | "gold";
}) {
  const t: Record<string, string> = {
    default: "text-foreground",
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
    gold: "text-gold",
  };
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-display text-2xl ${t[tone]}`}>{value}</p>
    </div>
  );
}
function EstadoBadge({ estado }: { estado: string }) {
  const map: Record<string, string> = {
    disponible: "bg-secondary text-muted-foreground",
    reservado: "bg-warning/20 text-warning",
    vendido: "bg-success/20 text-success",
    ganador: "bg-gold-gradient text-primary-foreground",
  };
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-semibold ${map[estado] ?? ""}`}>
      {estado}
    </span>
  );
}
