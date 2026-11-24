// The chat this person was last in, on this browser (docs/DECISIONS.md D-060). Only the New chat
// button starts a new one; everything else (the sidebar, Home's box, Find → Answer) comes back here.
// Kept per person in this browser, not read from the server: demo people are shared by every
// visitor, so "their latest chat" on the server may be a stranger's.

const HOURS = 8;
const key = (email: string) => `atlas-last-chat:${email}`;

export function rememberChat(email: string, id: string) {
  try {
    localStorage.setItem(key(email), JSON.stringify({ id, at: Date.now() }));
  } catch {}
}

/** null: none yet, or nothing happened in it for 8 hours (an old subject would confuse a new question). */
export function lastChat(email: string): string | null {
  try {
    const v = JSON.parse(localStorage.getItem(key(email)) ?? "null");
    return v && typeof v.id === "string" && /^[\w-]{1,64}$/.test(v.id) && Date.now() - v.at < HOURS * 3600_000 ? v.id : null;
  } catch {
    return null;
  }
}
