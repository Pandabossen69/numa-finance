"use client";

export function HardReloadLink({
  href = "/idag",
  className,
  children,
}: {
  href?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        const sep = href.includes("?") ? "&" : "?";
        window.location.replace(`${href}${sep}r=${Date.now()}`);
      }}
    >
      {children}
    </button>
  );
}
