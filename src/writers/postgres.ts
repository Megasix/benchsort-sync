import pg from "pg";
import { quote, upsert } from "../sql.js";
import type { Writer } from "./types.js";

export function postgresWriter(url: string): Writer {
  const pool = new pg.Pool({ connectionString: url, max: 2 });
  return {
    async upsert(table, key, rows) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        for (const row of rows) {
          const statement = upsert("postgres", table, key, row);
          await client.query(statement.text, statement.values);
        }
        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async check(table) {
      await pool.query(`SELECT 1 FROM ${quote("postgres", table)} WHERE false`);
    },
    close: () => pool.end(),
  };
}
