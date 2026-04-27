import { NextRequest, NextResponse } from 'next/server';
import { getClassReminder, setClassReminder } from '@/lib/reminder-store';

export async function GET(request: NextRequest) {
  try {
    const classIdParam = new URL(request.url).searchParams.get('classId');
    const classId = Number(classIdParam);
    if (!Number.isFinite(classId) || classId <= 0) {
      return NextResponse.json({ success: false, message: '班级ID无效' }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: getClassReminder(classId) });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : '获取催交提醒失败' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { classId, message } = await request.json();
    const parsedClassId = Number(classId);
    if (!Number.isFinite(parsedClassId) || parsedClassId <= 0) {
      return NextResponse.json({ success: false, message: '班级ID无效' }, { status: 400 });
    }
    if (!message || typeof message !== 'string') {
      return NextResponse.json({ success: false, message: '催交文案不能为空' }, { status: 400 });
    }

    const record = setClassReminder(parsedClassId, message);
    return NextResponse.json({ success: true, data: record });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : '发布催交提醒失败' },
      { status: 500 }
    );
  }
}
