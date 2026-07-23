import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  adminListRaffles,
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
import { Plus, Trash2, Power, PowerOff, Layers, ChevronDown, ChevronUp } from "lucide-react";
import { useSelectedRaffle } from "@/hooks/use-selected-raffle";
import { formatCOP } from "@/lib/format";

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
              <Field label="Fecha del sorteo">
                <Input
                  type="date"
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
        },
      });
      toast.success("Cambios guardados");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  }

  const vendidos = r.counts.vendido + r.counts.ganador;

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
