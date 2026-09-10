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
      <div className="bg-[#4b2814] px-1 py-[1.15%] text-center text-[clamp(.24rem,.46vw,.39rem)] font-black uppercase tracking-[.08em] text-white">
        {label}
      </div>
      <div className="grid grid-cols-3 gap-[2.8%] px-[6.4%] py-[2.2%]">
        {padBonoNumber(value).split("").map((digit, index) => (
          <div
            key={index}
            className="flex aspect-[1.18/1] items-center justify-center border border-[#5b331b]/45 bg-white font-black leading-none shadow-inner"
            style={{ color, fontSize: "clamp(.66rem,1.82vw,1.45rem)" }}
          >
            {digit}
          </div>
        ))}
      </div>
    </div>
  );
}

function OrnamentDivider() {
  return (
    <div className="my-[3.6%] flex items-center gap-2 text-[#9a6a25]">
      <span className="h-px flex-1 border-t border-dashed border-[#6c4a2a]/60" />
      <span className="text-[clamp(.6rem,1.15vw,.95rem)] leading-none">✦</span>
      <span className="h-px flex-1 border-t border-dashed border-[#6c4a2a]/60" />
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
          <section className="relative min-w-0 overflow-hidden border-r border-dashed border-[#6c4a2a]/45 px-[3%] pb-[7%] pt-[1.6%]">
            <div className="flex items-start gap-2">
              {logoImage && <img src={logoImage} alt="Logo" className="max-h-10 max-w-[9%] object-contain" />}
              <div className="min-w-0 flex-1 text-center">
                <div
                  className="leading-[.8]"
                  style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "clamp(1.65rem,5.35vw,4.18rem)", fontWeight: 700 }}
                >
                  {raffle.bono_title || "Bono"}
                </div>
                <div
                  className="mx-auto mt-[.4%] max-w-[98%] leading-[.88]"
                  style={{
                    fontFamily: "'Brush Script MT', 'Segoe Script', 'Apple Chancery', cursive",
                    fontSize: "clamp(1.08rem,3.55vw,2.82rem)",
                    fontWeight: 500,
                  }}
                >
                  {raffle.bono_subtitle || raffle.nombre}
                </div>
              </div>
            </div>

            <div className="mt-[.9%] grid h-[66%] grid-cols-[60%_40%] gap-[1.4%]">
              <div className="flex items-end justify-center overflow-hidden pb-[1%]">
                {prizeImage ? (
                  <img src={prizeImage} alt={raffle.bono_prize_name || "Premio"} className="h-[99%] w-full object-contain object-bottom" />
                ) : (
                  <div className="text-xs text-[#6b5a48]">Imagen del premio</div>
                )}
              </div>

              <div className="flex min-w-0 flex-col justify-start pr-[2.4%] pt-[8%] text-left">
                <div
                  className="leading-[1.06]"
                  style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "clamp(.54rem,1.55vw,1.1rem)", fontWeight: 700 }}
                >
                  {raffle.bono_prize_description || `Se rifa esta hermosa ${raffle.bono_prize_name?.toLowerCase() || "cajonera archivador"}.`}
                </div>

                <OrnamentDivider />

                {raffle.bono_prize_dimensions && (
                  <div className="text-center leading-tight text-[#3e2415]" style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: "clamp(.4rem,1.02vw,.77rem)", fontWeight: 700 }}>
                    <div>Medidas</div>
                    <div>{raffle.bono_prize_dimensions}</div>
                  </div>
                )}

                {date && (
                  <div className="mx-auto mt-[2.2%] w-[84%] rounded-[clamp(.3rem,.75vw,.6rem)] border-2 border-[#b99249] bg-[#0b315d] px-[4%] py-[2.5%] text-center text-white shadow-md">
                    <div className="text-[clamp(.24rem,.48vw,.4rem)] font-black uppercase tracking-wide">Juega el día</div>
                    <div className="text-[clamp(1rem,2.7vw,2rem)] font-black leading-[.88] text-[#f6c431]">{date.day}</div>
                    <div className="text-[clamp(.26rem,.55vw,.44rem)] font-black uppercase">de {date.month}</div>
                    {raffle.loteria && <div className="mt-[1%] text-[clamp(.2rem,.4vw,.32rem)] font-bold uppercase opacity-90">{raffle.loteria}</div>}
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
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#9d681f]/25" />

            <div className="absolute inset-x-[6.2%] bottom-[3.2%] z-10 space-y-[1.7%]">
              <NumberPanel label="Opción 1" value={bono.numbers[0] ?? 0} color={numberColor} />
              <NumberPanel label="Opción 2" value={bono.numbers[1] ?? 0} color={numberColor} />
              <div className="rounded-[clamp(.35rem,.8vw,.65rem)] border border-[#5b331b]/45 bg-white/95 px-[6%] py-[2.6%] text-center shadow-md">
                <span className="mr-3 text-[clamp(.68rem,1.55vw,1.2rem)] font-black" style={{ color: numberColor }}>Nº</span>
                <span className="text-[clamp(1.05rem,2.45vw,1.95rem)] font-black tracking-[.03em]">{padBonoNumber(bono.serial)}</span>
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
