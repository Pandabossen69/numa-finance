import {
  UnconfiguredExtractionProvider,
  type ExtractionProvider,
  type ExtractionProviderResult,
  type ExtractionRequest,
} from "./extraction";

type VisionJson = {
  amountMajor?: number | string | null;
  currency?: string | null;
  description?: string | null;
  merchant?: string | null;
  confidence?: number | null;
};

/**
 * OpenAI Vision extraction — candidates only, never ledger writes.
 */
export class OpenAiVisionExtractionProvider implements ExtractionProvider {
  readonly name = "vision_api" as const;

  constructor(private readonly apiKey: string) {}

  async extract(request: ExtractionRequest): Promise<ExtractionProviderResult> {
    if (!request.imageBase64 || !request.mimeType) {
      return {
        provider: "vision_api",
        candidates: [],
        rawMetadata: { message: "Missing image bytes for vision extraction" },
      };
    }

    const body = {
      model: "gpt-4o-mini",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You extract purchase totals from receipt photos for a personal finance app. " +
            "Return JSON only with keys: amountMajor (number), currency (THB or SEK), " +
            "description (short Swedish or English), merchant (string|null), confidence (0-1). " +
            "Use the final amount due / total, not line items. If unclear, set amountMajor null.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Extract the receipt total.",
            },
            {
              type: "image_url",
              image_url: {
                url: `data:${request.mimeType};base64,${request.imageBase64}`,
              },
            },
          ],
        },
      ],
    };

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      return {
        provider: "vision_api",
        candidates: [],
        rawMetadata: {
          message: "OpenAI vision request failed",
          status: res.status,
          body: text.slice(0, 500),
        },
      };
    }

    const json = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: VisionJson = {};
    try {
      parsed = JSON.parse(content) as VisionJson;
    } catch {
      return {
        provider: "vision_api",
        candidates: [],
        rawMetadata: { message: "Invalid JSON from vision model", content },
      };
    }

    const currency =
      parsed.currency === "SEK" || parsed.currency === "THB"
        ? parsed.currency
        : "THB";
    const major =
      typeof parsed.amountMajor === "number"
        ? parsed.amountMajor
        : typeof parsed.amountMajor === "string"
          ? Number(parsed.amountMajor.replace(",", "."))
          : NaN;
    const amountMinor =
      Number.isFinite(major) && major > 0 ? Math.round(major * 100) : null;
    const confidence =
      typeof parsed.confidence === "number"
        ? Math.min(1, Math.max(0, parsed.confidence))
        : null;

    const description =
      [parsed.merchant, parsed.description].filter(Boolean).join(" · ") ||
      parsed.description ||
      parsed.merchant ||
      null;

    return {
      provider: "vision_api",
      candidates: [
        {
          direction: "debit",
          amountMinor,
          currency,
          balanceAfterMinor: null,
          occurredAt: new Date().toISOString(),
          description,
          confidence,
          rawPayload: parsed as Record<string, unknown>,
        },
      ],
      rawMetadata: { model: "gpt-4o-mini", observationId: request.observationId },
    };
  }
}

export function createExtractionProvider(): ExtractionProvider {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (key) {
    return new OpenAiVisionExtractionProvider(key);
  }
  return new UnconfiguredExtractionProvider();
}

/**
 * OCR Bangkok Bank (or similar) SMS screenshot → plain text only.
 * Domain parsers turn the text into fingerprint-ready candidates.
 */
export async function extractBankSmsPlainText(input: {
  imageBase64: string;
  mimeType: string;
}): Promise<{
  text: string | null;
  provider: "vision_api" | "none";
  rawMetadata: Record<string, unknown>;
}> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return {
      text: null,
      provider: "none",
      rawMetadata: {
        message:
          "OCR/vision is not configured. Paste the SMS text instead.",
      },
    };
  }

  const body = {
    model: "gpt-4o-mini",
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You OCR bank SMS screenshots for a personal finance app. " +
          "Return JSON with key `text`: the full readable SMS thread as plain text, " +
          "preserving each message in order (oldest to newest if visible). " +
          "Keep amounts, account masks (e.g. X6591), and 'available balance' lines exactly. " +
          "Do not invent messages. If unreadable, return text as empty string.",
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Extract all Bangkok Bank / bank SMS message text from this screenshot.",
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${input.mimeType};base64,${input.imageBase64}`,
            },
          },
        ],
      },
    ],
  };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    return {
      text: null,
      provider: "vision_api",
      rawMetadata: {
        message: "OpenAI vision request failed",
        status: res.status,
        body: errText.slice(0, 500),
      },
    };
  }

  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = json.choices?.[0]?.message?.content ?? "{}";
  try {
    const parsed = JSON.parse(content) as { text?: unknown };
    const text =
      typeof parsed.text === "string" ? parsed.text.trim() : "";
    return {
      text: text || null,
      provider: "vision_api",
      rawMetadata: { model: "gpt-4o-mini" },
    };
  } catch {
    return {
      text: null,
      provider: "vision_api",
      rawMetadata: { message: "Invalid JSON from vision model", content },
    };
  }
}
