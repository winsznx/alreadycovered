import type { ModelHealth } from "@alreadycovered/shared";
import type { HealthResponse, JobView, PacketView, RoutineView, SettingsResponse, SourcesResponse, TimetableBlockView } from "./types";

export type ApiErrorBody = {
  error: { code: string; message: string; details?: Record<string, unknown>; retryable: boolean };
};

export class ApiError extends Error {
  code: string;
  retryable: boolean;
  details?: Record<string, unknown>;

  constructor(body: ApiErrorBody) {
    super(body.error.message);
    this.code = body.error.code;
    this.retryable = body.error.retryable;
    this.details = body.error.details;
  }
}

// Frontend (Vercel) and backend (VPS) are different origins in production;
// VITE_API_BASE_URL points at the deployed API. Falls back to same-origin
// relative paths for local dev via the Vite proxy.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/api/v1${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
    if (body?.error) throw new ApiError(body);
    throw new Error(`Request failed with status ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export type CurrentUser = { id: string; email: string; displayName: string | null };

export const api = {
  health: () => request<HealthResponse>("/health"),
  settings: () => request<SettingsResponse>("/settings"),

  signup: (email: string, password: string, displayName?: string) =>
    request<{ user: CurrentUser }>("/auth/signup", { method: "POST", body: JSON.stringify({ email, password, displayName }) }),
  login: (email: string, password: string) => request<{ user: CurrentUser }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  logout: () => request<{ ok: true }>("/auth/logout", { method: "POST" }),
  me: () => request<{ user: CurrentUser | null }>("/auth/me"),

  createProfile: (payload: unknown) => request<{ profileId: string }>("/profile", { method: "POST", body: JSON.stringify(payload) }),
  testModel: () => request<ModelHealth>("/models/test", { method: "POST" }),

  getSchedule: (profileId: string) => request<{ scheduleRevision: number; blocks: TimetableBlockView[] }>(`/profiles/${profileId}/schedule`),
  putSchedule: (profileId: string, blocks: unknown) =>
    request<{ scheduleRevision: number; blocks: TimetableBlockView[] }>(`/profiles/${profileId}/schedule`, { method: "PUT", body: JSON.stringify(blocks) }),
  getRoutines: (profileId: string) => request<{ routinesRevision: number; routines: RoutineView[] }>(`/profiles/${profileId}/routines`),
  putRoutines: (profileId: string, routines: unknown) =>
    request<{ routinesRevision: number; routines: RoutineView[] }>(`/profiles/${profileId}/routines`, { method: "PUT", body: JSON.stringify(routines) }),

  listSources: (status?: string) => request<SourcesResponse>(`/sources${status ? `?status=${status}` : ""}`),
  getSource: (id: string) => request<{ source: SourcesResponse["sources"][number]; chunks: unknown[] }>(`/sources/${id}`),
  deleteSource: (id: string) => request<{ ok: true }>(`/sources/${id}`, { method: "DELETE" }),
  uploadSources: async (files: File[]) => {
    const form = new FormData();
    for (const file of files) form.append("files", file);
    const response = await fetch(`${API_BASE_URL}/api/v1/sources/upload`, { method: "POST", credentials: "include", body: form });
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
      if (body?.error) throw new ApiError(body);
      throw new Error(`Upload failed with status ${response.status}`);
    }
    return (await response.json()) as { uploaded: Array<{ sourceId: string; displayName: string; ok: boolean; errorCode?: string }> };
  },

  getJob: (id: string) => request<{ job: JobView }>(`/jobs/${id}`),
  listJobs: () => request<{ jobs: JobView[] }>("/jobs"),

  createPacket: (date: string) => request<PacketView>("/packets", { method: "POST", body: JSON.stringify({ date }) }),
  getPacket: (id: string) => request<PacketView>(`/packets/${id}`),
  regeneratePacket: (id: string) => request<PacketView>(`/packets/${id}/regenerate`, { method: "POST" }),
  patchBlock: (packetId: string, blockId: string, payload: unknown) =>
    request<PacketView>(`/packets/${packetId}/blocks/${blockId}`, { method: "PATCH", body: JSON.stringify(payload) }),
  reviewPacket: (packetId: string, payload: unknown) => request<PacketView>(`/packets/${packetId}/review`, { method: "POST", body: JSON.stringify(payload) }),
  exportPacket: (packetId: string, confirmExportWithWarnings: boolean) =>
    request<{ export: { id: string; exportedWithWarnings: boolean } }>(`/packets/${packetId}/export`, {
      method: "POST",
      body: JSON.stringify({ confirmExportWithWarnings }),
    }),

  downloadUrl: (exportId: string, kind: "pdf" | "zip") => `${API_BASE_URL}/api/v1/exports/${exportId}/download/${kind}`,
  eventsUrl: () => `${API_BASE_URL}/api/v1/events`,
};
