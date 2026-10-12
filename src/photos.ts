import { mkdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Api, SessionFiles } from "./api.js";

/** A folder name from a session's name: what file systems accept. */
export function folderName(name: string): string {
  const cleaned = name.replace(/[<>:"/\\|?*\x00-\x1f]+/g, "_").trim();
  return cleaned === "" ? "session" : cleaned.slice(0, 120);
}

/** Copies the session's renamed photos; files already there are kept. Answers how many came. */
export async function copyPhotos(
  api: Api,
  files: SessionFiles["files"],
  folder: string,
): Promise<number> {
  await mkdir(folder, { recursive: true });
  let copied = 0;
  for (const file of files) {
    const target = path.join(folder, path.basename(file.filename));
    const exists = await stat(target).then(
      () => true,
      () => false,
    );
    if (exists) continue;
    await writeFile(target, await api.download(file.url));
    copied += 1;
  }
  return copied;
}
