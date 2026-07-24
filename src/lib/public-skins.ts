export const PUBLIC_SKIN_IDS = [
  "verde-esmeralda",
  "azul-profundo",
  "purpura-real",
  "naranja-energia",
  "rojo-pasion",
  "dorado-premium",
  "turquesa-marino",
  "oscuro-moderno",
] as const;

export type PublicSkin = (typeof PUBLIC_SKIN_IDS)[number];

export const PUBLIC_SKINS: Array<{
  id: PublicSkin;
  name: string;
  description: string;
  colors: [string, string, string, string];
}> = [
  {
    id: "verde-esmeralda",
    name: "Verde Esmeralda",
    description: "Fresco, confiable y natural.",
    colors: ["#078c67", "#16ad83", "#a8ddd0", "#edf7f4"],
  },
  {
    id: "azul-profundo",
    name: "Azul Profundo",
    description: "Seguro, tecnológico y elegante.",
    colors: ["#103879", "#245dca", "#91afea", "#eff3fa"],
  },
  {
    id: "purpura-real",
    name: "Púrpura Real",
    description: "Festivo, llamativo y conectado con el cartón.",
    colors: ["#4b176c", "#70359b", "#9b67c2", "#f5f0f8"],
  },
  {
    id: "naranja-energia",
    name: "Naranja Energía",
    description: "Cálido, cercano y dinámico.",
    colors: ["#f05a00", "#ff8b12", "#fac687", "#fff4e8"],
  },
  {
    id: "rojo-pasion",
    name: "Rojo Pasión",
    description: "Intenso, urgente y emocional.",
    colors: ["#c70d18", "#f33a45", "#ff9298", "#fff0f1"],
  },
  {
    id: "dorado-premium",
    name: "Dorado Premium",
    description: "Premios, lujo y celebración.",
    colors: ["#bd8411", "#e5b54a", "#f1d797", "#fbf7ec"],
  },
  {
    id: "turquesa-marino",
    name: "Turquesa Marino",
    description: "Moderno, tropical y distintivo.",
    colors: ["#00635f", "#159a98", "#89d0cf", "#eef8f7"],
  },
  {
    id: "oscuro-moderno",
    name: "Oscuro Moderno",
    description: "Nocturno, premium y de alto contraste.",
    colors: ["#151b24", "#3b424c", "#858b92", "#eef0f2"],
  },
];

export function getPublicSkinDefinition(id: string | null | undefined) {
  return PUBLIC_SKINS.find((skin) => skin.id === id) ?? PUBLIC_SKINS[0];
}
