import { NextRequest, NextResponse } from 'next/server';
import { createExemption, deleteExemption } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const { classId, studentId, subjectId, date, reason } = await request.json();
    
    if (!classId || !studentId || !subjectId || !date) {
      return NextResponse.json({ 
        success: false, 
        message: '缺少必要参数' 
      }, { status: 400 });
    }
    
    const exemption = await createExemption(
      parseInt(classId, 10),
      parseInt(studentId, 10),
      parseInt(subjectId, 10),
      date,
      reason
    );
    
    return NextResponse.json({ success: true, data: exemption });
  } catch (error) {
    console.error('Create exemption error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error instanceof Error ? error.message : '创建豁免记录失败' 
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
        message: '豁免记录ID不能为空' 
      }, { status: 400 });
    }
    
    await deleteExemption(parseInt(id, 10));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete exemption error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error instanceof Error ? error.message : '删除豁免记录失败' 
    }, { status: 500 });
  }
}
