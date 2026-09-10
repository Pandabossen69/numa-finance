import { beforeEach, describe, expect, it, vi } from "vitest";
import { NUMA_ADMIN_EMAIL } from "@/domain/identity/admin";
import { ADMIN_NOT_FOUND_SV } from "@/features/admin/create-user";

const getVerifiedClaimsIdentity = vi.fn();
const getVerifiedServerUser = vi.fn();
const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});

vi.mock("next/navigation", () => ({
  notFound: () => notFound(),
}));

vi.mock("@/lib/supabase/auth-user", () => ({
  getAuthUser: vi.fn(),
}));

vi.mock("@/lib/supabase/verified-identity", () => ({
  getVerifiedClaimsIdentity: () => getVerifiedClaimsIdentity(),
  getVerifiedServerUser: () => getVerifiedServerUser(),
}));

describe("admin session decisions", () => {
  beforeEach(() => {
    getVerifiedClaimsIdentity.mockReset();
    getVerifiedServerUser.mockReset();
    notFound.mockClear();
  });

  it("denies a verified ordinary user admin UI and mutations", async () => {
    const { currentUserIsNumaAdmin, requireVerifiedAdminForMutation } = await import(
      "./session"
    );
    getVerifiedClaimsIdentity.mockResolvedValue({
      id: "member-1",
      email: "member@example.com",
    });
    getVerifiedServerUser.mockResolvedValue({
      id: "member-1",
      email: "member@example.com",
    });

    await expect(currentUserIsNumaAdmin()).resolves.toBe(false);
    await expect(requireVerifiedAdminForMutation()).resolves.toEqual({
      ok: false,
      error: ADMIN_NOT_FOUND_SV,
    });
  });

  it("allows a verified admin and 404s everyone else on the admin page", async () => {
    const { currentUserIsNumaAdmin, requireNumaAdminOrNotFound } = await import(
      "./session"
    );
    getVerifiedClaimsIdentity.mockResolvedValue({
      id: "admin-1",
      email: NUMA_ADMIN_EMAIL,
    });

    await expect(currentUserIsNumaAdmin()).resolves.toBe(true);
    await expect(requireNumaAdminOrNotFound()).resolves.toEqual({
      id: "admin-1",
      email: NUMA_ADMIN_EMAIL,
    });
    expect(notFound).not.toHaveBeenCalled();

    getVerifiedClaimsIdentity.mockResolvedValue({
      id: "member-1",
      email: "member@example.com",
    });
    await expect(requireNumaAdminOrNotFound()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(1);
  });

  it("denies mutations when server getUser is missing, expired, or revoked", async () => {
    const { requireVerifiedAdminForMutation } = await import("./session");
    getVerifiedServerUser.mockResolvedValue(null);
    await expect(requireVerifiedAdminForMutation()).resolves.toEqual({
      ok: false,
      error: ADMIN_NOT_FOUND_SV,
    });
  });
});
