import { describe, expect, it } from "vitest";
import { ConfigError, parseConfig, SAMPLE_CONFIG } from "../src/config.js";
import { rowOf } from "../src/templates.js";

const base = {
  benchsort: { key: "bsk_abc" },
  database: {
    dialect: "postgres",
    url: "postgres://localhost/c",
    tables: [
      { table: "specimens", key: "catalog_number", columns: { catalog_number: "{catalogNumber}" } },
    ],
  },
};

describe("the configuration", () => {
  it("reads a minimal one, with defaults", () => {
    const config = parseConfig(base);
    expect(config.benchsort.url).toBe("https://app.benchsort.com");
    expect(config.intervalMinutes).toBe(15);
    expect(config.database?.tables[0]?.rows).toBe("specimen");
  });

  it("takes secrets from the environment", () => {
    const config = parseConfig(
      { ...base, benchsort: {}, database: { ...base.database, url: undefined } },
      { BENCHSORT_KEY: "bsk_env", BENCHSORT_SYNC_DATABASE_URL: "postgres://env/c" },
    );
    expect(config.benchsort.key).toBe("bsk_env");
    expect(config.database?.url).toBe("postgres://env/c");
  });

  it("refuses names that could carry SQL, a key outside the columns, and no target", () => {
    const bad = (database: unknown) => () => parseConfig({ ...base, database });
    expect(
      bad({
        ...base.database,
        tables: [{ table: "specimens; DROP", key: "k", columns: { k: "x" } }],
      }),
    ).toThrow(ConfigError);
    expect(
      bad({ ...base.database, tables: [{ table: "s", key: "other", columns: { k: "x" } }] }),
    ).toThrow(/must be one of its columns/);
    expect(() => parseConfig({ benchsort: { key: "bsk_a" } })).toThrow(
      /photos, a database, or both/,
    );
    expect(() => parseConfig({ ...base, benchsort: { key: "nope" } })).toThrow(/bsk_/);
  });

  it("the sample is valid once its key is set", () => {
    expect(() =>
      parseConfig({ ...SAMPLE_CONFIG, benchsort: { ...SAMPLE_CONFIG.benchsort, key: "bsk_x" } }),
    ).not.toThrow();
  });

  it("templates fill rows; empty values become null", () => {
    expect(
      rowOf(
        { id: "UAM:Mamm:{catalogNumber}", taxon: "{scientificName}", note: "{nothing}" },
        { catalogNumber: "123", scientificName: "" },
      ),
    ).toEqual({ id: "UAM:Mamm:123", taxon: null, note: null });
  });
});
