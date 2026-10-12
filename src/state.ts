import { readFile, rename, writeFile } from "node:fs/promises";

/** What the agent has written: each session's last export it took in. */
export interface State {
  sessions: Record<string, { exportId: string; syncedAt: string }>;
}

export async function readState(path: string): Promise<State> {
  try {
    const parsed = JSON.parse(await readFile(path, "utf8")) as Partial<State>;
    return { sessions: parsed.sessions ?? {} };
  } catch {
    return { sessions: {} };
  }
}

/** Written to a temporary file first, so a crash never leaves half a file. */
export async function writeState(path: string, state: State): Promise<void> {
  const temporary = `${path}.tmp`;
  await writeFile(temporary, JSON.stringify(state, null, 2));
  await rename(temporary, path);
}
