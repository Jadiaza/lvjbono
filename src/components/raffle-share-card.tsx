import { forwardRef } from "react";
import { formatCOP, formatDate, padNumber } from "@/lib/format";
import type { PublicSkin } from "@/lib/public-skins";

type ShareRaffle = {
  nombre: string;
  serie: string | null;
  digitos: number;
  valor_boleta: number;
  fecha_sorteo: string | null;
  loteria: string | null;
  premio_mayor: number;
  premio_seco1: number;
  premio_seco2: number;
  premio_aprox_ant: number;
  premio_aprox_pos: number;
  public_skin: PublicSkin;
};

type ShareTicket = {
  numero: number;
  estado: string;
};

const SKINS = {
  "verde-esmeralda": {
    background: "linear-gradient(145deg, #effaf6, #ffffff 58%, #cdece2)",
    panel: "#ffffff",
    panelText: "#18263d",
    brand: "#078c67",
    brandText: "#ffffff",
    heroText: "#18263d",
    muted: "#edf3f1",
    line: "#aab9b4",
    prizePanel: "#f4fbf8",
    prizeText: "#18263d",
  },
  "azul-profundo": {
    background: "linear-gradient(145deg, #eef3fc, #ffffff 58%, #cfddf6)",
    panel: "#ffffff",
    panelText: "#15223b",
    brand: "#103879",
    brandText: "#ffffff",
    heroText: "#15223b",
    muted: "#edf1f8",
    line: "#aab7ce",
    prizePanel: "#f4f7fd",
    prizeText: "#15223b",
  },
  "purpura-real": {
    background: "linear-gradient(145deg, #12001f, #3d0758 60%, #190028)",
    panel: "#fff9ef",
    panelText: "#1d1539",
    brand: "#ffc400",
    brandText: "#25102f",
    heroText: "#ffffff",
    muted: "#f2e9dc",
    line: "#766d83",
    prizePanel: "rgba(20, 5, 30, .72)",
    prizeText: "#ffffff",
  },
  "naranja-energia": {
    background: "linear-gradient(145deg, #fff3e7, #ffffff 58%, #fbd5ac)",
    panel: "#ffffff",
    panelText: "#302117",
    brand: "#f05a00",
    brandText: "#ffffff",
    heroText: "#302117",
    muted: "#f8eee5",
    line: "#d0b9a7",
    prizePanel: "#fff8ef",
    prizeText: "#302117",
  },
  "rojo-pasion": {
    background: "linear-gradient(145deg, #fff0f1, #ffffff 58%, #ffd3d6)",
    panel: "#ffffff",
    panelText: "#30181b",
    brand: "#c70d18",
    brandText: "#ffffff",
    heroText: "#30181b",
    muted: "#f8e8e9",
    line: "#d1b0b3",
    prizePanel: "#fff5f5",
    prizeText: "#30181b",
  },
  "dorado-premium": {
    background: "linear-gradient(145deg, #fbf6e8, #ffffff 58%, #f0dfb5)",
    panel: "#ffffff",
    panelText: "#302817",
    brand: "#bd8411",
    brandText: "#ffffff",
    heroText: "#302817",
    muted: "#f5efe1",
    line: "#c8baa0",
    prizePanel: "#fffaf0",
    prizeText: "#302817",
  },
  "turquesa-marino": {
    background: "linear-gradient(145deg, #eaf8f7, #ffffff 58%, #bfe8e6)",
    panel: "#ffffff",
    panelText: "#14302f",
    brand: "#00635f",
    brandText: "#ffffff",
    heroText: "#14302f",
    muted: "#e5f2f1",
    line: "#9ebfbd",
    prizePanel: "#f1fbfa",
    prizeText: "#14302f",
  },
  "oscuro-moderno": {
    background: "linear-gradient(145deg, #0d0814, #24102e 60%, #120b18)",
    panel: "#f8f2e7",
    panelText: "#201628",
    brand: "#d9a72e",
    brandText: "#1b121f",
    heroText: "#ffffff",
    muted: "#e8dfd0",
    line: "#756b7b",
    prizePanel: "#151b24",
    prizeText: "#ffffff",
  },
} satisfies Record<PublicSkin, Record<string, string>>;

const PRIZES = [
  { label: "Premio Mayor", field: "premio_mayor" },
  { label: "Seco 1", field: "premio_seco1" },
  { label: "Seco 2", field: "premio_seco2" },
  { label: "Aprox. anterior", field: "premio_aprox_ant" },
  { label: "Aprox. posterior", field: "premio_aprox_pos" },
] as const;

export const RaffleShareCard = forwardRef<
  HTMLDivElement,
  { raffle: ShareRaffle; tickets: ShareTicket[] }
>(({ raffle, tickets }, ref) => {
  const skin = SKINS[raffle.public_skin] ?? SKINS["purpura-real"];
  const digits = (raffle.digitos === 3 ? 3 : 2) as 2 | 3;
  const columns = digits === 3 ? 20 : 10;
  const totalPrizes = PRIZES.reduce((sum, prize) => sum + raffle[prize.field], 0);

  return (
    <div
      ref={ref}
      style={{
        width: 1200,
        minHeight: digits === 3 ? 1780 : 800,
        padding: 28,
        color: skin.heroText,
        background: skin.background,
        fontFamily: "Inter, Arial, sans-serif",
        border: `8px solid ${skin.brand}`,
        boxShadow: `inset 0 0 0 3px ${skin.line}`,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "270px 1fr 330px",
          gap: 20,
          marginBottom: 22,
        }}
      >
        <aside
          style={{
            borderRadius: 22,
            padding: 24,
            background: skin.panel,
            color: skin.panelText,
          }}
        >
          <p style={{ margin: 0, fontSize: 16, fontWeight: 800, textTransform: "uppercase" }}>
            Fecha del sorteo
          </p>
          <p style={{ margin: "12px 0 28px", fontSize: 24, fontWeight: 900 }}>
            {formatDate(raffle.fecha_sorteo)}
          </p>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 800, textTransform: "uppercase" }}>
            Lotería
          </p>
          <p style={{ margin: "12px 0 28px", fontSize: 21, fontWeight: 800 }}>
            {raffle.loteria || "Por definir"}
          </p>
          <div
            style={{
              borderRadius: 16,
              padding: 18,
              textAlign: "center",
              color: skin.brandText,
              background: skin.brand,
            }}
          >
            <p style={{ margin: 0, fontSize: 14, fontWeight: 800, textTransform: "uppercase" }}>
              Valor boleta
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 34, fontWeight: 950 }}>
              {formatCOP(raffle.valor_boleta)}
            </p>
          </div>
          {raffle.serie && (
            <p style={{ margin: "22px 0 0", fontSize: 18, fontWeight: 900 }}>
              Serie: {raffle.serie}
            </p>
          )}
        </aside>

        <div
          style={{
            position: "relative",
            display: "flex",
            minHeight: 345,
            flexDirection: "column",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0.2,
              background:
                "repeating-conic-gradient(from 10deg at 50% 55%, #ffffff 0 4deg, transparent 4deg 12deg)",
              borderRadius: 24,
            }}
          />
          <div
            style={{
              position: "relative",
              alignSelf: "center",
              width: 118,
              height: 118,
              marginBottom: 10,
              overflow: "hidden",
              border: `3px solid ${skin.brand}`,
              borderRadius: 24,
              background: "#ffffff",
              boxShadow: "0 12px 30px rgba(0,0,0,.18)",
            }}
          >
            <img
              src="/brand/rifaya-logo.png"
              alt="Rifaya"
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          </div>
          <p
            style={{
              position: "relative",
              margin: 0,
              fontSize: 46,
              lineHeight: 0.98,
              fontWeight: 950,
              letterSpacing: -2,
              textTransform: "uppercase",
              textShadow:
                raffle.public_skin === "purpura-real" || raffle.public_skin === "oscuro-moderno"
                  ? "0 4px 0 #180020, 0 8px 25px rgba(0,0,0,.35)"
                  : "0 8px 25px rgba(30,20,40,.12)",
            }}
          >
            {raffle.nombre}
          </p>
          <p
            style={{
              position: "relative",
              alignSelf: "center",
              margin: "20px 0 0",
              borderRadius: 999,
              padding: "10px 24px",
              color: skin.brandText,
              background: skin.brand,
              fontSize: 22,
              fontWeight: 950,
              textTransform: "uppercase",
            }}
          >
            {10 ** digits} números · {padNumber(0, digits)} al {padNumber(10 ** digits - 1, digits)}
          </p>
          <p style={{ position: "relative", margin: "16px 0 0", fontSize: 20, fontWeight: 800 }}>
            ¡Participa, elige tu número y gana!
          </p>
        </div>

        <aside
          style={{
            border: `2px solid ${skin.brand}`,
            borderRadius: 22,
            padding: 16,
            color: skin.prizeText,
            background: skin.prizePanel,
          }}
        >
          <p
            style={{
              margin: "0 0 12px",
              color: skin.brand,
              fontSize: 28,
              fontWeight: 950,
              textAlign: "center",
              textTransform: "uppercase",
            }}
          >
            Premios
          </p>
          {PRIZES.map((prize, index) => (
            <div
              key={prize.field}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 125px",
                overflow: "hidden",
                marginTop: 7,
                borderRadius: 10,
                background: "#fffaf1",
                color: "#20172f",
              }}
            >
              <span
                style={{
                  padding: "9px 10px",
                  fontSize: 13,
                  fontWeight: 850,
                  textTransform: "uppercase",
                }}
              >
                {prize.label}
              </span>
              <strong
                style={{
                  padding: "9px 6px",
                  color: skin.brandText,
                  background: `color-mix(in srgb, ${skin.brand} ${100 - index * 8}%, ${skin.panel})`,
                  fontSize: 17,
                  textAlign: "center",
                }}
              >
                {formatCOP(raffle[prize.field])}
              </strong>
            </div>
          ))}
          <p style={{ margin: "15px 0 0", fontSize: 19, fontWeight: 950, textAlign: "center" }}>
            Total: <span style={{ color: skin.brand }}>{formatCOP(totalPrizes)}</span>
          </p>
        </aside>
      </div>

      <div
        style={{
          borderRadius: 22,
          padding: 18,
          color: skin.panelText,
          background: skin.panel,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap: digits === 3 ? 3 : 5,
          }}
        >
          {tickets.map((ticket) => {
            const status = {
              disponible: { bg: skin.panel, color: skin.panelText, opacity: 1 },
              reservado: {
                bg: `color-mix(in srgb, ${skin.brand} 42%, ${skin.panel})`,
                color: skin.panelText,
                opacity: 1,
              },
              vendido: {
                bg: `color-mix(in srgb, ${skin.brand} 16%, ${skin.panel})`,
                color: skin.panelText,
                opacity: 0.72,
              },
              ganador: { bg: skin.brand, color: skin.brandText, opacity: 1 },
            }[ticket.estado] ?? { bg: skin.muted, color: skin.panelText, opacity: 1 };
            return (
              <div
                key={ticket.numero}
                style={{
                  display: "grid",
                  minHeight: digits === 3 ? 27 : 42,
                  placeItems: "center",
                  border: `1px solid ${skin.line}`,
                  borderRadius: digits === 3 ? 4 : 7,
                  color: status.color,
                  background: status.bg,
                  fontSize: digits === 3 ? 15 : 24,
                  fontWeight: 900,
                  opacity: status.opacity,
                  textDecoration: ticket.estado === "vendido" ? "line-through" : "none",
                }}
              >
                {padNumber(ticket.numero, digits)}
              </div>
            );
          })}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 24,
            marginTop: 14,
            fontSize: 13,
            fontWeight: 750,
          }}
        >
          <span>□ Disponible</span>
          <span style={{ color: skin.brand }}>■ Reservado</span>
          <span style={{ color: skin.muted }}>■ Vendido</span>
          <span style={{ color: skin.brand }}>■ Ganador</span>
        </div>
      </div>

      <p style={{ margin: "16px 10px 0", fontSize: 14, fontWeight: 700, textAlign: "center" }}>
        Los premios no son acumulables. Si un número gana en más de una categoría, se paga
        únicamente el premio de mayor valor.
      </p>
    </div>
  );
});

RaffleShareCard.displayName = "RaffleShareCard";
