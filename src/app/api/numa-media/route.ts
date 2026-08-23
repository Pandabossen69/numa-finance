import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";
import { assertUserOwnsStoragePath } from "@/lib/store/isolation";
import { LOCAL_DEMO_USER_ID } from "@/lib/store/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/** Dev-only fallback when the local JSON store wrote files under `.data/media`. */
export async function GET(request: NextRequest) {
  if (isSupabaseConfigured()) {
    return new Response("Not found", { status: 404 });
  }

  const storagePath = request.nextUrl.searchParams.get("p");
  if (!storagePath) {
    return new Response("Missing path", { status: 400 });
  }

  try {
    assertUserOwnsStoragePath(LOCAL_DEMO_USER_ID, storagePath);
  } catch {
    return new Response("Forbidden", { status: 403 });
  }

  const mediaRoot = path.resolve(process.cwd(), ".data", "media");
  const fullPath = path.resolve(mediaRoot, storagePath);
  if (fullPath !== mediaRoot && !fullPath.startsWith(`${mediaRoot}${path.sep}`)) {
    return new Response("Forbidden", { status: 403 });
  }

  try {
    const bytes = await readFile(fullPath);
    return new Response(bytes, {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
