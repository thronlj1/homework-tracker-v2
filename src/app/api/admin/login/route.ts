import { NextRequest, NextResponse } from 'next/server';
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
  getAdminCookieOptions,
  validateAdminCredentials,
} from '@/lib/admin-auth';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();
    if (!username || !password) {
      return NextResponse.json({ success: false, message: '请输入管理员账号和密码' }, { status: 400 });
    }
    if (!validateAdminCredentials(String(username), String(password))) {
      return NextResponse.json({ success: false, message: '账号或密码错误' }, { status: 401 });
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set(ADMIN_SESSION_COOKIE, createAdminSessionToken(String(username)), getAdminCookieOptions());
    return response;
  } catch {
    return NextResponse.json({ success: false, message: '登录失败，请重试' }, { status: 500 });
  }
}
