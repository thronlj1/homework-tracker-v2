import { NextRequest, NextResponse } from 'next/server';
import { getClassById, getStudentStatuses, getSubjectById, getTodayDate } from '@/lib/database';
import { setClassReminder } from '@/lib/reminder-store';

function buildReminderMessage(subjectName: string, notSubmittedNames: string[]): string {
  return `${subjectName}还有 ${notSubmittedNames.length} 位同学未交：${notSubmittedNames.join('、')}。请尽快提交。`;
}

export async function GET(request: NextRequest) {
  try {
    const classIdParam = request.nextUrl.searchParams.get('classId');
    const subjectIdParam = request.nextUrl.searchParams.get('subjectId');
    const classId = Number(classIdParam);
    const subjectId = Number(subjectIdParam);

    if (!Number.isFinite(classId) || classId <= 0 || !Number.isFinite(subjectId) || subjectId <= 0) {
      return new NextResponse('参数错误：classId/subjectId 无效', { status: 400 });
    }

    const [classInfo, subjectInfo, statuses] = await Promise.all([
      getClassById(classId),
      getSubjectById(subjectId),
      getStudentStatuses(classId, subjectId, getTodayDate()),
    ]);

    if (!classInfo || !subjectInfo) {
      return new NextResponse('班级或科目不存在', { status: 404 });
    }

    const notSubmittedNames = statuses
      .filter((s) => s.status === 'not_submitted')
      .map((s) => s.student_name);

    if (notSubmittedNames.length === 0) {
      return new NextResponse(`已处理：${classInfo.name}【${subjectInfo.name}】当前无人未交，无需催交。`, {
        status: 200,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    const message = buildReminderMessage(subjectInfo.name, notSubmittedNames);
    setClassReminder(classId, message);

    return new NextResponse(`催交已发送到学生端：${classInfo.name}【${subjectInfo.name}】未交 ${notSubmittedNames.length} 人。`, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  } catch (error) {
    return new NextResponse(
      `触发催交失败：${error instanceof Error ? error.message : 'unknown error'}`,
      {
        status: 500,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      }
    );
  }
}
