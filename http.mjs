import { createHash, timingSafeEqual } from 'node:crypto';

export const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });

export function authOk(req, expected) {
  if (!expected || expected.length < 16) return false; // без довољно дугог токена све је закључано
  const got = req.headers.get('x-token') || '';
  const a = createHash('sha256').update(got).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}
