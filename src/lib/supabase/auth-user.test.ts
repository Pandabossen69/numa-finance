import { beforeEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ getUser: vi.fn(), getSession: vi.fn() }));
vi.mock("./config", () => ({ isSupabaseConfigured: () => true }));
vi.mock("./server", () => ({ createSupabaseServerClient: async () => ({ auth }) }));
import { getVerifiedAuthUser } from "./auth-user";
describe("verified identity for privileged actions", () => {
  beforeEach(() => vi.resetAllMocks());
  it("ignores a cookie identity when Auth rejects the token", async () => {
    auth.getSession.mockResolvedValue({
      data: { session: { user: { id: "forged", email: "admin@example.com" } } },
    });
    auth.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error("invalid token"),
    });
    expect(await getVerifiedAuthUser()).toBeNull();
    expect(auth.getSession).not.toHaveBeenCalled();
  });
  it("uses only the verified identity", async () => {
    auth.getUser.mockResolvedValue({
      data: { user: { id: "verified", email: "member@example.com" } },
      error: null,
    });
    expect(await getVerifiedAuthUser()).toEqual({
      id: "verified",
      email: "member@example.com",
      metadataDisplayName: null,
    });
  });
  it("does not fall back to cookies when Auth is unavailable", async () => {
    auth.getUser.mockRejectedValue(new Error("offline"));
    await expect(getVerifiedAuthUser()).rejects.toThrow("offline");
    expect(auth.getSession).not.toHaveBeenCalled();
  });
});
