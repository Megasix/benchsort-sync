import mysql from "mysql2/promise";
import { quote, upsert } from "../sql.js";
import type { Writer } from "./types.js";

export function mysqlWriter(url: string): Writer {
  const pool = mysql.createPool({ uri: url, connectionLimit: 2 });
  return {
    async upsert(table, key, rows) {
      const connection = await pool.getConnection();
      try {
        await connection.beginTransaction();
        for (const row of rows) {
          const statement = upsert("mysql", table, key, row);
          await connection.execute(statement.text, statement.values);
        }
        await connection.commit();
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    },
    async check(table) {
      await pool.query(`SELECT 1 FROM ${quote("mysql", table)} WHERE 1 = 0`);
    },
    close: () => pool.end(),
  };
}
