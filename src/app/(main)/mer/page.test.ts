import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const mer = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const settings = readFileSync(
  new URL("../installningar/page.tsx", import.meta.url),
  "utf8",
);
const auth = readFileSync(
  new URL("../../../features/auth/actions.ts", import.meta.url),
  "utf8",
);
const adminAction = readFileSync(
  new URL("../../../features/admin/actions.ts", import.meta.url),
  "utf8",
);
const adminClient = readFileSync(
  new URL("../../../lib/supabase/admin.ts", import.meta.url),
  "utf8",
);
const migration = readFileSync(
  new URL(
    "../../../../supabase/migrations/20260827104139_admin_only_user_lockdown.sql",
    import.meta.url,
  ),
  "utf8",
);

describe("Mer HIGH regress", () => {
  it("keeps Logga ut in Mer", () => {
    expect(mer).toContain("SignOutButton");
    expect(mer).toContain("Konto");
  });

  it("uses the same desktop width as Hem and Plan", () => {
    expect(mer).toContain("numa-page-wide");
  });

  it("keeps SignOut on Mer and not on Inställningar", () => {
    expect(mer).toContain("SignOutButton");
    expect(settings).not.toContain("SignOutButton");
  });

  it("gates Ny användare on the admin email check", () => {
    expect(mer).toContain("currentUserIsNumaAdmin");
    expect(mer).toContain("Ny användare");
    expect(settings).toContain("currentUserIsNumaAdmin");
    expect(settings).toContain("/installningar/ny-anvandare");
  });
});

describe("admin-only user creation security", () => {
  it("closes public Auth signUp in the server action", () => {
    expect(auth).toContain("rejectPublicSignup");
    expect(auth).not.toMatch(/auth\.signUp\(/);
  });

  it("creates users with the service role on the server", () => {
    expect(adminAction).toContain("createSupabaseServiceRoleClient");
    expect(adminAction).toContain("getSessionUser");
    expect(adminAction).toContain("authorizeAdminCreateUser");
    expect(adminAction).toContain("email_confirm: true");
    expect(adminAction).not.toContain("NEXT_PUBLIC_SUPABASE_SERVICE");
    expect(adminClient).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(adminClient).toContain("persistSession: false");
    expect(adminClient).toContain('import "server-only"');
  });

  it("locks down handle_new_user and keeps owner RLS", () => {
    expect(migration).toContain("numa_internal.handle_new_user");
    expect(migration).toContain(
      "revoke all on function numa_internal.handle_new_user() from public",
    );
    expect(migration).toContain("from anon, authenticated");
    expect(migration).toContain("drop function if exists numa.handle_new_user()");
    expect(migration).toContain("auth.uid() = user_id");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("security_invoker");
  });
});
