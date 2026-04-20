import { NextRequest, NextResponse } from 'next/server';
import { getClasses, createClass, getClassById } from '@/lib/database';

export async function GET() {
  try {
    const classes = await getClasses();
    return NextResponse.json({ success: true, data: classes });
  } catch (error) {
    console.error('Get classes error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error instanceof Error ? error.message : '获取班级列表失败' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
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
