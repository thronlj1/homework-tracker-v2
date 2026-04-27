import { NextRequest, NextResponse } from 'next/server';
import { getSubjectsByClass, createSubject } from '@/lib/database';

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
    
    const subjects = await getSubjectsByClass(parseInt(classId, 10));
    return NextResponse.json({ success: true, data: subjects });
  } catch (error) {
    console.error('Get subjects error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error instanceof Error ? error.message : '获取科目列表失败' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { classId, name, subjectImage } = await request.json();
    
    if (!classId || !name) {
      return NextResponse.json({ 
        success: false, 
        message: '缺少必要参数' 
      }, { status: 400 });
    }
    
    const newSubject = await createSubject(
      parseInt(classId, 10), 
      name.trim(), 
      subjectImage
    );
    return NextResponse.json({ success: true, data: newSubject });
  } catch (error) {
    console.error('Create subject error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error instanceof Error ? error.message : '创建科目失败' 
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, updates } = await request.json();
    if (!id || !updates) {
      return NextResponse.json({
        success: false,
        message: '缺少必要参数',
      }, { status: 400 });
    }
    const { updateSubject } = await import('@/lib/database');
    const updated = await updateSubject(parseInt(String(id), 10), updates);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update subject error:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : '更新科目失败',
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({
        success: false,
        message: '科目ID不能为空',
      }, { status: 400 });
    }
    const { deleteSubject } = await import('@/lib/database');
    await deleteSubject(parseInt(id, 10));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete subject error:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : '删除科目失败',
    }, { status: 500 });
  }
}
