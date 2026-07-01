import type { Project } from "./screen-schema";

const KEY = "nova-project";

export function saveProject(p: Project) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export function loadProject(): Project | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Project;
  } catch {
    return null;
  }
}

export function clearProject() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
}