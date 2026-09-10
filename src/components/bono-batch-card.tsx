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
  bono_prize_image_data_url?: string | null;
  bono_logo_url?: string | null;
  bono_logo_data_url?: string | null;
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
  exportMode?: boolean;
  onSelectBono?: (bono: BatchBono) => void;
};

const unavailableStatuses = new Set(["reservado", "vendido", "pagado", "anulado"]);

export const BonoBatchCard = forwardRef<HTMLDivElement, BonoBatchCardProps>(
  ({ raffle, batch, responsibleName, bonos, exportMode = false, onSelectBono }, ref) => {
    const accent = raffle.bono_accent_color || "#B8860B";
    const numberColor = raffle.bono_number_color || "#C51B1B";
    const ordered = [...bonos].sort((a, b) => a.serial - b.serial);
    const available = ordered.filter((bono) => !unavailableStatuses.has(bono.status)).length;
    const prizeImage = exportMode
      ? raffle.bono_prize_image_data_url || raffle.bono_prize_image_url
      : raffle.bono_prize_image_url;
    const logoImage = exportMode
      ? raffle.bono_logo_data_url || raffle.bono_logo_url
      : raffle.bono_logo_url;

    return (
      <div
        ref={ref}
        className={`mx-auto overflow-hidden bg-[#fffaf0] text-slate-950 ${
          exportMode ? "w-[1200px]" : "w-full max-w-full rounded-2xl"
        }`}
        style={{ border: `${exportMode ? 10 : 4}px solid ${accent}` }}
      >
        <header
          className={
            exportMode
              ? "grid grid-cols-[1fr_300px] gap-8 bg-white px-10 py-8"
              : "grid gap-5 bg-white p-4 sm:p-6 md:grid-cols-[1fr_220px]"
          }
        >
          <div className="min-w-0">
            <div className="flex items-center gap-3 sm:gap-5">
              {logoImage && (
                <img
                  src={logoImage}
                  alt="Logo"
                  className={exportMode ? "h-20 w-20 rounded-xl object-contain" : "h-14 w-14 rounded-xl object-contain sm:h-16 sm:w-16"}
                />
              )}
              <div className="min-w-0">
                <p
                  className={exportMode ? "text-lg font-black uppercase tracking-[.25em]" : "text-xs font-black uppercase tracking-[.22em] sm:text-sm"}
                  style={{ color: accent }}
                >
                  {raffle.bono_title || "BONO"}
                </p>
                <h1 className={exportMode ? "mt-1 text-4xl font-black leading-tight" : "mt-1 break-words text-xl font-black leading-tight sm:text-2xl"}>
                  {raffle.bono_subtitle || raffle.nombre}
                </h1>
              </div>
            </div>
            <div className={exportMode ? "mt-5 flex flex-wrap gap-x-7 gap-y-2 text-lg" : "mt-4 grid gap-1 text-sm sm:grid-cols-2 sm:text-base"}>
              <span><strong>Lote:</strong> {batch.name || batch.code}</span>
              <span><strong>Responsable:</strong> {responsibleName}</span>
              <span><strong>Valor:</strong> {formatCOP(raffle.valor_boleta)}</span>
              {raffle.fecha_sorteo && <span><strong>Sorteo:</strong> {formatDate(raffle.fecha_sorteo)}</span>}
              {raffle.loteria && <span><strong>Lotería:</strong> {raffle.loteria}</span>}
            </div>
            <p className={exportMode ? "mt-4 text-base text-slate-600" : "mt-3 text-sm text-slate-600"}>
              Cada bono participa con dos números de tres cifras. Elige una dupla disponible.
            </p>
          </div>
          <div className="flex min-w-0 flex-col items-center justify-center rounded-3xl bg-[#fff5db] p-4 text-center">
            {prizeImage ? (
              <img
                src={prizeImage}
                alt={raffle.bono_prize_name || "Premio"}
                className={exportMode ? "h-40 w-full object-contain" : "h-32 w-full object-contain sm:h-36"}
              />
            ) : (
              <div className={exportMode ? "flex h-40 w-full items-center justify-center rounded-2xl border border-dashed border-amber-300 bg-white/70 px-5 text-center text-2xl font-black text-slate-700" : "hidden"}>
                {raffle.bono_prize_name || "Premio especial"}
              </div>
            )}
            <p className="mt-3 text-xs font-bold uppercase tracking-wider" style={{ color: accent }}>
              Premio
            </p>
            <strong className={exportMode ? "mt-1 text-xl" : "mt-1 text-base sm:text-lg"}>{raffle.bono_prize_name || "Premio especial"}</strong>
          </div>
        </header>

        <div className={exportMode ? "border-y px-10 py-5" : "border-y px-4 py-3 sm:px-6"} style={{ borderColor: `${accent}55` }}>
          <div className={exportMode ? "flex items-center justify-between text-lg font-bold" : "flex flex-wrap items-center justify-between gap-2 text-sm font-bold sm:text-base"}>
            <span>{ordered.length} bonos en este lote</span>
            <span>{available} disponibles</span>
          </div>
        </div>

        <section className={exportMode ? "grid grid-cols-5 gap-3 p-10" : "grid grid-cols-2 gap-2 p-3 sm:grid-cols-3 sm:gap-3 sm:p-5 lg:grid-cols-4"}>
          {ordered.map((bono) => {
            const numbers = [...(bono.raffle_bono_numbers ?? [])]
              .sort((a, b) => a.option_number - b.option_number)
              .map((item) => padBonoNumber(item.numero));
            const unavailable = unavailableStatuses.has(bono.status);
            const clickable = !exportMode && !unavailable && Boolean(onSelectBono);
            const className = `relative overflow-hidden rounded-2xl border-2 bg-white text-center transition ${
              exportMode ? "p-4" : "p-3"
            } ${unavailable ? "opacity-55" : "shadow-sm"} ${clickable ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-md active:scale-[.99]" : ""}`;
            const content = (
              <>
                <div className="flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wide text-slate-500 sm:text-xs">
                  <span>Bono {padBonoNumber(bono.serial)}</span>
                  <span>{unavailable ? bono.status : "disponible"}</span>
                </div>
                <div className="mt-2 flex items-center justify-center gap-2 sm:mt-3">
                  {numbers.map((number, index) => (
                    <div key={`${bono.id}-${index}`} className="min-w-0 flex-1">
                      <div className="text-[9px] font-black uppercase tracking-wider text-slate-500 sm:text-[10px]">
                        Opción {index + 1}
                      </div>
                      <div className={exportMode ? "mt-1 text-3xl font-black tracking-wider" : "mt-1 text-xl font-black tracking-wider sm:text-2xl"} style={{ color: numberColor }}>
                        {number}
                      </div>
                    </div>
                  ))}
                </div>
                {unavailable && (
                  <div className="pointer-events-none absolute inset-0 grid place-items-center bg-white/25">
                    <span className="-rotate-12 rounded border-2 border-slate-700 px-2 py-1 text-[10px] font-black uppercase text-slate-700 sm:text-xs">
                      {bono.status}
                    </span>
                  </div>
                )}
              </>
            );
            return clickable ? (
              <button
                type="button"
                key={bono.id}
                className={className}
                style={{ borderColor: `${accent}99` }}
                onClick={() => onSelectBono?.(bono)}
                aria-label={`Ver bono ${padBonoNumber(bono.serial)}`}
              >
                {content}
              </button>
            ) : (
              <div
                key={bono.id}
                className={className}
                style={{ borderColor: unavailable ? "#cbd5e1" : `${accent}99` }}
              >
                {content}
              </div>
            );
          })}
        </section>

        <footer className={exportMode ? "px-10 py-5 text-center text-lg font-bold text-white" : "px-4 py-4 text-center text-sm font-bold text-white sm:text-base"} style={{ background: accent }}>
          {raffle.bono_footer_text || "¡Gracias por apoyar nuestra misión!"}
        </footer>
      </div>
    );
  },
);
BonoBatchCard.displayName = "BonoBatchCard";
