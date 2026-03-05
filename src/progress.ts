import { readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import type { Progress } from "./types.js";

export function progressFilePath(configPath: string): string {
  const absPath = resolve(configPath);
  const hash = createHash("sha256").update(absPath).digest("hex").slice(0, 12);
  return join(dirname(absPath), `.thinker-progress-${hash}.json`);
}

export function readProgress(configPath: string): Progress | null {
  const path = progressFilePath(configPath);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8")) as Progress;
}

export function writeProgress(configPath: string, progress: Progress): void {
  writeFileSync(progressFilePath(configPath), JSON.stringify(progress));
}

export function deleteProgress(configPath: string): void {
  rmSync(progressFilePath(configPath), { force: true });
}
