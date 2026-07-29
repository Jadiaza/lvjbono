import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toPng } from "html-to-image";
import {
  adminListRaffles,
  adminListTickets,
  adminCreateRaffle,
  adminUpdateRaffle,
  adminDeleteRaffle,
} from "@/lib/raffle.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Power,
  PowerOff,
  Layers,
  ChevronDown,
  ChevronUp,
  ImageDown,
  Share2,
} from "lucide-react";
import { useSelectedRaffle } from "@/hooks/use-selected-raffle";
import { formatCOP } from "@/lib/format";
import { PUBLIC_SKINS, type PublicSkin } from "@/lib/public-skins";
import { getPublicRaffleSlug } from "@/lib/public-raffle-url";
import { RaffleShareCard } from "@/components/raffle-share-card";

export const Route = createFileRoute("/admin/rifa")({
  component: AdminRaffles,
});

type Raffle = {
  id: string;
  nombre: string;
  serie: string | null;
  digitos: number;
  valor_boleta: number;
  fecha_sorteo: string | null;
  loteria: string | null;
  activa: boolean;
  whatsapp_admin: string | null;
  nequi: string | null;
  daviplata: string | null;
  bre_b: string | null;
  premio_mayor: number;
  premio_seco1: number;
  premio_seco2: number;
  premio_aprox_ant: number;
  premio_aprox_pos: number;
  public_skin: PublicSkin;
  staged_payments: boolean;
  installment_amount: number | null;
  total: number;
  counts: { disponible: number; reservado: number; vendido: number; ganador: number };
};

function AdminRaffles() {
  const qc = useQueryClient();
  const list = useServerFn(adminListRaffles);
  const create = useServerFn(adminCreateRaffle);
  const update = useServerFn(adminUpdateRaffle);
  const del = useServerFn(adminDeleteRaffle);
  const { id: selectedId, select } = useSelectedRaffle();

  const { data } = useQuery({ queryKey: ["admin-raffles"], queryFn: () => list() });
  const raffles: Raffle[] = (data?.raffles ?? []) as Raffle[];

  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedId) setExpandedId(selectedId);
  }, [selectedId]);

  const [newForm, setNewForm] = useState({
    nombre: "",
    serie: "",
    digitos: 2 as 2 | 3,
    valor_boleta: 10000,
    cantidad: 1,
    fecha_sorteo: "",
    loteria: "",
    premio_mayor: 300000,
    premio_seco1: 100000,
    premio_seco2: 80000,
    premio_aprox_ant: 10000,
    premio_aprox_pos: 10000,
    public_skin: "purpura-real" as const,
    staged_payments: false,
    installment_amount: 10000,
    stages: [{ name: "Premio mensual 1", draw_at: "", minimum_paid: 10000, prize_amount: 50000 }],
  });

  async function submitCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const r = await create({
        data: {
          ...newForm,
          serie: newForm.serie || null,
          fecha_sorteo: newForm.fecha_sorteo || null,
          loteria: newForm.loteria || null,
          staged_payments: newForm.digitos === 3 && newForm.staged_payments,
          stages: newForm.digitos === 3 && newForm.staged_payments ? newForm.stages : [],
        },
      });
      toast.success(`Se crearon ${r.ids.length} cartón(es)`);
      setShowCreate(false);
      qc.invalidateQueries();
      if (r.ids[0]) select(r.ids[0]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  }

  async function toggleActive(r: Raffle) {
    try {
      await update({ data: { id: r.id, activa: !r.activa } });
      toast.success(r.activa ? "Cartón desactivado" : "Cartón activado (visible al público)");
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  }

  async function removeRaffle(r: Raffle) {
    if (!confirm(`¿Eliminar "${r.nombre}"? Solo se puede si no hay boletas vendidas.`)) return;
    try {
      await del({ data: { raffleId: r.id } });
      toast.success("Cartón eliminado");
      if (selectedId === r.id) select(null);
      qc.invalidateQueries();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="font-display text-2xl text-gold flex items-center gap-2">
            <Layers className="h-6 w-6" />
            Cartones / Talonarios
          </h2>
          <p className="text-sm text-muted-foreground">
            Crea uno o varios cartones numerados. Solo los <strong>activos</strong> son visibles al
            público.
          </p>
        </div>
        <Button
          onClick={() => setShowCreate(true)}
          className="bg-gold-gradient text-primary-foreground font-semibold"
        >
          <Plus className="h-4 w-4 mr-1" /> Crear cartón
        </Button>
      </div>

      {raffles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
          Aún no hay cartones. Crea el primero para empezar.
        </div>
      ) : (
        <div className="space-y-3">
          {raffles.map((r) => (
            <RaffleCard
              key={r.id}
              r={r}
              expanded={expandedId === r.id}
              selected={selectedId === r.id}
              onToggleExpand={() => setExpandedId(expandedId === r.id ? null : r.id)}
              onSelect={() => select(r.id)}
              onToggleActive={() => toggleActive(r)}
              onDelete={() => removeRaffle(r)}
              onSaved={() => qc.invalidateQueries()}
            />
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Crear cartón(es)</DialogTitle>
            <DialogDescription>
              Configura el nuevo talonario. Puedes generar varios cartones idénticos numerados
              automáticamente.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitCreate} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nombre del cartón *">
                <Input
                  required
                  value={newForm.nombre}
                  onChange={(e) => setNewForm({ ...newForm, nombre: e.target.value })}
                  placeholder="Ej: Rifa de Navidad"
                />
              </Field>
              <Field label="Serie (opcional)">
                <Input
                  value={newForm.serie}
                  onChange={(e) => setNewForm({ ...newForm, serie: e.target.value })}
                  placeholder="Ej: A, B..."
                />
              </Field>
            </div>
            {newForm.digitos === 3 && (
              <div className="rounded-xl border border-brand/30 bg-brand-soft/40 p-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={newForm.staged_payments}
                    onChange={(event) =>
                      setNewForm({ ...newForm, staged_payments: event.target.checked })
                    }
                    className="mt-1 h-4 w-4 accent-[var(--brand)]"
                  />
                  <span>
                    <strong className="block text-sm">Modalidad por etapas</strong>
                    <span className="text-xs text-muted-foreground">
                      El comprador elige el número mayor, recibe un alterno automático y puede
                      realizar abonos acumulables.
                    </span>
                  </span>
                </label>
                {newForm.staged_payments && (
                  <div className="mt-3">
                    <div className="max-w-xs">
                      <Field label="Abono mínimo sugerido (COP)">
                        <Input
                          type="number"
                          min={1}
                          max={newForm.valor_boleta}
                          value={newForm.installment_amount}
                          onChange={(event) =>
                            setNewForm({
                              ...newForm,
                              installment_amount: Number(event.target.value),
                            })
                          }
                        />
                      </Field>
                    </div>
                    <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-brand">
                      Premios mensuales · juega el número alterno
                    </p>
                    <div className="mt-2 space-y-2">
                      {newForm.stages.map((stage, index) => (
                        <div
                          key={index}
                          className="grid gap-2 rounded-lg border border-border bg-card p-3 md:grid-cols-[1fr_1fr_1fr_auto]"
                        >
                          <Field label="Nombre">
                            <Input
                              required
                              value={stage.name}
                              onChange={(event) =>
                                setNewForm({
                                  ...newForm,
                                  stages: newForm.stages.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? { ...item, name: event.target.value }
                                      : item,
                                  ),
                                })
                              }
                            />
                          </Field>
                          <Field label="Fecha premio menor">
                            <Input
                              required
                              type="datetime-local"
                              value={stage.draw_at}
                              onChange={(event) =>
                                setNewForm({
                                  ...newForm,
                                  stages: newForm.stages.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? { ...item, draw_at: event.target.value }
                                      : item,
                                  ),
                                })
                              }
                            />
                          </Field>
                          <Field label="Valor del premio">
                            <Input
                              required
                              type="number"
                              min={0}
                              value={stage.prize_amount}
                              onChange={(event) =>
                                setNewForm({
                                  ...newForm,
                                  stages: newForm.stages.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? { ...item, prize_amount: Number(event.target.value) }
                                      : item,
                                  ),
                                })
                              }
                            />
                          </Field>
                          <button
                            type="button"
                            aria-label="Eliminar premio mensual"
                            className="self-end rounded-md p-2 text-destructive hover:bg-destructive/10"
                            onClick={() =>
                              setNewForm({
                                ...newForm,
                                stages: newForm.stages.filter(
                                  (_, itemIndex) => itemIndex !== index,
                                ),
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() =>
                        setNewForm({
                          ...newForm,
                          stages: [
                            ...newForm.stages,
                            {
                              name: `Premio mensual ${newForm.stages.length + 1}`,
                              draw_at: "",
                              minimum_paid:
                                newForm.installment_amount * (newForm.stages.length + 1),
                              prize_amount: 50000,
                            },
                          ],
                        })
                      }
                    >
                      <Plus className="mr-1 h-4 w-4" /> Agregar premio mensual
                    </Button>
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-3 gap-3">
              <Field label="Dígitos por número">
                <select
                  value={newForm.digitos}
                  onChange={(e) =>
                    setNewForm({ ...newForm, digitos: Number(e.target.value) as 2 | 3 })
                  }
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value={2}>2 dígitos · 00–99 (100 boletas)</option>
                  <option value={3}>3 dígitos · 000–999 (1000 boletas)</option>
                </select>
              </Field>
              <Field label="Valor boleta (COP)">
                <Input
                  type="number"
                  min={100}
                  step={100}
                  value={newForm.valor_boleta}
                  onChange={(e) => setNewForm({ ...newForm, valor_boleta: Number(e.target.value) })}
                />
              </Field>
              <Field label="Cantidad de cartones">
                <Input
                  type="number"
                  min={1}
                  max={20}
                  value={newForm.cantidad}
                  onChange={(e) => setNewForm({ ...newForm, cantidad: Number(e.target.value) })}
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label={newForm.staged_payments ? "Fecha del premio final *" : "Fecha del sorteo"}
              >
                <Input
                  type="date"
                  required={newForm.staged_payments}
                  value={newForm.fecha_sorteo}
                  onChange={(e) => setNewForm({ ...newForm, fecha_sorteo: e.target.value })}
                />
              </Field>
              <Field label="Lotería">
                <Input
                  value={newForm.loteria}
                  onChange={(e) => setNewForm({ ...newForm, loteria: e.target.value })}
                  placeholder="Ej: Lotería de Bogotá"
                />
              </Field>
            </div>
            {newForm.staged_payments ? (
              <div className="rounded-md border border-brand/30 bg-brand-soft/40 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-brand">
                  Premio final · juega el número elegido por el usuario
                </p>
                <div className="mt-2 max-w-xs">
                  <Field label="Valor del premio final (COP)">
                    <Input
                      type="number"
                      min={0}
                      value={newForm.premio_mayor}
                      onChange={(event) =>
                        setNewForm({ ...newForm, premio_mayor: Number(event.target.value) })
                      }
                    />
                  </Field>
                </div>
              </div>
            ) : (
              <div className="rounded-md border border-border bg-secondary/40 p-3 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Premios (COP)
                </p>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  <Field label="Mayor">
                    <Input
                      type="number"
                      min={0}
                      value={newForm.premio_mayor}
                      onChange={(e) =>
                        setNewForm({ ...newForm, premio_mayor: Number(e.target.value) })
                      }
                    />
                  </Field>
                  <Field label="Seco 1">
                    <Input
                      type="number"
                      min={0}
                      value={newForm.premio_seco1}
                      onChange={(e) =>
                        setNewForm({ ...newForm, premio_seco1: Number(e.target.value) })
                      }
                    />
                  </Field>
                  <Field label="Seco 2">
                    <Input
                      type="number"
                      min={0}
                      value={newForm.premio_seco2}
                      onChange={(e) =>
                        setNewForm({ ...newForm, premio_seco2: Number(e.target.value) })
                      }
                    />
                  </Field>
                  <Field label="Aprox. Ant.">
                    <Input
                      type="number"
                      min={0}
                      value={newForm.premio_aprox_ant}
                      onChange={(e) =>
                        setNewForm({ ...newForm, premio_aprox_ant: Number(e.target.value) })
                      }
                    />
                  </Field>
                  <Field label="Aprox. Pos.">
                    <Input
                      type="number"
                      min={0}
                      value={newForm.premio_aprox_pos}
                      onChange={(e) =>
                        setNewForm({ ...newForm, premio_aprox_pos: Number(e.target.value) })
                      }
                    />
                  </Field>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="bg-gold-gradient text-primary-foreground font-semibold"
              >
                Crear
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function RaffleCard({
  r,
  expanded,
  selected,
  onToggleExpand,
  onSelect,
  onToggleActive,
  onDelete,
  onSaved,
}: {
  r: Raffle;
  expanded: boolean;
  selected: boolean;
  onToggleExpand: () => void;
  onSelect: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  onSaved: () => void;
}) {
  const update = useServerFn(adminUpdateRaffle);
  const listTickets = useServerFn(adminListTickets);
  const posterRef = useRef<HTMLDivElement>(null);
  const [posterOpen, setPosterOpen] = useState(false);
  const [generatingPoster, setGeneratingPoster] = useState(false);
  const [includeWhatsappMessage, setIncludeWhatsappMessage] = useState(true);
  const { data: posterData, isLoading: posterLoading } = useQuery({
    queryKey: ["raffle-share-card", r.id],
    queryFn: () => listTickets({ data: { raffleId: r.id } }),
    enabled: posterOpen,
  });
  const [form, setForm] = useState(() => ({
    nombre: r.nombre,
    serie: r.serie ?? "",
    valor_boleta: r.valor_boleta,
    fecha_sorteo: r.fecha_sorteo ? String(r.fecha_sorteo).slice(0, 10) : "",
    loteria: r.loteria ?? "",
    whatsapp_admin: r.whatsapp_admin ?? "",
    nequi: r.nequi ?? "",
    daviplata: r.daviplata ?? "",
    bre_b: r.bre_b ?? "",
    premio_mayor: r.premio_mayor,
    premio_seco1: r.premio_seco1,
    premio_seco2: r.premio_seco2,
    premio_aprox_ant: r.premio_aprox_ant,
    premio_aprox_pos: r.premio_aprox_pos,
    public_skin: r.public_skin ?? "purpura-real",
    staged_payments: r.staged_payments ?? false,
    installment_amount: r.installment_amount ?? Math.ceil(r.valor_boleta / 3),
  }));

  useEffect(() => {
    setForm({
      nombre: r.nombre,
      serie: r.serie ?? "",
      valor_boleta: r.valor_boleta,
      fecha_sorteo: r.fecha_sorteo ? String(r.fecha_sorteo).slice(0, 10) : "",
      loteria: r.loteria ?? "",
      whatsapp_admin: r.whatsapp_admin ?? "",
      nequi: r.nequi ?? "",
      daviplata: r.daviplata ?? "",
      bre_b: r.bre_b ?? "",
      premio_mayor: r.premio_mayor,
      premio_seco1: r.premio_seco1,
      premio_seco2: r.premio_seco2,
      premio_aprox_ant: r.premio_aprox_ant,
      premio_aprox_pos: r.premio_aprox_pos,
      public_skin: r.public_skin ?? "purpura-real",
      staged_payments: r.staged_payments ?? false,
      installment_amount: r.installment_amount ?? Math.ceil(r.valor_boleta / 3),
    });
  }, [r]);

  const progreso = useMemo(() => {
    const vend = r.counts.vendido + r.counts.ganador;
    return r.total ? Math.round((vend / r.total) * 100) : 0;
  }, [r]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    try {
      await update({
        data: {
          id: r.id,
          nombre: form.nombre,
          serie: form.serie || null,
          valor_boleta: Number(form.valor_boleta),
          fecha_sorteo: form.fecha_sorteo || null,
          loteria: form.loteria || null,
          whatsapp_admin: form.whatsapp_admin || null,
          nequi: form.nequi || null,
          daviplata: form.daviplata || null,
          bre_b: form.bre_b || null,
          premio_mayor: Number(form.premio_mayor),
          premio_seco1: Number(form.premio_seco1),
          premio_seco2: Number(form.premio_seco2),
          premio_aprox_ant: Number(form.premio_aprox_ant),
          premio_aprox_pos: Number(form.premio_aprox_pos),
          public_skin: form.public_skin,
          staged_payments: r.digitos === 3 && form.staged_payments,
          installment_amount:
            r.digitos === 3 && form.staged_payments ? form.installment_amount : null,
        },
      });
      toast.success("Cambios guardados");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  }

  const vendidos = r.counts.vendido + r.counts.ganador;

  function whatsappMessage() {
    const raffleUrl = `${window.location.origin}/${getPublicRaffleSlug(r)}`;
    return [
      `🎟️ *${form.nombre.toUpperCase()}*`,
      form.serie ? `🔖 Serie: *${form.serie}*` : null,
      "",
      `📅 *Fecha del sorteo:* ${form.fecha_sorteo || "Por definir"}`,
      `🎰 *Lotería:* ${form.loteria || "Por definir"}`,
      `💵 *Valor de la boleta:* ${formatCOP(Number(form.valor_boleta))}`,
      "",
      "🏆 *PREMIOS*",
      `🥇 Premio mayor: *${formatCOP(Number(form.premio_mayor))}*`,
      `🥈 Seco 1: *${formatCOP(Number(form.premio_seco1))}*`,
      `🥉 Seco 2: *${formatCOP(Number(form.premio_seco2))}*`,
      `🎁 Aproximación anterior: *${formatCOP(Number(form.premio_aprox_ant))}*`,
      `🎁 Aproximación posterior: *${formatCOP(Number(form.premio_aprox_pos))}*`,
      "",
      "📌 *CONDICIONES DE LA RIFA*",
      `✅ Escoge un número ${r.digitos === 3 ? "del 000 al 999" : "del 00 al 99"} que esté disponible.`,
      "✅ La reserva se confirma cuando el administrador verifica el pago.",
      "✅ El resultado se toma de las últimas cifras de la lotería indicada.",
      "⚠️ Los premios no son acumulables: si un número gana en varias categorías, se paga únicamente el premio de mayor valor.",
      "",
      `🌐 *Elige tu número aquí:* ${raffleUrl}`,
      form.whatsapp_admin ? `📲 *Información:* ${form.whatsapp_admin}` : null,
      "",
      "🍀 ¡Mucha suerte!",
    ]
      .filter((line): line is string => line !== null)
      .join("\n");
  }

  async function exportPoster() {
    if (!posterRef.current) return;
    setGeneratingPoster(true);
    try {
      const dataUrl = await toPng(posterRef.current, {
        cacheBust: true,
        pixelRatio: r.digitos === 3 ? 1 : 1.5,
      });
      const blob = await (await fetch(dataUrl)).blob();
      const safeName = r.nombre
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase();
      const file = new File([blob], `carton-${safeName || "rifa"}.png`, { type: "image/png" });
      const shareData = {
        files: [file],
        title: r.nombre,
        text: includeWhatsappMessage
          ? whatsappMessage()
          : `🎟️ Participa en ${r.nombre}. Elige tu número en ${window.location.origin}/${getPublicRaffleSlug(r)}`,
      };
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
        return;
      }
      const download = document.createElement("a");
      download.href = dataUrl;
      download.download = file.name;
      download.click();
      if (includeWhatsappMessage) {
        await navigator.clipboard?.writeText(whatsappMessage());
        const whatsapp = document.createElement("a");
        whatsapp.href = `https://wa.me/?text=${encodeURIComponent(whatsappMessage())}`;
        whatsapp.target = "_blank";
        whatsapp.rel = "noopener noreferrer";
        whatsapp.click();
        toast.success("Cartón descargado. El mensaje quedó copiado y abierto en WhatsApp.");
      } else {
        toast.success("Cartón descargado como imagen PNG");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      console.error("[exportPoster] Could not generate raffle poster", error);
      toast.error("No fue posible generar la imagen del cartón.");
    } finally {
      setGeneratingPoster(false);
    }
  }

  return (
    <div
      className={`rounded-xl border ${selected ? "border-gold ring-1 ring-gold/40" : "border-border"} bg-card overflow-hidden`}
    >
      <div className="p-4 flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${r.activa ? "bg-success" : "bg-muted-foreground/40"}`}
            />
            <h3 className="font-semibold truncate">{r.nombre}</h3>
            {r.serie && (
              <span className="text-xs rounded bg-secondary px-2 py-0.5">Serie {r.serie}</span>
            )}
            <span className="text-xs rounded bg-secondary px-2 py-0.5">
              {r.digitos === 3 ? "000–999" : "00–99"}
            </span>
            {selected && (
              <span className="text-xs rounded bg-gold/20 text-gold px-2 py-0.5 font-semibold">
                Seleccionado
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
            <span>Boleta: {formatCOP(r.valor_boleta)}</span>
            <span>
              Vendidos: {vendidos}/{r.total}
            </span>
            <span>Reservados: {r.counts.reservado}</span>
            <span>Ingresos potenciales: {formatCOP(r.total * r.valor_boleta)}</span>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
            <div className="h-full bg-gold-gradient" style={{ width: `${progreso}%` }} />
          </div>
        </div>
        <div className="flex gap-1 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setPosterOpen(true)}
            title="Generar cartón para WhatsApp"
          >
            <ImageDown className="h-4 w-4" />
          </Button>
          {!selected && (
            <Button size="sm" variant="outline" onClick={onSelect}>
              Seleccionar
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={onToggleActive}
            title={r.activa ? "Desactivar" : "Activar"}
          >
            {r.activa ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
          </Button>
          <Button size="sm" variant="outline" onClick={onToggleExpand}>
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={onDelete}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {expanded && (
        <form onSubmit={save} className="border-t border-border p-4 space-y-3 bg-secondary/20">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nombre">
              <Input
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                required
              />
            </Field>
            <Field label="Serie">
              <Input
                value={form.serie}
                onChange={(e) => setForm({ ...form, serie: e.target.value })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Valor boleta (COP)">
              <Input
                type="number"
                value={form.valor_boleta}
                onChange={(e) => setForm({ ...form, valor_boleta: Number(e.target.value) })}
                required
              />
            </Field>
            <Field label="Fecha sorteo">
              <Input
                type="date"
                value={form.fecha_sorteo}
                onChange={(e) => setForm({ ...form, fecha_sorteo: e.target.value })}
              />
            </Field>
            <Field label="Lotería">
              <Input
                value={form.loteria}
                onChange={(e) => setForm({ ...form, loteria: e.target.value })}
              />
            </Field>
          </div>
          {r.digitos === 3 && (
            <div className="rounded-xl border border-brand/30 bg-brand-soft/40 p-4">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={form.staged_payments}
                  onChange={(event) => setForm({ ...form, staged_payments: event.target.checked })}
                  className="mt-1 h-4 w-4 accent-[var(--brand)]"
                />
                <span>
                  <strong className="block text-sm">Número alterno y pagos por etapas</strong>
                  <span className="text-xs text-muted-foreground">
                    Asigna un número sorpresa para sorteos pequeños y permite abonos acumulables.
                  </span>
                </span>
              </label>
              {form.staged_payments && (
                <div className="mt-3 max-w-xs">
                  <Field label="Abono mínimo sugerido (COP)">
                    <Input
                      type="number"
                      min={1}
                      max={form.valor_boleta}
                      value={form.installment_amount}
                      onChange={(event) =>
                        setForm({ ...form, installment_amount: Number(event.target.value) })
                      }
                    />
                  </Field>
                </div>
              )}
            </div>
          )}
          <div className="rounded-xl border border-border bg-background p-4">
            <div className="mb-3">
              <p className="text-sm font-semibold">Apariencia pública</p>
              <p className="text-xs text-muted-foreground">
                La piel se aplica al panel, la página pública, la boleta y el cartón para compartir.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {PUBLIC_SKINS.map((skin) => (
                <SkinOption
                  key={skin.id}
                  value={skin.id}
                  selected={form.public_skin === skin.id}
                  onSelect={() => setForm({ ...form, public_skin: skin.id })}
                  title={skin.name}
                  description={skin.description}
                  colors={skin.colors}
                />
              ))}
            </div>
          </div>
          <Field label="WhatsApp administrador">
            <Input
              value={form.whatsapp_admin}
              onChange={(e) => setForm({ ...form, whatsapp_admin: e.target.value })}
              placeholder="+57 300..."
            />
          </Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Nequi">
              <Input
                value={form.nequi}
                onChange={(e) => setForm({ ...form, nequi: e.target.value })}
              />
            </Field>
            <Field label="Daviplata">
              <Input
                value={form.daviplata}
                onChange={(e) => setForm({ ...form, daviplata: e.target.value })}
              />
            </Field>
            <Field label="Bre-B">
              <Input
                value={form.bre_b}
                onChange={(e) => setForm({ ...form, bre_b: e.target.value })}
              />
            </Field>
          </div>
          <div className="rounded-md border border-border bg-background p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Premios (COP)
            </p>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <Field label="Mayor">
                <Input
                  type="number"
                  min={0}
                  value={form.premio_mayor}
                  onChange={(e) => setForm({ ...form, premio_mayor: Number(e.target.value) })}
                />
              </Field>
              <Field label="Seco 1">
                <Input
                  type="number"
                  min={0}
                  value={form.premio_seco1}
                  onChange={(e) => setForm({ ...form, premio_seco1: Number(e.target.value) })}
                />
              </Field>
              <Field label="Seco 2">
                <Input
                  type="number"
                  min={0}
                  value={form.premio_seco2}
                  onChange={(e) => setForm({ ...form, premio_seco2: Number(e.target.value) })}
                />
              </Field>
              <Field label="Aprox. Ant.">
                <Input
                  type="number"
                  min={0}
                  value={form.premio_aprox_ant}
                  onChange={(e) => setForm({ ...form, premio_aprox_ant: Number(e.target.value) })}
                />
              </Field>
              <Field label="Aprox. Pos.">
                <Input
                  type="number"
                  min={0}
                  value={form.premio_aprox_pos}
                  onChange={(e) => setForm({ ...form, premio_aprox_pos: Number(e.target.value) })}
                />
              </Field>
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              className="bg-gold-gradient text-primary-foreground font-semibold"
            >
              Guardar cambios
            </Button>
          </div>
        </form>
      )}

      <Dialog open={posterOpen} onOpenChange={setPosterOpen}>
        <DialogContent className="max-w-[96vw] max-h-[94vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle>Cartón para WhatsApp</DialogTitle>
            <DialogDescription>
              Se genera con los datos, números y apariencia pública activa de esta rifa.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[50vh] overflow-auto rounded-xl border border-border bg-secondary/30 p-3">
            {posterLoading || !posterData?.raffle ? (
              <div className="grid min-h-64 place-items-center text-sm text-muted-foreground">
                Preparando cartón…
              </div>
            ) : (
              <RaffleShareCard
                ref={posterRef}
                raffle={{
                  ...r,
                  public_skin: form.public_skin,
                }}
                tickets={posterData.tickets}
              />
            )}
          </div>
          <div className="rounded-xl border border-border bg-card p-3">
            <label className="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={includeWhatsappMessage}
                onChange={(event) => setIncludeWhatsappMessage(event.target.checked)}
                className="mt-1 h-4 w-4 accent-[var(--brand)]"
              />
              <span>
                <span className="block text-sm font-semibold">
                  Incluir mensaje con las condiciones
                </span>
                <span className="block text-xs text-muted-foreground">
                  Adjunta un texto estructurado con emojis, sorteo, premios, condiciones y enlace
                  para elegir número.
                </span>
              </span>
            </label>
            {includeWhatsappMessage && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-semibold text-brand">
                  Vista previa del mensaje de WhatsApp
                </summary>
                <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-secondary/60 p-3 font-sans text-xs leading-relaxed">
                  {whatsappMessage()}
                </pre>
              </details>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPosterOpen(false)}>
              Cerrar
            </Button>
            <Button
              type="button"
              onClick={exportPoster}
              disabled={posterLoading || !posterData?.raffle || generatingPoster}
              className="bg-gold-gradient text-primary-foreground"
            >
              <Share2 className="mr-2 h-4 w-4" />
              {generatingPoster ? "Generando…" : "Compartir o descargar PNG"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}

function SkinOption({
  value,
  selected,
  onSelect,
  title,
  description,
  colors,
}: {
  value: PublicSkin;
  selected: boolean;
  onSelect: () => void;
  title: string;
  description: string;
  colors: [string, string, string, string];
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`overflow-hidden rounded-xl border-2 text-left transition ${
        selected ? "border-brand ring-2 ring-brand/20" : "border-border hover:border-brand/50"
      }`}
    >
      <div
        className="h-20 relative"
        style={{ background: `linear-gradient(135deg, ${colors[3]}, ${colors[1]})` }}
      >
        <div className="absolute inset-x-3 bottom-3 grid grid-cols-5 gap-1">
          {[...colors, colors[0]].map((color, index) => (
            <span
              key={`${value}-${index}`}
              className="h-3 rounded-sm"
              style={{ backgroundColor: color }}
            />
          ))}
        </div>
      </div>
      <div className="bg-card p-3">
        <p className="text-sm font-semibold">{title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
    </button>
  );
}
