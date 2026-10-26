import Link from "next/link";
import type { ComponentProps } from "react";
import { ChevronRight } from "lucide-react";
import { Icon } from "@/components/ui/Icon";

/** Secondary action: text plus a chevron. One filled button stays the primary. */
export function TextLink({
  children,
  className,
  ...props
}: ComponentProps<typeof Link>) {
  return (
    <Link
      {...props}
      className={["numa-text-link", className].filter(Boolean).join(" ")}
    >
      {children}
      <Icon icon={ChevronRight} size={16} />
    </Link>
  );
}
