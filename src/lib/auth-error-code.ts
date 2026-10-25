// Public Firebase error identifiers only. Never expose provider messages or credentials.
export function publicAuthErrorCode(error: unknown): string | null {
  const code = typeof error === "object" && error !== null && "code" in error ? error.code : null;
  return typeof code === "string" && /^auth\/[a-z0-9-]{1,80}$/.test(code) ? code : null;
}
