import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const src = readFileSync(new URL("./TabKeepAlive.tsx", import.meta.url), "utf8");
const shell = readFileSync(new URL("./AppShell.tsx", import.meta.url), "utf8");

describe("TabKeepAlive", () => {
  it("mounts SPA panels once and parks RSC children while a tab is active", () => {
    expect(src).toContain("useNavIntent");
    expect(src).toContain("spaTabKey");
    expect(src).toContain("mounted");
    expect(src).toContain("hidden={!visible}");
    expect(src).toContain("data-numa-rsc-shadow");
    expect(src).toContain("if (!active)");
    expect(src).toContain("{children}");
  });

  it("is wired under AppShell around LastViewOutlet", () => {
    expect(shell).toContain('import { TabKeepAlive } from "@/components/layout/TabKeepAlive"');
    expect(shell).toContain("<TabKeepAlive>");
    expect(shell).toContain("</TabKeepAlive>");
  });
});
