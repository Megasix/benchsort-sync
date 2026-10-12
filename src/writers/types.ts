/** Writes rows into the museum's database. */
export interface Writer {
  /** Adds or updates each row by its key, in one transaction. */
  upsert(table: string, key: string, rows: Record<string, string | null>[]): Promise<void>;
  /** Checks the connection and that the table is there. */
  check(table: string): Promise<void>;
  close(): Promise<void>;
}
