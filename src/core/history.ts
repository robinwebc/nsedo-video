export interface HistoryState<T> {
  past: T[];
  present: T;
  future: T[];
}

export function historyInit<T>(present: T): HistoryState<T> {
  return { past: [], present, future: [] };
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function historyCommit<T>(state: HistoryState<T>, next: T, limit = 50): HistoryState<T> {
  if (same(state.present, next)) return state;
  const past = [...state.past, state.present];
  const trimmed = past.length > limit ? past.slice(past.length - limit) : past;
  return { past: trimmed, present: next, future: [] };
}

export function historyUndo<T>(state: HistoryState<T>): HistoryState<T> {
  const previous = state.past[state.past.length - 1];
  if (previous === undefined) return state;
  return {
    past: state.past.slice(0, -1),
    present: previous,
    future: [state.present, ...state.future],
  };
}

export function historyRedo<T>(state: HistoryState<T>): HistoryState<T> {
  const [next, ...rest] = state.future;
  if (next === undefined) return state;
  return {
    past: [...state.past, state.present],
    present: next,
    future: rest,
  };
}
