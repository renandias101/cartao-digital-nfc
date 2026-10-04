import type { ReactNode } from "react";

/**
 * Ícones de traço simples, desenhados inline — mesmo padrão do login, sem
 * biblioteca de ícones (nenhuma dependência nova, zero requisição de rede).
 * Sempre decorativos: o texto ao lado ou o `aria-label` do botão é que diz a
 * função.
 */
function Svg({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {children}
    </svg>
  );
}

type IconProps = { className?: string };

export const IconUser = ({ className }: IconProps) => (
  <Svg className={className}>
    <circle cx="12" cy="7" r="3.5" />
    <path d="M4.5 21v-2a7.5 7.5 0 0 1 15 0v2" />
  </Svg>
);

export const IconHome = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9v11a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9" />
  </Svg>
);

export const IconCard = ({ className }: IconProps) => (
  <Svg className={className}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="M3 10h18M7 15h4" />
  </Svg>
);

export const IconUsers = ({ className }: IconProps) => (
  <Svg className={className}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20v-1.5A6.5 6.5 0 0 1 9 12a6.5 6.5 0 0 1 6.5 6.5V20" />
    <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.5a6.5 6.5 0 0 1 3 5.5" />
  </Svg>
);

export const IconUserPlus = ({ className }: IconProps) => (
  <Svg className={className}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20v-1.5A6.5 6.5 0 0 1 9 12a6.5 6.5 0 0 1 6.5 6.5V20M19 8v6M16 11h6" />
  </Svg>
);

export const IconLogout = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l-4-4 4-4M6 12h10" />
  </Svg>
);

export const IconArrowLeft = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M20 12H4M10 6l-6 6 6 6" />
  </Svg>
);

export const IconExternal = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
  </Svg>
);

export const IconEdit = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M4 20h4L19 9a2.83 2.83 0 0 0-4-4L4 16v4Z" />
    <path d="m13.5 6.5 4 4" />
  </Svg>
);

export const IconPalette = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.8-.9 1.8-1.9 0-.5-.2-.9-.5-1.3-.3-.3-.5-.8-.5-1.3 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4C21 6.4 17 3 12 3Z" />
    <circle cx="7.5" cy="11" r="1" />
    <circle cx="10" cy="7" r="1" />
    <circle cx="15" cy="7.5" r="1" />
  </Svg>
);

export const IconImage = ({ className }: IconProps) => (
  <Svg className={className}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="9" cy="9.5" r="1.5" />
    <path d="m21 16-5-5-9 9" />
  </Svg>
);

export const IconGrid = ({ className }: IconProps) => (
  <Svg className={className}>
    <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
    <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
    <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
  </Svg>
);

export const IconPlus = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const IconTrash = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
  </Svg>
);

export const IconChevronUp = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="m6 15 6-6 6 6" />
  </Svg>
);

export const IconChevronDown = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="m6 9 6 6 6-6" />
  </Svg>
);

export const IconCheck = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);

export const IconLock = ({ className }: IconProps) => (
  <Svg className={className}>
    <rect x="5" y="10" width="14" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" />
  </Svg>
);

export const IconLink = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" />
    <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
  </Svg>
);

export const IconSearch = ({ className }: IconProps) => (
  <Svg className={className}>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m20 20-4-4" />
  </Svg>
);

export const IconRefresh = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M4 12a8 8 0 0 1 14-5.3L20 9M20 4v5h-5M20 12a8 8 0 0 1-14 5.3L4 15M4 20v-5h5" />
  </Svg>
);

export const IconNote = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M6 3h9l4 4v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
    <path d="M9 12h6M9 16h6M9 8h3" />
  </Svg>
);

export const IconClock = ({ className }: IconProps) => (
  <Svg className={className}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3 2" />
  </Svg>
);

export const IconAlert = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M12 4 2.5 20h19L12 4Z" />
    <path d="M12 10v4M12 17.5v.01" />
  </Svg>
);

export const IconContact = ({ className }: IconProps) => (
  <Svg className={className}>
    <circle cx="12" cy="7" r="3.5" />
    <path d="M4.5 21v-2a7.5 7.5 0 0 1 15 0v2" />
  </Svg>
);

export const IconMail = ({ className }: IconProps) => (
  <Svg className={className}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m4 7 8 6 8-6" />
  </Svg>
);

export const IconInstagram = ({ className }: IconProps) => (
  <Svg className={className}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.5" cy="6.5" r=".7" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconLinkedIn = ({ className }: IconProps) => (
  <Svg className={className}>
    <path fill="currentColor" stroke="none" fillRule="evenodd"
      d="M5 2a3 3 0 0 0-3 3v14a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V5a3 3 0 0 0-3-3H5Zm2 3a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3ZM5.7 9.5V19h2.6V9.5H5.7Zm4.6 0V19h2.6v-5.2c0-1.4.6-2.1 1.7-2.1s1.6.7 1.6 2.1V19h2.6v-5.8c0-2.6-1.2-4-3.3-4-1.3 0-2.2.6-2.7 1.4V9.5h-2.5Z" />
  </Svg>
);

export const IconWhatsApp = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M20 11.5a8 8 0 0 1-11.8 7L4 20l1.5-4A8 8 0 1 1 20 11.5Z" />
    <path d="M8.2 8.2c.5 3 2.3 4.8 5.6 6.2.8.3 1.8-.5 2.1-1.2l-2.5-1.1-1 1c-1.5-.7-2.6-1.8-3.2-3.2l1-1-1.1-2.4c-.6.2-1 .8-.9 1.7Z" />
  </Svg>
);

export const IconMonitor = ({ className }: IconProps) => (
  <Svg className={className}>
    <rect x="3" y="4" width="18" height="13" rx="2" />
    <path d="M8 21h8M12 17v4" />
  </Svg>
);

export const IconMapPin = ({ className }: IconProps) => (
  <Svg className={className}>
    <path fill="currentColor" stroke="none" fillRule="evenodd"
      d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Zm-5.5 0a2.5 2.5 0 1 0-5 0 2.5 2.5 0 0 0 5 0Z" />
  </Svg>
);

export const IconPhone = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M7 3H4.5A1.5 1.5 0 0 0 3 4.5C3 13.6 10.4 21 19.5 21a1.5 1.5 0 0 0 1.5-1.5V17l-4-1.5-1.5 2.3a15 15 0 0 1-9.3-9.3L8.5 7 7 3Z" />
  </Svg>
);

export const IconGrip = ({ className }: IconProps) => (
  <Svg className={className}>
    <circle cx="9" cy="6" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="15" cy="6" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="9" cy="12" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="15" cy="12" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="9" cy="18" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="15" cy="18" r="1.2" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconCopy = ({ className }: IconProps) => (
  <Svg className={className}>
    <rect x="8" y="8" width="12" height="12" rx="2" />
    <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
  </Svg>
);

export const IconDots = ({ className }: IconProps) => (
  <Svg className={className}>
    <circle cx="5.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="12" cy="12" r="1.3" fill="currentColor" stroke="none" />
    <circle cx="18.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconSmartphone = ({ className }: IconProps) => (
  <Svg className={className}>
    <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
    <path d="M11 18.5h2" />
  </Svg>
);

export const IconCalendar = ({ className }: IconProps) => (
  <Svg className={className}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Svg>
);

export const IconUpload = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3" />
  </Svg>
);

export const IconLayers = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="m12 3 9 5-9 5-9-5 9-5Z" />
    <path d="m3 13 9 5 9-5" />
  </Svg>
);

export const IconShare = ({ className }: IconProps) => (
  <Svg className={className}>
    <circle cx="18" cy="5.5" r="2.5" />
    <circle cx="6" cy="12" r="2.5" />
    <circle cx="18" cy="18.5" r="2.5" />
    <path d="m8.2 10.8 7.6-4.1M8.2 13.2l7.6 4.1" />
  </Svg>
);

export const IconMove = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M12 3v18M3 12h18M9 6l3-3 3 3M9 18l3 3 3-3M6 9l-3 3 3 3M18 9l3 3-3 3" />
  </Svg>
);

export const IconUndo = ({ className }: IconProps) => (
  <Svg className={className}>
    <path d="M4 5v5h5" />
    <path d="M4.5 10A8 8 0 1 1 6 16.5" />
  </Svg>
);
