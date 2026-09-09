import { forwardRef } from "react";
import { formatCOP, formatDate } from "@/lib/format";
import { padBonoNumber } from "@/lib/bono-domain";

type BatchRaffle = {
  nombre: string;
  valor_boleta: number;
  fecha_sorteo?: string | null;
  loteria?: string | null;
  bono_title?: string | null;
  bono_subtitle?: string | null;
  bono_prize_name?: string | null;
  bono_prize_image_url?: string | null;
  bono_logo_url?: string | null;
  bono_number_color?: string | null;
  bono_accent_color?: string | null;
  bono_footer_text?: string | null;
};

type BatchBono = {
  id: string;
  serial: number;
  status: string;
  raffle_bono_numbers?: Array<{ option_number: number; numero: number }>;
};

type BonoBatchCardProps = {
  raffle: BatchRaffle;
  batch: { code: string; name?: string | null };
  responsibleName: string;
  bonos: BatchBono[];
};

const unavailableStatuses = new Set(["reservado", "vendido", "pagado", "anulado"]);

export const BonoBatchCard = forwardRef<HTMLDivElement, BonoBatchCardProps>(
  ({ raffle, batch, responsibleName, bonos }, ref) => {
    const accent = raffle.bono_accent_color || "#B8860B";
    const numberColor = raffle.bono_number_color || "#C51B1B";
    const ordered = [...bonos].sort((a, b) => a.serial - b.serial);
    const available = ordered.filter((bono) => !unavailableStatuses.has(bono.status)).length;

    return (
      <div
        ref={ref}
        className="mx-auto w-[1200px] overflow-hidden bg-[#fffaf0] text-slate-950"
        style={{ border: `10px solid ${accent}` }}
      >
        <header className="grid grid-cols-[1fr_300px] gap-8 bg-white px-10 py-8">
          <div>
            <div className="flex items-center gap-5">
              {raffle.bono_logo_url && (
                <img
                  src={raffle.bono_logo_url}
                  alt="Logo"
                  className="h-20 w-20 rounded-xl object-contain"
                  crossOrigin="anonymous"
                />
              )}
              <div>
                <p className="text-lg font-black uppercase tracking-[.25em]" style={{ color: accent }}>
                  {raffle.bono_title || "BONO"}
                </p>
                <h1 className="mt-1 text-4xl font-black leading-tight">
                  {raffle.bono_subtitle || raffle.nombre}
                </h1>
              </div>
            </div>
            <div className="mt-5 flex flex-wrap gap-x-7 gap-y-2 text-lg">
              <span><strong>Lote:</strong> {batch.name || batch.code}</span>
              <span><strong>Responsable:</strong> {responsibleName}</span>
              <span><strong>Valor:</strong> {formatCOP(raffle.valor_boleta)}</span>
              {raffle.fecha_sorteo && <span><strong>Sorteo:</strong> {formatDate(raffle.fecha_sorteo)}</span>}
              {raffle.loteria && <span><strong>Lotería:</strong> {raffle.loteria}</span>}
            </div>
            <p className="mt-4 text-base text-slate-600">
              Cada bono participa con dos números de tres cifras. Elige una dupla disponible.
            </p>
          </div>
          <div className="flex flex-col items-center justify-center rounded-3xl bg-[#fff5db] p-5 text-center">
            {raffle.bono_prize_image_url ? (
              <img
                src={raffle.bono_prize_image_url}
                alt={raffle.bono_prize_name || "Premio"}
                className="h-40 w-full object-contain"
                crossOrigin="anonymous"
              />
            ) : null}
            <p className="mt-3 text-sm font-bold uppercase tracking-wider" style={{ color: accent }}>
              Premio
            </p>
            <strong className="mt-1 text-xl">{raffle.bono_prize_name || "Premio especial"}</strong>
          </div>
        </header>

        <div className="border-y px-10 py-5" style={{ borderColor: `${accent}55` }}>
          <div className="flex items-center justify-between text-lg font-bold">
            <span>{ordered.length} bonos en este lote</span>
            <span>{available} disponibles</span>
          </div>
        </div>

        <section className="grid grid-cols-5 gap-3 p-10">
          {ordered.map((bono) => {
            const numbers = [...(bono.raffle_bono_numbers ?? [])]
              .sort((a, b) => a.option_number - b.option_number)
              .map((item) => padBonoNumber(item.numero));
            const unavailable = unavailableStatuses.has(bono.status);
            return (
              <div
                key={bono.id}
                className={`relative overflow-hidden rounded-2xl border-2 bg-white p-4 text-center ${
                  unavailable ? "opacity-55" : "shadow-sm"
                }`}
                style={{ borderColor: unavailable ? "#cbd5e1" : `${accent}99` }}
              >
                <div className="flex items-center justify-between gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                  <span>Bono {padBonoNumber(bono.serial)}</span>
                  <span>{unavailable ? bono.status : "disponible"}</span>
                </div>
                <div className="mt-3 flex items-center justify-center gap-2">
                  {numbers.map((number, index) => (
                    <div key={`${bono.id}-${index}`} className="min-w-0 flex-1">
                      <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                        Opción {index + 1}
                      </div>
                      <div className="mt-1 text-3xl font-black tracking-wider" style={{ color: numberColor }}>
                        {number}
                      </div>
                    </div>
                  ))}
                </div>
                {unavailable && (
                  <div className="pointer-events-none absolute inset-0 grid place-items-center bg-white/25">
                    <span className="-rotate-12 rounded border-2 border-slate-700 px-3 py-1 text-sm font-black uppercase text-slate-700">
                      {bono.status}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </section>

        <footer className="px-10 py-5 text-center text-lg font-bold text-white" style={{ background: accent }}>
          {raffle.bono_footer_text || "¡Gracias por apoyar nuestra misión!"}
        </footer>
      </div>
    );
  },
);
BonoBatchCard.displayName = "BonoBatchCard";
