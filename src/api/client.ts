import type { Shape } from "../types/shapes";

const BASE = "/api";

function getToken() {
  return localStorage.getItem("ariapaint_token");
}

function headers(extra?: Record<string, string>) {
  const h: Record<string, string> = { "Content-Type": "application/json", ...extra };
  const token = getToken();
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { ...options, headers: headers() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data as T;
}

export type User = { id: number; username: string; email: string };

export type Project = {
  id: number;
  user_id: number;
  name: string;
  shapes_data: Shape[];
  background_color: string;
  updated_at: string;
  created_at: string;
};

export const authApi = {
  register: (username: string, email: string, password: string) =>
    request<{ token: string; user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password }),
    }),

  login: (email: string, password: string) =>
    request<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  me: () => request<{ user: User }>("/auth/me"),
};

export const projectsApi = {
  list: () => request<{ projects: Omit<Project, "shapes_data">[] }>("/projects"),

  get: (id: number) => request<{ project: Project }>(`/projects/${id}`),

  create: (name: string, shapes_data: Shape[], background_color: string) =>
    request<{ project: Project }>("/projects", {
      method: "POST",
      body: JSON.stringify({ name, shapes_data, background_color }),
    }),

  update: (id: number, data: Partial<{ name: string; shapes_data: Shape[]; background_color: string }>) =>
    request<{ project: Project }>(`/projects/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),

  delete: (id: number) =>
    request<{ success: boolean }>(`/projects/${id}`, { method: "DELETE" }),
};
