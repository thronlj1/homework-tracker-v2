import { NextRequest, NextResponse } from 'next/server';
import { getStudentsByClass, createStudent, getStudentById } from '@/lib/database';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    
    if (!classId) {
      return NextResponse.json({ 
        success: false, 
        message: '班级ID不能为空' 
      }, { status: 400 });
    }
    
    const students = await getStudentsByClass(parseInt(classId, 10));
    return NextResponse.json({ success: true, data: students });
  } catch (error) {
    console.error('Get students error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error instanceof Error ? error.message : '获取学生列表失败' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResponse = requireAdmin(request);
    if (authResponse) return authResponse;

    const { classId, name, studentCode, avatarImage } = await request.json();
    
    if (!classId || !name || !studentCode) {
      return NextResponse.json({ 
        success: false, 
        message: '缺少必要参数' 
      }, { status: 400 });
    }
    
    const newStudent = await createStudent(
      parseInt(classId, 10), 
      name.trim(), 
      studentCode.trim(), 
      avatarImage
    );
    return NextResponse.json({ success: true, data: newStudent });
  } catch (error) {
    console.error('Create student error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error instanceof Error ? error.message : '创建学生失败' 
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const authResponse = requireAdmin(request);
    if (authResponse) return authResponse;

    const { id, updates } = await request.json();
    if (!id || !updates) {
      return NextResponse.json({
        success: false,
        message: '缺少必要参数',
      }, { status: 400 });
    }
    const { updateStudent } = await import('@/lib/database');
    const updated = await updateStudent(parseInt(String(id), 10), updates);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update student error:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : '更新学生失败',
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authResponse = requireAdmin(request);
    if (authResponse) return authResponse;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({
        success: false,
        message: '学生ID不能为空',
      }, { status: 400 });
    }
    const { deleteStudent } = await import('@/lib/database');
    await deleteStudent(parseInt(id, 10));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete student error:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : '删除学生失败',
    }, { status: 500 });
  }
}
