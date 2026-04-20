import { NextRequest, NextResponse } from 'next/server';
import { getSystemConfig, updateSystemConfig, createSystemConfig } from '@/lib/database';

export async function GET() {
  try {
    const config = await getSystemConfig();
    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    console.error('Get config error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error instanceof Error ? error.message : '获取系统配置失败' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const updates = await request.json();
    
    const existingConfig = await getSystemConfig();
    
    if (existingConfig) {
      const updated = await updateSystemConfig(existingConfig.id, updates);
      return NextResponse.json({ success: true, data: updated });
    } else {
      const created = await createSystemConfig(updates);
      return NextResponse.json({ success: true, data: created });
    }
  } catch (error) {
    console.error('Update config error:', error);
    return NextResponse.json({ 
      success: false, 
      message: error instanceof Error ? error.message : '更新系统配置失败' 
    }, { status: 500 });
  }
}
