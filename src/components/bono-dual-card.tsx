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
  const accent = raffle.bono_accent_color || "#991B1B";
  const numberColor = raffle.bono_number_color || "#701118";
  const prizeImage = raffle.bono_prize_image_data_url || raffle.bono_prize_image_url;
  const number = padBonoNumber(bono.numbers[0] ?? 0, 2);
  const date = drawParts(raffle.fecha_sorteo);
  const qrUrl =
    verifyUrl && raffle.bono_show_qr !== false
      ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(verifyUrl)}&margin=3`
      : null;

  return (
    <div
      ref={forwardedRef}
      className="relative mx-auto w-full max-w-[1020px] select-none overflow-hidden rounded-[26px] border-[3px] border-[#c49746] bg-gradient-to-br from-[#faf4e6] via-[#f5eccf] to-[#e8d7aa] text-[#2c180e] shadow-2xl transition-all print:shadow-none"
      style={{
        boxShadow: "0 18px 40px -12px rgba(60, 20, 10, 0.28), 0 0 0 1px rgba(255, 235, 175, 0.6) inset",
      }}
    >
      {/* Filete perimetral interior dorado */}
      <div className="pointer-events-none absolute inset-[5px] rounded-[21px] border border-[#d8b065]/70" />

      {/* Grid horizontal en escritorio (proporción tipo ticket ~16:9), apilable en móvil */}
      <div className="relative grid min-h-[380px] md:min-h-[410px] md:grid-cols-[1.22fr_1.15fr_.88fr]">
        
        {/* ========================================================
            ZONA 1 (IZQUIERDA): IDENTIDAD Y FOTOGRAFÍA DEL PREMIO
           ======================================================== */}
        <section className="relative flex flex-col justify-between p-4 sm:p-5 md:pr-4">
          <div>
            {/* Header: Insignia RIFAYA con guirnaldas y cruz */}
            <div className="flex flex-col items-center text-center">
              <div className="relative inline-flex items-center justify-center">
                {/* Fondo cinta curva vino tinto con ribete dorado */}
                <div className="relative flex items-center justify-center rounded-md border border-[#f7e099] bg-gradient-to-b from-[#7f131a] via-[#630d13] to-[#48080c] px-6 py-1 shadow-md">
                  {/* Laureles / espigas ornamentales a los lados */}
                  <span className="mr-2 text-xs text-[#f1cb6e]">🌿</span>
                  <span className="font-serif text-lg font-black tracking-[0.24em] text-[#fff6db] drop-shadow-sm sm:text-xl">
                    RIFAYA
                  </span>
                  <span className="ml-2 text-xs text-[#f1cb6e]">🌿</span>
                </div>
              </div>

              {/* Título del Premio: Cursiva / Serif elegante de impacto */}
              <h1 className="mt-2 text-center font-serif text-[clamp(1.2rem,2.4vw,1.75rem)] font-extrabold italic leading-tight tracking-tight text-[#3b1216]">
                {raffle.bono_subtitle || raffle.bono_prize_name || raffle.nombre}
              </h1>

              {/* Banner / Ribete dorado: "2 libros" u opción secundaria */}
              <div className="mt-1 inline-flex items-center justify-center">
                <span className="rounded-full border border-[#ca9e4b] bg-gradient-to-r from-[#e8ad38] via-[#f7cb68] to-[#e8ad38] px-4 py-0.5 font-serif text-xs font-black tracking-wide text-[#421b06] shadow-xs">
                  {raffle.bono_prize_dimensions || "2 libros"}
                </span>
              </div>
            </div>

            {/* Fotografía del Premio (Libros reales con alta nitidez) */}
            <div className="relative mt-2.5 flex min-h-[190px] items-center justify-center overflow-hidden rounded-2xl border border-[#cfa55b]/50 bg-gradient-to-b from-white/70 via-white/40 to-transparent p-2 shadow-inner sm:min-h-[220px]">
              {prizeImage ? (
                <img
                  src={prizeImage}
                  alt={raffle.bono_prize_name || "Premio"}
                  className="max-h-[260px] w-full object-contain drop-shadow-xl transition-transform duration-300 hover:scale-105"
                  crossOrigin="anonymous"
                  loading="eager"
                  decoding="async"
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-1.5 p-4 text-center text-[#73512b]">
                  <span className="text-3xl">📖</span>
                  <p className="text-xs font-semibold">Fotografía del premio</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Separador vertical sutil entre Zona 1 y Zona 2 */}
        <div className="hidden md:block absolute left-[37.5%] top-4 bottom-12 w-px border-r border-dashed border-[#bfa060]/50" />

        {/* ========================================================
            ZONA 2 (CENTRAL): DESCRIPCIÓN, PRECIO Y DATOS DEL SORTEO
           ======================================================== */}
        <section className="relative flex flex-col justify-between p-4 sm:p-5 md:px-5">
          <div>
            {/* Ornamento superior: Biblia abierta con cruz dorada radiante */}
            <div className="flex justify-center text-[#9a6f23]">
              <div className="flex items-center gap-1.5 opacity-90">
                <span className="text-xs">✦</span>
                <span className="font-serif text-lg leading-none">📖 ✟</span>
                <span className="text-xs">✦</span>
              </div>
            </div>

            {/* Descripción breve (máximo 3 líneas) */}
            <p className="mt-1.5 text-center text-[clamp(0.72rem,1.15vw,0.85rem)] font-medium leading-relaxed text-[#4a3221]">
              {raffle.bono_prize_description
                ? raffle.bono_prize_description.length > 175
                  ? `${raffle.bono_prize_description.slice(0, 172)}…`
                  : raffle.bono_prize_description
                : "Un kit de formación y crecimiento espiritual para fortalecer tu fe, profundizar en la oración y crecer en tu relación con Dios."}
            </p>

            {/* BLOQUE DESTACADO: VALOR DE LA BOLETA */}
            {raffle.valor_boleta != null && Number.isFinite(raffle.valor_boleta) && raffle.valor_boleta > 0 && (
              <div className="mt-3.5 overflow-hidden rounded-2xl border-2 border-[#caa050] bg-gradient-to-r from-[#6e1219] via-[#5c0e14] to-[#6e1219] p-1 shadow-lg">
                <div className="relative flex items-center justify-between rounded-xl border border-[#ecc476]/50 bg-gradient-to-b from-[#5c0e14] to-[#45080c] px-3.5 py-2 text-white">
                  {/* Icono de boleto / ticket en relieve */}
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#e8c072]/60 bg-[#7d1720] shadow-inner text-base">
                    🎟️
                  </div>
                  <div className="flex-1 text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#eed494] drop-shadow-xs">
                      VALOR DE LA BOLETA
                    </p>
                    <p className="font-serif text-xl font-black tracking-tight text-[#fffdfa] sm:text-2xl drop-shadow-sm">
                      {new Intl.NumberFormat("es-CO", {
                        style: "currency",
                        currency: "COP",
                        maximumFractionDigits: 0,
                      }).format(raffle.valor_boleta)}{" "}
                      <span className="text-xs font-extrabold text-[#f5d78e]">COP</span>
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* FICHA TÉCNICA Y DATOS DEL SORTEO CON ICONOS */}
            <div className="mt-3.5 space-y-2 border-t border-[#caa050]/40 pt-2.5 text-xs text-[#3b2719]">
              {/* Características */}
              {raffle.bono_prize_dimensions && (
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-[#caa050]/50 bg-white/60 text-[11px]">
                    📖
                  </span>
                  <div className="min-w-0">
                    <span className="block text-[9.5px] font-black uppercase tracking-wider text-[#825c27]">
                      CARACTERÍSTICAS
                    </span>
                    <span className="block truncate text-xs font-semibold text-[#2f1b0f]">
                      {raffle.bono_prize_dimensions}
                    </span>
                  </div>
                </div>
              )}

              {/* Fecha de sorteo */}
              {date && (
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-[#caa050]/50 bg-white/60 text-[11px]">
                    📅
                  </span>
                  <div className="min-w-0">
                    <span className="block text-[9.5px] font-black uppercase tracking-wider text-[#825c27]">
                      SORTEO
                    </span>
                    <span className="block truncate text-xs font-semibold text-[#2f1b0f]">
                      {date.day} de {date.month.toLowerCase()} de {date.year}
                    </span>
                  </div>
                </div>
              )}

              {/* Lotería */}
              {raffle.loteria && (
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded border border-[#caa050]/50 bg-white/60 text-[11px]">
                    🎡
                  </span>
                  <div className="min-w-0">
                    <span className="block text-[9.5px] font-black uppercase tracking-wider text-[#825c27]">
                      LOTERÍA
                    </span>
                    <span className="block truncate text-xs font-semibold text-[#2f1b0f]">
                      {raffle.loteria}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ========================================================
            ZONA 3 (DERECHA): TALONARIO VINO TINTO CON NÚMERO Y QR
           ======================================================== */}
        <aside className="relative flex flex-col items-center justify-between overflow-hidden border-t-2 border-dashed border-[#d8b065] bg-gradient-to-b from-[#640f16] via-[#52090f] to-[#3d0408] p-4 text-center text-[#fff9ed] shadow-2xl md:border-t-0 md:border-l-2">
          {/* Muescas circulares de corte estilo ticket */}
          <div className="hidden md:block absolute -top-3.5 -left-3.5 h-7 w-7 rounded-full border border-[#c49746] bg-[#fbf8f1]" />
          <div className="hidden md:block absolute -bottom-3.5 -left-3.5 h-7 w-7 rounded-full border border-[#c49746] bg-[#fbf8f1]" />

          {/* Etiqueta superior curvada "BONO N.º" */}
          <div className="w-full">
            <div className="mx-auto inline-flex items-center justify-center rounded-full border border-[#f0cc78] bg-black/25 px-5 py-0.5 shadow-sm">
              <span className="font-serif text-xs font-black uppercase tracking-[0.24em] text-[#f7dc96]">
                BONO N.º
              </span>
            </div>

            {/* Dos dígitos grandes, elegantes y centrados en casillas de marfil */}
            <div className="mt-3 flex justify-center gap-2" aria-label={`Número ${number}`}>
              {number.split("").map((digit, index) => (
                <div
                  key={index}
                  className="relative flex h-20 w-16 items-center justify-center rounded-2xl border-2 border-[#e8c072] bg-gradient-to-b from-[#ffffff] via-[#fffbf2] to-[#faedd0] shadow-xl sm:h-22 sm:w-18"
                  style={{
                    boxShadow: "inset 0 2px 4px rgba(255,255,255,0.9), 0 8px 18px rgba(0,0,0,0.45)",
                  }}
                >
                  <span
                    className="font-serif text-5xl font-black leading-none text-[#5e0a11] sm:text-6xl drop-shadow-xs"
                    style={{ color: numberColor }}
                  >
                    {digit}
                  </span>
                </div>
              ))}
            </div>

            {/* Serial con viñetas estilizadas */}
            <div className="mt-2.5 inline-flex items-center gap-2 text-xs font-bold tracking-wider text-[#f8e5b6]">
              <span className="text-[10px] text-[#cca050]">❖</span>
              <span>Serial {padBonoNumber(bono.serial)}</span>
              <span className="text-[10px] text-[#cca050]">❖</span>
            </div>
          </div>

          {/* Código QR y texto verificador */}
          <div className="mt-3 w-full">
            {qrUrl && (
              <div className="mx-auto flex w-fit flex-col items-center rounded-2xl border-2 border-[#ecc77a] bg-white p-2 shadow-xl">
                <img
                  src={qrUrl}
                  crossOrigin="anonymous"
                  alt="Código QR de verificación del bono"
                  width={112}
                  height={112}
                  className="h-24 w-24 rounded-lg object-contain sm:h-26 sm:w-26"
                  loading="eager"
                  decoding="async"
                />
              </div>
            )}

            <div className="mt-2 flex items-center justify-center gap-1.5 text-center text-[10px] font-semibold text-[#f5deaa]">
              <span className="text-xs text-[#eed494]">🔗</span>
              <span>Escanea y verifica tu bono</span>
            </div>
          </div>
        </aside>
      </div>

      {/* ========================================================
          FRANJA INFERIOR: MENSAJE DE AGRADECIMIENTO ELEGANTE
         ======================================================== */}
      <footer className="relative flex h-9 items-center justify-center border-t-2 border-[#caa050] bg-gradient-to-r from-[#4d070d] via-[#6e1219] to-[#4d070d] px-4 text-center shadow-inner">
        {/* Ribete dorado decorativo */}
        <div className="flex items-center gap-3">
          <span className="h-px w-10 bg-gradient-to-r from-transparent to-[#f0cc78]" />
          <p className="font-serif text-xs font-bold italic tracking-wider text-[#fff3d4] sm:text-sm drop-shadow-xs">
            {raffle.bono_footer_text || "¡Gracias por apoyar!"}
          </p>
          <span className="h-px w-10 bg-gradient-to-l from-transparent to-[#f0cc78]" />
        </div>
      </footer>

      {/* Sello de reservado cuando aplique */}
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
