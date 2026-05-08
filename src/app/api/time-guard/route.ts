import { NextRequest, NextResponse } from 'next/server';
import { checkTimeGuard, getTodayDate, getCurrentTime } from '@/lib/database';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get('classId');
    
    const status = await checkTimeGuard(classId ? parseInt(classId, 10) : undefined);
    
    return NextResponse.json({ 
      success: true, 
      data: status,
      debug: {
        todayDate: getTodayDate(),
        currentTime: getCurrentTime(),
        rawUTC: new Date().toISOString(),
        rawLocal: new Date().toString(),
      }
    });
  } catch (error) {
    console.error('Check time guard error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error instanceof Error ? error.message : '检查时间守卫失败' 
    }, { status: 500 });
  }
}
