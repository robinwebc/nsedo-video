import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { messages, type MessageKey } from "../i18n/messages";
import type { Lang } from "../core/types";

type Theme = "light" | "dark";

interface Prefs {
  lang: Lang;
  theme: Theme;
  setLang: (lang: Lang) => void;
  setTheme: (theme: Theme) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}

const PrefsContext = createContext<Prefs | null>(null);

function initialTheme(): Theme {
  const stored = localStorage.getItem("nsedo.theme");
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function initialLang(): Lang {
  const stored = localStorage.getItem("nsedo.lang");
  return stored === "en" ? "en" : "bn";
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const [theme, setThemeState] = useState<Theme>(initialTheme);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("nsedo.lang", lang);
    localStorage.setItem("nsedo.theme", theme);
  }, [lang, theme]);

  const value = useMemo<Prefs>(() => {
    const t = (key: MessageKey, vars?: Record<string, string | number>) => {
      const template = messages[lang][key];
      if (!vars) return template;
      return template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? ""));
    };
    return { lang, theme, setLang: setLangState, setTheme: setThemeState, t };
  }, [lang, theme]);

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): Prefs {
  const value = useContext(PrefsContext);
  if (!value) throw new Error("prefs");
  return value;
}
