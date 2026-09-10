import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NUMA_ADMIN_EMAIL } from "@/domain/identity/admin";
import { ADMIN_NOT_FOUND_SV } from "./create-user";

const src = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");

describe("createUserAction profile write", () => {
  it("writes the typed name to auth metadata and the profile row", () => {
    expect(src).toContain("user_metadata: { display_name: displayName");
    expect(src).toContain(".update({ display_name: displayName })");
    expect(src).toContain("display_name: displayName");
    expect(src).not.toContain('|| "Användare"');
  });

  it("verifies the server user before any service-role client is created", () => {
    const verifyAt = src.indexOf("requireVerifiedAdminForMutation");
    const serviceAt = src.indexOf("isServiceRoleConfigured");
    const clientAt = src.indexOf("createSupabaseServiceRoleClient()");
    expect(verifyAt).toBeGreaterThan(-1);
    expect(serviceAt).toBeGreaterThan(verifyAt);
    expect(clientAt).toBeGreaterThan(serviceAt);
    expect(src).not.toContain("getSessionUser");
    expect(src).not.toContain("getAuthUser");
    expect(src).not.toContain("auth.getSession");
    expect(src).not.toContain("user_metadata.role");
  });
});

const requireVerifiedAdminForMutation = vi.fn();
const isServiceRoleConfigured = vi.fn();
const createSupabaseServiceRoleClient = vi.fn();

vi.mock("server-only", () => ({}));

vi.mock("@/features/auth/session", () => ({
  requireVerifiedAdminForMutation: () => requireVerifiedAdminForMutation(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  isServiceRoleConfigured: () => isServiceRoleConfigured(),
  createSupabaseServiceRoleClient: () => createSupabaseServiceRoleClient(),
}));

describe("createUserAction service-role gate", () => {
  beforeEach(() => {
    requireVerifiedAdminForMutation.mockReset();
    isServiceRoleConfigured.mockReset();
    createSupabaseServiceRoleClient.mockReset();
  });

  it("does not touch service-role when verification fails", async () => {
    requireVerifiedAdminForMutation.mockResolvedValue({
      ok: false,
      error: ADMIN_NOT_FOUND_SV,
    });
    const { createUserAction } = await import("./actions");
    await expect(
      createUserAction({
        email: "new@example.com",
        password: "abcdefgh",
        displayName: "Nova",
      }),
    ).resolves.toEqual({ ok: false, error: ADMIN_NOT_FOUND_SV });
    expect(isServiceRoleConfigured).not.toHaveBeenCalled();
    expect(createSupabaseServiceRoleClient).not.toHaveBeenCalled();
  });

  it("does not touch service-role for a verified ordinary user", async () => {
    requireVerifiedAdminForMutation.mockResolvedValue({
      ok: false,
      error: ADMIN_NOT_FOUND_SV,
    });
    const { createUserAction } = await import("./actions");
    await expect(
      createUserAction({
        email: "new@example.com",
        password: "abcdefgh",
        displayName: "Nova",
      }),
    ).resolves.toEqual({ ok: false, error: ADMIN_NOT_FOUND_SV });
    expect(createSupabaseServiceRoleClient).not.toHaveBeenCalled();
  });

  it("reaches service-role only after a verified admin", async () => {
    requireVerifiedAdminForMutation.mockResolvedValue({
      ok: true,
      identity: { id: "admin-1", email: NUMA_ADMIN_EMAIL },
    });
    isServiceRoleConfigured.mockReturnValue(true);
    createSupabaseServiceRoleClient.mockReturnValue({
      auth: {
        admin: {
          createUser: vi.fn().mockResolvedValue({
            data: { user: { id: "created-1" } },
            error: null,
          }),
        },
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: "created-1" },
              error: null,
            }),
          })),
        })),
        update: vi.fn(() => ({
          eq: vi.fn().mockResolvedValue({ error: null }),
        })),
      })),
    });

    const { createUserAction } = await import("./actions");
    await expect(
      createUserAction({
        email: "new@example.com",
        password: "abcdefgh",
        displayName: "Nova",
      }),
    ).resolves.toEqual({
      ok: true,
      email: "new@example.com",
      displayName: "Nova",
    });
    expect(requireVerifiedAdminForMutation).toHaveBeenCalled();
    expect(isServiceRoleConfigured).toHaveBeenCalled();
    expect(createSupabaseServiceRoleClient).toHaveBeenCalled();
  });
});
