import { NextRequest, NextResponse } from 'next/server';
import { deleteHomeworkRecord } from '@/lib/database';

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({
        success: false,
        message: '作业记录ID不能为空',
      }, { status: 400 });
    }

    await deleteHomeworkRecord(parseInt(id, 10));
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete homework record error:', error);
    return NextResponse.json({
      success: false,
      message: error instanceof Error ? error.message : '删除作业记录失败',
    }, { status: 500 });
  }
}
