import { useEffect, useState } from "react";
import { createProjectFromFile, EditorScreen, removeProject } from "./components/Editor";
import { Home } from "./components/Home";
import { SettingsDialog } from "./components/Dialogs";
import { listProjects, type LibraryEntry } from "./lib/library";
import { loadSettings, saveSettings } from "./lib/settingsStore";

type Route = { name: "home" } | { name: "editor"; id: string };

export function App() {
  const [route, setRoute] = useState<Route>({ name: "home" });
  const [projects, setProjects] = useState<LibraryEntry[]>([]);
  const [settingsOpen, setSettingsOpen] = useState(false);

  function refresh() {
    setProjects(listProjects());
  }

  useEffect(() => {
    refresh();
  }, [route]);

  return (
    <>
      {route.name === "home" ? (
        <Home
          projects={projects}
          onCreate={(file) => {
            void createProjectFromFile(file).then((id) => {
              refresh();
              setRoute({ name: "editor", id });
            });
          }}
          onOpen={(id) => setRoute({ name: "editor", id })}
          onDelete={(id) => {
            void removeProject(id).then(refresh);
          }}
          onSettings={() => setSettingsOpen(true)}
        />
      ) : (
        <EditorScreen projectId={route.id} onHome={() => setRoute({ name: "home" })} />
      )}
      {settingsOpen && route.name === "home" ? (
        <SettingsDialog initial={loadSettings()} onSave={saveSettings} onClose={() => setSettingsOpen(false)} />
      ) : null}
    </>
  );
}
