import { NextRequest, NextResponse } from 'next/server';
import { getClasses, createClass, getClassById } from '@/lib/database';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (id) {
      const classInfo = await getClassById(parseInt(id, 10));
      return NextResponse.json({ success: true, data: classInfo });
    }
    return NextResponse.json({ success: true, data: await getClasses() });
  } catch (error) {
    console.error('Get classes error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error instanceof Error ? error.message : '获取班级列表失败' 
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
    const { updateClass } = await import('@/lib/database');
    const updated = await updateClass(parseInt(String(id), 10), updates);
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('Update class error:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : '更新班级失败',
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
        message: '班级ID不能为空',
      }, { status: 400 });
    }
    const { deleteClass } = await import('@/lib/database');
    await deleteClass(parseInt(id, 10));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete class error:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : '删除班级失败',
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResponse = requireAdmin(request);
    if (authResponse) return authResponse;

    const { name, classImage } = await request.json();
    
    if (!name || !name.trim()) {
      return NextResponse.json({ 
        success: false, 
        message: '班级名称不能为空' 
      }, { status: 400 });
    }
    
    const newClass = await createClass(name.trim(), classImage);
    return NextResponse.json({ success: true, data: newClass });
  } catch (error) {
    console.error('Create class error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error instanceof Error ? error.message : '创建班级失败' 
    }, { status: 500 });
  }
}
