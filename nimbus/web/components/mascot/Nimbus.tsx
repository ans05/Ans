import { cn } from "../ui/cn";

interface NimbusProps {
  state?: "idle" | "warning";
  size?: number;
  className?: string;
}

/**
 * The Nimbus mascot: a small, round cloud with two dot eyes and the faintest
 * smile. Only ever mounted once, by MascotHost.
 */
export function Nimbus({ state = "idle", size = 72, className }: NimbusProps) {
  const warning = state === "warning";
  return (
    <svg
      viewBox="0 0 64 48"
      width={size}
      height={(size * 48) / 64}
      role="img"
      aria-label={warning ? "Nimbus, concerned" : "Nimbus"}
      className={cn(
        "drop-shadow-[0_6px_14px_rgba(26,26,31,0.12)] transition-[filter] duration-200",
        warning && "motion-safe:animate-bob",
        className,
      )}
    >
      <path
        d="M18 42h32a11 11 0 0 0 1.6-21.9A15 15 0 0 0 24.8 13.5 12 12 0 0 0 5.5 25.5 11 11 0 0 0 18 42z"
        fill={warning ? "var(--cloud-warn)" : "var(--cloud)"}
        stroke="var(--line-2)"
        strokeWidth="1.5"
        className="transition-[fill] duration-200"
      />
      <circle cx="28" cy="29" r="2" fill="#1a1a1f" />
      <circle cx="39" cy="29" r="2" fill="#1a1a1f" />
      {warning ? (
        <path d="M31.5 35.5h4" stroke="#1a1a1f" strokeWidth="1.4" strokeLinecap="round" />
      ) : (
        <path d="M31.5 34.5q2 1.8 4 0" stroke="#1a1a1f" strokeWidth="1.4" strokeLinecap="round" fill="none" />
      )}
    </svg>
  );
}
