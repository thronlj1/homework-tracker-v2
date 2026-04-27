import { NextRequest, NextResponse } from 'next/server';
import { runHomeworkDeadlineJobWithOptions } from '@/lib/homework-deadline-job';

export async function POST(request: NextRequest) {
  try {
    if ((process.env.NEXT_PUBLIC_APP_MODE ?? 'prod') !== 'debug') {
      return NextResponse.json({ success: false, message: '仅 debug 模式可用' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const onlyClassId =
      body && typeof body.classId !== 'undefined' ? Number(body.classId) : undefined;

    const baseUrl = process.env.APP_BASE_URL || request.nextUrl.origin;
    await runHomeworkDeadlineJobWithOptions(baseUrl, {
      force: true,
      ignoreDedup: true,
      onlyClassId: Number.isFinite(onlyClassId) ? onlyClassId : undefined,
    });

    return NextResponse.json({
      success: true,
      message: '已触发钉钉提醒调试发送',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '调试发送失败',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    if ((process.env.NEXT_PUBLIC_APP_MODE ?? 'prod') !== 'debug') {
      return NextResponse.json({ success: false, message: '仅 debug 模式可用' }, { status: 403 });
    }

    const classIdParam = request.nextUrl.searchParams.get('classId');
    const onlyClassId = classIdParam ? Number(classIdParam) : undefined;

    const baseUrl = process.env.APP_BASE_URL || request.nextUrl.origin;
    await runHomeworkDeadlineJobWithOptions(baseUrl, {
      force: true,
      ignoreDedup: true,
      onlyClassId: Number.isFinite(onlyClassId) ? onlyClassId : undefined,
    });

    return NextResponse.json({
      success: true,
      message: '已触发钉钉提醒调试发送',
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '调试发送失败',
      },
      { status: 500 }
    );
  }
}
