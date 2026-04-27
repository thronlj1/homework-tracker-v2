import { NextRequest, NextResponse } from 'next/server';
import { createSystemConfig, getSystemConfig, updateSystemConfig } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const classIdParam = request.nextUrl.searchParams.get('classId');
    const classId = classIdParam ? Number(classIdParam) : undefined;
    const config = await getSystemConfig(Number.isFinite(classId) ? classId : undefined);
    return NextResponse.json({
      success: true,
      data: {
        enabled: config?.student_reminder_voice_enabled ?? true,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '获取教师提醒语音开关失败',
      },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const enabled = Boolean(body?.enabled);
    const classId = body?.classId ? Number(body.classId) : undefined;
    const config = await getSystemConfig(Number.isFinite(classId) ? classId : undefined);

    if (config) {
      await updateSystemConfig(config.id, {
        student_reminder_voice_enabled: enabled,
      });
    } else {
      await createSystemConfig({
        class_id: Number.isFinite(classId) ? classId : undefined,
        student_reminder_voice_enabled: enabled,
      });
    }

    return NextResponse.json({ success: true, data: { enabled } });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : '更新教师提醒语音开关失败',
      },
      { status: 500 },
    );
  }
}
