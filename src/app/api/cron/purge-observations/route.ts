import { NextResponse } from "next/server";
import { purgeExpiredObservations } from "@/lib/store/repository";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const sent = request.headers.get("authorization");
  if (secret && sent !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  try {
    const result = await purgeExpiredObservations();
    return NextResponse.json({ ok: true, purged: result.purged });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "purge failed",
      },
      { status: 500 },
    );
  }
}
