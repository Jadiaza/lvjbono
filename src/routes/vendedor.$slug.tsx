/* eslint-disable @typescript-eslint/no-explicit-any */
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Search, Share2, MessageCircle, TicketCheck } from "lucide-react";
import { getPublicSellerPage } from "@/lib/seller-public.functions";
import { padBonoNumber } from "@/lib/bono-domain";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCOP } from "@/lib/format";

export const Route = createFileRoute("/vendedor/$slug")({ component: SellerPage });

const availableStatuses = new Set(["asignado", "disponible", "devuelto"]);

function formatDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(`${value}T12:00:00`);
  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function SellerPage() {
  const { slug } = Route.useParams();
  const get = useServerFn(getPublicSellerPage);
  const [filter, setFilter] = useState<"available" | "all">("available");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any | null>(null);

  const { data, error } = useQuery({
    queryKey: ["seller-public", slug],
    queryFn: () => get({ data: { slug } }),
    retry: false,
  });

  const bonos = data?.bonos ?? [];
  const campaign = bonos[0]?.raffles ?? null;

  const visibleBonos = useMemo(() => {
    const term = search.trim().toLowerCase();
    return bonos.filter((bono: any) => {
      const available = availableStatuses.has(bono.status);
      if (filter === "available" && !available) return false;
      if (!term) return true;
      const serial = padBonoNumber(bono.serial);
      const numbers = (bono.raffle_bono_numbers ?? []).map((item: any) =>
        padBonoNumber(item.numero),
      );
      return serial.includes(term) || numbers.some((number: string) => number.includes(term));
    });
  }, [bonos, filter, search]);

  if (error)
    return (
      <main className="grid min-h-screen place-items-center p-6 text-center">
        <div>
          <h1 className="text-xl font-bold">Página no disponible</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Verifica el enlace o consulta al responsable.
          </p>
        </div>
      </main>
    );

  if (!data)
    return <main className="grid min-h-screen place-items-center p-6 text-center">Cargando…</main>;

  const availableCount = bonos.filter((bono: any) => availableStatuses.has(bono.status)).length;
  const accent = campaign?.bono_accent_color || "#B8860B";
  const numberColor = campaign?.bono_number_color || "#C51B1B";

  function getNumbers(bono: any) {
    return [...(bono.raffle_bono_numbers ?? [])]
      .sort((a: any, b: any) => a.option_number - b.option_number)
      .map((item: any) => padBonoNumber(item.numero));
  }

  function whatsappUrl(bono: any) {
    if (!data.responsible.phone) return null;
    const nums = getNumbers(bono);
    const text = encodeURIComponent(
      `Hola ${data.responsible.display_name}, quiero el Bono ${padBonoNumber(bono.serial)} con los números ${nums.join(" y ")}. ¿Está disponible?`,
    );
    return `https://wa.me/${data.responsible.phone.replace(/\D/g, "")}?text=${text}`;
  }

  async function shareBono(bono: any) {
    const nums = getNumbers(bono);
    const text = `Bono ${padBonoNumber(bono.serial)} · ${nums.join(" / ")} · ${campaign?.nombre ?? "Bono"}`;
    if (navigator.share) {
      await navigator.share({ title: campaign?.nombre ?? "Bono", text, url: window.location.href });
      return;
    }
    await navigator.clipboard.writeText(`${text}\n${window.location.href}`);
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-background">
      <section className="border-b bg-card">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
          <div className="grid gap-5 md:grid-cols-[1fr_260px] md:items-center">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                {campaign?.bono_logo_url ? (
                  <img
                    src={campaign.bono_logo_url}
                    alt="Logo"
                    className="h-14 w-14 shrink-0 rounded-xl object-contain"
                  />
                ) : (
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-secondary">
                    <TicketCheck className="h-7 w-7" style={{ color: accent }} />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[.18em]" style={{ color: accent }}>
                    {campaign?.bono_title || "BONO"}
                  </p>
                  <h1 className="break-words text-2xl font-black leading-tight sm:text-3xl">
                    {campaign?.bono_subtitle || campaign?.nombre || "Bonos disponibles"}
                  </h1>
                </div>
              </div>

              <div className="mt-4 grid gap-1 text-sm sm:grid-cols-2 sm:text-base">
                <p><strong>Responsable:</strong> {data.responsible.display_name}</p>
                {campaign?.valor_boleta ? <p><strong>Valor:</strong> {formatCOP(campaign.valor_boleta)}</p> : null}
                {campaign?.fecha_sorteo ? <p><strong>Sorteo:</strong> {formatDate(campaign.fecha_sorteo)}</p> : null}
                {campaign?.loteria ? <p><strong>Lotería:</strong> {campaign.loteria}</p> : null}
              </div>
            </div>

            <div className="rounded-2xl border bg-background p-4 text-center">
              {campaign?.bono_prize_image_url ? (
                <img
                  src={campaign.bono_prize_image_url}
                  alt={campaign.bono_prize_name || "Premio"}
                  className="mx-auto h-28 w-full object-contain"
                />
              ) : null}
              <p className="mt-2 text-xs font-bold uppercase tracking-wider" style={{ color: accent }}>
                Premio
              </p>
              <p className="font-bold">{campaign?.bono_prize_name || "Premio especial"}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-7">
        <div className="mb-4 rounded-2xl border bg-card p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-black">Bonos del responsable</h2>
              <p className="text-sm text-muted-foreground">
                {availableCount} disponibles de {bonos.length} asignados
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={filter === "available" ? "default" : "outline"}
                onClick={() => setFilter("available")}
              >
                Disponibles
              </Button>
              <Button
                type="button"
                size="sm"
                variant={filter === "all" ? "default" : "outline"}
                onClick={() => setFilter("all")}
              >
                Todos
              </Button>
            </div>
          </div>

          <div className="relative mt-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por bono o número…"
              className="pl-9"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visibleBonos.map((bono: any) => {
            const nums = getNumbers(bono);
            const available = availableStatuses.has(bono.status);
            return (
              <button
                key={bono.id}
                type="button"
                onClick={() => setSelected(bono)}
                className={`w-full rounded-2xl border-2 bg-card p-4 text-left transition active:scale-[.99] ${
                  available ? "shadow-sm hover:shadow-md" : "opacity-60"
                }`}
                style={{ borderColor: available ? `${accent}88` : undefined }}
              >
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-base">Bono {padBonoNumber(bono.serial)}</strong>
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-bold uppercase">
                    {available ? "Disponible" : bono.status}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-center gap-3 text-center">
                  {nums.map((number: string) => (
                    <span
                      key={number}
                      className="min-w-0 flex-1 rounded-xl bg-background px-2 py-3 text-3xl font-black tracking-wider"
                      style={{ color: numberColor }}
                    >
                      {number}
                    </span>
                  ))}
                </div>
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Toca para ver el bono
                </p>
              </button>
            );
          })}
        </div>

        {!visibleBonos.length && (
          <div className="rounded-2xl border border-dashed p-8 text-center text-muted-foreground">
            No encontramos bonos con ese filtro.
          </div>
        )}
      </section>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="w-[calc(100vw-2rem)] max-w-md rounded-2xl p-0 overflow-hidden">
          {selected && (() => {
            const nums = getNumbers(selected);
            const available = availableStatuses.has(selected.status);
            const wa = whatsappUrl(selected);
            return (
              <>
                <div className="p-5" style={{ borderTop: `6px solid ${accent}` }}>
                  <DialogHeader>
                    <DialogTitle>Bono {padBonoNumber(selected.serial)}</DialogTitle>
                  </DialogHeader>
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {nums.map((number: string) => (
                      <div key={number} className="rounded-2xl border bg-background p-4 text-center">
                        <div className="text-xs font-bold uppercase text-muted-foreground">Número</div>
                        <div className="mt-1 text-4xl font-black tracking-wider" style={{ color: numberColor }}>
                          {number}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 rounded-xl bg-secondary p-3 text-sm">
                    <p><strong>Estado:</strong> {available ? "Disponible" : selected.status}</p>
                    {campaign?.valor_boleta ? <p><strong>Valor:</strong> {formatCOP(campaign.valor_boleta)}</p> : null}
                  </div>

                  <div className="mt-5 grid gap-2">
                    {available && wa ? (
                      <a href={wa} target="_blank" rel="noreferrer">
                        <Button className="w-full">
                          <MessageCircle className="mr-2 h-4 w-4" />
                          Quiero este bono
                        </Button>
                      </a>
                    ) : null}
                    <Button type="button" variant="outline" className="w-full" onClick={() => shareBono(selected)}>
                      <Share2 className="mr-2 h-4 w-4" />
                      Compartir bono
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </main>
  );
}
