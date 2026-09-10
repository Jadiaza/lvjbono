import { forwardRef } from "react";
import { padBonoNumber } from "@/lib/bono-domain";
import { formatDate } from "@/lib/format";

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
    bono_prize_image_data_url?: string | null;
    bono_side_image_url?: string | null;
    bono_side_image_data_url?: string | null;
    bono_logo_url?: string | null;
    bono_logo_data_url?: string | null;
    bono_number_color?: string | null;
    bono_accent_color?: string | null;
    bono_footer_text?: string | null;
    bono_show_qr?: boolean;
    bono_show_platform_branding?: boolean;
  };
};

function NumberPanel({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#5d3318]/40 bg-white/95 shadow-sm">
      <div className="bg-[#4d2812] px-2 py-1.5 text-center text-[clamp(.42rem,1vw,.78rem)] font-black uppercase tracking-[.08em] text-white">
        {label}
      </div>
      <div className="grid grid-cols-3 gap-1.5 p-2.5">
        {padBonoNumber(value).split("").map((digit, index) => (
          <div key={index} className="flex aspect-[.86/1] items-center justify-center border border-[#5d3318]/50 bg-white text-[clamp(1.2rem,4.6vw,3.5rem)] font-black leading-none" style={{ color }}>
            {digit}
          </div>
        ))}
      </div>
    </div>
  );
}

export const BonoDualCard = forwardRef<HTMLDivElement, { bono: DualBonoCardData; verifyUrl?: string }>(
  ({ bono, verifyUrl }, ref) => {
    const raffle = bono.raffle;
    const numberColor = raffle.bono_number_color || "#C51B1B";
    const accent = raffle.bono_accent_color || "#B8860B";
    const isReserved = bono.status?.toLowerCase() === "reservado";
    const prizeImage = raffle.bono_prize_image_data_url || raffle.bono_prize_image_url;
    const sideImage = raffle.bono_side_image_data_url || raffle.bono_side_image_url;
    const logoImage = raffle.bono_logo_data_url || raffle.bono_logo_url;
    const drawDate = raffle.fecha_sorteo ? formatDate(raffle.fecha_sorteo) : null;

    return (
      <div ref={ref} className="relative aspect-[3/2] w-full overflow-hidden rounded-[1.3rem] border bg-[#f6ead1] text-[#2f1a0d] shadow-xl" style={{ borderColor: accent }}>
        <div className="absolute inset-0" style={{ background: "radial-gradient(circle at 40% 10%, rgba(255,255,255,.96), rgba(252,244,224,.82) 38%, rgba(225,198,148,.5) 100%)" }} />

        <div className="relative grid h-full grid-cols-[64%_36%]">
          <section className="relative min-w-0 overflow-hidden border-r border-dashed border-[#5d3318]/35 px-[3%] pb-[6%] pt-[2%]">
            <div className="flex items-start gap-2">
              {logoImage && <img src={logoImage} alt="Logo" className="h-[8%] max-h-12 max-w-[10%] object-contain" />}
              <div className="min-w-0 flex-1 text-center">
                <div className="text-[clamp(1.55rem,5.5vw,4.4rem)] font-serif font-bold leading-[.8]">{raffle.bono_title || "Bono"}</div>
                <div className="mt-[.8%] text-[clamp(.95rem,3.3vw,2.6rem)] font-serif italic leading-[.95]">{raffle.bono_subtitle || raffle.nombre}</div>
              </div>
            </div>

            <div className="mt-[2.2%] grid h-[59%] grid-cols-[60%_40%] gap-[2.5%]">
              <div className="flex items-end justify-center overflow-hidden">
                {prizeImage ? <img src={prizeImage} alt={raffle.bono_prize_name || "Premio"} className="h-full w-full object-contain object-bottom" /> : <div className="text-sm text-slate-500">Imagen del premio</div>}
              </div>
              <div className="flex min-w-0 flex-col justify-center pr-[3%] text-left">
                <div className="text-[clamp(.72rem,2vw,1.55rem)] font-serif font-bold leading-tight">{raffle.bono_prize_description || `Se rifa esta hermosa ${raffle.bono_prize_name?.toLowerCase() || "cajonera archivador"}.`}</div>
                <div className="my-[7%] flex items-center gap-2"><span className="h-px flex-1 border-t border-dashed border-[#5d3318]/55" /><span className="text-[#8b5b20]">✦</span><span className="h-px flex-1 border-t border-dashed border-[#5d3318]/55" /></div>
                {raffle.bono_prize_dimensions && <div className="text-center text-[clamp(.58rem,1.55vw,1.15rem)] font-serif font-bold leading-tight"><div>Medidas</div><div>{raffle.bono_prize_dimensions}</div></div>}
                {drawDate && <div className="mt-[8%] rounded-xl border-2 border-[#b08a44] bg-[#0d315b] px-[5%] py-[4%] text-center text-white shadow-sm"><div className="text-[clamp(.42rem,.95vw,.75rem)] font-black uppercase">Juega el día</div><div className="text-[clamp(1.05rem,3vw,2.5rem)] font-black leading-none">{drawDate}</div>{raffle.loteria && <div className="mt-1 text-[clamp(.36rem,.75vw,.58rem)] font-bold uppercase">{raffle.loteria}</div>}</div>}
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 flex h-[7%] items-center justify-center bg-[#4d2812] px-4 text-center text-[clamp(.48rem,1.05vw,.82rem)] font-serif italic text-white">
              {raffle.bono_footer_text || "¡Gracias por apoyar nuestra misión!"}
            </div>
          </section>

          <section className="relative flex min-w-0 flex-col overflow-hidden px-[5%] pb-[4%] pt-[3%]">
            {sideImage && <img src={sideImage} alt="San Miguel Arcángel" className="absolute inset-0 h-full w-full object-cover" />}
            <div className="absolute inset-0 bg-gradient-to-b from-[#f4d99f]/20 via-[#f2d8a4]/8 to-[#c68c2e]/20" />
            <div className="relative z-10 mt-auto space-y-[4%]">
              <NumberPanel label="Opción 1" value={bono.numbers[0] ?? 0} color={numberColor} />
              <NumberPanel label="Opción 2" value={bono.numbers[1] ?? 0} color={numberColor} />
              <div className="rounded-lg border border-[#5d3318]/35 bg-white/95 px-[5%] py-[3%] text-left shadow-sm">
                <span className="mr-2 text-[clamp(.8rem,2vw,1.55rem)] font-black" style={{ color: numberColor }}>Nº</span>
                <span className="text-[clamp(.8rem,2vw,1.55rem)] font-black">{padBonoNumber(bono.serial)}</span>
              </div>
              {verifyUrl && raffle.bono_show_qr !== false && <div className="truncate text-center text-[clamp(.3rem,.55vw,.45rem)] font-semibold text-[#3f2b1b]">Verificación: {verifyUrl}</div>}
            </div>
          </section>
        </div>

        {isReserved && (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center overflow-hidden">
            <div className="-rotate-[24deg] border-y-[5px] border-red-700/80 bg-white/75 px-[14%] py-[1.5%] text-[clamp(1.5rem,5vw,4.2rem)] font-black uppercase tracking-[0.18em] text-red-700/85 shadow-sm backdrop-blur-[1px]">RESERVADO</div>
          </div>
        )}
      </div>
    );
  },
);
BonoDualCard.displayName = "BonoDualCard";
