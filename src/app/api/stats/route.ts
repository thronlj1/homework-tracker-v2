import { NextRequest, NextResponse } from 'next/server';
import { getClassStats, getStudentStatuses, checkStudentWarnings } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    const subjectId = searchParams.get('subjectId');
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];
    
    if (!classId) {
      return NextResponse.json({ 
        success: false, 
        message: '班级ID不能为空' 
      }, { status: 400 });
    }
    
    const stats = await getClassStats(parseInt(classId, 10), date);
    
    // 如果指定了科目，同时返回学生状态
    let studentStatuses = null;
    let warningStudents: number[] = [];
    
    if (subjectId) {
      studentStatuses = await getStudentStatuses(
        parseInt(classId, 10), 
        parseInt(subjectId, 10), 
        date
      );
      warningStudents = await checkStudentWarnings(
        parseInt(classId, 10),
        parseInt(subjectId, 10),
        3
      );
    }
    
    return NextResponse.json({ 
      success: true, 
      data: {
        stats,
        studentStatuses,
        warningStudents,
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error instanceof Error ? error.message : '获取统计数据失败' 
    }, { status: 500 });
  }
}
