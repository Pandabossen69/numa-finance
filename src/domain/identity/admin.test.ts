import { describe, expect, it } from "vitest";
import { isNumaAdminEmail, NUMA_ADMIN_EMAIL } from "./admin";

describe("isNumaAdminEmail", () => {
  it("accepts Hugo's address regardless of case", () => {
    expect(isNumaAdminEmail("Qualityltf@gmail.com")).toBe(true);
    expect(isNumaAdminEmail("QualityLTF@gmail.com")).toBe(true);
    expect(isNumaAdminEmail("qualityltf@gmail.com")).toBe(true);
    expect(isNumaAdminEmail("  QUALITYLTF@GMAIL.COM  ")).toBe(true);
    expect(NUMA_ADMIN_EMAIL).toBe("qualityltf@gmail.com");
  });

  it("rejects everyone else", () => {
    expect(isNumaAdminEmail("kliv.arne@icloud.com")).toBe(false);
    expect(isNumaAdminEmail("oslin002@gmail.com")).toBe(false);
    expect(isNumaAdminEmail("qualityltf@gmail.com.evil")).toBe(false);
    expect(isNumaAdminEmail("hugo@example.com")).toBe(false);
    expect(isNumaAdminEmail("")).toBe(false);
    expect(isNumaAdminEmail(null)).toBe(false);
    expect(isNumaAdminEmail(undefined)).toBe(false);
  });
});
