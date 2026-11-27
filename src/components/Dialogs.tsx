import { useState } from "react";
import { endpointAllowed, type AiSettings } from "../core/agent";
import type { ProgressInfo } from "../lib/process";
import type { Quality } from "../core/types";
import { usePrefs } from "../ui/prefs";
import { IconClose } from "./Icons";

export function ExportDialog(props: {
  quality: Quality;
  onQuality: (quality: Quality) => void;
  busy: boolean;
  progress: ProgressInfo | null;
  error: string | null;
  log: string;
  resultName: string | null;
  savedUri: string | null;
  onStart: () => void;
  onDownload: () => void;
  onClose: () => void;
}) {
  const { t } = usePrefs();
  const phase = props.progress
    ? props.progress.phase === "clip"
      ? t("phaseClip", { n: (props.progress.index ?? 0) + 1, total: props.progress.total ?? 1 })
      : props.progress.phase === "join"
        ? t("phaseJoin")
        : props.progress.phase === "finish"
          ? t("phaseFinish")
          : props.progress.phase === "save"
            ? t("phaseSave")
            : t("phaseLoad")
    : "";
  return (
    <div className="dialog-backdrop">
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="export-title">
        <header className="dialog-head">
          <h2 id="export-title">{t("exportTitle")}</h2>
          <button type="button" className="icon-button" onClick={props.onClose} aria-label={t("close")} disabled={props.busy}>
            <IconClose />
          </button>
        </header>
        <p>{t("exportBody")}</p>
        <div className="choice" role="radiogroup" aria-label={t("quality")}>
          {(["draft", "standard", "high"] as Quality[]).map((quality) => (
            <button
              key={quality}
              type="button"
              role="radio"
              aria-checked={props.quality === quality}
              className={props.quality === quality ? "is-on" : ""}
              onClick={() => props.onQuality(quality)}
              disabled={props.busy}
            >
              {quality === "draft" ? t("qualityDraft") : quality === "high" ? t("qualityHigh") : t("qualityStandard")}
            </button>
          ))}
        </div>
        {props.progress ? (
          <div className="progress-block">
            <div className="progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(props.progress.ratio * 100)} role="progressbar">
              <span style={{ width: `${Math.round(props.progress.ratio * 100)}%` }} />
            </div>
            <p className="hint">{phase}</p>
          </div>
        ) : null}
        {props.error ? <p className="error">{props.error}</p> : null}
        {props.log ? (
          <details>
            <summary>{t("log")}</summary>
            <pre>{props.log.slice(-1800)}</pre>
          </details>
        ) : null}
        {props.savedUri ? <p className="banner">{t("savedGallery")}</p> : null}
        {props.resultName && !props.savedUri ? <p className="banner">{props.resultName}</p> : null}
        <div className="plan-actions">
          {props.resultName && !props.savedUri ? (
            <button type="button" className="btn btn-primary" onClick={props.onDownload}>
              {t("download")}
            </button>
          ) : (
            <button type="button" className="btn btn-primary" onClick={props.onStart} disabled={props.busy}>
              {props.busy ? t("exportWorking") : t("exportAction")}
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={props.onClose} disabled={props.busy}>
            {t("close")}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SettingsDialog(props: { initial: AiSettings; onSave: (settings: AiSettings) => void; onClose: () => void }) {
  const { t } = usePrefs();
  const [settings, setSettings] = useState(props.initial);
  const [status, setStatus] = useState("");
  const patch = (partial: Partial<AiSettings>) => setSettings((current) => ({ ...current, ...partial }));

  async function check() {
    setStatus("");
    if (!endpointAllowed(settings.aiBaseUrl)) {
      setStatus(t("endpointBlocked"));
      return;
    }
    try {
      const response = await fetch(`${settings.aiBaseUrl.replace(/\/$/, "")}/models`, {
        headers: settings.aiApiKey ? { Authorization: `Bearer ${settings.aiApiKey}` } : {},
      });
      setStatus(response.ok ? "OK" : `HTTP ${response.status}`);
    } catch {
      setStatus(t("corsHint"));
    }
  }

  return (
    <div className="dialog-backdrop">
      <div className="dialog dialog-wide" role="dialog" aria-modal="true" aria-labelledby="settings-title">
        <header className="dialog-head">
          <h2 id="settings-title">{t("settings")}</h2>
          <button type="button" className="icon-button" onClick={props.onClose} aria-label={t("close")}>
            <IconClose />
          </button>
        </header>
        <p>{t("keyHint")}</p>
        <h3>{t("aiSection")}</h3>
        <div className="stack">
          <label className="field">
            <span>{t("baseUrl")}</span>
            <input value={settings.aiBaseUrl} onChange={(event) => patch({ aiBaseUrl: event.target.value })} spellCheck={false} />
          </label>
          <label className="field">
            <span>{t("model")}</span>
            <input value={settings.aiModel} onChange={(event) => patch({ aiModel: event.target.value })} spellCheck={false} />
          </label>
          <label className="field">
            <span>{t("apiKey")}</span>
            <input type="password" value={settings.aiApiKey} autoComplete="off" onChange={(event) => patch({ aiApiKey: event.target.value })} />
          </label>
        </div>
        <h3>{t("whisperSection")}</h3>
        <div className="stack">
          <label className="field">
            <span>{t("baseUrl")}</span>
            <input value={settings.whisperBaseUrl} onChange={(event) => patch({ whisperBaseUrl: event.target.value })} spellCheck={false} />
          </label>
          <label className="field">
            <span>{t("model")}</span>
            <input value={settings.whisperModel} onChange={(event) => patch({ whisperModel: event.target.value })} spellCheck={false} />
          </label>
          <label className="field">
            <span>{t("apiKey")}</span>
            <input
              type="password"
              value={settings.whisperApiKey}
              autoComplete="off"
              onChange={(event) => patch({ whisperApiKey: event.target.value })}
            />
          </label>
        </div>
        <p className="hint">{t("corsHint")}</p>
        {status ? <p className="banner">{status}</p> : null}
        <div className="plan-actions">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              props.onSave(settings);
              props.onClose();
            }}
          >
            {t("save")}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => void check()}>
            {t("testConnection")}
          </button>
        </div>
      </div>
    </div>
  );
}
