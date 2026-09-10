import { describe, expect, it } from "vitest";
import { createStableMutationId } from "./native-fx";

describe("createStableMutationId", () => {
  it("reuses one id until clear, then issues a new one", () => {
    const mutation = createStableMutationId();
    const first = mutation.take();
    expect(mutation.take()).toBe(first);
    expect(mutation.peek()).toBe(first);
    mutation.clear();
    expect(mutation.peek()).toBeNull();
    const second = mutation.take();
    expect(second).not.toBe(first);
  });
});
