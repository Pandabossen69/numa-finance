import { promises as fs } from "node:fs";
import path from "node:path";
import { createEmptyStore, type NumaStoreData } from "./types";

const DATA_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(DATA_DIR, "numa-store.json");

let writeQueue: Promise<void> = Promise.resolve();

async function ensureDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

export async function readStore(): Promise<NumaStoreData> {
  await ensureDir();
  try {
    const raw = await fs.readFile(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as NumaStoreData;
    if (parsed.version !== 1) {
      return createEmptyStore();
    }
    return parsed;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      const empty = createEmptyStore();
      await writeStore(empty);
      return empty;
    }
    throw error;
  }
}

export async function writeStore(data: NumaStoreData): Promise<void> {
  writeQueue = writeQueue.then(async () => {
    await ensureDir();
    const tmp = `${STORE_PATH}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
    await fs.rename(tmp, STORE_PATH);
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
  return STORE_PATH;
}
