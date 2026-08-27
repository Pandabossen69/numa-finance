import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MoneyDisplay } from "@/components/ui/MoneyDisplay";

describe("MoneyDisplay signed tone", () => {
  it("shows a single minus for negative amounts", () => {
    const html = renderToStaticMarkup(
      createElement(MoneyDisplay, {
        amountMinor: -12345,
        currency: "SEK",
        tone: "signed",
      }),
    );
    expect(html).toMatch(/aria-label="−123,45 kr"/);
    expect(html).toMatch(/>−123,45</);
    expect(html.match(/aria-label="[^"]*"/)?.[0].match(/−/g)?.length).toBe(1);
  });

  it("shows a plus for positive amounts", () => {
    const html = renderToStaticMarkup(
      createElement(MoneyDisplay, {
        amountMinor: 5_100_000,
        currency: "THB",
        tone: "signed",
        compact: true,
      }),
    );
    // Intl may use NBSP as the thousands separator.
    expect(html).toMatch(/aria-label="\+51[\u00a0 ]000 THB"/);
  });

  it("shows no sign prefix for zero", () => {
    const html = renderToStaticMarkup(
      createElement(MoneyDisplay, {
        amountMinor: 0,
        currency: "THB",
        tone: "signed",
        compact: true,
      }),
    );
    expect(html).toContain('aria-label="0 THB"');
    expect(html).not.toContain("+0");
    expect(html).not.toContain("−0");
  });

  it("keeps Intl minus for neutral negatives without a plus path", () => {
    const html = renderToStaticMarkup(
      createElement(MoneyDisplay, {
        amountMinor: -500,
        currency: "SEK",
        tone: "neutral",
      }),
    );
    expect(html).toMatch(/aria-label="−5,00 kr"/);
    expect(html).not.toContain("+");
  });
});
