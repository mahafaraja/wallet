/**
 * ICON REGISTRY
 *
 * Categories and goals store an icon NAME, not a component, so records stay
 * JSON-serialisable for backup. This map is the single place a name becomes a
 * Lucide component — and the single place to audit that every icon exists.
 *
 * Lucide React is the only icon source in the app. No emoji, no generated art.
 */

import {
  ArrowLeftRight,
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  BookOpen,
  Bus,
  CircleEllipsis,
  CreditCard,
  Gift,
  HeartPulse,
  Home,
  Laptop,
  PiggyBank,
  Plane,
  PlusCircle,
  PlugZap,
  RotateCcw,
  ShieldCheck,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Sofa,
  Target,
  Tv,
  Utensils,
  Users,
  Wallet,
  Wrench,
  Car,
  Baby,
  GraduationCap,
  Landmark,
  type LucideIcon,
} from "lucide-react";

export const ICONS = {
  ArrowLeftRight,
  ArrowDownCircle,
  ArrowUpCircle,
  Banknote,
  BookOpen,
  Bus,
  Car,
  CircleEllipsis,
  CreditCard,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Landmark,
  Laptop,
  PiggyBank,
  Plane,
  PlusCircle,
  PlugZap,
  RotateCcw,
  ShieldCheck,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Sofa,
  Target,
  Tv,
  Users,
  Utensils,
  Wallet,
  Wrench,
  Baby,
} as const satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

export const ICON_NAMES = Object.keys(ICONS) as IconName[];

export function isIconName(value: string): value is IconName {
  return Object.prototype.hasOwnProperty.call(ICONS, value);
}

/** Resolve a stored icon name, falling back to a neutral mark if unknown. */
export function iconFor(name: string | null | undefined): LucideIcon {
  if (name && isIconName(name)) return ICONS[name];
  return CircleEllipsis;
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
