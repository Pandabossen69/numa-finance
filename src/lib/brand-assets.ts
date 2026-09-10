/**
 * Cache-bust query for brand PNGs/ICO. Safari and the SW can keep old
 * /icons/* for days (max-age was a week) — after a rebrand that leaves
 * friends staring at the previous mark even though production is current.
 * Bump with NEXT_PUBLIC_NUMA_BUILD_ID on each deploy (see next.config).
 */
export const BRAND_ASSET_VERSION =
  process.env.NEXT_PUBLIC_NUMA_BUILD_ID?.trim() || "steel-orange";

export function brandAsset(path: string): string {
  const version = encodeURIComponent(BRAND_ASSET_VERSION);
  return path.includes("?") ? `${path}&v=${version}` : `${path}?v=${version}`;
}

export const BRAND_MARK = brandAsset("/icons/mark.png");
export const BRAND_ICON_192 = brandAsset("/icons/icon-192.png");
export const BRAND_ICON_512 = brandAsset("/icons/icon-512.png");
export const BRAND_ICON_MASKABLE_512 = brandAsset("/icons/icon-maskable-512.png");
export const BRAND_APPLE_TOUCH = brandAsset("/apple-touch-icon.png");
export const BRAND_FAVICON = brandAsset("/favicon.ico");
