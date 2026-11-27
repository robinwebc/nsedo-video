import type { Project } from "../core/types";

const KEY = "nsedo.library.v1";

export interface LibraryEntry {
  project: Project;
  updatedAt: number;
}

function read(): LibraryEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as LibraryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(entries: LibraryEntry[]): void {
  localStorage.setItem(KEY, JSON.stringify(entries));
}

export function listProjects(): LibraryEntry[] {
  return read().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function loadProject(id: string): Project | null {
  return read().find((entry) => entry.project.id === id)?.project ?? null;
}

export function saveProject(project: Project): void {
  const entries = read().filter((entry) => entry.project.id !== project.id);
  entries.push({ project, updatedAt: Date.now() });
  write(entries);
}

export function deleteStoredProject(id: string): void {
  write(read().filter((entry) => entry.project.id !== id));
}
