/**
 * ICON REGISTRY
 *
 * Categories and goals store an icon NAME, not a component, so records stay
 * JSON-serialisable for backup. This map is the single place a name becomes a
 * Lucide component — and the single place to audit that every icon exists.
 *
 * Lucide React is the only icon source in the app. No emoji, no generated art,
 * no hand-drawn SVG illustrations.
 *
 * WEIGHT DISCIPLINE
 * -----------------
 * Each entry is registered through sfIcon() with a deliberate stroke weight on
 * the SF Symbols scale, so the register documents why an icon looks the way it
 * does rather than leaving it to whatever a call site happened to pass:
 *
 *   medium    category and goal glyphs. They sit beside a 15px label inside a
 *             tinted tile, so they need enough density to read as the focal
 *             point of that tile.
 *   regular   never used here directly; the default for inline text symbols.
 */

import Icon, { type SFWeight } from "@/design/Icon";
import * as Lucide from "lucide-react";

type IconFactoryProps = {
  className?: string;
  strokeWidth?: number;
  style?: React.CSSProperties;
};

/** Create a named app icon with a fixed SF Symbols weight. */
function make(name: keyof typeof Lucide, weight: SFWeight = "medium") {
  const Cmp = Lucide[name] as Lucide.LucideIcon;
  return function AppIcon({ className, strokeWidth, style }: IconFactoryProps) {
    return (
      <Icon
        icon={Cmp}
        weight={weight}
        className={className}
        strokeWidth={strokeWidth}
        style={style}
      />
    );
  };
}

/* ---- Category and goal glyphs -------------------------------------------
 * Weight "medium": these appear inside a tinted tile next to a small label, so
 * they carry the tile. */
export const BanknoteIcon = make("Banknote");
export const ShoppingBasketIcon = make("ShoppingBasket");
export const UtensilsIcon = make("Utensils");
export const BusIcon = make("Bus");
export const SmartphoneIcon = make("Smartphone");
export const HomeIcon = make("Home");
export const PlugZapIcon = make("PlugZap");
export const HeartPulseIcon = make("HeartPulse");
export const BookOpenIcon = make("BookOpen");
export const SofaIcon = make("Sofa");
export const ShirtIcon = make("Shirt");
export const TvIcon = make("Tv");
export const PiggyBankIcon = make("PiggyBank");
export const UsersIcon = make("Users");
export const GiftIcon = make("Gift");
export const LaptopIcon = make("Laptop");
export const PlaneIcon = make("Plane");
export const CarIcon = make("Car");
export const WrenchIcon = make("Wrench");
export const BabyIcon = make("Baby");
export const GraduationCapIcon = make("GraduationCap");
export const ShieldCheckIcon = make("ShieldCheck");
export const TargetIcon = make("Target");
export const LandmarkIcon = make("Landmark");
export const CreditCardIcon = make("CreditCard");
export const CircleEllipsisIcon = make("CircleEllipsis");
export const WalletIcon = make("Wallet");
export const ArrowLeftRightIcon = make("ArrowLeftRight");
export const ArrowUpCircleIcon = make("ArrowUpCircle");
export const ArrowDownCircleIcon = make("ArrowDownCircle");
export const PlusCircleIcon = make("PlusCircle");
export const RotateCcwIcon = make("RotateCcw");

/* ---- Icon name registry --------------------------------------------------
 * The keys here are what gets persisted on Category.icon and SavingsGoal.icon.
 * Keep the list exhaustive and alphabetised — it is the on-disk contract. */
export const ICONS = {
  ArrowLeftRight: Lucide.ArrowLeftRight,
  ArrowDownCircle: Lucide.ArrowDownCircle,
  ArrowUpCircle: Lucide.ArrowUpCircle,
  Baby: Lucide.Baby,
  Banknote: Lucide.Banknote,
  BookOpen: Lucide.BookOpen,
  Bus: Lucide.Bus,
  Car: Lucide.Car,
  CircleEllipsis: Lucide.CircleEllipsis,
  CreditCard: Lucide.CreditCard,
  Gift: Lucide.Gift,
  GraduationCap: Lucide.GraduationCap,
  HeartPulse: Lucide.HeartPulse,
  Home: Lucide.Home,
  Landmark: Lucide.Landmark,
  Laptop: Lucide.Laptop,
  PiggyBank: Lucide.PiggyBank,
  Plane: Lucide.Plane,
  PlusCircle: Lucide.PlusCircle,
  PlugZap: Lucide.PlugZap,
  RotateCcw: Lucide.RotateCcw,
  ShieldCheck: Lucide.ShieldCheck,
  Shirt: Lucide.Shirt,
  ShoppingBasket: Lucide.ShoppingBasket,
  Smartphone: Lucide.Smartphone,
  Sofa: Lucide.Sofa,
  Target: Lucide.Target,
  Tv: Lucide.Tv,
  Users: Lucide.Users,
  Utensils: Lucide.Utensils,
  Wallet: Lucide.Wallet,
  Wrench: Lucide.Wrench,
} as const satisfies Record<string, Lucide.LucideIcon>;

export type IconName = keyof typeof ICONS;

export const ICON_NAMES = Object.keys(ICONS) as IconName[];

export function isIconName(value: string): value is IconName {
  return Object.prototype.hasOwnProperty.call(ICONS, value);
}

/** Resolve a stored icon name, falling back to a neutral mark if unknown. */
export function iconFor(name: string | null | undefined): Lucide.LucideIcon {
  if (name && isIconName(name)) return ICONS[name];
  return Lucide.CircleEllipsis;
}

/** Icons offered when creating or editing a category or goal. */
export const PICKER_ICONS: IconName[] = [
  "Banknote",
  "ShoppingBasket",
  "Utensils",
  "Bus",
  "Smartphone",
  "Home",
  "PlugZap",
  "HeartPulse",
  "BookOpen",
  "Sofa",
  "Shirt",
  "Tv",
  "PiggyBank",
  "Users",
  "Gift",
  "Laptop",
  "Plane",
  "Car",
  "Wrench",
  "Baby",
  "GraduationCap",
  "ShieldCheck",
  "Target",
  "Landmark",
  "CreditCard",
  "CircleEllipsis",
];

export { Icon };
export { SF_WEIGHTS, SF_SIZES, SF_WEIGHT_LABELS, SF_TEXT_SIZE } from "@/design/Icon";
export type { SFWeight, SFSize } from "@/design/Icon";
