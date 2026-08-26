// Small leveled, structured logger for the Worker. Set the level once per
// invocation from env.LOG_LEVEL (error < warn < info < debug). Output is JSON
// so it is easy to filter in `wrangler tail` / observability.
export type Level = "error" | "warn" | "info" | "debug";

const ORDER: Record<Level, number> = { error: 0, warn: 1, info: 2, debug: 3 };

let threshold = ORDER.info;

export function setLevel(level: string | undefined): void {
  const l = (level ?? "info").toLowerCase() as Level;
  threshold = ORDER[l] ?? ORDER.info;
}

function emit(level: Level, msg: string, data?: unknown): void {
  if (ORDER[level] > threshold) return;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    ...(data !== undefined ? { data } : {}),
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else if (level === "debug") console.debug(line);
  else console.log(line);
}

export const log = {
  error: (msg: string, data?: unknown) => emit("error", msg, data),
  warn: (msg: string, data?: unknown) => emit("warn", msg, data),
  info: (msg: string, data?: unknown) => emit("info", msg, data),
  debug: (msg: string, data?: unknown) => emit("debug", msg, data),
};
