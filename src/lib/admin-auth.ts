import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

export const ADMIN_SESSION_COOKIE = 'ht_admin_session';
const SESSION_TTL_SECONDS = 12 * 60 * 60;

function getAdminUsername(): string {
  return process.env.ADMIN_USERNAME ?? 'admin';
}

function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD ?? 'admin123456';
}

function getSessionSecret(): string {
  return process.env.ADMIN_SESSION_SECRET ?? process.env.SUPABASE_ANON_KEY ?? 'homework-tracker-admin-session';
}

function sign(payload: string): string {
  return createHmac('sha256', getSessionSecret()).update(payload).digest('hex');
}

export function validateAdminCredentials(username: string, password: string): boolean {
  return username === getAdminUsername() && password === getAdminPassword();
}

export function createAdminSessionToken(username: string): string {
  const issuedAt = Date.now().toString();
  const payload = `${username}:${issuedAt}`;
  const signature = sign(payload);
  return Buffer.from(`${payload}:${signature}`).toString('base64url');
}

export function verifyAdminSessionToken(token?: string): boolean {
  if (!token) return false;
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const [username, issuedAtText, signature] = decoded.split(':');
    if (!username || !issuedAtText || !signature) return false;
    if (username !== getAdminUsername()) return false;

    const issuedAt = Number(issuedAtText);
    if (!Number.isFinite(issuedAt)) return false;
    if (Date.now() - issuedAt > SESSION_TTL_SECONDS * 1000) return false;

    const expected = sign(`${username}:${issuedAtText}`);
    const sigBuf = Buffer.from(signature, 'utf-8');
    const expectedBuf = Buffer.from(expected, 'utf-8');
    if (sigBuf.length !== expectedBuf.length) return false;

    return timingSafeEqual(sigBuf, expectedBuf);
  } catch {
    return false;
  }
}

export function isAdminRequest(request: NextRequest): boolean {
  return verifyAdminSessionToken(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);
}

export function requireAdmin(request: NextRequest): NextResponse | null {
  if (isAdminRequest(request)) return null;
  return NextResponse.json({ success: false, message: '管理员登录已过期，请重新登录' }, { status: 401 });
}

export function getAdminCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  };
}
