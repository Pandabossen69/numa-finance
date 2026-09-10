/** True when running as an installed home-screen / standalone PWA. */
export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const mq = window.matchMedia("(display-mode: standalone)").matches;
    const iosStandalone =
      "standalone" in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
    return mq || iosStandalone;
  } catch {
    return false;
  }
}
