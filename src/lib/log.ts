type Level = "debug" | "info" | "warn" | "error";
function emit(level: Level, msg: string, ctx?: Record<string, unknown>) {
  const line = JSON.stringify({ ts: new Date().toISOString(), level, msg, ...ctx });
  if (level === "error") console.error(line); else console.log(line);
}
export const log = {
  debug: (m: string, c?: Record<string, unknown>) => emit("debug", m, c),
  info: (m: string, c?: Record<string, unknown>) => emit("info", m, c),
  warn: (m: string, c?: Record<string, unknown>) => emit("warn", m, c),
  error: (m: string, c?: Record<string, unknown>) => emit("error", m, c),
};
