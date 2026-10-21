import type { CardStyle, Category, WalletKind } from "./types";

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
  light?: boolean;
}

export const CARD_MATERIALS: CardMaterial[] = [
  {
    id: "graphite",
    name: "Графит",
    background:
      "radial-gradient(120% 90% at 0% 0%, rgba(255,255,255,0.10), transparent 55%), linear-gradient(150deg, #2b2b30 0%, #19191c 48%, #0e0e10 100%)",
    ink: "#F6F6F7",
    inkMuted: "rgba(246,246,247,0.56)",
    line: "rgba(255,255,255,0.06)",
    swatch: "#26262a"
  },
  {
    id: "ember",
    name: "Жар",
    background:
      "radial-gradient(120% 90% at 0% 0%, rgba(255,255,255,0.16), transparent 55%), linear-gradient(150deg, #ff6a3a 0%, #d6431a 45%, #6e1c08 100%)",
    ink: "#FFF7F3",
    inkMuted: "rgba(255,247,243,0.66)",
    line: "rgba(255,255,255,0.09)",
    swatch: "#e04d22"
  },
  {
    id: "titanium",
    name: "Титан",
    background:
      "radial-gradient(120% 90% at 0% 0%, rgba(255,255,255,0.18), transparent 55%), linear-gradient(150deg, #8d8a85 0%, #5d5b57 48%, #34332f 100%)",
    ink: "#FBFAF8",
    inkMuted: "rgba(251,250,248,0.66)",
    line: "rgba(255,255,255,0.08)",
    swatch: "#76736e"
  },
  {
    id: "midnight",
    name: "Полночь",
    background:
      "radial-gradient(120% 90% at 0% 0%, rgba(160,180,255,0.14), transparent 55%), linear-gradient(150deg, #22305a 0%, #141c38 48%, #0a0e1d 100%)",
    ink: "#F3F5FF",
    inkMuted: "rgba(243,245,255,0.6)",
    line: "rgba(255,255,255,0.07)",
    swatch: "#1d2a50"
  },
  {
    id: "forest",
    name: "Лес",
    background:
      "radial-gradient(120% 90% at 0% 0%, rgba(190,255,220,0.12), transparent 55%), linear-gradient(150deg, #23463a 0%, #15302a 48%, #0b1a16 100%)",
    ink: "#F2FAF6",
    inkMuted: "rgba(242,250,246,0.6)",
    line: "rgba(255,255,255,0.07)",
    swatch: "#1f4035"
  },
  {
    id: "plum",
    name: "Слива",
    background:
      "radial-gradient(120% 90% at 0% 0%, rgba(255,200,240,0.12), transparent 55%), linear-gradient(150deg, #4a2a4f 0%, #2d1832 48%, #160b19 100%)",
    ink: "#FBF3FC",
    inkMuted: "rgba(251,243,252,0.6)",
    line: "rgba(255,255,255,0.07)",
    swatch: "#432647"
  },
  {
    id: "sand",
    name: "Песок",
    background:
      "radial-gradient(120% 90% at 0% 0%, rgba(255,255,255,0.22), transparent 55%), linear-gradient(150deg, #cdb08a 0%, #a5865e 50%, #6f5536 100%)",
    ink: "#FFFBF5",
    inkMuted: "rgba(255,251,245,0.72)",
    line: "rgba(255,255,255,0.1)",
    swatch: "#b8986d"
  },
  {
    id: "ivory",
    name: "Слоновая кость",
    background:
      "radial-gradient(120% 90% at 0% 0%, rgba(255,255,255,0.9), transparent 55%), linear-gradient(150deg, #f6f3ec 0%, #e8e3d8 55%, #d6d0c3 100%)",
    ink: "#141412",
    inkMuted: "rgba(20,20,18,0.55)",
    line: "rgba(0,0,0,0.06)",
    swatch: "#ece7dc",
    light: true
  }
];

export const TOTAL_MATERIAL: CardMaterial = {
  id: "graphite",
  name: "Все счета",
  background:
    "radial-gradient(90% 70% at 100% 110%, rgba(255,90,46,0.22), transparent 60%), radial-gradient(120% 90% at 0% 0%, rgba(255,255,255,0.09), transparent 55%), linear-gradient(150deg, #222226 0%, #131315 50%, #09090a 100%)",
  ink: "#F6F6F7",
  inkMuted: "rgba(246,246,247,0.56)",
  line: "rgba(255,255,255,0.055)",
  swatch: "#1a1a1d"
};

export function materialOf(style: CardStyle): CardMaterial {
  return CARD_MATERIALS.find((m) => m.id === style) ?? CARD_MATERIALS[0];
}
