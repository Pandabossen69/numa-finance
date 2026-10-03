import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenAiVisionExtractionProvider } from "./openai-vision";
import { uploadLimitFlags } from "./upload-rate-limit";
import { COULD_NOT_READ_SV } from "./vision-grounding";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function completion(content: unknown, status = 200): Response {
  if (status !== 200) {
    return new Response("upstream blew up", { status });
  }
  return jsonResponse({
    choices: [{ message: { content: JSON.stringify(content) } }],
  });
}

function requestBody(call: unknown[]): { temperature: number; messages: Array<{ content: unknown }> } {
  const init = call[1] as RequestInit;
  return JSON.parse(String(init.body));
}

function imageDetail(body: { messages: Array<{ content: unknown }> }): string {
  const content = body.messages[1]?.content as Array<{
    image_url?: { detail?: string };
  }>;
  return content[1]?.image_url?.detail ?? "";
}

describe("vision OCR retry and raw metadata", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retries once when the store name is missing and keeps both attempts", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        completion({
          kind: "receipt",
          amountMajor: 61,
          currency: "THB",
          merchant: null,
          description: null,
          fullText: "61.00 THB",
        }),
      )
      .mockResolvedValueOnce(
        completion({
          kind: "receipt",
          amountMajor: 61,
          currency: "THB",
          merchant: "KAFE Z4A QA",
          description: "KAFE Z4A QA",
          fullText: "KAFE Z4A QA 61.00 THB",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const result = await new OpenAiVisionExtractionProvider("test-key").extract({
      observationId: "obs",
      storagePath: "u/r.jpg",
      imageBase64: "aGVsbG8=",
      mimeType: "image/jpeg",
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const first = requestBody(fetchMock.mock.calls[0] ?? []);
    const second = requestBody(fetchMock.mock.calls[1] ?? []);
    expect(first.temperature).toBe(0);
    expect(second.temperature).toBe(0);
    expect(imageDetail(first)).toBe("high");
    expect(imageDetail(second)).toBe("high");
    expect(result.candidates[0]?.description).toContain("KAFE Z4A QA");
    expect(result.candidates[0]?.currency).toBe("THB");
    expect(result.rawMetadata.attemptCount).toBe(2);
    expect(result.rawMetadata.lastError).toBeNull();
    const attempts = result.rawMetadata.attempts as Array<Record<string, unknown>>;
    expect(attempts).toHaveLength(2);
    expect(attempts[0]?.description).toBeNull();
    expect(attempts[1]?.description).toBe("KAFE Z4A QA");
    expect(attempts[0]?.rawContent).toEqual(expect.any(String));
    expect(attempts[0]?.latencyMs).toEqual(expect.any(Number));
    expect(attempts[0]?.httpStatus).toBe(200);
  });

  it("does not retry a receipt that already has a store name", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      completion({
        kind: "receipt",
        amountMajor: 61,
        currency: "THB",
        merchant: "KAFE Z4A QA",
        fullText: "KAFE Z4A QA 61.00 THB",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await new OpenAiVisionExtractionProvider("test-key").extract({
      observationId: "obs",
      storagePath: "u/r.jpg",
      imageBase64: "aGVsbG8=",
      mimeType: "image/jpeg",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.rawMetadata.attemptCount).toBe(1);
    expect(result.candidates[0]?.description).toContain("KAFE Z4A QA");
  });

  it("stores http status, latency and the last error when both calls fail", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(completion(null, 503))
      .mockRejectedValueOnce(Object.assign(new Error("aborted"), { name: "TimeoutError" }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await new OpenAiVisionExtractionProvider("test-key").extract({
      observationId: "obs",
      storagePath: "u/r.jpg",
      imageBase64: "aGVsbG8=",
      mimeType: "image/jpeg",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.candidates).toEqual([]);
    expect(result.rawMetadata.detectedKind).toBe("unknown");
    expect(result.rawMetadata.attemptCount).toBe(2);
    expect(result.rawMetadata.httpStatus).toBeNull();
    expect(result.rawMetadata.lastError).toBe("Vision-anropet tog för lång tid (timeout)");
    expect(result.rawMetadata.latencyMs).toEqual(expect.any(Number));
    const attempts = result.rawMetadata.attempts as Array<Record<string, unknown>>;
    expect(attempts[0]?.httpStatus).toBe(503);
    expect(attempts[0]?.ok).toBe(false);
    expect(String(attempts[0]?.rawContent)).toContain("upstream");
    expect(attempts[1]?.error).toBe("Vision-anropet tog för lång tid (timeout)");
  });

  it("retries an unknown read at most once", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      completion({ kind: "unknown", fullText: "", amountMajor: null, merchant: null }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await new OpenAiVisionExtractionProvider("test-key").extract({
      observationId: "obs",
      storagePath: "u/r.jpg",
      imageBase64: "aGVsbG8=",
      mimeType: "image/jpeg",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.rawMetadata.attemptCount).toBe(2);
    expect(result.rawMetadata.detectedKind).toBe("unknown");
  });

  it("uses THB from บาท instead of a model EUR default", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      completion({
        kind: "receipt",
        amountMajor: 61,
        currency: "EUR",
        merchant: "KAFE QA",
        fullText: "KAFE QA\n61.00 บาท",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const result = await new OpenAiVisionExtractionProvider("test-key").extract({
      observationId: "obs",
      storagePath: "u/r.jpg",
      imageBase64: "aGVsbG8=",
      mimeType: "image/jpeg",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.candidates[0]?.currency).toBe("THB");
    expect(result.candidates[0]?.description).toContain("KAFE QA");
    expect(result.candidates[0]?.amountMinor).toBe(6_100);
    expect(result.rawMetadata.groundingRejected).toBeUndefined();
  });

  it("rejects invented bank rows from an empty image and does not count them", async () => {
    const invented = {
      kind: "bank_app_list",
      fullText: "",
      transactions: [
        { merchant: "7-Eleven", amountMajor: 248, currency: "THB", occurredAt: "2023-10-01", direction: "debit" },
        { merchant: "Starbucks", amountMajor: 150, currency: "THB", occurredAt: "2023-10-02", direction: "debit" },
        { merchant: "Amazon", amountMajor: 500, currency: "THB", occurredAt: "2023-10-03", direction: "debit" },
      ],
    };
    const fetchMock = vi.fn().mockResolvedValue(completion(invented));
    vi.stubGlobal("fetch", fetchMock);
    const result = await new OpenAiVisionExtractionProvider("test-key").extract({
      observationId: "obs",
      storagePath: "u/empty.jpg",
      imageBase64: "aGVsbG8=",
      mimeType: "image/jpeg",
      institutionHint: "bank_app",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.candidates).toEqual([]);
    expect(result.rawMetadata.detectedKind).toBe("unknown");
    expect(result.rawMetadata.groundingReason).toBe("fulltext_empty");
    expect(result.rawMetadata.message).toBe(COULD_NOT_READ_SV);
    expect(result.rawMetadata.transactions).toEqual([]);
    expect(
      uploadLimitFlags({
        provider: result.provider,
        amountMinors: result.candidates.map((row) => row.amountMinor),
        alreadyKnown: false,
        detectedKind: String(result.rawMetadata.detectedKind),
        groundingRejected: result.rawMetadata.groundingRejected === true,
      }).countsTowardUploadLimit,
    ).toBe(false);
  });
});
