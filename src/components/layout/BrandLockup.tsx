import { BRAND_MARK } from "@/lib/brand-assets";

/**
 * Persistent shell brand — 2026 finance-app pattern: compact app-icon tile
 * top-left across the main shell (all primary tabs + nested Mer routes).
 * Screen titles stay in page content; back links stay in Mer chrome.
 */
export function BrandLockup({
  size = "md",
}: {
  size?: "md" | "lg";
}) {
  const px = size === "lg" ? 36 : 30;
  return (
    <span
      className={`numa-brand-lockup${size === "lg" ? " is-lg" : ""}`}
      aria-label="NUMA"
    >
      <img
        className="numa-brand-lockup-icon"
        src={BRAND_MARK}
        alt=""
        width={px}
        height={px}
        decoding="async"
      />
      <span className="numa-brand-mark">NUMA</span>
    </span>
  );
}
