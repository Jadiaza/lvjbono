/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Plus, TicketCheck } from "lucide-react";
import { toast } from "sonner";
import { adminCreateDualBonoCampaign, adminListDualBonoCampaigns } from "@/lib/bono.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCOP } from "@/lib/format";

export const Route = createFileRoute("/admin/bonos")({ component: AdminBonos });

const initialForm = {
  nombre: "",
  valor_boleta: 10000,
  bono_total: 500,
  fecha_sorteo: "",
  loteria: "",
  bono_title: "BONO",
  bono_subtitle: "",
  bono_prize_name: "",
  bono_prize_description: "",
  bono_prize_dimensions: "",
  bono_prize_image_url: "",
  bono_side_image_url: "",
  bono_logo_url: "",
  bono_number_color: "#C51B1B",
  bono_accent_color: "#C51B1B",
  bono_footer_text: "¡Gracias por apoyar nuestra misión!",
  bono_show_qr: true,
  bono_show_platform_branding: true,
};

function AdminBonos() {
  const list = useServerFn(adminListDualBonoCampaigns);
  const create = useServerFn(adminCreateDualBonoCampaign);
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data } = useQuery({ queryKey: ["dual-bono-campaigns"], queryFn: () => list() });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(initialForm);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await create({
        data: { ...form, fecha_sorteo: form.fecha_sorteo || null, loteria: form.loteria || null },
      });
      toast.success(
        `${result.generated} bonos y ${result.generated * 2} números generados sin repetición.`,
      );
      setOpen(false);
      setForm(initialForm);
      await qc.invalidateQueries();
      navigate({ to: "/admin/bonos/$raffleId", params: { raffleId: result.raffle.id } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible crear la campaña.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-gold">Bonos personalizados</h1>
          <p className="text-sm text-muted-foreground">
            Campañas de duplas permanentes con números únicos.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-1 h-4 w-4" />
          Nueva campaña
        </Button>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {(data?.campaigns ?? []).map((campaign: any) => (
          <Link
            key={campaign.id}
            to="/admin/bonos/$raffleId"
            params={{ raffleId: campaign.id }}
            className="rounded-xl border bg-card p-5 transition hover:border-gold/60"
          >
            <TicketCheck className="mb-3 h-6 w-6 text-gold" />
            <h2 className="font-semibold">{campaign.nombre}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {campaign.bono_total} bonos · {campaign.bono_total * 2} números ·{" "}
              {formatCOP(campaign.valor_boleta)}
            </p>
          </Link>
        ))}
        {!data?.campaigns?.length && (
          <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
            Aún no existen campañas de bonos.
          </p>
        )}
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Crear bono personalizado en duplas</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-5">
            <div className="rounded-lg border border-gold/30 bg-gold/5 p-3 text-sm">
              Se crearán bonos con <strong>2 números de 3 cifras</strong>, mezclados sin repetición.
              No se crearán tickets tradicionales.
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Nombre *">
                <Input
                  required
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                />
              </Field>
              <Field label="Cantidad">
                <Input
                  type="number"
                  min={1}
                  max={500}
                  value={form.bono_total}
                  onChange={(e) => setForm({ ...form, bono_total: Number(e.target.value) })}
                />
              </Field>
              <Field label="Valor por bono">
                <Input
                  type="number"
                  min={100}
                  step={100}
                  value={form.valor_boleta}
                  onChange={(e) => setForm({ ...form, valor_boleta: Number(e.target.value) })}
                />
              </Field>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Fecha del sorteo">
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
            <h3 className="font-semibold">Diseño del bono</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Título">
                <Input
                  value={form.bono_title}
                  onChange={(e) => setForm({ ...form, bono_title: e.target.value })}
                />
              </Field>
              <Field label="Subtítulo">
                <Input
                  value={form.bono_subtitle}
                  onChange={(e) => setForm({ ...form, bono_subtitle: e.target.value })}
                />
              </Field>
              <Field label="Premio">
                <Input
                  value={form.bono_prize_name}
                  onChange={(e) => setForm({ ...form, bono_prize_name: e.target.value })}
                />
              </Field>
              <Field label="Medidas">
                <Input
                  value={form.bono_prize_dimensions}
                  onChange={(e) => setForm({ ...form, bono_prize_dimensions: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Descripción">
              <Input
                value={form.bono_prize_description}
                onChange={(e) => setForm({ ...form, bono_prize_description: e.target.value })}
              />
            </Field>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Imagen premio (HTTPS)">
                <Input
                  type="url"
                  value={form.bono_prize_image_url}
                  onChange={(e) => setForm({ ...form, bono_prize_image_url: e.target.value })}
                />
              </Field>
              <Field label="Imagen lateral (HTTPS)">
                <Input
                  type="url"
                  value={form.bono_side_image_url}
                  onChange={(e) => setForm({ ...form, bono_side_image_url: e.target.value })}
                />
              </Field>
              <Field label="Logo (HTTPS)">
                <Input
                  type="url"
                  value={form.bono_logo_url}
                  onChange={(e) => setForm({ ...form, bono_logo_url: e.target.value })}
                />
              </Field>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Color de números">
                <Input
                  type="color"
                  value={form.bono_number_color}
                  onChange={(e) => setForm({ ...form, bono_number_color: e.target.value })}
                />
              </Field>
              <Field label="Color de acento">
                <Input
                  type="color"
                  value={form.bono_accent_color}
                  onChange={(e) => setForm({ ...form, bono_accent_color: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Texto inferior">
              <Input
                value={form.bono_footer_text}
                onChange={(e) => setForm({ ...form, bono_footer_text: e.target.value })}
              />
            </Field>
            <div className="flex gap-6 text-sm">
              <label>
                <input
                  type="checkbox"
                  checked={form.bono_show_qr}
                  onChange={(e) => setForm({ ...form, bono_show_qr: e.target.checked })}
                />{" "}
                Mostrar verificación
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={form.bono_show_platform_branding}
                  onChange={(e) =>
                    setForm({ ...form, bono_show_platform_branding: e.target.checked })
                  }
                />{" "}
                Mostrar marca Rifaya
              </label>
            </div>
            <Button disabled={busy} className="w-full">
              {busy ? "Generando…" : `Crear ${form.bono_total} bonos`}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
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
