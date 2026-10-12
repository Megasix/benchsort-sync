/** BenchSort's public API, read with an institution's key (bsk_…). */

export interface SessionSummary {
  id: string;
  name: string;
  status: string;
  site: string;
  team: string;
}

export interface SessionDetail extends SessionSummary {
  exports: { id: string; createdAt: string }[];
}

export interface SessionFiles {
  files: { filename: string; specimen: number; photoId: string; url: string }[];
  specimens: Record<string, string>[];
  photos: Record<string, string>[];
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface Api {
  exportedSessions(): Promise<SessionSummary[]>;
  session(id: string): Promise<SessionDetail>;
  files(id: string): Promise<SessionFiles>;
  download(url: string): Promise<Uint8Array>;
}

export function benchSortApi(base: string, key: string, fetchImpl: typeof fetch = fetch): Api {
  async function get<T>(path: string): Promise<T> {
    const response = await fetchImpl(`${base}${path}`, {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    });
    const body = (await response.json().catch(() => null)) as {
      error?: { message?: string };
    } | null;
    if (!response.ok) {
      throw new ApiError(
        response.status,
        body?.error?.message ?? `BenchSort answered ${String(response.status)}`,
      );
    }
    return body as T;
  }
  return {
    exportedSessions: async () =>
      (await get<{ sessions: SessionSummary[] }>("/api/v1/sessions?status=exported&limit=200"))
        .sessions,
    session: async (id) =>
      (await get<{ session: SessionDetail }>(`/api/v1/sessions/${id}`)).session,
    files: (id) => get<SessionFiles>(`/api/v1/sessions/${id}/files`),
    async download(url) {
      const response = await fetchImpl(url);
      if (!response.ok)
        throw new ApiError(response.status, `Download failed: ${String(response.status)}`);
      return new Uint8Array(await response.arrayBuffer());
    },
  };
}
