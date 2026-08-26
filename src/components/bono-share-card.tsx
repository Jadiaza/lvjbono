import { forwardRef } from "react";
import { formatCOP, formatDate } from "@/lib/format";

type BonoShareRaffle = {
  nombre: string;
  valor_boleta: number;
  fecha_sorteo: string | null;
  loteria: string | null;
  bono_total?: number | null;
  bono_title?: string | null;
  bono_subtitle?: string | null;
  bono_prize_name?: string | null;
  bono_prize_description?: string | null;
  bono_prize_dimensions?: string | null;
  bono_prize_image_url?: string | null;
  bono_logo_url?: string | null;
  bono_accent_color?: string | null;
};

export const BonoShareCard = forwardRef<HTMLDivElement, { raffle: BonoShareRaffle }>(
  ({ raffle }, ref) => {
    const accent = raffle.bono_accent_color || "#f9bd08";
    const total = raffle.bono_total ?? 500;
    return (
      <div
        ref={ref}
        className="mx-auto w-[1200px] overflow-hidden bg-[#170326] text-white"
        style={{ border: `10px solid ${accent}` }}
      >
        <div className="grid min-h-[720px] grid-cols-[1.15fr_.85fr] gap-10 p-14">
          <section className="flex flex-col justify-between">
            <div>
              <div className="mb-8 flex items-center gap-5">
                {raffle.bono_logo_url && (
                  <img
                    src={raffle.bono_logo_url}
                    alt="Logo"
                    className="h-24 w-24 rounded-2xl bg-white object-contain p-2"
                    crossOrigin="anonymous"
                  />
                )}
                <div>
                  <p
                    className="text-2xl font-bold uppercase tracking-[.25em]"
                    style={{ color: accent }}
                  >
                    {raffle.bono_title || "BONO SOLIDARIO"}
                  </p>
                  <p className="mt-2 text-xl text-white/75">
                    Premio físico · no canjeable por dinero
                  </p>
                </div>
              </div>
              <h1 className="max-w-3xl text-6xl font-black uppercase leading-[1.05]">
                {raffle.bono_subtitle || raffle.nombre}
              </h1>
              <div
                className="mt-10 inline-flex rounded-full px-8 py-4 text-3xl font-black text-[#170326]"
                style={{ background: accent }}
              >
                {total} BONOS · {total * 2} NÚMEROS · 2 POR BONO
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 text-xl">
              <Info label="Valor del bono" value={formatCOP(raffle.valor_boleta)} />
              <Info
                label="Sorteo"
                value={raffle.fecha_sorteo ? formatDate(raffle.fecha_sorteo) : "Por definir"}
              />
              <Info label="Lotería" value={raffle.loteria || "Por definir"} />
            </div>
          </section>
          <section className="rounded-[36px] bg-[#fff8ed] p-8 text-[#1c1230]">
            {raffle.bono_prize_image_url ? (
              <img
                src={raffle.bono_prize_image_url}
                alt={raffle.bono_prize_name || "Premio"}
                className="h-[360px] w-full rounded-3xl object-contain"
                crossOrigin="anonymous"
              />
            ) : (
              <div className="grid h-[360px] place-items-center rounded-3xl bg-black/5 text-3xl font-bold">
                Imagen del premio
              </div>
            )}
            <p
              className="mt-7 text-lg font-bold uppercase tracking-[.2em]"
              style={{ color: accent }}
            >
              PREMIO
            </p>
            <h2 className="mt-2 text-4xl font-black">
              {raffle.bono_prize_name || "Premio especial"}
            </h2>
            {raffle.bono_prize_description && (
              <p className="mt-3 text-xl leading-relaxed">{raffle.bono_prize_description}</p>
            )}
            {raffle.bono_prize_dimensions && (
              <p className="mt-4 text-lg font-bold">
                Características: {raffle.bono_prize_dimensions}
              </p>
            )}
          </section>
        </div>
        <div
          className="px-14 py-6 text-center text-xl font-bold text-[#170326]"
          style={{ background: accent }}
        >
          Cada bono participa con una pareja única de números entre 000 y 999.
        </div>
      </div>
    );
  },
);
BonoShareCard.displayName = "BonoShareCard";

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/20 bg-white/10 p-5">
      <p className="text-sm uppercase tracking-wider text-white/60">{label}</p>
      <strong className="mt-2 block">{value}</strong>
    </div>
  );
}
