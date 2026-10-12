/** BenchSort's export placeholders: "{catalogNumber}", "UAM:Mamm:{catalogNumber}". */
const PLACEHOLDER = /\{(\w+)\}/g;

/** Fills a template from one row's values; unknown or empty names give "". */
export function render(template: string, values: Readonly<Record<string, string>>): string {
  return template.replace(PLACEHOLDER, (_, name: string) => values[name] ?? "");
}

/** A database row from a mapping's columns; empty values become null. */
export function rowOf(
  columns: Readonly<Record<string, string>>,
  values: Readonly<Record<string, string>>,
): Record<string, string | null> {
  return Object.fromEntries(
    Object.entries(columns).map(([column, template]) => {
      const value = render(template, values);
      return [column, value === "" ? null : value];
    }),
  );
}
