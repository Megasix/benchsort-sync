import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ApiError, type Api } from "../src/api.js";
import { parseConfig } from "../src/config.js";
import type { State } from "../src/state.js";
import { syncOnce } from "../src/sync.js";
import type { Writer } from "../src/writers/index.js";

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "sync-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function fakeApi(exportId = "e1", failFiles?: ApiError): Api & { downloads: string[] } {
  const downloads: string[] = [];
  return {
    downloads,
    exportedSessions: () =>
      Promise.resolve([{ id: "s1", name: "Drawer 12", status: "exported", site: "", team: "ENT" }]),
    session: () =>
      Promise.resolve({
        id: "s1",
        name: "Drawer 12",
        status: "exported",
        site: "",
        team: "ENT",
        exports: [{ id: exportId, createdAt: "2026-10-12T10:00:00Z" }],
      }),
    files: () =>
      failFiles
        ? Promise.reject(failFiles)
        : Promise.resolve({
            files: [
              { filename: "GJ00012-01.jpg", specimen: 1, photoId: "p1", url: "https://s/1" },
              { filename: "GJ00012-02.jpg", specimen: 1, photoId: "p2", url: "https://s/2" },
            ],
            specimens: [
              { catalogNumber: "GJ00012", scientificName: "Carabus nemoralis" },
              { catalogNumber: "" },
            ],
            photos: [
              { catalogNumber: "GJ00012", file: "GJ00012-01.jpg" },
              { catalogNumber: "GJ00012", file: "GJ00012-02.jpg" },
            ],
          }),
    download: (url) => {
      downloads.push(url);
      return Promise.resolve(new TextEncoder().encode(url));
    },
  };
}

function fakeWriter() {
  const written: { table: string; key: string; rows: Record<string, string | null>[] }[] = [];
  const writer: Writer = {
    upsert: (table, key, rows) => {
      written.push({ table, key, rows });
      return Promise.resolve();
    },
    check: () => Promise.resolve(),
    close: () => Promise.resolve(),
  };
  return { writer, written };
}

const config = () =>
  parseConfig({
    benchsort: { key: "bsk_a" },
    photos: { folder: dir },
    database: {
      dialect: "postgres",
      url: "postgres://x",
      tables: [
        {
          table: "specimens",
          key: "catalog_number",
          columns: { catalog_number: "{catalogNumber}", taxon: "{scientificName}" },
        },
        {
          table: "media",
          rows: "photo",
          key: "file_name",
          columns: { file_name: "{file}", catalog_number: "{catalogNumber}" },
        },
      ],
    },
  });

describe("a run", () => {
  it("writes each table, copies the photos, and remembers the export", async () => {
    const api = fakeApi();
    const { writer, written } = fakeWriter();
    const state: State = { sessions: {} };

    const results = await syncOnce(config(), api, writer, state);

    expect(results).toEqual([{ session: "Drawer 12", rows: 3, photos: 2 }]);
    expect(written[0]).toEqual({
      table: "specimens",
      key: "catalog_number",
      // The specimen without a catalog number cannot be matched later: left out.
      rows: [{ catalog_number: "GJ00012", taxon: "Carabus nemoralis" }],
    });
    expect(written[1]?.rows).toHaveLength(2);
    expect(await readdir(path.join(dir, "Drawer 12"))).toEqual([
      "GJ00012-01.jpg",
      "GJ00012-02.jpg",
    ]);
    expect(await readFile(path.join(dir, "Drawer 12", "GJ00012-01.jpg"), "utf8")).toBe(
      "https://s/1",
    );
    expect(state.sessions.s1?.exportId).toBe("e1");

    // Same export: nothing to do. A new export: done again, photos kept.
    expect(await syncOnce(config(), api, writer, state)).toEqual([]);
    const again = fakeApi("e2");
    expect(await syncOnce(config(), again, writer, state)).toEqual([
      { session: "Drawer 12", rows: 3, photos: 0 },
    ]);
    expect(again.downloads).toEqual([]);
  });

  it("leaves a session BenchSort cannot give now for the next run", async () => {
    const state: State = { sessions: {} };
    const busy = await syncOnce(
      config(),
      fakeApi("e1", new ApiError(409, "Being changed")),
      null,
      state,
    );
    expect(busy[0]?.skipped).toBe("Being changed");
    expect(state.sessions.s1).toBeUndefined();

    const gone = await syncOnce(config(), fakeApi("e1", new ApiError(410, "Deleted")), null, state);
    expect(gone[0]?.skipped).toBe("Deleted");
    expect(state.sessions.s1?.exportId).toBe("e1");
  });
});
