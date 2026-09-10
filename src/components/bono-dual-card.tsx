import { forwardRef } from "react";
import { padBonoNumber } from "@/lib/bono-domain";

export type DualBonoCardData = {
  serial: number;
  verification_code?: string;
  numbers: [number, number] | number[];
  status?: string;
  raffle: {
    nombre: string;
    fecha_sorteo?: string | null;
    loteria?: string | null;
    valor_boleta?: number;
    bono_title?: string | null;
    bono_subtitle?: string | null;
    bono_prize_name?: string | null;
    bono_prize_description?: string | null;
    bono_prize_dimensions?: string | null;
    bono_prize_image_url?: string | null;
    bono_side_image_url?: string | null;
    bono_logo_url?: string | null;
    bono_number_color?: string | null;
    bono_accent_color?: string | null;
    bono_footer_text?: string | null;
    bono_show_qr?: boolean;
    bono_show_platform_branding?: boolean;
  };
};

export const BonoDualCard = forwardRef<
  HTMLDivElement,
  { bono: DualBonoCardData; verifyUrl?: string }
>(({ bono, verifyUrl }, ref) => {
  const raffle = bono.raffle;
  const numberColor = raffle.bono_number_color || "#C51B1B";
  const accent = raffle.bono_accent_color || "#C51B1B";
  const isReserved = bono.status?.toLowerCase() === "reservado";

  return (
    <div
      ref={ref}
      className="relative aspect-[1.72/1] w-full overflow-hidden rounded-2xl border bg-white text-slate-900 shadow-xl"
      style={{ borderColor: accent }}
    >
      <div className="grid h-[88%] grid-cols-[3fr_2fr]">
        <section className="flex min-w-0 flex-col p-[4%]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div
                className="text-[clamp(1rem,3vw,2rem)] font-black tracking-[0.18em]"
                style={{ color: accent }}
              >
                {raffle.bono_title || "BONO"}
              </div>
              <div className="mt-1 text-[clamp(.55rem,1.3vw,.95rem)] font-semibold">
                {raffle.bono_subtitle || raffle.nombre}
              </div>
            </div>
            {raffle.bono_logo_url && (
              <img
                src={raffle.bono_logo_url}
                alt="Logo"
                crossOrigin="anonymous"
                referrerPolicy="no-referrer"
                className="h-[12%] max-h-14 max-w-[24%] object-contain"
              />
            )}
          </div>
          <div className="mt-3 grid min-h-0 flex-1 grid-cols-[1.15fr_1fr] gap-4">
            <div className="flex items-center justify-center overflow-hidden rounded-xl bg-slate-100">
              {raffle.bono_prize_image_url ? (
                <img
                  src={raffle.bono_prize_image_url}
                  alt={raffle.bono_prize_name || "Premio"}
                  crossOrigin="anonymous"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="px-3 text-center text-xs text-slate-400">
                  Imagen del premio opcional
                </span>
              )}
            </div>
            <div className="flex flex-col justify-center text-[clamp(.5rem,1.15vw,.85rem)]">
              <strong className="text-[clamp(.7rem,1.5vw,1.1rem)]">
                {raffle.bono_prize_name || "Premio"}
              </strong>
              {raffle.bono_prize_description && (
                <p className="mt-1">{raffle.bono_prize_description}</p>
              )}
              {raffle.bono_prize_dimensions && (
                <p className="mt-1 font-medium">{raffle.bono_prize_dimensions}</p>
              )}
              {raffle.fecha_sorteo && (
                <p className="mt-3">
                  <strong>Sorteo:</strong> {raffle.fecha_sorteo}
                </p>
              )}
              {raffle.loteria && (
                <p>
                  <strong>Lotería:</strong> {raffle.loteria}
                </p>
              )}
            </div>
          </div>
        </section>
        <section
          className="relative flex flex-col items-center justify-center overflow-hidden border-l p-[5%] text-center"
          style={{ borderColor: accent, background: `${accent}10` }}
        >
          {raffle.bono_side_image_url && (
            <img
              src={raffle.bono_side_image_url}
              alt=""
              crossOrigin="anonymous"
              referrerPolicy="no-referrer"
              className="absolute inset-0 h-full w-full object-cover opacity-15"
            />
          )}
          <div className="relative z-10 w-full">
            {[0, 1].map((index) => (
              <div key={index} className={index ? "mt-[6%]" : ""}>
                <div className="text-[clamp(.5rem,1.2vw,.8rem)] font-black tracking-[.2em]">
                  OPCIÓN {index + 1}
                </div>
                <div
                  className="mt-1 text-[clamp(1.6rem,5vw,3.7rem)] font-black leading-none tracking-[.16em]"
                  style={{ color: numberColor }}
                >
                  {padBonoNumber(bono.numbers[index] ?? 0)
                    .split("")
                    .join(" ")}
                </div>
              </div>
            ))}
            <div className="mt-[8%] text-[clamp(.65rem,1.5vw,1rem)] font-black">
              BONO Nº {padBonoNumber(bono.serial)}
            </div>
            {bono.status && (
              <div
                className="mt-1 text-[clamp(.45rem,1vw,.7rem)] font-bold uppercase"
                style={{ color: accent }}
              >
                {bono.status}
              </div>
            )}
            {raffle.bono_show_qr !== false && verifyUrl && (
              <div className="mx-auto mt-2 max-w-[80%] break-all rounded border border-slate-300 bg-white/80 p-1 text-[clamp(.35rem,.7vw,.55rem)]">
                Verificar
                <br />
                {verifyUrl}
              </div>
            )}
          </div>
        </section>
      </div>
      <footer
        className="flex h-[12%] items-center justify-center px-4 text-center text-[clamp(.5rem,1.1vw,.8rem)] font-semibold text-white"
        style={{ background: accent }}
      >
        {raffle.bono_footer_text || "¡Gracias por apoyar nuestra misión!"}
        {raffle.bono_show_platform_branding !== false && (
          <span className="ml-2 opacity-75">· Rifaya</span>
        )}
      </footer>

      {isReserved && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center overflow-hidden">
          <div className="-rotate-[24deg] border-y-[5px] border-red-700/80 bg-white/75 px-[14%] py-[1.5%] text-[clamp(1.4rem,5vw,4rem)] font-black uppercase tracking-[0.18em] text-red-700/85 shadow-sm backdrop-blur-[1px]">
            RESERVADO
          </div>
        </div>
      )}
    </div>
  );
});
BonoDualCard.displayName = "BonoDualCard";
