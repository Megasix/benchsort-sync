import type { Dialect } from "./config.js";

/**
 * Upserts for each database: add the row, or update it when its key is there already.
 * Names were checked when the configuration was read (letters, digits, _); values always
 * go as parameters, never in the SQL text. Pure.
 */

export interface Statement {
  text: string;
  values: (string | null)[];
}

export function quote(dialect: Dialect, name: string): string {
  const parts = name.split(".");
  return parts
    .map((part) =>
      dialect === "mysql" ? `\`${part}\`` : dialect === "sqlserver" ? `[${part}]` : `"${part}"`,
    )
    .join(".");
}

export function upsert(
  dialect: Dialect,
  table: string,
  key: string,
  row: Readonly<Record<string, string | null>>,
): Statement {
  const columns = Object.keys(row);
  const values = columns.map((column) => row[column] ?? null);
  const q = (name: string) => quote(dialect, name);
  const others = columns.filter((column) => column !== key);
  switch (dialect) {
    case "postgres": {
      const params = columns.map((_, i) => `$${String(i + 1)}`).join(", ");
      const update = others.length
        ? `DO UPDATE SET ${others.map((c) => `${q(c)} = EXCLUDED.${q(c)}`).join(", ")}`
        : "DO NOTHING";
      return {
        text: `INSERT INTO ${q(table)} (${columns.map(q).join(", ")}) VALUES (${params}) ON CONFLICT (${q(key)}) ${update}`,
        values,
      };
    }
    case "mysql": {
      const update = (others.length ? others : [key])
        .map((c) => `${q(c)} = VALUES(${q(c)})`)
        .join(", ");
      return {
        text: `INSERT INTO ${q(table)} (${columns.map(q).join(", ")}) VALUES (${columns.map(() => "?").join(", ")}) ON DUPLICATE KEY UPDATE ${update}`,
        values,
      };
    }
    case "sqlserver": {
      const params = columns.map((_, i) => `@p${String(i)}`);
      const source = columns.map((c, i) => `${params[i] ?? ""} AS ${q(c)}`).join(", ");
      const update = others.length
        ? ` WHEN MATCHED THEN UPDATE SET ${others.map((c) => `target.${q(c)} = source.${q(c)}`).join(", ")}`
        : "";
      return {
        text: `MERGE ${q(table)} AS target USING (SELECT ${source}) AS source ON target.${q(key)} = source.${q(key)}${update} WHEN NOT MATCHED THEN INSERT (${columns.map(q).join(", ")}) VALUES (${columns.map((c) => `source.${q(c)}`).join(", ")});`,
        values,
      };
    }
  }
}
