import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createAccountOnce,
  resetCreateAccountOnceForTests,
} from "./create-account-once";

type WriteResult = { ok: true; id?: string } | { ok: false; error: string };

const MUTATION_ID = "11111111-1111-4111-8111-111111111111";

afterEach(() => {
  resetCreateAccountOnceForTests();
});

describe("createAccountOnce", () => {
  it("turns two rapid submits with the same id into one create", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const write = vi.fn(
      (input: { clientMutationId?: string }): Promise<WriteResult> => {
        expect(input.clientMutationId).toBe(MUTATION_ID);
        return gate.then(() => ({ ok: true, id: "acc-1" }));
      },
    );
    const input = { name: "Kontant", clientMutationId: MUTATION_ID };

    const first = createAccountOnce(input, write);
    const second = createAccountOnce(input, write);

    expect(second).toBe(first);
    expect(write).toHaveBeenCalledTimes(1);
    release?.();
    await expect(first).resolves.toEqual({ ok: true, id: "acc-1" });
    await expect(second).resolves.toEqual({ ok: true, id: "acc-1" });
    expect(write).toHaveBeenCalledTimes(1);
  });

  it("retries with the same id after the in-flight create settles", async () => {
    const write = vi.fn(
      async (input: { clientMutationId?: string }): Promise<WriteResult> => {
        if (!input.clientMutationId) {
          return { ok: false, error: "saknar id" };
        }
        return { ok: true, id: "acc-2" };
      },
    );
    write
      .mockResolvedValueOnce({ ok: false, error: "Kunde inte skapa konto" })
      .mockResolvedValueOnce({ ok: true, id: "acc-2" });
    const input = { name: "Kontant", clientMutationId: MUTATION_ID };

    await expect(createAccountOnce(input, write)).resolves.toMatchObject({
      ok: false,
    });
    await expect(createAccountOnce(input, write)).resolves.toMatchObject({
      ok: true,
      id: "acc-2",
    });
    expect(write).toHaveBeenCalledTimes(2);
    expect(write.mock.calls[0]?.[0].clientMutationId).toBe(MUTATION_ID);
    expect(write.mock.calls[1]?.[0].clientMutationId).toBe(MUTATION_ID);
  });
});
