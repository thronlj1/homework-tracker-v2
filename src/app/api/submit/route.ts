import { NextRequest, NextResponse } from 'next/server';
import { submitHomeworkWithValidation } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const { qrCode } = await request.json();
    
    if (!qrCode) {
      return NextResponse.json({ 
        success: false, 
        message: '二维码数据不能为空' 
      }, { status: 400 });
    }
    
    const result = await submitHomeworkWithValidation(qrCode);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Submit homework error:', error);
    return NextResponse.json({ 
      success: false, 
      message: '服务器错误，请重试' 
    }, { status: 500 });
  }
}
