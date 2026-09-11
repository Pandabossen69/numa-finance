import { beforeEach, describe, expect, it, vi } from "vitest";
import { NUMA_ADMIN_EMAIL } from "@/domain/identity/admin";

const auth = vi.hoisted(() => ({ getUser: vi.fn(), getSession: vi.fn() }));

vi.mock("./config", () => ({ isSupabaseConfigured: () => true }));
vi.mock("./server", () => ({
  createSupabaseServerClient: async () => ({ auth }),
}));

import { readVerifiedServerUser } from "./auth-user";

describe("verified identity for privileged actions", () => {
  beforeEach(() => vi.resetAllMocks());

  it("ignores a cookie identity when Auth rejects the token", async () => {
    auth.getSession.mockResolvedValue({
      data: { session: { user: { id: "forged", email: NUMA_ADMIN_EMAIL } } },
    });
    auth.getUser.mockResolvedValue({
      data: { user: null },
      error: new Error("invalid token"),
    });
    expect(await readVerifiedServerUser()).toBeNull();
    expect(auth.getSession).not.toHaveBeenCalled();
  });

  it("fails closed on revoked or expired identity", async () => {
    auth.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "session revoked" },
    });
    expect(await readVerifiedServerUser()).toBeNull();
  });

  it("fails closed when Auth is unavailable", async () => {
    auth.getUser.mockRejectedValue(new Error("offline"));
    expect(await readVerifiedServerUser()).toBeNull();
    expect(auth.getSession).not.toHaveBeenCalled();
  });

  it("fails closed without a server user id even if metadata says admin", async () => {
    auth.getUser.mockResolvedValue({
      data: {
        user: {
          email: NUMA_ADMIN_EMAIL,
          user_metadata: { role: "admin" },
        },
      },
      error: null,
    });
    expect(await readVerifiedServerUser()).toBeNull();
  });

  it("uses only the verified Auth email, never user_metadata", async () => {
    auth.getUser.mockResolvedValue({
      data: {
        user: {
          id: "verified",
          email: "member@example.com",
          user_metadata: { role: "admin", email: NUMA_ADMIN_EMAIL },
        },
      },
      error: null,
    });
    expect(await readVerifiedServerUser()).toEqual({
      id: "verified",
      email: "member@example.com",
      metadataDisplayName: null,
    });
  });
});
