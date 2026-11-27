import type { EditOp } from "../core/types";
import { describeOp } from "../core/describe";
import type { CommandPlan } from "../core/parser";
import type { Suggestion } from "../core/suggestions";
import { usePrefs } from "../ui/prefs";

interface CommandBarProps {
  value: string;
  onChange: (value: string) => void;
  onPlan: () => void;
  busy: boolean;
  suggestions: Suggestion[];
  onSuggest: (command: string) => void;
  plan: (CommandPlan & { fallbackReason?: string }) | null;
  onPlanChange: (ops: EditOp[]) => void;
  onApply: () => void;
  onDismiss: () => void;
  notice: string | null;
}

export function CommandBar(props: CommandBarProps) {
  const { t, lang } = usePrefs();
  const plan = props.plan;
  return (
    <section className="command">
      <form
        className="command-row"
        onSubmit={(event) => {
          event.preventDefault();
          props.onPlan();
        }}
      >
        <label htmlFor="command">{t("commandLabel")}</label>
        <input
          id="command"
          value={props.value}
          placeholder={t("commandPlaceholder")}
          onChange={(event) => props.onChange(event.target.value)}
          disabled={props.busy}
        />
        <button type="submit" className="btn btn-primary" disabled={props.busy || !props.value.trim()}>
          {props.busy ? t("planning") : t("planAction")}
        </button>
      </form>
      <div className="chips" role="list">
        {props.suggestions.map((item) => (
          <button key={item.command} type="button" className="chip" onClick={() => props.onSuggest(item.command)} disabled={props.busy}>
            {item.label}
          </button>
        ))}
      </div>
      {props.notice ? (
        <p className="banner" role="status">
          {props.notice}
        </p>
      ) : null}
      {plan ? (
        <div className="plan" aria-live="polite">
          <header className="plan-head">
            <strong>{plan.summary}</strong>
            <span className="badge">{plan.source === "model" ? t("modelBadge") : t("rulesBadge")}</span>
          </header>
          {plan.fallbackReason ? <p className="hint">{t("fallback")}</p> : null}
          {plan.ops.length === 0 ? <p className="hint">{t("noPlan")}</p> : null}
          <ul>
            {plan.ops.map((op, index) => (
              <li key={`${op.op}-${index}`} className="plan-row">
                <span>{describeOp(op, lang)}</span>
                <OpFields
                  op={op}
                  onChange={(next) => props.onPlanChange(plan.ops.map((item, itemIndex) => (itemIndex === index ? next : item)))}
                />
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => props.onPlanChange(plan.ops.filter((_, itemIndex) => itemIndex !== index))}
                >
                  {t("dismiss")}
                </button>
              </li>
            ))}
          </ul>
          <div className="plan-actions">
            <button type="button" className="btn btn-primary" onClick={props.onApply} disabled={props.busy || plan.ops.length === 0}>
              {t("apply")}
            </button>
            <button type="button" className="btn btn-ghost" onClick={props.onDismiss}>
              {t("close")}
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function OpFields({ op, onChange }: { op: EditOp; onChange: (op: EditOp) => void }) {
  if (op.op === "cutHead" || op.op === "cutTail") {
    return (
      <input
        className="mini"
        type="number"
        min={0}
        step={0.1}
        value={op.seconds}
        aria-label="seconds"
        onChange={(event) => onChange({ ...op, seconds: Number(event.target.value) })}
      />
    );
  }
  if (op.op === "speed") {
    return (
      <input
        className="mini"
        type="number"
        min={0.25}
        max={4}
        step={0.05}
        value={op.rate}
        aria-label="speed"
        onChange={(event) => onChange({ ...op, rate: Number(event.target.value) })}
      />
    );
  }
  if (op.op === "text") {
    return (
      <input className="mini is-wide" value={op.text} aria-label="text" onChange={(event) => onChange({ ...op, text: event.target.value })} />
    );
  }
  if (op.op === "aspect") {
    return (
      <select value={op.aspect} aria-label="aspect" onChange={(event) => onChange({ ...op, aspect: event.target.value as typeof op.aspect })}>
        <option value="original">original</option>
        <option value="16:9">16:9</option>
        <option value="9:16">9:16</option>
        <option value="1:1">1:1</option>
      </select>
    );
  }
  return null;
}
