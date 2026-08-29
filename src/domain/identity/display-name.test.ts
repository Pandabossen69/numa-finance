import {
  chromeDisplayName,
  greetingFirstName,
  isPlaceholderDisplayName,
  knownDisplayNameForEmail,
  resolveProfileDisplayName,
} from "./display-name";
import { describe, expect, it } from "vitest";

describe("knownDisplayNameForEmail", () => {
  it("maps the three NUMA accounts", () => {
    expect(knownDisplayNameForEmail("qualityltf@gmail.com")).toBe("Hugo");
    expect(knownDisplayNameForEmail("kliv.arne@icloud.com")).toBe("Jordan");
    expect(knownDisplayNameForEmail("oslin002@gmail.com")).toBe("Oscar");
  });

  it("does not invent a name for an unknown email", () => {
    expect(knownDisplayNameForEmail("christianhultz1@gmail.com")).toBeNull();
    expect(knownDisplayNameForEmail("jjisthename17@gmail.com")).toBeNull();
  });
});

describe("resolveProfileDisplayName", () => {
  it("keeps a stored name for an unmapped email like Christian", () => {
    expect(
      resolveProfileDisplayName({
        stored: "Christian Hultz",
        email: "christianhultz1@gmail.com",
        authMetaName: "Användare",
      }),
    ).toBe("Christian Hultz");
  });

  it("keeps Jhunel even though the email is not in the map", () => {
    expect(
      resolveProfileDisplayName({
        stored: "Jhunel Mabuti",
        email: "jjisthename17@gmail.com",
      }),
    ).toBe("Jhunel Mabuti");
  });

  it("does not clobber a stored name with the email map", () => {
    expect(
      resolveProfileDisplayName({
        stored: "Jordan",
        email: "kliv.arne@icloud.com",
        authMetaName: "Kliv",
      }),
    ).toBe("Jordan");
    expect(
      resolveProfileDisplayName({
        stored: "Oscar",
        email: "oslin002@gmail.com",
        authMetaName: "Oslin",
      }),
    ).toBe("Oscar");
  });

  it("seeds from the map only when the stored name is empty or Användare", () => {
    expect(
      resolveProfileDisplayName({
        stored: "Användare",
        email: "kliv.arne@icloud.com",
        authMetaName: "Kliv",
      }),
    ).toBe("Jordan");
    expect(
      resolveProfileDisplayName({
        stored: "",
        email: "qualityltf@gmail.com",
        authMetaName: "Användare",
      }),
    ).toBe("Hugo");
  });

  it("seeds from auth metadata when stored is a placeholder and the email is unknown", () => {
    expect(
      resolveProfileDisplayName({
        stored: "Användare",
        email: "christianhultz1@gmail.com",
        authMetaName: "Christian Hultz",
      }),
    ).toBe("Christian Hultz");
  });

  it("never uses the email local-part", () => {
    expect(
      resolveProfileDisplayName({
        stored: "",
        email: "christianhultz1@gmail.com",
        authMetaName: null,
      }),
    ).toBe("Användare");
    expect(
      resolveProfileDisplayName({
        stored: "christianhultz1@gmail.com",
        email: "christianhultz1@gmail.com",
      }),
    ).toBe("Användare");
  });
});

describe("greeting and chrome helpers", () => {
  it("uses the first name for greetings", () => {
    expect(greetingFirstName("Christian Hultz")).toBe("Christian");
    expect(greetingFirstName("Jhunel Mabuti")).toBe("Jhunel");
    expect(greetingFirstName("Hugo")).toBe("Hugo");
    expect(greetingFirstName("Användare")).toBeNull();
    expect(greetingFirstName("christianhultz1@gmail.com")).toBeNull();
  });

  it("hides placeholder names from chrome", () => {
    expect(chromeDisplayName("Christian Hultz")).toBe("Christian Hultz");
    expect(chromeDisplayName("Användare")).toBeNull();
    expect(chromeDisplayName("")).toBeNull();
    expect(isPlaceholderDisplayName("Användare")).toBe(true);
    expect(isPlaceholderDisplayName("Jordan")).toBe(false);
  });
});
