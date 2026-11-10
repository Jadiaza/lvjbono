import { forwardRef, useEffect, useState, type ForwardedRef } from "react";
import { padBonoNumber } from "@/lib/bono-domain";

export type DualBonoCardData = {
  serial: number;
  verification_code?: string;
  numbers: [number, number] | number[];
  status?: string;
  raffle: {
    raffle_mode?: string;
    digitos?: number;
    bono_numbers_per_ticket?: number;
    nombre: string;
    fecha_sorteo?: string | null;
    loteria?: string | null;
    valor_boleta?: number | null;
    bono_title?: string | null;
    bono_subtitle?: string | null;
    bono_prize_name?: string | null;
    bono_prize_description?: string | null;
    bono_prize_dimensions?: string | null;
    bono_prize_value?: number | null;
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
  "ENERO",
  "FEBRERO",
  "MARZO",
  "ABRIL",
  "MAYO",
  "JUNIO",
  "JULIO",
  "AGOSTO",
  "SEPTIEMBRE",
  "OCTUBRE",
  "NOVIEMBRE",
  "DICIEMBRE",
];

function drawParts(value?: string | null) {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  return { day: String(day), month: MONTHS[month - 1], year: String(year) };
}

function NumberPanel({
  label,
  value,
  color,
  digits,
}: {
  label: string;
  value: number;
  color: string;
  digits: number;
}) {
  return (
    <div className="overflow-hidden rounded-[clamp(.35rem,.8vw,.65rem)] border border-[#5b331b]/50 bg-white/94 shadow-md">
      <div className="bg-[#4b2814] px-1 py-[1.15%] text-center text-[clamp(.24rem,.46vw,.39rem)] font-black uppercase tracking-[.08em] text-white">
        {label}
      </div>
      <div className="grid grid-cols-3 gap-[2.8%] px-[6.4%] py-[2.2%]">
        {padBonoNumber(value, digits)
          .split("")
          .map((digit, index) => (
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

function MaterialTwoDigitCard({
  bono,
  verifyUrl,
  statusDisplay,
  forwardedRef,
}: {
  bono: DualBonoCardData;
  verifyUrl?: string;
  statusDisplay: StatusDisplay;
  forwardedRef: ForwardedRef<HTMLDivElement>;
}) {
  const raffle = bono.raffle;
  const accent = raffle.bono_accent_color || "#B8860B";
  const numberColor = raffle.bono_number_color || "#C51B1B";
  const prizeImage = raffle.bono_prize_image_data_url || raffle.bono_prize_image_url;
  const logoImage = raffle.bono_logo_data_url || raffle.bono_logo_url;
  const number = padBonoNumber(bono.numbers[0] ?? 0, 2);
  const date = dateLabel(raffle.fecha_sorteo, raffle.loteria);
  const qrUrl =
    verifyUrl && raffle.bono_show_qr !== false
      ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(verifyUrl)}`
      : null;

  return (
    <div
      ref={forwardedRef}
      className="relative mx-auto w-full overflow-hidden rounded-3xl border bg-[#fbf7eb] text-[#352319] shadow-xl md:grid md:min-h-[410px] md:grid-cols-[1.05fr_.95fr_.68fr]"
      style={{ borderColor: accent }}
    >
      <section className="flex min-w-0 flex-col border-b border-[#b99452]/50 p-5 sm:p-7 md:border-b-0 md:border-r">
        <header className="flex items-center justify-center gap-3 text-center">
          {logoImage && (
            <img src={logoImage} alt="Logo" className="h-10 max-w-16 object-contain sm:h-12" />
          )}
          {raffle.bono_show_platform_branding !== false && (
            <p
              className="text-xs font-black uppercase tracking-[.28em] sm:text-sm"
              style={{ color: accent }}
            >
              RIFAYA
            </p>
          )}
        </header>
        {raffle.bono_prize_name && (
          <h2 className="mt-4 text-center font-serif text-2xl font-bold leading-tight sm:text-3xl">
            {raffle.bono_prize_name}
          </h2>
        )}
        <div className="mt-4 flex min-h-56 flex-1 items-center justify-center sm:min-h-72 md:min-h-0">
          {prizeImage ? (
            <img
              src={prizeImage}
              alt={raffle.bono_prize_name || "Premio"}
              className="max-h-[420px] min-h-48 w-full object-contain"
            />
          ) : (
            <div className="grid min-h-48 w-full place-items-center rounded-2xl border border-dashed border-[#b99452]/60 text-sm text-[#78634a]">
              Imagen del premio
            </div>
          )}
        </div>
      </section>

      <section className="min-w-0 p-5 sm:p-7">
        {(raffle.bono_title || raffle.bono_subtitle || raffle.nombre) && (
          <div className="border-b border-[#b99452]/50 pb-4 text-center">
            {raffle.bono_title && (
              <p
                className="text-xs font-black uppercase tracking-[.18em]"
                style={{ color: accent }}
              >
                {raffle.bono_title}
              </p>
            )}
            {(raffle.bono_subtitle || raffle.nombre) && (
              <h3 className="mt-1 font-serif text-xl font-bold leading-snug sm:text-2xl">
                {raffle.bono_subtitle || raffle.nombre}
              </h3>
            )}
          </div>
        )}
        <div className="space-y-4 pt-4">
          {raffle.bono_prize_description && (
            <p className="whitespace-pre-line break-words text-sm leading-relaxed text-[#59483a] sm:text-base">
              {raffle.bono_prize_description}
            </p>
          )}
          {raffle.valor_boleta != null &&
            Number.isFinite(raffle.valor_boleta) &&
            raffle.valor_boleta > 0 && (
              <div className="rounded-2xl border-2 border-[#b99452] bg-[#641f32] p-1.5 shadow-md">
                <div className="rounded-xl bg-[#f7e7bd] px-4 py-3 text-center">
                  <p className="text-xs font-black uppercase tracking-[.16em] text-[#8f6426] sm:text-sm">
                    Valor de la boleta
                  </p>
                  <p className="mt-1 font-serif text-2xl font-bold text-[#641f32] sm:text-3xl">
                    {new Intl.NumberFormat("es-CO", {
                      style: "currency",
                      currency: "COP",
                      maximumFractionDigits: 0,
                    }).format(raffle.valor_boleta)}{" "}
                    COP
                  </p>
                </div>
              </div>
            )}
          {raffle.bono_prize_dimensions && (
            <div className="border-l-2 pl-3" style={{ borderColor: accent }}>
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: accent }}>
                Características
              </p>
              <p className="mt-1 whitespace-pre-line break-words text-sm leading-relaxed">
                {raffle.bono_prize_dimensions}
              </p>
            </div>
          )}
          {date && <p className="text-sm text-[#78634a]">{date}</p>}
        </div>
      </section>

      <aside className="flex min-w-0 flex-col items-center justify-center bg-[#641f32] px-5 py-7 text-center text-[#fff9ed]">
        <p className="text-xs font-bold uppercase tracking-[.22em] text-[#e5c986]">BONO N.º</p>
        <div className="mt-3 flex gap-2" aria-label={`Número ${number}`}>
          {number.split("").map((digit, index) => (
            <span
              key={index}
              className="flex h-20 w-16 items-center justify-center rounded-xl border-2 bg-[#fff9ed] font-serif text-5xl font-bold shadow-inner sm:h-24 sm:w-20 sm:text-6xl"
              style={{ borderColor: accent, color: numberColor }}
            >
              {digit}
            </span>
          ))}
        </div>
        <p className="mt-3 text-xs text-[#f4e8d2]">Serial {padBonoNumber(bono.serial)}</p>
        {qrUrl && (
          <div className="mt-4 rounded-xl bg-white p-2">
            <img
              src={qrUrl}
              crossOrigin="anonymous"
              alt="Código QR de verificación del bono"
              width={120}
              height={120}
              className="h-24 w-24 sm:h-[120px] sm:w-[120px]"
            />
          </div>
        )}
        {verifyUrl && raffle.bono_show_qr !== false && (
          <p className="mt-2 max-w-full break-all text-[10px] text-[#f4e8d2]">
            Verificación: {verifyUrl}
          </p>
        )}
      </aside>

      {raffle.bono_footer_text && (
        <footer className="border-t border-[#b99452]/50 px-4 py-3 text-center font-serif text-sm italic text-[#59483a] md:col-span-3">
          {raffle.bono_footer_text}
        </footer>
      )}
      {statusDisplay !== "hidden" && bono.status?.toLowerCase() === "reservado" && (
        <div className="pointer-events-none absolute left-0 top-6 -rotate-12 border-y border-[#e0b45b] bg-[#8f1118]/95 px-6 py-1 text-sm font-semibold italic text-white shadow-md">
          Reservado
        </div>
      )}
    </div>
  );
}

function dateLabel(value?: string | null, loteria?: string | null) {
  const date = drawParts(value);
  if (!date) return loteria || null;
  return [`Sorteo: ${date.day} de ${date.month.toLowerCase()} de ${date.year}`, loteria]
    .filter(Boolean)
    .join(" · ");
}

type StatusDisplay = "review" | "subtle" | "hidden";

export const BonoDualCard = forwardRef<
  HTMLDivElement,
  { bono: DualBonoCardData; verifyUrl?: string; statusDisplay?: StatusDisplay }
>(({ bono, verifyUrl, statusDisplay = "subtle" }, ref) => {
  const raffle = bono.raffle;
  const [browserOrigin, setBrowserOrigin] = useState<string>();
  useEffect(() => {
    if (raffle.raffle_mode === "material_2d") setBrowserOrigin(window.location.origin);
  }, [raffle.raffle_mode]);
  if (raffle.raffle_mode === "material_2d") {
    return (
      <MaterialTwoDigitCard
        bono={bono}
        verifyUrl={
          browserOrigin && bono.verification_code
            ? `${browserOrigin}/bono/${encodeURIComponent(bono.verification_code)}`
            : undefined
        }
        statusDisplay={statusDisplay}
        forwardedRef={ref}
      />
    );
  }
  const numberColor = raffle.bono_number_color || "#C51B1B";
  const accent = raffle.bono_accent_color || "#B8860B";
  const status = bono.status?.toLowerCase() || "";
  const isReserved = status === "reservado";
  const prizeImage = raffle.bono_prize_image_data_url || raffle.bono_prize_image_url;
  const sideImage = raffle.bono_side_image_data_url || raffle.bono_side_image_url;
  const logoImage = raffle.bono_logo_data_url || raffle.bono_logo_url;
  const date = drawParts(raffle.fecha_sorteo);
  const digits = raffle.digitos === 2 ? 2 : 3;
  const numberCount = raffle.bono_numbers_per_ticket === 1 ? 1 : 2;

  return (
    <div
      ref={ref}
      className="relative aspect-[3/2] w-full overflow-hidden rounded-[1.3rem] border bg-[#f5e8ce] text-[#30190c] shadow-xl"
      style={{ borderColor: accent }}
    >
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(circle at 36% 8%, #fffdf7 0%, #f8efd9 42%, #e5c895 100%)",
        }}
      />
      <div className="relative grid h-full grid-cols-[64%_36%]">
        <section className="relative min-w-0 overflow-hidden border-r border-dashed border-[#6c4a2a]/45 px-[3%] pb-[7%] pt-[1.6%]">
          <div className="flex items-start gap-2">
            {logoImage && (
              <img src={logoImage} alt="Logo" className="max-h-10 max-w-[9%] object-contain" />
            )}
            <div className="min-w-0 flex-1 text-center">
              <div
                className="leading-[.8]"
                style={{
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  fontSize: "clamp(1.65rem,5.35vw,4.18rem)",
                  fontWeight: 700,
                }}
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
                <img
                  src={prizeImage}
                  alt={raffle.bono_prize_name || "Premio"}
                  className="h-[99%] w-full object-contain object-bottom"
                />
              ) : (
                <div className="text-xs text-[#6b5a48]">Imagen del premio</div>
              )}
            </div>
            <div className="flex min-w-0 flex-col justify-start pr-[2.4%] pt-[8%] text-left">
              <div
                className="leading-[1.06]"
                style={{
                  fontFamily: "Georgia, 'Times New Roman', serif",
                  fontSize: "clamp(.54rem,1.55vw,1.1rem)",
                  fontWeight: 700,
                }}
              >
                {raffle.bono_prize_description ||
                  `Se rifa esta hermosa ${raffle.bono_prize_name?.toLowerCase() || "cajonera archivador"}.`}
              </div>
              <OrnamentDivider />
              {raffle.bono_prize_dimensions && (
                <div
                  className="text-center leading-tight text-[#3e2415]"
                  style={{
                    fontFamily: "Georgia, 'Times New Roman', serif",
                    fontSize: "clamp(.4rem,1.02vw,.77rem)",
                    fontWeight: 700,
                  }}
                >
                  <div>Medidas</div>
                  <div>{raffle.bono_prize_dimensions}</div>
                </div>
              )}
              {date && (
                <div className="mx-auto mt-[2.2%] w-[84%] rounded-[clamp(.3rem,.75vw,.6rem)] border-2 border-[#b99249] bg-[#0b315d] px-[4%] py-[2.5%] text-center text-white shadow-md">
                  <div className="text-[clamp(.24rem,.48vw,.4rem)] font-black uppercase tracking-wide">
                    Juega el día
                  </div>
                  <div className="text-[clamp(1rem,2.7vw,2rem)] font-black leading-[.88] text-[#f6c431]">
                    {date.day}
                  </div>
                  <div className="text-[clamp(.26rem,.55vw,.44rem)] font-black uppercase">
                    de {date.month}
                  </div>
                  {raffle.loteria && (
                    <div className="mt-[1%] text-[clamp(.2rem,.4vw,.32rem)] font-bold uppercase opacity-90">
                      {raffle.loteria}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div
            className="absolute bottom-0 left-0 right-0 flex h-[7%] items-center justify-center bg-[#4d2812] px-4 text-center text-[clamp(.46rem,1vw,.78rem)] italic text-white"
            style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
          >
            {raffle.bono_footer_text || "¡Gracias por apoyar nuestra misión!"}
          </div>
        </section>

        <section className="relative min-w-0 overflow-hidden bg-[#d9a94f]">
          {sideImage ? (
            <img
              src={sideImage}
              alt="San Miguel Arcángel"
              className="absolute inset-0 h-full w-full object-cover object-top"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-b from-[#f3d79c] to-[#c98e31]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#9d681f]/25" />
          <div className="absolute inset-x-[6.2%] bottom-[3.2%] z-10 space-y-[1.7%]">
            {Array.from({ length: numberCount }, (_, index) => (
              <NumberPanel
                key={index}
                label={numberCount === 1 ? "Número" : `Opción ${index + 1}`}
                value={bono.numbers[index] ?? 0}
                color={numberColor}
                digits={digits}
              />
            ))}
            <div className="rounded-[clamp(.35rem,.8vw,.65rem)] border border-[#5b331b]/45 bg-white/95 px-[6%] py-[2.6%] text-center shadow-md">
              <span
                className="mr-3 text-[clamp(.68rem,1.55vw,1.2rem)] font-black"
                style={{ color: numberColor }}
              >
                Nº
              </span>
              <span className="text-[clamp(1.05rem,2.45vw,1.95rem)] font-black tracking-[.03em]">
                {padBonoNumber(bono.serial)}
              </span>
            </div>
            {verifyUrl && raffle.bono_show_qr !== false && (
              <div className="truncate rounded bg-white/75 px-1 text-center text-[clamp(.2rem,.38vw,.3rem)] font-semibold text-[#3f2b1b]">
                Verificación: {verifyUrl}
              </div>
            )}
          </div>
        </section>
      </div>

      {statusDisplay !== "hidden" && isReserved && (
        <div className="pointer-events-none absolute -left-[5.2%] top-[3.2%] z-30 w-[22%] -rotate-[38deg] border-y border-[#e0b45b] bg-[#8f1118]/92 py-[.55%] text-center text-[clamp(.34rem,.72vw,.62rem)] font-semibold italic tracking-[.03em] text-white shadow-md">
          Reservado
        </div>
      )}
    </div>
  );
});

BonoDualCard.displayName = "BonoDualCard";
