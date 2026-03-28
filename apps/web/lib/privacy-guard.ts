/**
 * Privacy guard — rejects any feed event containing forbidden keys.
 *
 * This is the client-side enforcement layer. The server sanitizes events
 * before broadcast, but this guard provides defense-in-depth: if a
 * forbidden key somehow arrives, the event is dropped and logged.
 *
 * Forbidden keys: trace_*, cot, chain_of_thought, prompt, secret, token,
 * api_key, access_token, refresh_token, password, credential
 */

const FORBIDDEN_PREFIXES = ["trace_", "cot"];
const FORBIDDEN_EXACT = new Set([
  "chain_of_thought",
  "prompt",
  "secret",
  "token",
  "reasoning_trace",
  "context_tokens",
  "reasoning_tokens",
  "decision_tokens",
  "total_tokens",
  "api_key",
  "private_key",
  "access_token",
  "refresh_token",
  "password",
  "credential",
]);

function isForbiddenKey(key: string): boolean {
  const lower = key.toLowerCase();
  if (FORBIDDEN_EXACT.has(lower)) return true;
  return FORBIDDEN_PREFIXES.some((p) => lower.startsWith(p));
}

/**
 * Recursively check a value for forbidden keys.
 * Returns the list of forbidden keys found (empty = safe).
 */
function findForbiddenKeys(value: unknown, path = ""): string[] {
  const found: string[] = [];
  if (value && typeof value === "object" && !Array.isArray(value)) {
    for (const [key, val] of Object.entries(value)) {
      if (isForbiddenKey(key)) {
        found.push(path ? `${path}.${key}` : key);
      }
      found.push(...findForbiddenKeys(val, path ? `${path}.${key}` : key));
    }
  } else if (Array.isArray(value)) {
    value.forEach((item, i) => {
      found.push(...findForbiddenKeys(item, `${path}[${i}]`));
    });
  }
  return found;
}

/**
 * Validate that a feed event contains no forbidden keys.
 *
 * @returns `true` if the event is safe, `false` if it contains forbidden keys.
 */
export function validateFeedEvent(event: unknown): boolean {
  const forbidden = findForbiddenKeys(event);
  if (forbidden.length > 0) {
    console.error(
      `[privacy-guard] REJECTED feed event containing forbidden keys: ${forbidden.join(", ")}`,
    );
    return false;
  }
  return true;
}

/**
 * Strip forbidden keys from an object (client-side defense-in-depth).
 * Returns a new object with forbidden keys removed.
 */
export function sanitizeEvent<T>(event: T): T {
  if (!event || typeof event !== "object") return event;
  if (Array.isArray(event)) {
    return event.map(sanitizeEvent) as T;
  }
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(event)) {
    if (!isForbiddenKey(key)) {
      result[key] = sanitizeEvent(val);
    }
  }
  return result as T;
}
