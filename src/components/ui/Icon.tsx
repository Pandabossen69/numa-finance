import type { LucideIcon } from "lucide-react";

/**
 * Shared lucide glyph. 20 px, hairline stroke, inherits color.
 * Decorative — the control that hosts it carries the accessible name.
 */
export function Icon({
  icon: Glyph,
  size = 20,
  className,
}: {
  icon: LucideIcon;
  size?: number;
  className?: string;
}) {
  return (
    <Glyph
      size={size}
      strokeWidth={1.75}
      color="currentColor"
      aria-hidden
      className={className}
    />
  );
}
