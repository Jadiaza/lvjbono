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

const MONTHS = [
  "ENERO", "FEBRERO", "MARZO", "ABRIL", "MAYO", "JUNIO",
  "JULIO", "AGOSTO", "SEPTIEMBRE", "OCTUBRE", "NOVIEMBRE", "DICIEMBRE",
];

function drawParts(value?: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return { day: String(day), month: MONTHS[month - 1], year: String(year) };
}

function NumberPanel({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="overflow-hidden rounded-[clamp(.35rem,.8vw,.65rem)] border border-[#5b331b]/50 bg-white/94 shadow-md">
      <div className="bg-[#4b2814] px-1 py-[1.1%] text-center text-[clamp(.24rem,.46vw,.38rem)] font-black uppercase tracking-[.08em] text-white">
        {label}
      </div>
      <div className="grid grid-cols-3 gap-[3%] px-[6%] py-[2.2%]">
        {padBonoNumber(value).split("").map((digit, index) => (
          <div
            key={index}
            className="flex aspect-[1.18/1] items-center justify-center border border-[#5b331b]/45 bg-white font-black leading-none shadow-inner"
            style={{ color, fontSize: "clamp(.64rem,1.55vw,1.28rem)" }}
          >
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
    const date = drawParts(raffle.fecha_sorteo);

    return (
      <div
        ref={ref}
        className="relative aspect-[3/2] w-full overflow-hidden rounded-[1.3rem] border bg-[#f5e8ce] text-[#30190c] shadow-xl"
        style={{ borderColor: accent }}
      >
        <div
          className="absolute inset-0"
          style={{ background: "radial-gradient(circle at 36% 8%, #fffdf7 0%, #f8efd9 42%, #e5c895 100%)" }}
        />

        <div className="relative grid h-full grid-cols-[64%_36%]">
          <section className="relative min-w-0 overflow-hidden border-r border-dashed border-[#6c4a2a]/45 px-[2.6%] pb-[7%] pt-[1.6%]">
            <div className="flex items-start gap-2">
              {logoImage && <img src={logoImage} alt="Logo" className="max-h-10 max-w-[9%] object-contain" />}
              <div className="min-w-0 flex-1 text-center">
                <div
                  className="leading-[.82]"
                  style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "clamp(1.55rem,5.15vw,4rem)", fontWeight: 700 }}
                >
                  {raffle.bono_title || "Bono"}
                </div>
                <div
                  className="mx-auto mt-[.8%] max-w-[96%] leading-[.88]"
                  style={{
                    fontFamily: "'Brush Script MT', 'Segoe Script', 'Apple Chancery', cursive",
                    fontSize: "clamp(1.05rem,3.45vw,2.75rem)",
                    fontWeight: 500,
                  }}
                >
                  {raffle.bono_subtitle || raffle.nombre}
                </div>
              </div>
            </div>

            <div className="mt-[1.2%] grid h-[68%] grid-cols-[64%_36%] gap-[1.4%]">
              <div className="flex items-center justify-center overflow-hidden pt-[.5%]">
                {prizeImage ? (
                  <img src={prizeImage} alt={raffle.bono_prize_name || "Premio"} className="h-[102%] w-full object-contain object-center" />
                ) : (
                  <div className="text-xs text-[#6b5a48]">Imagen del premio</div>
                )}
              </div>

              <div className="flex min-w-0 flex-col justify-between pr-[2%] pb-[1.5%] text-left">
                <div
                  className="pt-[5%] leading-[1.02]"
                  style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "clamp(.65rem,1.82vw,1.38rem)", fontWeight: 700 }}
                >
                  {raffle.bono_prize_description || `Se rifa esta hermosa ${raffle.bono_prize_name?.toLowerCase() || "cajonera archivador"}.`}
                </div>

                <div className="my-[3%] flex items-center gap-1.5">
                  <span className="h-px flex-1 border-t border-dashed border-[#6c4a2a]/60" />
                  <span className="text-[#9a6a25]">✦</span>
                  <span className="h-px flex-1 border-t border-dashed border-[#6c4a2a]/60" />
                </div>

                {raffle.bono_prize_dimensions && (
                  <div className="text-center leading-tight" style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "clamp(.48rem,1.22vw,.9rem)", fontWeight: 700 }}>
                    <div>Medidas</div>
                    <div>{raffle.bono_prize_dimensions}</div>
                  </div>
                )}

                {date && (
                  <div className="mx-auto mt-[2.3%] w-[92%] -translate-y-[2%] rounded-[clamp(.3rem,.75vw,.6rem)] border-2 border-[#b99249] bg-[#0b315d] px-[4%] py-[2.4%] text-center text-white shadow-md">
                    <div className="text-[clamp(.25rem,.52vw,.42rem)] font-black uppercase tracking-wide">Juega el día</div>
                    <div className="text-[clamp(1.05rem,2.8vw,2.05rem)] font-black leading-[.9] text-[#f6c431]">{date.day}</div>
                    <div className="text-[clamp(.27rem,.58vw,.46rem)] font-black uppercase">de {date.month}</div>
                    {raffle.loteria && <div className="mt-[.5%] text-[clamp(.21rem,.4vw,.32rem)] font-bold uppercase opacity-90">{raffle.loteria}</div>}
                  </div>
                )}
              </div>
            </div>

            <div className="absolute bottom-0 left-0 right-0 flex h-[7%] items-center justify-center bg-[#4d2812] px-4 text-center text-[clamp(.46rem,1vw,.78rem)] italic text-white" style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}>
              {raffle.bono_footer_text || "¡Gracias por apoyar nuestra misión!"}
            </div>
          </section>

          <section className="relative min-w-0 overflow-hidden bg-[#d9a94f]">
            {sideImage ? (
              <img src={sideImage} alt="San Miguel Arcángel" className="absolute inset-0 h-full w-full object-cover object-top" />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-b from-[#f3d79c] to-[#c98e31]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#9d681f]/18" />

            <div className="absolute inset-x-[8%] bottom-[3%] z-10 space-y-[1.55%]">
              <NumberPanel label="Opción 1" value={bono.numbers[0] ?? 0} color={numberColor} />
              <NumberPanel label="Opción 2" value={bono.numbers[1] ?? 0} color={numberColor} />
              <div className="flex min-h-[12%] items-center justify-center rounded-[clamp(.4rem,.85vw,.72rem)] border border-[#5b331b]/45 bg-white/96 px-[6%] py-[3.2%] text-center shadow-md">
                <span className="mr-2 text-[clamp(.62rem,1.45vw,1.08rem)] font-black" style={{ color: numberColor }}>Nº</span>
                <span className="text-[clamp(.82rem,1.9vw,1.5rem)] font-black tracking-[.04em]">{padBonoNumber(bono.serial)}</span>
              </div>
              {verifyUrl && raffle.bono_show_qr !== false && (
                <div className="truncate rounded bg-white/75 px-1 text-center text-[clamp(.2rem,.38vw,.3rem)] font-semibold text-[#3f2b1b]">Verificación: {verifyUrl}</div>
              )}
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
