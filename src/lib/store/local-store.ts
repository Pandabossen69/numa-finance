import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createEmptyStore, normalizeStore, type NumaStoreData } from "./types";

/**
 * Persistence strategy:
 * - Local/dev: `.data/numa-store.json` under the project
 * - Serverless (Vercel): prefer `/tmp`, else in-memory (ephemeral)
 *
 * Until the Supabase repository is wired, this keeps pages from crashing
 * on read-only deployment filesystems.
 */
const PROJECT_DATA_DIR = path.join(process.cwd(), ".data");
const TMP_DATA_DIR = path.join(os.tmpdir(), "numa-finance");

type Backend = "project" | "tmp" | "memory";

let backend: Backend | null = null;
let storePath: string | null = null;
let memoryStore: NumaStoreData | null = null;
let writeQueue: Promise<void> = Promise.resolve();

async function canUseDir(dir: string): Promise<boolean> {
  try {
    await fs.mkdir(dir, { recursive: true });
    const probe = path.join(dir, ".write-probe");
    await fs.writeFile(probe, "ok", "utf8");
    await fs.unlink(probe);
    return true;
  } catch {
    return false;
  }
}

async function resolveBackend(): Promise<{ backend: Backend; path: string | null }> {
  if (backend) {
    return { backend, path: storePath };
  }

  if (await canUseDir(PROJECT_DATA_DIR)) {
    backend = "project";
    storePath = path.join(PROJECT_DATA_DIR, "numa-store.json");
    return { backend, path: storePath };
  }

  if (await canUseDir(TMP_DATA_DIR)) {
    backend = "tmp";
    storePath = path.join(TMP_DATA_DIR, "numa-store.json");
    return { backend, path: storePath };
  }

  backend = "memory";
  storePath = null;
  memoryStore = createEmptyStore();
  return { backend, path: null };
}

export async function readStore(): Promise<NumaStoreData> {
  const resolved = await resolveBackend();

  if (resolved.backend === "memory") {
    return structuredClone(
      normalizeStore(memoryStore ?? createEmptyStore()),
    );
  }

  try {
    const raw = await fs.readFile(resolved.path!, "utf8");
    const parsed = JSON.parse(raw) as NumaStoreData;
    if (parsed.version !== 1) {
      return createEmptyStore();
    }
    return normalizeStore(parsed);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      const empty = createEmptyStore();
      await writeStore(empty);
      return empty;
    }
    // Corrupt/unreadable → start empty rather than crash the whole app.
    console.error("[numa] store read failed, using empty store", error);
    return createEmptyStore();
  }
}

export async function writeStore(data: NumaStoreData): Promise<void> {
  const resolved = await resolveBackend();

  if (resolved.backend === "memory") {
    memoryStore = structuredClone(data);
    return;
  }

  writeQueue = writeQueue.then(async () => {
    const target = resolved.path!;
    const dir = path.dirname(target);
    await fs.mkdir(dir, { recursive: true });
    const tmp = `${target}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
    await fs.rename(tmp, target);
  });
  await writeQueue;
}

export async function updateStore(
  mutator: (data: NumaStoreData) => NumaStoreData | void,
): Promise<NumaStoreData> {
  const current = await readStore();
  const next = structuredClone(current);
  const result = mutator(next);
  const data = result ?? next;
  await writeStore(data);
  return data;
}

export function getStorePath(): string {
  return storePath ?? "(memory)";
}
