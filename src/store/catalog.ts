import type { CardStyle, Category, WalletKind, CardPattern } from "./types";

/**
 * Chart palette: muted, evenly weighted hues. Colour is used only for data
 * (charts, the small key dot next to a category) — never to decorate icons.
 */
export const CHART_COLORS = [
  "#FF6A3D",
  "#E9A23B",
  "#5DB98A",
  "#4E9FD1",
  "#8E7CE3",
  "#D06AA2",
  "#45B3A8",
  "#C8B25A",
  "#D9805F",
  "#7A90B8",
  "#9BB06A",
  "#B88AD4"
];

export const OTHER_COLOR = "#7C7C84";

export const DEFAULT_EXPENSE_CATEGORIES: Array<Omit<Category, "kind">> = [
  { id: "c-groceries", name: "Продукты", icon: "ShoppingBasket", color: CHART_COLORS[0] },
  { id: "c-cafe", name: "Кафе и рестораны", icon: "Coffee", color: CHART_COLORS[1] },
  { id: "c-transport", name: "Транспорт", icon: "TramFront", color: CHART_COLORS[3] },
  { id: "c-taxi", name: "Такси", icon: "CarTaxiFront", color: CHART_COLORS[9] },
  { id: "c-car", name: "Автомобиль", icon: "Car", color: CHART_COLORS[7] },
  { id: "c-home", name: "Дом и ЖКХ", icon: "House", color: CHART_COLORS[2] },
  { id: "c-connect", name: "Связь и интернет", icon: "Wifi", color: CHART_COLORS[6] },
  { id: "c-subs", name: "Подписки", icon: "Repeat", color: CHART_COLORS[4] },
  { id: "c-health", name: "Здоровье", icon: "HeartPulse", color: CHART_COLORS[5] },
  { id: "c-sport", name: "Спорт", icon: "Dumbbell", color: CHART_COLORS[10] },
  { id: "c-shopping", name: "Покупки", icon: "ShoppingBag", color: CHART_COLORS[8] },
  { id: "c-clothes", name: "Одежда", icon: "Shirt", color: CHART_COLORS[11] },
  { id: "c-fun", name: "Развлечения", icon: "Ticket", color: CHART_COLORS[4] },
  { id: "c-travel", name: "Путешествия", icon: "Plane", color: CHART_COLORS[3] },
  { id: "c-education", name: "Образование", icon: "GraduationCap", color: CHART_COLORS[6] },
  { id: "c-gifts", name: "Подарки", icon: "Gift", color: CHART_COLORS[5] },
  { id: "c-beauty", name: "Красота", icon: "Sparkles", color: CHART_COLORS[11] },
  { id: "c-pets", name: "Питомцы", icon: "PawPrint", color: CHART_COLORS[7] },
  { id: "c-other", name: "Прочее", icon: "CircleDashed", color: OTHER_COLOR }
];

export const DEFAULT_INCOME_CATEGORIES: Array<Omit<Category, "kind">> = [
  { id: "i-salary", name: "Зарплата", icon: "BriefcaseBusiness", color: CHART_COLORS[2] },
  { id: "i-freelance", name: "Фриланс", icon: "Laptop", color: CHART_COLORS[3] },
  { id: "i-invest", name: "Проценты и дивиденды", icon: "TrendingUp", color: CHART_COLORS[6] },
  { id: "i-cashback", name: "Кешбэк", icon: "BadgePercent", color: CHART_COLORS[1] },
  { id: "i-gifts", name: "Подарки", icon: "Gift", color: CHART_COLORS[5] },
  { id: "i-sale", name: "Продажа вещей", icon: "Tag", color: CHART_COLORS[7] },
  { id: "i-other", name: "Прочее", icon: "CircleDashed", color: OTHER_COLOR }
];

export function defaultCategories(): Category[] {
  return [
    ...DEFAULT_EXPENSE_CATEGORIES.map((c) => ({ ...c, kind: "expense" as const })),
    ...DEFAULT_INCOME_CATEGORIES.map((c) => ({ ...c, kind: "income" as const }))
  ];
}

/** Icons offered when creating a category */
export const CATEGORY_ICON_CHOICES = [
  "ShoppingBasket", "Coffee", "UtensilsCrossed", "Pizza", "Wine", "TramFront", "Bus", "CarTaxiFront", "Car", "Fuel",
  "House", "Lightbulb", "Wifi", "Smartphone", "Repeat", "HeartPulse", "Pill", "Dumbbell", "ShoppingBag", "Shirt",
  "Ticket", "Clapperboard", "Gamepad2", "Plane", "Hotel", "GraduationCap", "BookOpen", "Gift", "Sparkles", "Scissors",
  "PawPrint", "Baby", "Wrench", "Sofa", "Music", "Tv", "Cloud", "BriefcaseBusiness", "Laptop", "TrendingUp",
  "BadgePercent", "Tag", "Coins", "HandCoins", "Landmark", "Receipt", "Package", "Flower2", "Leaf", "CircleDashed"
];

export const GOAL_ICON_CHOICES = ["Target", "House", "Car", "Plane", "LifeBuoy", "GraduationCap", "Laptop", "Gem", "Baby", "Mountain", "Sofa", "Gift"];

export const WALLET_KINDS: Array<{ kind: WalletKind; label: string; icon: string }> = [
  { kind: "card", label: "Банковская карта", icon: "CreditCard" },
  { kind: "cash", label: "Наличные", icon: "Banknote" },
  { kind: "savings", label: "Накопления", icon: "PiggyBank" },
  { kind: "bank", label: "Банковский счёт", icon: "Landmark" },
  { kind: "investment", label: "Инвестиции", icon: "ChartCandlestick" },
  { kind: "other", label: "Другое", icon: "Wallet" }
];

export function walletKindInfo(kind: WalletKind) {
  return WALLET_KINDS.find((k) => k.kind === kind) ?? WALLET_KINDS[5];
}

export interface CardMaterial {
  id: CardStyle;
  /** Line-work drawn on the card (default: the sail) */
  pattern?: CardPattern;
  name: string;
  /** Card surface */
  background: string;
  /** Text on the card */
  ink: string;
  inkMuted: string;
  /** Fine line-work */
  line: string;
  /** Small swatch for pickers */
  swatch: string;
  /** Ambient light the card casts on the page around it */
  glow: string;
  light?: boolean;
}

/**
 * A lit slab: a soft specular highlight from the top-left, a shadowed
 * lower-right corner and a three-stop body gradient.
 */
function lit(from: string, mid: string, to: string, spec: number): string {
  return [
    `radial-gradient(130% 95% at 0% 0%, rgba(255,255,255,${spec}), transparent 52%)`,
    "radial-gradient(90% 70% at 100% 100%, rgba(0,0,0,0.32), transparent 70%)",
    `linear-gradient(155deg, ${from} 0%, ${mid} 46%, ${to} 100%)`
  ].join(", ");
}

/** Card colours in the Ardessa palette: the brand red, blacks and greys, a deep wine, paper white. */
export const CARD_MATERIALS: CardMaterial[] = [
  {
    id: "ardessa",
    name: "Ardessa",
    background: lit("#ff3b46", "#df0714", "#5e0206", 0.24),
    ink: "#FFF7F6",
    inkMuted: "rgba(255,247,246,0.72)",
    line: "rgba(255,255,255,0.14)",
    swatch: "#df0714",
    glow: "rgba(250,7,23,0.42)"
  },
  {
    id: "obsidian",
    name: "Обсидиан",
    background: lit("#1d1d20", "#0d0d0f", "#020203", 0.1),
    ink: "#F6F5F3",
    inkMuted: "rgba(246,245,243,0.56)",
    line: "rgba(250,7,23,0.22)",
    swatch: "#0f0f11",
    glow: "rgba(250,7,23,0.16)"
  },
  {
    id: "graphite",
    name: "Графит",
    background: lit("#3a3a40", "#232327", "#111113", 0.13),
    ink: "#F6F5F3",
    inkMuted: "rgba(246,245,243,0.58)",
    line: "rgba(255,255,255,0.085)",
    swatch: "#2a2a2f",
    glow: "rgba(160,160,175,0.20)"
  },
  {
    id: "titanium",
    name: "Титан",
    background: lit("#a19d96", "#6a6762", "#33322e", 0.3),
    ink: "#FCFBF9",
    inkMuted: "rgba(252,251,249,0.7)",
    line: "rgba(255,255,255,0.12)",
    swatch: "#76736e",
    glow: "rgba(205,198,188,0.22)"
  },
  {
    id: "bordeaux",
    name: "Бордо",
    background: lit("#86202b", "#4f0d15", "#1c0306", 0.18),
    ink: "#FFF5F5",
    inkMuted: "rgba(255,245,245,0.64)",
    line: "rgba(255,255,255,0.1)",
    swatch: "#5c111a",
    glow: "rgba(170,25,45,0.34)"
  },
  {
    id: "ivory",
    name: "Белая",
    background: lit("#fbfaf6", "#ece8df", "#d6d0c4", 0.9),
    ink: "#16140F",
    inkMuted: "rgba(22,20,15,0.58)",
    line: "rgba(250,7,23,0.09)",
    swatch: "#ece8df",
    glow: "rgba(255,244,220,0.22)",
    light: true
  }
];

/** Retired colours from earlier versions, shown as their nearest current one. */
const RETIRED: Partial<Record<CardStyle, CardStyle>> = {
  ember: "ardessa",
  sand: "titanium",
  midnight: "obsidian",
  forest: "graphite",
  plum: "bordeaux"
};

/** The overview card: sumi black with a low vermilion sun. */
export const TOTAL_MATERIAL: CardMaterial = {
  id: "graphite",
  name: "Все счета",
  background: [
    // follows the chosen accent colour
    "radial-gradient(75% 65% at 92% 108%, color-mix(in srgb, var(--accent) 42%, transparent), color-mix(in srgb, var(--accent) 8%, transparent) 55%, transparent 75%)",
    "radial-gradient(130% 95% at 0% 0%, rgba(255,255,255,0.11), transparent 52%)",
    "linear-gradient(155deg, #26262a 0%, #141416 48%, #08080a 100%)"
  ].join(", "),
  ink: "#F6F5F3",
  inkMuted: "rgba(246,245,243,0.56)",
  line: "rgba(255,255,255,0.07)",
  swatch: "#1a1a1d",
  glow: "color-mix(in srgb, var(--accent) 30%, transparent)"
};

/** A card in any colour: the same lit slab, built from one hex. */
/** Colours a goal can wear. */
export const GOAL_COLORS = ["#fa0717", "#ff7a59", "#f0b14e", "#3cc896", "#2bb3c0", "#5b8cff", "#8e7ce3", "#e879b9"];

export function customMaterial(hex: string): CardMaterial {
  const v = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) / 255);
  const light = 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.62;
  return {
    id: "graphite",
    name: "Свой цвет",
    background: lit(`color-mix(in srgb, ${hex} 78%, white)`, hex, `color-mix(in srgb, ${hex} 45%, black)`, light ? 0.6 : 0.22),
    ink: light ? "#16140F" : "#FFFAF6",
    inkMuted: light ? "rgba(22,20,15,0.58)" : "rgba(255,250,246,0.7)",
    line: light ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.13)",
    swatch: hex,
    glow: `color-mix(in srgb, ${hex} 35%, transparent)`,
    light
  };
}

/** The look of a wallet's card: its colour (or own colour) and its pattern. */
export function materialFor(w: { style: CardStyle; customColor?: string; pattern?: CardPattern }): CardMaterial {
  const base = w.customColor ? customMaterial(w.customColor) : materialOf(w.style);
  return w.pattern ? { ...base, pattern: w.pattern } : base;
}

export function materialOf(style: CardStyle): CardMaterial {
  const id = RETIRED[style] ?? style;
  return CARD_MATERIALS.find((m) => m.id === id) ?? CARD_MATERIALS[0];
}
