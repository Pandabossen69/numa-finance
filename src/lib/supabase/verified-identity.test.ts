import { beforeEach, describe, expect, it, vi } from "vitest";
import { NUMA_ADMIN_EMAIL } from "@/domain/identity/admin";
import {
  identityFromVerifiedClaims,
  identityFromVerifiedUser,
} from "./verified-identity";

const getClaims = vi.fn();
const getUser = vi.fn();
const getSession = vi.fn();

vi.mock("./config", () => ({
  isSupabaseConfigured: () => true,
}));

vi.mock("./server", () => ({
  createSupabaseServerClient: async () => ({
    auth: {
      getClaims,
      getUser,
      getSession,
    },
  }),
}));

const FORGED_ADMIN = {
  id: "forged-admin-id",
  email: NUMA_ADMIN_EMAIL,
  user_metadata: { role: "admin", display_name: "Forged" },
};

describe("identityFromVerifiedClaims", () => {
  it("uses the email claim and ignores user_metadata roles", () => {
    expect(
      identityFromVerifiedClaims({
        claims: {
          sub: "user-1",
          email: "  member@example.com ",
          user_metadata: { role: "admin", email: NUMA_ADMIN_EMAIL },
          app_metadata: {},
        },
      }),
    ).toEqual({ id: "user-1", email: "member@example.com" });
  });

  it("fails closed when claims are missing or have no sub", () => {
    expect(identityFromVerifiedClaims(null)).toBeNull();
    expect(identityFromVerifiedClaims({ claims: null })).toBeNull();
    expect(identityFromVerifiedClaims({ claims: { email: NUMA_ADMIN_EMAIL } })).toBeNull();
  });
});

describe("identityFromVerifiedUser", () => {
  it("uses user.email and ignores user_metadata", () => {
    expect(
      identityFromVerifiedUser({
        id: "user-2",
        email: NUMA_ADMIN_EMAIL,
        user_metadata: { role: "user" },
      }),
    ).toEqual({ id: "user-2", email: NUMA_ADMIN_EMAIL });
  });

  it("fails closed without a server user id", () => {
    expect(identityFromVerifiedUser(null)).toBeNull();
    expect(
      identityFromVerifiedUser({ email: NUMA_ADMIN_EMAIL, user_metadata: { role: "admin" } }),
    ).toBeNull();
  });
});

describe("verified server identity", () => {
  beforeEach(() => {
    getClaims.mockReset();
    getUser.mockReset();
    getSession.mockReset();
    getSession.mockResolvedValue({
      data: { session: { user: FORGED_ADMIN } },
      error: null,
    });
  });

  it("denies a forged getSession().user and never treats it as identity", async () => {
    getClaims.mockResolvedValue({
      data: null,
      error: { message: "invalid JWT" },
    });
    getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "invalid JWT" },
    });

    const { readVerifiedClaimsIdentity, readVerifiedServerUser } = await import(
      "./verified-identity"
    );

    await expect(readVerifiedClaimsIdentity()).resolves.toBeNull();
    await expect(readVerifiedServerUser()).resolves.toBeNull();
    expect(getSession).not.toHaveBeenCalled();
  });

  it("denies invalid, expired, and revoked verification", async () => {
    const { readVerifiedClaimsIdentity, readVerifiedServerUser } = await import(
      "./verified-identity"
    );

    getClaims.mockResolvedValue({
      data: null,
      error: { message: "token has expired" },
    });
    await expect(readVerifiedClaimsIdentity()).resolves.toBeNull();

    getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "session_not_found" },
    });
    await expect(readVerifiedServerUser()).resolves.toBeNull();

    getUser.mockRejectedValue(new Error("Auth session missing"));
    await expect(readVerifiedServerUser()).resolves.toBeNull();
  });

  it("returns a verified ordinary user from claims and getUser", async () => {
    getClaims.mockResolvedValue({
      data: {
        claims: { sub: "member-1", email: "member@example.com", user_metadata: { role: "admin" } },
      },
      error: null,
    });
    getUser.mockResolvedValue({
      data: {
        user: { id: "member-1", email: "member@example.com", user_metadata: { role: "admin" } },
      },
      error: null,
    });

    const { readVerifiedClaimsIdentity, readVerifiedServerUser } = await import(
      "./verified-identity"
    );

    await expect(readVerifiedClaimsIdentity()).resolves.toEqual({
      id: "member-1",
      email: "member@example.com",
    });
    await expect(readVerifiedServerUser()).resolves.toEqual({
      id: "member-1",
      email: "member@example.com",
    });
  });
});
