import sql from "mssql";
import { quote, upsert } from "../sql.js";
import type { Writer } from "./types.js";

export function sqlServerWriter(url: string): Writer {
  const pool = new sql.ConnectionPool(url);
  const ready = pool.connect();
  return {
    async upsert(table, key, rows) {
      await ready;
      const transaction = new sql.Transaction(pool);
      await transaction.begin();
      try {
        for (const row of rows) {
          const statement = upsert("sqlserver", table, key, row);
          const request = new sql.Request(transaction);
          statement.values.forEach((value, i) => {
            request.input(`p${String(i)}`, sql.NVarChar(sql.MAX), value);
          });
          await request.query(statement.text);
        }
        await transaction.commit();
      } catch (error) {
        await transaction.rollback();
        throw error;
      }
    },
    async check(table) {
      await ready;
      await pool.request().query(`SELECT TOP 0 1 AS one FROM ${quote("sqlserver", table)}`);
    },
    async close() {
      await pool.close();
    },
  };
}
