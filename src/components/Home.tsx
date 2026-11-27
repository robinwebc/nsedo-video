import { timelineDuration } from "../core/time";
import { formatTimecode } from "../core/time";
import type { LibraryEntry } from "../lib/library";
import { usePrefs } from "../ui/prefs";
import { IconMoon, IconSettings, IconSun, Mark } from "./Icons";

export function Home(props: {
  projects: LibraryEntry[];
  onCreate: (file: File) => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onSettings: () => void;
}) {
  const { t, lang, theme, setLang, setTheme } = usePrefs();
  return (
    <div className="home">
      <header className="topbar">
        <div className="brand">
          <Mark />
          <span className="brand-name">
            nSedo <em>Video</em>
          </span>
        </div>
        <div className="top-actions">
          <div className="seg" role="group" aria-label={t("language")}>
            <button type="button" className={lang === "bn" ? "is-on" : ""} onClick={() => setLang("bn")}>
              বাংলা
            </button>
            <button type="button" className={lang === "en" ? "is-on" : ""} onClick={() => setLang("en")}>
              English
            </button>
          </div>
          <button
            type="button"
            className="icon-button"
            aria-label={theme === "dark" ? t("themeLight") : t("themeDark")}
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          >
            {theme === "dark" ? <IconSun /> : <IconMoon />}
          </button>
          <button type="button" className="icon-button" aria-label={t("settings")} onClick={props.onSettings}>
            <IconSettings />
          </button>
        </div>
      </header>
      <main className="home-main">
        <p className="kicker">{t("kicker")}</p>
        <h1>{t("headline")}</h1>
        <p className="lede">{t("lede")}</p>
        <div className="actions">
          <label className="btn btn-primary file-btn">
            {t("newProject")}
            <input
              type="file"
              accept="video/*,.mp4,.webm,.mov,.mkv"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) props.onCreate(file);
                event.target.value = "";
              }}
            />
          </label>
          <button type="button" className="btn btn-ghost" onClick={props.onSettings}>
            {t("settings")}
          </button>
        </div>
        <aside className="privacy">
          <strong>{t("privacyTitle")}</strong>
          <p>{t("privacyBody")}</p>
        </aside>
        <section>
          <h2>{t("recent")}</h2>
          {props.projects.length === 0 ? (
            <div className="empty">
              <strong>{t("emptyTitle")}</strong>
              <p>{t("emptyBody")}</p>
            </div>
          ) : (
            <ul className="project-list">
              {props.projects.map((entry) => (
                <li key={entry.project.id}>
                  <button type="button" className="project-main" onClick={() => props.onOpen(entry.project.id)}>
                    <span className="project-name">{entry.project.name}</span>
                    <span className="project-meta">
                      {t("clipsCount", { n: entry.project.clips.length })} · {formatTimecode(timelineDuration(entry.project.clips))} ·{" "}
                      {new Date(entry.updatedAt).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB")}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      if (window.confirm(t("confirmDelete"))) props.onDelete(entry.project.id);
                    }}
                  >
                    {t("delete")}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
