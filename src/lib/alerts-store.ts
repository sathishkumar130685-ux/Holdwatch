import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { AlertRule } from "./types";

const DATA_DIR = path.join(process.cwd(), ".data", "alerts");

async function ensureDir() {
  await mkdir(DATA_DIR, { recursive: true });
}

function filePath(userId: string) {
  return path.join(DATA_DIR, `${userId}.json`);
}

export async function listAlertRules(userId: string): Promise<AlertRule[]> {
  try {
    const raw = await readFile(filePath(userId), "utf8");
    return JSON.parse(raw) as AlertRule[];
  } catch {
    return [];
  }
}

export async function saveAlertRules(
  userId: string,
  rules: AlertRule[],
): Promise<void> {
  await ensureDir();
  await writeFile(filePath(userId), JSON.stringify(rules, null, 2), "utf8");
}
