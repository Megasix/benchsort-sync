import pg from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { postgresWriter } from "../src/writers/postgres.js";

// Runs against a real PostgreSQL when SYNC_TEST_POSTGRES_URL is set (always in CI).
const url = process.env.SYNC_TEST_POSTGRES_URL;
const schema = `sync_test_${String(process.pid)}`;

describe.skipIf(!url)("PostgreSQL", () => {
  const admin = new pg.Pool({ connectionString: url });
  afterAll(async () => {
    await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await admin.end();
  });

  it("adds rows, then updates them by their key", async () => {
    await admin.query(`CREATE SCHEMA ${schema}`);
    await admin.query(
      `CREATE TABLE ${schema}.specimens (catalog_number text PRIMARY KEY, taxon text, locality text)`,
    );
    const writer = postgresWriter(url ?? "");
    try {
      await writer.check(`${schema}.specimens`);
      await writer.upsert(`${schema}.specimens`, "catalog_number", [
        { catalog_number: "GJ00012", taxon: "Carabus", locality: null },
        { catalog_number: "GJ00013", taxon: "Bembidion", locality: "Pond 4" },
      ]);
      await writer.upsert(`${schema}.specimens`, "catalog_number", [
        { catalog_number: "GJ00012", taxon: "Carabus nemoralis", locality: "Bog 2" },
      ]);
      const { rows } = await admin.query(
        `SELECT catalog_number, taxon, locality FROM ${schema}.specimens ORDER BY catalog_number`,
      );
      expect(rows).toEqual([
        { catalog_number: "GJ00012", taxon: "Carabus nemoralis", locality: "Bog 2" },
        { catalog_number: "GJ00013", taxon: "Bembidion", locality: "Pond 4" },
      ]);
      await expect(writer.check(`${schema}.missing`)).rejects.toThrow();
    } finally {
      await writer.close();
    }
  });
});
