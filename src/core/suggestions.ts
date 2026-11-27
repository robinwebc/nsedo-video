import { timelineDuration } from "./time";
import type { Lang, Project } from "./types";

export interface Suggestion {
  command: string;
  label: string;
}

export function suggestCommands(project: Project, lang: Lang): Suggestion[] {
  const bn = lang === "bn";
  const items: Suggestion[] = [];
  const duration = timelineDuration(project.clips);
  if (duration > 4) {
    items.push(
      bn
        ? { command: "প্রথম ৫ সেকেন্ড কেটে দাও", label: "প্রথম ৫ সে. কাটো" }
        : { command: "cut the first 5 seconds", label: "Cut first 5s" },
    );
  }
  if (project.aspect !== "9:16") {
    items.push(
      bn
        ? { command: "রিলসের জন্য ৯:১৬ করো", label: "রিলস ৯:১৬" }
        : { command: "make it 9:16 for Reels", label: "9:16 Reels" },
    );
  }
  items.push(bn ? { command: "স্পিড ১.৫x", label: "স্পিড ১.৫x" } : { command: "speed 1.5x", label: "Speed 1.5x" });
  items.push(
    bn ? { command: "নীরবতা সরাও", label: "নীরবতা সরাও" } : { command: "remove silence", label: "Remove silence" },
  );
  if (project.captions.length === 0) {
    items.push(
      bn
        ? { command: "বাংলা সাবটাইটেল যোগ করো", label: "বাংলা সাবটাইটেল" }
        : { command: "add Bangla subtitles", label: "Bangla subtitles" },
    );
  }
  if (project.texts.length === 0) {
    items.push(bn ? { command: "টাইটেল যোগ করো", label: "টাইটেল" } : { command: "add text title", label: "Add title" });
  }
  if (!project.music && !project.musicPending) {
    items.push(
      bn
        ? { command: "ব্যাকগ্রাউন্ড মিউজিক যোগ করো", label: "সঙ্গীত" }
        : { command: "add background music", label: "Music" },
    );
  }
  if (duration > 12) {
    items.push(
      bn ? { command: "হাইলাইট রিল বানাও", label: "হাইলাইট" } : { command: "make a highlight reel", label: "Highlight" },
    );
  }
  return items.slice(0, 8);
}
