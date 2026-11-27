import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps) {
  return {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    ...props,
  };
}

export function IconPlay(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M8 5.5v13l11-6.5-11-6.5z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconPause(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M7 5h3.2v14H7zM13.8 5H17v14h-3.2z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconUndo(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M8 8H4v4" />
      <path d="M4.5 12a8 8 0 1 0 2-5.5L4 8" />
    </svg>
  );
}

export function IconRedo(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M16 8h4v4" />
      <path d="M19.5 12a8 8 0 1 1-2-5.5L20 8" />
    </svg>
  );
}

export function IconExport(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 4v10" />
      <path d="M8 8l4-4 4 4" />
      <path d="M5 14v5h14v-5" />
    </svg>
  );
}

export function IconPlus(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function IconClose(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

export function IconSettings(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 7h16M4 12h16M4 17h16" />
      <circle cx="9" cy="7" r="2" fill="var(--surface, #fff)" />
      <circle cx="15" cy="12" r="2" fill="var(--surface, #fff)" />
      <circle cx="8" cy="17" r="2" fill="var(--surface, #fff)" />
    </svg>
  );
}

export function IconSun(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.5 5.5l1.4 1.4M17.1 17.1l1.4 1.4M18.5 5.5l-1.4 1.4M6.9 17.1l-1.4 1.4" />
    </svg>
  );
}

export function IconMoon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M16 3.5A8.5 8.5 0 1 0 20.5 14 7 7 0 0 1 16 3.5z" />
    </svg>
  );
}

export function Mark({ size = 32 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="14" fill="#14202B" />
      <rect x="11" y="26" width="22" height="12" rx="3" fill="#2457E6" />
      <rect x="35" y="26" width="18" height="12" rx="3" fill="#6E96FF" />
      <rect x="30.5" y="15" width="3" height="34" rx="1.5" fill="#F7F8FA" />
    </svg>
  );
}
