import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";

describe("MoneyDisplay signed tone", () => {
  it("shows a single minus for negative amounts", () => {
    const html = renderToStaticMarkup(
      <MoneyDisplay amountMinor={-12345} currency="SEK" tone="signed" />,
    );
    expect(html).toContain("aria-label=\"−123,45 SEK\"");
    expect(html).not.toContain("--");
    expect(html.match(/−/g)?.length).toBe(1);
  });

  it("shows a plus for positive amounts", () => {
    const html = renderToStaticMarkup(
      <MoneyDisplay amountMinor={5100000} currency="THB" tone="signed" compact />,
    );
    expect(html).toContain("aria-label=\"+51 000 THB\"");
  });

  it("shows no sign prefix for zero", () => {
    const html = renderToStaticMarkup(
      <MoneyDisplay amountMinor={0} currency="THB" tone="signed" compact />,
    );
    expect(html).toContain("aria-label=\"0 THB\"");
    expect(html).not.toContain("+0");
    expect(html).not.toContain("−0");
  });

  it("keeps Intl minus for neutral negatives without a plus path", () => {
    const html = renderToStaticMarkup(
      <MoneyDisplay amountMinor={-500} currency="SEK" tone="neutral" />,
    );
    expect(html).toContain("aria-label=\"−5,00 SEK\"");
    expect(html).not.toContain("+");
  });
});
