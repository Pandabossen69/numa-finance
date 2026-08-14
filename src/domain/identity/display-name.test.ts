import { knownDisplayNameForEmail } from "./display-name";
import { describe, expect, it } from "vitest";

describe("knownDisplayNameForEmail", () => {
  it("maps the three NUMA accounts", () => {
    expect(knownDisplayNameForEmail("qualityltf@gmail.com")).toBe("Hugo");
    expect(knownDisplayNameForEmail("kliv.arne@icloud.com")).toBe("Jordan");
    expect(knownDisplayNameForEmail("oslin002@gmail.com")).toBe("Oscar");
  });
});
