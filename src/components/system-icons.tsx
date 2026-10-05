import type { ComponentType } from "react";

import {
  IconBriefcase,
  IconCalendar,
  IconCard,
  IconCatalog,
  IconContact,
  IconFacebook,
  IconGlobe,
  IconGoogle,
  IconInstagram,
  IconLink,
  IconLinkedIn,
  IconMail,
  IconMapPin,
  IconMenu,
  IconMonitor,
  IconNote,
  IconPhone,
  IconPinterest,
  IconStar,
  IconStore,
  IconTelegram,
  IconTikTok,
  IconWhatsApp,
  IconWifi,
  IconX,
  IconYouTube,
} from "@/components/icons";
import type { SystemIconKey } from "@/lib/card/icon-catalog";

/**
 * Desenho de cada ícone do catálogo (`lib/card/icon-catalog.ts`). O tipo
 * `Record` faz o TypeScript recusar um ícone novo no catálogo sem desenho.
 */
export const SYSTEM_ICON_COMPONENTS: Record<SystemIconKey, ComponentType<{ className?: string }>> = {
  whatsapp: IconWhatsApp,
  phone: IconPhone,
  email: IconMail,
  telegram: IconTelegram,
  contact: IconContact,
  instagram: IconInstagram,
  facebook: IconFacebook,
  linkedin: IconLinkedIn,
  tiktok: IconTikTok,
  youtube: IconYouTube,
  x: IconX,
  pinterest: IconPinterest,
  globe: IconGlobe,
  link: IconLink,
  briefcase: IconBriefcase,
  monitor: IconMonitor,
  catalog: IconCatalog,
  menu: IconMenu,
  store: IconStore,
  calendar: IconCalendar,
  star: IconStar,
  google: IconGoogle,
  card: IconCard,
  lock: IconWifi,
  "map-pin": IconMapPin,
  note: IconNote,
};
