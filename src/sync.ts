import path from "node:path";
import { ApiError, type Api } from "./api.js";
import type { Config } from "./config.js";
import { copyPhotos, folderName } from "./photos.js";
import type { State } from "./state.js";
import { rowOf } from "./templates.js";
import type { Writer } from "./writers/index.js";

export interface SessionResult {
  session: string;
  rows: number;
  photos: number;
  /** Why it was skipped this time; it is tried again next run. */
  skipped?: string;
}

/**
 * One run: every exported session whose latest export the agent has not taken in yet is
 * written to the database (a row per specimen or per photo, by the mappings) and its photos
 * copied. A session BenchSort cannot give right now is left for the next run.
 */
export async function syncOnce(
  config: Config,
  api: Api,
  writer: Writer | null,
  state: State,
  log: (line: string) => void = () => undefined,
): Promise<SessionResult[]> {
  const results: SessionResult[] = [];
  for (const summary of await api.exportedSessions()) {
    const detail = await api.session(summary.id);
    const latest = detail.exports[0];
    if (!latest || state.sessions[summary.id]?.exportId === latest.id) continue;
    let files;
    try {
      files = await api.files(summary.id);
    } catch (error) {
      if (error instanceof ApiError && (error.status === 409 || error.status === 410)) {
        results.push({ session: summary.name, rows: 0, photos: 0, skipped: error.message });
        log(`${summary.name}: skipped, ${error.message}`);
        if (error.status === 410) {
          // Photos deleted: nothing more will come for this export.
          state.sessions[summary.id] = { exportId: latest.id, syncedAt: new Date().toISOString() };
        }
        continue;
      }
      throw error;
    }
    let rows = 0;
    if (writer && config.database) {
      for (const mapping of config.database.tables) {
        const source = mapping.rows === "photo" ? files.photos : files.specimens;
        const table = source
          .map((values) => rowOf(mapping.columns, values))
          // A row without its key cannot be matched later: left out.
          .filter((row) => row[mapping.key] !== null);
        await writer.upsert(mapping.table, mapping.key, table);
        rows += table.length;
      }
    }
    let photos = 0;
    if (config.photos) {
      const folder = config.photos.perSession
        ? path.join(config.photos.folder, folderName(summary.name))
        : config.photos.folder;
      photos = await copyPhotos(api, files.files, folder);
    }
    state.sessions[summary.id] = { exportId: latest.id, syncedAt: new Date().toISOString() };
    results.push({ session: summary.name, rows, photos });
    log(`${summary.name}: ${String(rows)} rows written, ${String(photos)} photos copied`);
  }
  return results;
}
