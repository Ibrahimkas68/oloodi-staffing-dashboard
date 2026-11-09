/**
 * A random id that tags one request, so the server log and the browser can be matched up.
 *
 * `crypto.randomUUID` only exists in a secure context (https, or localhost). Opened over plain http
 * at any other address (a phone on the same wifi, the e2e container, a server without TLS) it is
 * undefined, and calling it would stop every action button before it sent anything. So fall back to
 * `getRandomValues`, which exists everywhere, and build a version 4 UUID from it.
 */
export function newRequestId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8]! & 0x3f) | 0x80; // variant 10xx
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
