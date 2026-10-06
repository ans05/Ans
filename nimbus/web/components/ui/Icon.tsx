import type { SVGProps } from "react";

const paths = {
  timeline: <><path d="M4 6h16" /><path d="M4 12h10" /><path d="M4 18h13" /></>,
  focus: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="2.5" /></>,
  shield: <path d="M12 3l7 3v5c0 5-3.3 8.4-7 10-3.7-1.6-7-5-7-10V6l7-3z" />,
  checklist: <><path d="M9 6h11" /><path d="M9 12h11" /><path d="M9 18h11" /><path d="M4 6l1 1 2-2" /><path d="M4 12l1 1 2-2" /><path d="M4 18l1 1 2-2" /></>,
  chart: <><path d="M4 20V10" /><path d="M10 20V4" /><path d="M16 20v-7" /><path d="M22 20H2" /></>,
  plane: <path d="M10.5 20l1.5-6 7.5-4.5c.9-.5.9-1.9 0-2.4L12 11.5 6.5 8 4 9.5l4 3-1 3-3 1 1 1.5 3-.5 2.5 2.5z" />,
  car: <><path d="M5 16l1.5-5.5A2 2 0 0 1 8.4 9h7.2a2 2 0 0 1 1.9 1.5L19 16" /><rect x="3" y="16" width="18" height="4" rx="1" /><circle cx="7.5" cy="20" r="1" /><circle cx="16.5" cy="20" r="1" /></>,
  train: <><rect x="5" y="3" width="14" height="14" rx="3" /><path d="M5 10h14" /><path d="M9 21l1.5-3" /><path d="M15 21l-1.5-3" /><circle cx="9" cy="14" r=".6" /><circle cx="15" cy="14" r=".6" /></>,
  gate: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M12 3v18" /><circle cx="9.5" cy="12" r=".6" /></>,
  security: <><path d="M12 3l7 3v5c0 5-3.3 8.4-7 10-3.7-1.6-7-5-7-10V6l7-3z" /><path d="M9 12l2 2 4-4" /></>,
  hotel: <><path d="M3 18V8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10" /><path d="M3 14h18" /><path d="M7 10h4v4" /></>,
  boarding: <><path d="M4 12h12" /><path d="M12 6l6 6-6 6" /></>,
  wifi: <><path d="M3 9a14 14 0 0 1 18 0" /><path d="M6.5 12.5a9 9 0 0 1 11 0" /><path d="M10 16a4 4 0 0 1 4 0" /><circle cx="12" cy="19" r=".8" /></>,
  wifiOff: <><path d="M3 9a14 14 0 0 1 18 0" /><path d="M6.5 12.5a9 9 0 0 1 11 0" /><path d="M10 16a4 4 0 0 1 4 0" /><path d="M3 3l18 18" /></>,
  signal: <><path d="M5 18v-2" /><path d="M9 18v-5" /><path d="M13 18v-8" /><path d="M17 18V7" /></>,
  clock: <><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>,
  copy: <><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V6a2 2 0 0 1 2-2h9" /></>,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  x: <><path d="M6 6l12 12" /><path d="M18 6L6 18" /></>,
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  minus: <path d="M5 12h14" />,
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2v2" /><path d="M12 20v2" /><path d="M4.9 4.9l1.4 1.4" /><path d="M17.7 17.7l1.4 1.4" /><path d="M2 12h2" /><path d="M20 12h2" /><path d="M4.9 19.1l1.4-1.4" /><path d="M17.7 6.3l1.4-1.4" /></>,
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />,
  arrowRight: <><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></>,
  arrowUpRight: <><path d="M7 17L17 7" /><path d="M8 7h9v9" /></>,
  sparkle: <path d="M12 3l2 5.5L19.5 10.5 14 12.5 12 18l-2-5.5L4.5 10.5 10 8.5 12 3z" />,
  chevronDown: <path d="M6 9l6 6 6-6" />,
  alert: <><path d="M12 3l9.5 17h-19L12 3z" /><path d="M12 10v4" /><circle cx="12" cy="17" r=".6" /></>,
  cloud: <path d="M7 18h10a4 4 0 0 0 .6-7.95A5.5 5.5 0 0 0 7.1 9.3 4.4 4.4 0 0 0 7 18z" />,
} as const;

export type IconName = keyof typeof paths;

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name"> {
  name: IconName;
  size?: number;
}

/** Minimal line icons, 24-unit grid, stroke follows `currentColor`. */
export function Icon({ name, size = 16, className, ...rest }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}
