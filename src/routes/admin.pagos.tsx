import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CreditCard, ImageUp, KeyRound, Save } from "lucide-react";
import { toast } from "sonner";
import { adminListRaffles, organizerUpdatePaymentSettings } from "@/lib/raffle.functions";
import { supabase } from "@/integrations/supabase/client";
import { useSelectedRaffle } from "@/hooks/use-selected-raffle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/admin/pagos")({
  component: OrganizerPayments,
});

type PaymentRaffle = {
  id: string;
  nombre: string;
  serie: string | null;
  whatsapp_admin: string | null;
  nequi: string | null;
  daviplata: string | null;
  bre_b: string | null;
  nequi_qr_url: string | null;
  daviplata_qr_url: string | null;
  bre_b_qr_url: string | null;
  mercadopago_url: string | null;
  nequi_logo_url: string | null;
  daviplata_logo_url: string | null;
  bre_b_logo_url: string | null;
  mercadopago_logo_url: string | null;
  nequi_enabled: boolean;
  nequi_number_visible: boolean;
  nequi_qr_visible: boolean;
  daviplata_enabled: boolean;
  daviplata_number_visible: boolean;
  daviplata_qr_visible: boolean;
  bre_b_enabled: boolean;
  bre_b_key_visible: boolean;
  bre_b_qr_visible: boolean;
  mercadopago_enabled: boolean;
};

type QrField = "nequi_qr_url" | "daviplata_qr_url" | "bre_b_qr_url";

const EMPTY = {
  whatsapp_admin: "",
  nequi: "",
  daviplata: "",
  bre_b: "",
  nequi_qr_url: "",
  daviplata_qr_url: "",
  bre_b_qr_url: "",
  mercadopago_url: "",
  nequi_logo_url: "",
  daviplata_logo_url: "",
  bre_b_logo_url: "",
  mercadopago_logo_url: "",
  nequi_enabled: false,
  nequi_number_visible: true,
  nequi_qr_visible: true,
  daviplata_enabled: false,
  daviplata_number_visible: true,
  daviplata_qr_visible: true,
  bre_b_enabled: false,
  bre_b_key_visible: true,
  bre_b_qr_visible: true,
  mercadopago_enabled: false,
};

function OrganizerPayments() {
  const list = useServerFn(adminListRaffles);
  const saveSettings = useServerFn(organizerUpdatePaymentSettings);
  const qc = useQueryClient();
  const { id: selectedId } = useSelectedRaffle();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-raffles"],
    queryFn: () => list(),
  });
  const raffle = (data?.raffles ?? []).find((item) => item.id === selectedId) as
    | PaymentRaffle
    | undefined;
  const isOrganizer = data?.access?.role === "organizer";
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<QrField | null>(null);

  useEffect(() => {
    if (!raffle) return;
    setForm({
      whatsapp_admin: raffle.whatsapp_admin ?? "",
      nequi: raffle.nequi ?? "",
      daviplata: raffle.daviplata ?? "",
      bre_b: raffle.bre_b ?? "",
      nequi_qr_url: raffle.nequi_qr_url ?? "",
      daviplata_qr_url: raffle.daviplata_qr_url ?? "",
      bre_b_qr_url: raffle.bre_b_qr_url ?? "",
      mercadopago_url: raffle.mercadopago_url ?? "",
      nequi_logo_url: raffle.nequi_logo_url ?? "",
      daviplata_logo_url: raffle.daviplata_logo_url ?? "",
      bre_b_logo_url: raffle.bre_b_logo_url ?? "",
      mercadopago_logo_url: raffle.mercadopago_logo_url ?? "",
      nequi_enabled: raffle.nequi_enabled ?? false,
      nequi_number_visible: raffle.nequi_number_visible ?? true,
      nequi_qr_visible: raffle.nequi_qr_visible ?? true,
      daviplata_enabled: raffle.daviplata_enabled ?? false,
      daviplata_number_visible: raffle.daviplata_number_visible ?? true,
      daviplata_qr_visible: raffle.daviplata_qr_visible ?? true,
      bre_b_enabled: raffle.bre_b_enabled ?? false,
      bre_b_key_visible: raffle.bre_b_key_visible ?? true,
      bre_b_qr_visible: raffle.bre_b_qr_visible ?? true,
      mercadopago_enabled: raffle.mercadopago_enabled ?? false,
    });
  }, [raffle]);

  async function uploadQr(field: QrField, provider: string, file?: File) {
    if (!file || !raffle) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      toast.error("Carga una imagen JPG, PNG o WebP.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("La imagen no puede superar 5 MB.");
      return;
    }
    setUploading(field);
    try {
      const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const objectPath = `${raffle.id}/${provider}-${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage.from("payment-qr").upload(objectPath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type,
      });
      if (error) throw error;
      const { data: publicData } = supabase.storage.from("payment-qr").getPublicUrl(objectPath);
      setForm((current) => ({ ...current, [field]: publicData.publicUrl }));
      toast.success("QR cargado. Pulsa Guardar configuraciÃ³n para publicarlo.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible cargar el QR.");
    } finally {
      setUploading(null);
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!raffle) return;
    setSaving(true);
    try {
      await saveSettings({
        data: {
          raffleId: raffle.id,
          whatsapp_admin: form.whatsapp_admin.trim() || null,
          nequi: form.nequi.trim() || null,
          daviplata: form.daviplata.trim() || null,
          bre_b: form.bre_b.trim() || null,
          nequi_qr_url: form.nequi_qr_url || null,
          daviplata_qr_url: form.daviplata_qr_url || null,
          bre_b_qr_url: form.bre_b_qr_url || null,
          mercadopago_url: form.mercadopago_url.trim() || null,
          nequi_logo_url: form.nequi_logo_url || null,
          daviplata_logo_url: form.daviplata_logo_url || null,
          bre_b_logo_url: form.bre_b_logo_url || null,
          mercadopago_logo_url: form.mercadopago_logo_url || null,
          nequi_enabled: form.nequi_enabled,
          nequi_number_visible: form.nequi_number_visible,
          nequi_qr_visible: form.nequi_qr_visible,
          daviplata_enabled: form.daviplata_enabled,
          daviplata_number_visible: form.daviplata_number_visible,
          daviplata_qr_visible: form.daviplata_qr_visible,
          bre_b_enabled: form.bre_b_enabled,
          bre_b_key_visible: form.bre_b_key_visible,
          bre_b_qr_visible: form.bre_b_qr_visible,
          mercadopago_enabled: form.mercadopago_enabled,
        },
      });
      await qc.invalidateQueries({ queryKey: ["admin-raffles"] });
      await qc.invalidateQueries({ queryKey: ["raffle-public"] });
      toast.success("MÃ©todos de pago actualizados.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No fue posible guardar.");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return <p className="text-muted-foreground">Cargando configuraciÃ³nâ€¦</p>;
  if (!isOrganizer) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <h1 className="text-xl font-bold">ConfiguraciÃ³n personal de pagos</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Esta secciÃ³n estÃ¡ disponible Ãºnicamente en la cuenta del arrendatario.
        </p>
      </div>
    );
  }
  if (!raffle) return <p className="text-muted-foreground">No tienes una rifa asignada.</p>;

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl space-y-5">
      <div>
        <div className="flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-brand" />
          <h1 className="text-2xl font-bold">Mis mÃ©todos de pago</h1>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          ConfiguraciÃ³n personal para {raffle.serie ? `[${raffle.serie}] ` : ""}
          {raffle.nombre}. Solo se mostrarÃ¡n los mÃ©todos que diligencies.
        </p>
      </div>

      <section className="rounded-2xl border border-border bg-card p-4">
        <Label htmlFor="payment-whatsapp">WhatsApp que recibe boletas y comprobantes</Label>
        <Input
          id="payment-whatsapp"
          value={form.whatsapp_admin}
          onChange={(event) => setForm({ ...form, whatsapp_admin: event.target.value })}
          placeholder="3015559154"
          inputMode="tel"
          className="mt-1"
        />
      </section>

      <PaymentSection
        title="Nequi"
        enabled={form.nequi_enabled}
        onEnabled={(enabled) => setForm({ ...form, nequi_enabled: enabled })}
        showValue={form.nequi_number_visible}
        onShowValue={(visible) => setForm({ ...form, nequi_number_visible: visible })}
        showQr={form.nequi_qr_visible}
        onShowQr={(visible) => setForm({ ...form, nequi_qr_visible: visible })}
        accent="text-[#ff2ba6]"
        valueLabel="NÃºmero Nequi"
        value={form.nequi}
        onValue={(value) => setForm({ ...form, nequi: value })}
        qrUrl={form.nequi_qr_url}
        uploading={uploading === "nequi_qr_url"}
        onQr={(file) => uploadQr("nequi_qr_url", "nequi", file)}
        onRemoveQr={() => setForm({ ...form, nequi_qr_url: "" })}
        logoUrl="/payment-logos/nequi.png"
        useLogo={form.nequi_logo_url === "/payment-logos/nequi.png"}
        onUseLogo={(use) =>
          setForm({ ...form, nequi_logo_url: use ? "/payment-logos/nequi.png" : "" })
        }
      />
      <PaymentSection
        title="Daviplata"
        enabled={form.daviplata_enabled}
        onEnabled={(enabled) => setForm({ ...form, daviplata_enabled: enabled })}
        showValue={form.daviplata_number_visible}
        onShowValue={(visible) => setForm({ ...form, daviplata_number_visible: visible })}
        showQr={form.daviplata_qr_visible}
        onShowQr={(visible) => setForm({ ...form, daviplata_qr_visible: visible })}
        accent="text-[#ef3340]"
        valueLabel="NÃºmero Daviplata"
        value={form.daviplata}
        onValue={(value) => setForm({ ...form, daviplata: value })}
        qrUrl={form.daviplata_qr_url}
        uploading={uploading === "daviplata_qr_url"}
        onQr={(file) => uploadQr("daviplata_qr_url", "daviplata", file)}
        onRemoveQr={() => setForm({ ...form, daviplata_qr_url: "" })}
        logoUrl="/payment-logos/daviplata.png"
        useLogo={form.daviplata_logo_url === "/payment-logos/daviplata.png"}
        onUseLogo={(use) =>
          setForm({ ...form, daviplata_logo_url: use ? "/payment-logos/daviplata.png" : "" })
        }
      />
      <PaymentSection
        title="Bre-B"
        enabled={form.bre_b_enabled}
        onEnabled={(enabled) => setForm({ ...form, bre_b_enabled: enabled })}
        showValue={form.bre_b_key_visible}
        onShowValue={(visible) => setForm({ ...form, bre_b_key_visible: visible })}
        showQr={form.bre_b_qr_visible}
        onShowQr={(visible) => setForm({ ...form, bre_b_qr_visible: visible })}
        accent="text-[#00a7c7]"
        valueLabel="Llave Bre-B"
        value={form.bre_b}
        onValue={(value) => setForm({ ...form, bre_b: value })}
        qrUrl={form.bre_b_qr_url}
        uploading={uploading === "bre_b_qr_url"}
        onQr={(file) => uploadQr("bre_b_qr_url", "bre-b", file)}
        onRemoveQr={() => setForm({ ...form, bre_b_qr_url: "" })}
        logoUrl="/payment-logos/bre-b.png"
        useLogo={form.bre_b_logo_url === "/payment-logos/bre-b.png"}
        onUseLogo={(use) =>
          setForm({ ...form, bre_b_logo_url: use ? "/payment-logos/bre-b.png" : "" })
        }
        keyIcon
      />

      <section className="rounded-2xl border border-border bg-card p-4">
        <h2 className="font-bold">Mercado Pago</h2>
        <p className="mb-3 text-xs text-muted-foreground">
          Usa el enlace oficial de pago o Checkout generado en tu cuenta.
        </p>
        <Label htmlFor="mercadopago-url">Enlace oficial</Label>
        <Input
          id="mercadopago-url"
          type="url"
          disabled={!form.mercadopago_enabled}
          value={form.mercadopago_url}
          onChange={(event) => setForm({ ...form, mercadopago_url: event.target.value })}
          placeholder="https://link.mercadopago.com.co/..."
          className="mt-1"
        />
        <label className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-secondary/30 p-3">
          <input
            type="checkbox"
            checked={form.mercadopago_logo_url === "/payment-logos/mercado-pago.png"}
            disabled={!form.mercadopago_enabled}
            onChange={(event) =>
              setForm({
                ...form,
                mercadopago_logo_url: event.target.checked ? "/payment-logos/mercado-pago.png" : "",
              })
            }
          />
          <img
            src="/payment-logos/mercado-pago.png"
            alt="Mercado Pago"
            className="h-12 w-24 rounded bg-white object-contain p-1"
          />
          <span className="text-xs font-medium">Mostrar logo de Mercado Pago</span>
        </label>
      </section>

      <Button type="submit" disabled={saving || uploading !== null} className="w-full">
        <Save className="mr-2 h-4 w-4" />
        {saving ? "Guardandoâ€¦" : "Guardar configuraciÃ³n"}
      </Button>
    </form>
  );
}

function PaymentSection({
  title,
  enabled,
  onEnabled,
  showValue,
  onShowValue,
  showQr,
  onShowQr,
  accent,
  valueLabel,
  value,
  onValue,
  qrUrl,
  uploading,
  onQr,
  onRemoveQr,
  logoUrl,
  useLogo,
  onUseLogo,
  keyIcon = false,
}: {
  title: string;
  enabled: boolean;
  onEnabled: (enabled: boolean) => void;
  showValue: boolean;
  onShowValue: (visible: boolean) => void;
  showQr: boolean;
  onShowQr: (visible: boolean) => void;
  accent: string;
  valueLabel: string;
  value: string;
  onValue: (value: string) => void;
  qrUrl: string;
  uploading: boolean;
  onQr: (file?: File) => void;
  onRemoveQr: () => void;
  logoUrl: string;
  useLogo: boolean;
  onUseLogo: (use: boolean) => void;
  keyIcon?: boolean;
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <h2 className={`text-lg font-black ${accent}`}>{title}</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-[1fr_180px]">
        <div>
          <Label>
            {keyIcon && <KeyRound className="mr-1 inline h-4 w-4" />}
            {valueLabel}
          </Label>
          <Input
            disabled={!enabled}
            value={value}
            onChange={(event) => onValue(event.target.value)}
            placeholder={keyIcon ? "Celular, documento, correo o llave" : "NÃºmero de la cuenta"}
            className="mt-1"
          />
          <Label className="mt-4 block">QR oficial generado por la entidad</Label>
          <label className="mt-1 inline-flex cursor-pointer items-center rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-secondary">
            <ImageUp className="mr-2 h-4 w-4" />
            {uploading ? "Cargandoâ€¦" : "Seleccionar imagen"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={uploading || !enabled}
              onChange={(event) => onQr(event.target.files?.[0])}
            />
          </label>
          <label className="mt-4 flex items-center gap-3 rounded-xl border border-border bg-secondary/30 p-3">
            <input
              type="checkbox"
              checked={useLogo}
              disabled={!enabled}
              onChange={(event) => onUseLogo(event.target.checked)}
            />
            <img
              src={logoUrl}
              alt={`Logo de ${title}`}
              className="h-12 w-24 rounded bg-white object-contain p-1"
            />
            <span className="text-xs font-medium">Usar este logo si no tengo QR</span>
          </label>
        </div>
        <div className="grid min-h-40 place-items-center rounded-xl border border-dashed border-border bg-secondary/30 p-2">
          {qrUrl ? (
            <div className="text-center">
              <img
                src={qrUrl}
                alt={`QR oficial de ${title}`}
                className="mx-auto max-h-36 rounded-lg"
              />
              <button type="button" onClick={onRemoveQr} className="mt-2 text-xs text-destructive">
                Quitar QR
              </button>
            </div>
          ) : (
            <span className="text-center text-xs text-muted-foreground">Sin QR cargado</span>
          )}
        </div>
      </div>
    </section>
  );
}
