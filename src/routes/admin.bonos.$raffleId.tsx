/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Download, Pencil, Printer, RotateCcw, Trash2 } from "lucide-react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import { adminDeleteBono, adminGetDualBonoCampaign, adminUpdateBono } from "@/lib/bono.functions";
import { adminRevertPaidBono } from "@/lib/admin-bono-corrections.functions";
import { BonoDualCard } from "@/components/bono-dual-card";
import { waitForBonoCardAssets } from "@/lib/bono-card-export";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCOP } from "@/lib/format";
import { isValidBonoNumberSet, padBonoNumber } from "@/lib/bono-domain";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin/bonos/$raffleId")({ component: CampaignDetail });

const colors: Record<string, string> = {
  disponible: "bg-slate-200",
  asignado: "bg-blue-200",
  reservado: "bg-amber-300",
  vendido: "bg-orange-400",
  pagado: "bg-emerald-500 text-white",
  devuelto: "bg-purple-200",
  anulado: "bg-rose-700 text-white",
};

function CampaignDetail() {
  const { raffleId } = Route.useParams();
  const get = useServerFn(adminGetDualBonoCampaign);
  const revertPaid = useServerFn(adminRevertPaidBono);
  const updateBono = useServerFn(adminUpdateBono);
  const deleteBono = useServerFn(adminDeleteBono);
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["dual-bono", raffleId],
    queryFn: () => get({ data: { raffleId } }),
  });
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [reverting, setReverting] = useState(false);
  const [savingBono, setSavingBono] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<{
    serial: string;
    numbers: string[];
    buyer_name: string;
    buyer_phone: string;
    buyer_city: string;
    buyer_notes: string;
  } | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const bonos = useMemo(() => data?.bonos ?? [], [data?.bonos]);
  const raffle = data?.raffle;
  const summary = data?.summary ?? { counts: {}, paidValue: 0, pending: 0 };

  const numberEntries = useMemo(
    () =>
      bonos
        .flatMap((b: any) =>
          b.numbers.map((n: any) => ({ numero: n.numero, option: n.option_number, bono: b })),
        )
        .sort((a: any, b: any) => a.numero - b.numero),
    [bonos],
  );

  const filtered = bonos.filter(
    (b: any) =>
      !search ||
      padBonoNumber(b.serial).includes(search) ||
      b.numbers.some((n: any) =>
        padBonoNumber(n.numero, raffle?.digitos === 2 ? 2 : 3).includes(search),
      ),
  );

  const selectedBono = selected ? (bonos.find((b: any) => b.id === selected) ?? null) : null;

  function selectBono(bonoId: string) {
    setSelected(bonoId);
  }

  function openBonoEditor(bono: any) {
    setEditForm({
      serial: String(bono.serial),
      numbers: [...bono.numbers]
        .sort((a: any, b: any) => a.option_number - b.option_number)
        .map((number: any) => String(number.numero)),
      buyer_name: bono.buyer_name ?? "",
      buyer_phone: bono.buyer_phone ?? "",
      buyer_city: bono.buyer_city ?? "",
      buyer_notes: bono.buyer_notes ?? "",
    });
    setEditOpen(true);
  }

  async function saveBonoChanges(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedBono || !editForm) return;
    const digits = raffle.digitos === 2 ? 2 : 3;
    const numbers = editForm.numbers.map((number) => Number(number));
    if (
      !Number.isInteger(Number(editForm.serial)) ||
      editForm.serial.trim() === "" ||
      editForm.numbers.some((number) => number.trim() === "") ||
      !isValidBonoNumberSet(numbers, digits, raffle.bono_numbers_per_ticket === 1 ? 1 : 2)
    ) {
      toast.error(
        `Ingresa ${raffle.bono_numbers_per_ticket === 1 ? "un número" : "dos números"} únicos entre ${digits === 2 ? "00 y 99" : "000 y 999"}.`,
      );
      return;
    }

    const changes: string[] = [];
    if (Number(editForm.serial) !== selectedBono.serial) {
      changes.push(
        `Serial: ${padBonoNumber(selectedBono.serial)} → ${padBonoNumber(Number(editForm.serial))}`,
      );
    }
    if (
      numbers.join(",") !==
      [...selectedBono.numbers]
        .sort((a: any, b: any) => a.option_number - b.option_number)
        .map((number: any) => String(number.numero))
        .join(",")
    ) {
      const previousNumbers = [...selectedBono.numbers]
        .sort((a: any, b: any) => a.option_number - b.option_number)
        .map((number: any) => padBonoNumber(number.numero, digits));
      changes.push(
        `Números: ${previousNumbers.join(" / ")} → ${numbers.map((number) => padBonoNumber(number, digits)).join(" / ")}`,
      );
    }
    if (
      editForm.buyer_name !== (selectedBono.buyer_name ?? "") ||
      editForm.buyer_phone !== (selectedBono.buyer_phone ?? "") ||
      editForm.buyer_city !== (selectedBono.buyer_city ?? "") ||
      editForm.buyer_notes !== (selectedBono.buyer_notes ?? "")
    ) {
      changes.push("Datos de contacto, ciudad u observaciones del comprador");
    }
    if (changes.length === 0) {
      toast.info("No hay cambios para guardar.");
      return;
    }
    if (
      !window.confirm(
        `Confirma los cambios del Bono ${padBonoNumber(selectedBono.serial)}:\n\n${changes.map((change) => `• ${change}`).join("\n")}\n\nLa operación quedará registrada en la auditoría.`,
      )
    ) {
      return;
    }

    setSavingBono(true);
    try {
      await updateBono({
        data: {
          bonoId: selectedBono.id,
          serial: Number(editForm.serial),
          numbers,
          buyer_name: editForm.buyer_name.trim() || null,
          buyer_phone: editForm.buyer_phone.trim() || null,
          buyer_city: editForm.buyer_city.trim() || null,
          buyer_notes: editForm.buyer_notes.trim() || null,
        },
      });
      toast.success("Cambios guardados y registrados en la auditoría.");
      setEditOpen(false);
      await qc.invalidateQueries({ queryKey: ["dual-bono", raffleId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible editar el bono.");
    } finally {
      setSavingBono(false);
    }
  }

  async function removeSelectedBono() {
    if (!selectedBono) return;
    const isFinanciallyLocked =
      selectedBono.status === "vendido" ||
      selectedBono.status === "pagado" ||
      selectedBono.status === "anulado" ||
      Number(selectedBono.amount_paid ?? 0) > 0 ||
      Boolean(selectedBono.sale_id);
    if (isFinanciallyLocked) {
      toast.error("No se puede eliminar ni anular un bono con ventas o pagos registrados.");
      return;
    }
    const numberList = selectedBono.numbers
      .map((number: any) => padBonoNumber(number.numero, raffle.digitos === 2 ? 2 : 3))
      .join(" / ");
    if (
      !window.confirm(
        `¿Eliminar o anular el Bono ${padBonoNumber(selectedBono.serial)} (${numberList}) de “${raffle.nombre}”?\n\nSi hay historial de asignación o actividad, se conservará como ANULADO y sus números no se reutilizarán. Esta acción quedará auditada.`,
      )
    ) {
      return;
    }

    setSavingBono(true);
    try {
      const result = await deleteBono({ data: { bonoId: selectedBono.id } });
      toast.success(
        result.deleted
          ? `Bono ${padBonoNumber(selectedBono.serial)} eliminado. La operación quedó auditada.`
          : `Bono ${padBonoNumber(selectedBono.serial)} anulado; se conservaron sus números e historial.`,
      );
      if (result.deleted) setSelected(null);
      await qc.invalidateQueries({ queryKey: ["dual-bono", raffleId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible eliminar el bono.");
    } finally {
      setSavingBono(false);
    }
  }

  function exportCsv() {
    const header =
      raffle?.bono_numbers_per_ticket === 1
        ? "Bono,Número,Responsable,Lote,Estado,Comprador,Fecha venta,Valor,Pagado"
        : "Bono,Opción 1,Opción 2,Responsable,Lote,Estado,Comprador,Fecha venta,Valor,Pagado";
    const rows = bonos.map((b: any) =>
      [
        padBonoNumber(b.serial),
        ...b.numbers.map((n: any) => padBonoNumber(n.numero)),
        b.responsible_name ?? "",
        b.batch_code ?? "",
        b.status,
        b.buyer_name ?? "",
        b.sold_at ?? "",
        b.sale_value ?? 0,
        b.amount_paid ?? 0,
      ]
        .map((v: any) => `"${String(v).replaceAll('"', '""')}"`)
        .join(","),
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bonos-${raffle?.nombre ?? raffleId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadPng() {
    if (!printRef.current || !selectedBono) return;
    try {
      await waitForBonoCardAssets(printRef.current);
      const url = await toPng(printRef.current, { pixelRatio: 2, cacheBust: true });
      const anchor = document.createElement("a");
      anchor.download = `bono-${padBonoNumber(selectedBono.serial)}.png`;
      anchor.href = url;
      anchor.click();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No fue posible generar la imagen del bono.",
      );
    }
  }

  async function revertSelectedPayment() {
    if (!selectedBono || selectedBono.status !== "pagado") return;
    const reason = window.prompt(
      `Motivo para revertir el pago del Bono ${padBonoNumber(selectedBono.serial)}:`,
      "Corrección administrativa",
    );
    if (!reason?.trim()) return;
    const ok = window.confirm(
      `El Bono ${padBonoNumber(selectedBono.serial)} volverá de PAGADO a VENDIDO y su valor pagado quedará en $0. ¿Continuar?`,
    );
    if (!ok) return;

    setReverting(true);
    try {
      await revertPaid({ data: { bonoId: selectedBono.id, reason: reason.trim() } });
      toast.success(
        `Pago del Bono ${padBonoNumber(selectedBono.serial)} revertido. Ahora está VENDIDO.`,
      );
      await qc.invalidateQueries({ queryKey: ["dual-bono", raffleId] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible revertir el pago.");
    } finally {
      setReverting(false);
    }
  }

  if (!raffle) return <p>Cargando campaña…</p>;

  const stats = [
    ...Object.entries(summary.counts).map(([k, v]) => [k, v]),
    ["Recaudo", formatCOP(summary.paidValue)],
    ["Pendiente", formatCOP(summary.pending)],
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl text-gold">{raffle.nombre}</h1>
        <p className="text-sm text-muted-foreground">
          {bonos.length} bonos · {numberEntries.length} números únicos · Potencial{" "}
          {formatCOP(bonos.length * raffle.valor_boleta)}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-9">
        {stats.map(([label, value]) => (
          <div key={String(label)} className="rounded-lg border bg-card p-3">
            <div className="text-xs capitalize text-muted-foreground">{label}</div>
            <strong>{String(value)}</strong>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          className="max-w-xs"
          placeholder="Buscar bono o cualquiera de sus números"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Button variant="outline" onClick={exportCsv}>
          <Download className="mr-1 h-4 w-4" /> CSV
        </Button>
        <Button variant="outline" onClick={downloadPng} disabled={!selectedBono}>
          <Download className="mr-1 h-4 w-4" /> PNG del bono seleccionado
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="mr-1 h-4 w-4" /> Imprimir
        </Button>
      </div>

      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold">
              Matriz general {raffle.digitos === 2 ? "00–99" : "000–999"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {raffle.bono_numbers_per_ticket === 1
                ? "Toca un número para seleccionar su bono."
                : "Toca cualquiera de los dos números para seleccionar su bono."}
            </p>
          </div>
          {selectedBono && (
            <div className="rounded-lg border bg-card px-3 py-2 text-sm">
              Seleccionado: <strong>Bono {padBonoNumber(selectedBono.serial)}</strong> ·{" "}
              <span className="capitalize">{selectedBono.status}</span>
            </div>
          )}
        </div>
        <div className="grid grid-cols-10 gap-1 sm:grid-cols-[repeat(20,minmax(0,1fr))]">
          {numberEntries.map((entry: any) => {
            const isSelected = selected === entry.bono.id;
            return (
              <button
                key={entry.numero}
                onClick={() => selectBono(entry.bono.id)}
                title={`Bono ${padBonoNumber(entry.bono.serial)} · ${raffle.bono_numbers_per_ticket === 1 ? "Número" : `Opción ${entry.option}`} · ${entry.bono.status}`}
                className={`aspect-square rounded text-[8px] ring-offset-1 sm:text-[10px] ${colors[entry.bono.status] ?? "bg-slate-200"} ${isSelected ? "ring-2 ring-gold" : ""}`}
              >
                {padBonoNumber(entry.numero, raffle.digitos === 2 ? 2 : 3)}
              </button>
            );
          })}
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Consolidado por responsable</h2>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-secondary">
              <tr>
                <th className="p-3 text-left">Responsable</th>
                <th>Asignados</th>
                <th>Reservados</th>
                <th>Vendidos</th>
                <th>Pagados</th>
                <th>Recaudo</th>
                <th>Pendiente</th>
              </tr>
            </thead>
            <tbody>
              {(data?.responsibles ?? [])
                .filter((item: any) => item.total > 0)
                .map((item: any) => (
                  <tr key={item.id} className="border-t text-center">
                    <td className="p-3 text-left font-medium">{item.display_name}</td>
                    <td>{item.counts.asignado}</td>
                    <td>{item.counts.reservado}</td>
                    <td>{item.counts.vendido}</td>
                    <td>{item.counts.pagado}</td>
                    <td>{formatCOP(item.paidValue)}</td>
                    <td>{formatCOP(item.pending)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div>
          {selectedBono ? (
            <div className="space-y-3">
              <div ref={printRef}>
                <BonoDualCard
                  bono={{
                    ...selectedBono,
                    numbers: selectedBono.numbers.map((n: any) => n.numero),
                    raffle,
                  }}
                  verifyUrl={
                    selectedBono.verification_code
                      ? `${typeof window === "undefined" ? "" : window.location.origin}/bono/${selectedBono.verification_code}`
                      : undefined
                  }
                />
              </div>

              <div className="rounded-xl border bg-card p-4">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div>
                    <p className="font-semibold">Bono {padBonoNumber(selectedBono.serial)}</p>
                    <p className="text-sm text-muted-foreground">
                      Estado actual:{" "}
                      <span className="font-medium capitalize text-foreground">
                        {selectedBono.status}
                      </span>
                      {selectedBono.buyer_name ? ` · Comprador: ${selectedBono.buyer_name}` : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() => openBonoEditor(selectedBono)}
                      disabled={savingBono}
                    >
                      <Pencil className="mr-1 h-4 w-4" /> Editar bono
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={removeSelectedBono}
                      disabled={
                        savingBono ||
                        selectedBono.status === "vendido" ||
                        selectedBono.status === "pagado" ||
                        Number(selectedBono.amount_paid ?? 0) > 0 ||
                        Boolean(selectedBono.sale_id)
                      }
                    >
                      <Trash2 className="mr-1 h-4 w-4" />
                      Eliminar o anular
                    </Button>
                    {selectedBono.status === "pagado" && (
                      <Button
                        variant="destructive"
                        onClick={revertSelectedPayment}
                        disabled={reverting}
                      >
                        <RotateCcw className="mr-1 h-4 w-4" />
                        {reverting
                          ? "Revirtiendo…"
                          : `Revertir pago del Bono ${padBonoNumber(selectedBono.serial)}`}
                      </Button>
                    )}
                  </div>
                </div>
                {(selectedBono.status === "pagado" ||
                  selectedBono.status === "vendido" ||
                  Number(selectedBono.amount_paid ?? 0) > 0 ||
                  selectedBono.sale_id) && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Los cambios de serial y números están bloqueados cuando hay movimientos
                    financieros. El contacto del comprador aún se puede corregir y auditar.
                    {selectedBono.status === "pagado"
                      ? " El pago solo se modifica mediante la corrección administrativa."
                      : ""}
                  </p>
                )}
                {selectedBono.status === "pagado" && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Revertir el pago devuelve el bono de Pagado a Vendido y queda registrado en el
                    historial.
                  </p>
                )}
              </div>

              <Dialog open={editOpen} onOpenChange={setEditOpen}>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      Editar Bono {selectedBono && padBonoNumber(selectedBono.serial)}
                    </DialogTitle>
                    <DialogDescription>
                      Los datos del comprador pueden corregirse. El serial y los números requieren
                      disponibilidad y quedan protegidos cuando hay movimientos financieros.
                    </DialogDescription>
                  </DialogHeader>
                  {editForm && selectedBono && (
                    <form onSubmit={saveBonoChanges} className="space-y-3">
                      <Field label="Serial *">
                        <Input
                          type="number"
                          min={1}
                          max={raffle.bono_total ?? 500}
                          required
                          value={editForm.serial}
                          disabled={
                            Boolean(selectedBono.sale_id) ||
                            Number(selectedBono.amount_paid ?? 0) > 0 ||
                            ["vendido", "pagado"].includes(selectedBono.status)
                          }
                          onChange={(event) =>
                            setEditForm({ ...editForm, serial: event.target.value })
                          }
                        />
                      </Field>
                      {editForm.numbers.map((number, index) => (
                        <Field
                          key={index}
                          label={
                            raffle.bono_numbers_per_ticket === 1 ? "Número" : `Número ${index + 1}`
                          }
                        >
                          <Input
                            type="number"
                            min={0}
                            max={10 ** raffle.digitos - 1}
                            required
                            value={number}
                            disabled={
                              Boolean(selectedBono.sale_id) ||
                              Number(selectedBono.amount_paid ?? 0) > 0 ||
                              ["vendido", "pagado"].includes(selectedBono.status)
                            }
                            onChange={(event) =>
                              setEditForm({
                                ...editForm,
                                numbers: editForm.numbers.map((value, itemIndex) =>
                                  itemIndex === index ? event.target.value : value,
                                ),
                              })
                            }
                          />
                        </Field>
                      ))}
                      <Field label="Nombre del comprador">
                        <Input
                          required={Boolean(selectedBono.sale_id)}
                          value={editForm.buyer_name}
                          onChange={(event) =>
                            setEditForm({ ...editForm, buyer_name: event.target.value })
                          }
                        />
                      </Field>
                      <Field label="Teléfono o WhatsApp">
                        <Input
                          required={Boolean(selectedBono.sale_id)}
                          value={editForm.buyer_phone}
                          onChange={(event) =>
                            setEditForm({ ...editForm, buyer_phone: event.target.value })
                          }
                        />
                      </Field>
                      <Field label="Ciudad">
                        <Input
                          value={editForm.buyer_city}
                          onChange={(event) =>
                            setEditForm({ ...editForm, buyer_city: event.target.value })
                          }
                        />
                      </Field>
                      <Field label="Observaciones">
                        <Input
                          value={editForm.buyer_notes}
                          onChange={(event) =>
                            setEditForm({ ...editForm, buyer_notes: event.target.value })
                          }
                        />
                      </Field>
                      <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                          Cancelar
                        </Button>
                        <Button type="submit" disabled={savingBono}>
                          {savingBono ? "Guardando…" : "Revisar y guardar"}
                        </Button>
                      </DialogFooter>
                    </form>
                  )}
                </DialogContent>
              </Dialog>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed bg-card p-8 text-center text-muted-foreground">
              Selecciona primero un bono en la matriz o en la lista. Las acciones administrativas
              aparecerán únicamente para ese bono.
            </div>
          )}
        </div>

        <aside className="max-h-[500px] overflow-auto rounded-xl border bg-card p-3">
          <h2 className="mb-2 font-semibold">Bonos ({filtered.length})</h2>
          {filtered.map((b: any) => (
            <button
              key={b.id}
              onClick={() => selectBono(b.id)}
              className={`flex w-full justify-between rounded px-2 py-2 text-sm hover:bg-secondary ${selected === b.id ? "bg-secondary ring-1 ring-gold" : ""}`}
            >
              <span>
                Bono {padBonoNumber(b.serial)} ·{" "}
                {b.numbers
                  .map((n: any) => padBonoNumber(n.numero, raffle.digitos === 2 ? 2 : 3))
                  .join(" / ")}
              </span>
              <span className="text-right capitalize">
                {b.status}
                {b.responsible_name ? ` · ${b.responsible_name}` : ""}
                {b.batch_code ? ` · ${b.batch_code}` : ""}
              </span>
            </button>
          ))}
        </aside>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="mb-1 block">{label}</Label>
      {children}
    </div>
  );
}
