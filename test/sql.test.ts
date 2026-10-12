import { describe, expect, it } from "vitest";
import { quote, upsert } from "../src/sql.js";

const row = { catalog_number: "GJ00012", scientific_name: "Carabus nemoralis", notes: null };

describe("upserts", () => {
  it("PostgreSQL: INSERT … ON CONFLICT on the key", () => {
    expect(upsert("postgres", "collection.specimens", "catalog_number", row)).toEqual({
      text: 'INSERT INTO "collection"."specimens" ("catalog_number", "scientific_name", "notes") VALUES ($1, $2, $3) ON CONFLICT ("catalog_number") DO UPDATE SET "scientific_name" = EXCLUDED."scientific_name", "notes" = EXCLUDED."notes"',
      values: ["GJ00012", "Carabus nemoralis", null],
    });
  });

  it("MySQL: INSERT … ON DUPLICATE KEY UPDATE", () => {
    expect(upsert("mysql", "specimens", "catalog_number", row).text).toBe(
      "INSERT INTO `specimens` (`catalog_number`, `scientific_name`, `notes`) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE `scientific_name` = VALUES(`scientific_name`), `notes` = VALUES(`notes`)",
    );
  });

  it("SQL Server: MERGE on the key", () => {
    const statement = upsert("sqlserver", "dbo.specimens", "catalog_number", row);
    expect(statement.text).toBe(
      "MERGE [dbo].[specimens] AS target USING (SELECT @p0 AS [catalog_number], @p1 AS [scientific_name], @p2 AS [notes]) AS source ON target.[catalog_number] = source.[catalog_number] WHEN MATCHED THEN UPDATE SET target.[scientific_name] = source.[scientific_name], target.[notes] = source.[notes] WHEN NOT MATCHED THEN INSERT ([catalog_number], [scientific_name], [notes]) VALUES (source.[catalog_number], source.[scientific_name], source.[notes]);",
    );
    expect(statement.values).toEqual(["GJ00012", "Carabus nemoralis", null]);
  });

  it("a table with only its key adds rows and leaves existing ones", () => {
    expect(upsert("postgres", "t", "k", { k: "1" }).text).toContain("DO NOTHING");
    expect(quote("mysql", "a.b")).toBe("`a`.`b`");
  });
});
