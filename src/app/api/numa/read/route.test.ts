import { beforeEach, describe, expect, it, vi } from "vitest";
import { loadHomeSnapshot } from "@/features/finance/load-home";
import { getAuthUser } from "@/lib/supabase/auth-user";
import { GET } from "./route";

vi.mock("@/lib/supabase/auth-user", () => ({
  getAuthUser: vi.fn(),
}));

vi.mock("@/features/finance/load-home", () => ({
  loadHomeSnapshot: vi.fn(),
}));

vi.mock("@/features/imports/pending-bank-mail-count", () => ({
  countPendingBankMail: vi.fn(async () => 0),
}));

const LEAK = "relation numa.x does not exist / supabase details";
const GENERIC = "Kunde inte hämta just nu.";

function readRequest(part: string | null) {
  const url =
    part == null
      ? "http://localhost/api/numa/read"
      : `http://localhost/api/numa/read?part=${encodeURIComponent(part)}`;
  return new Request(url);
}

describe("GET /api/numa/read", () => {
  beforeEach(() => {
    vi.mocked(getAuthUser).mockReset();
    vi.mocked(loadHomeSnapshot).mockReset();
  });

  it("returns only the fixed Swedish text for an unknown part", async () => {
    const response = await GET(readRequest("relation numa.x"));
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body).toEqual({ ok: false, error: "Okänd läsning" });
    expect(JSON.stringify(body)).not.toContain("relation");
    expect(JSON.stringify(body)).not.toContain("home");
    expect(vi.mocked(getAuthUser)).not.toHaveBeenCalled();
  });

  it("returns only the fixed Swedish text when the session is missing", async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null);
    const response = await GET(readRequest("home"));
    const body = await response.json();
    expect(response.status).toBe(401);
    expect(body).toEqual({ ok: false, error: "Du måste vara inloggad" });
    expect(JSON.stringify(body)).not.toMatch(/user|email|stack/i);
    expect(vi.mocked(loadHomeSnapshot)).not.toHaveBeenCalled();
  });

  it("hides a thrown database error behind the generic Swedish text", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({
      id: "user-1",
      email: "person@example.com",
      metadataDisplayName: null,
    });
    vi.mocked(loadHomeSnapshot).mockRejectedValue(new Error(LEAK));
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET(readRequest("home"));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body).toEqual({ ok: false, error: GENERIC });
    expect(JSON.stringify(body)).not.toContain("relation");
    expect(JSON.stringify(body)).not.toContain("supabase");
    expect(JSON.stringify(body)).not.toContain("numa.x");
    expect(JSON.stringify(body)).not.toContain("person@example.com");
    expect(errorLog).toHaveBeenCalled();
    errorLog.mockRestore();
  });

  it("replaces a loader's raw error text with the same generic text", async () => {
    vi.mocked(getAuthUser).mockResolvedValue({
      id: "user-1",
      email: "person@example.com",
      metadataDisplayName: null,
    });
    vi.mocked(loadHomeSnapshot).mockResolvedValue({ ok: false, error: LEAK });
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await GET(readRequest("home"));
    const body = await response.json();

    expect(body).toEqual({ ok: false, error: GENERIC });
    expect(JSON.stringify(body)).not.toContain(LEAK);
    expect(JSON.stringify(body)).not.toContain("supabase");
    expect(errorLog).toHaveBeenCalled();
    errorLog.mockRestore();
  });
});
