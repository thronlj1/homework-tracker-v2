'use client';

import { Suspense, useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { checkTimeGuard, getClassById } from '@/lib/database';
import type { Class, TimeGuardStatus, SubmitResult } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

function ScannerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const classId = parseInt(searchParams.get('classId') || '0', 10);
  
  const [classInfo, setClassInfo] = useState<Class | null>(null);
  const [timeGuard, setTimeGuard] = useState<TimeGuardStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState<SubmitResult | null>(null);
  const [inputBuffer, setInputBuffer] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const bufferTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 播放提示音
  const playSound = useCallback((type: 'success' | 'duplicate' | 'invalid' | 'error') => {
    const audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    if (type === 'success') {
      oscillator.frequency.value = 880;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.3;
    } else {
      oscillator.frequency.value = 440;
      oscillator.type = 'square';
      gainNode.gain.value = 0.2;
    }
    
    oscillator.start();
    setTimeout(() => {
      oscillator.stop();
      audioContext.close();
    }, type === 'success' ? 150 : 300);
  }, []);

  // 处理扫码输入
  const handleScanInput = useCallback(async (value: string) => {
    if (!value.trim()) return;
    
    setScanning(true);
    
    try {
      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrCode: value.trim() }),
      });
      
      const result: SubmitResult = await response.json();
      setLastResult(result);
      playSound(result.type);
      
      // 2秒后清除结果显示
      setTimeout(() => {
        setLastResult(null);
      }, 2000);
      
      // 重新检查时间守卫状态
      const guardStatus = await checkTimeGuard(classId);
      setTimeGuard(guardStatus);
      
    } catch (error) {
      setLastResult({
        success: false,
        message: '提交失败，请重试',
        type: 'error',
      });
    } finally {
      setScanning(false);
      setInputBuffer('');
    }
  }, [classId, playSound]);

  // 键盘事件监听
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // 如果系统锁定，不处理输入
      if (timeGuard && !timeGuard.allowed) return;
      
      // 忽略输入框内的按键
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      // 回车键触发表单提交
      if (e.key === 'Enter') {
        if (inputBuffer.trim()) {
          handleScanInput(inputBuffer);
        }
        return;
      }
      
      // 只接受字母、数字和下划线
      if (/^[a-zA-Z0-9_]$/.test(e.key)) {
        const newBuffer = inputBuffer + e.key;
        setInputBuffer(newBuffer);
        
        // 清除之前的超时
        if (bufferTimeoutRef.current) {
          clearTimeout(bufferTimeoutRef.current);
        }
        
        // 300ms 无新输入则自动提交
        bufferTimeoutRef.current = setTimeout(() => {
          if (newBuffer.trim()) {
            handleScanInput(newBuffer);
          }
        }, 300);
      }
    }
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inputBuffer, timeGuard, handleScanInput]);

  // 加载数据
  useEffect(() => {
    async function loadData() {
      if (!classId) {
        router.push('/student');
        return;
      }
      
      try {
        setLoading(true);
        const [classData, guardStatus] = await Promise.all([
          getClassById(classId),
          checkTimeGuard(classId),
        ]);
        
        if (!classData) {
          router.push('/student');
          return;
        }
        
        setClassInfo(classData);
        setTimeGuard(guardStatus);
      } catch (error) {
        console.error('Load data error:', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
    
    // 组件卸载时清除超时
    return () => {
      if (bufferTimeoutRef.current) {
        clearTimeout(bufferTimeoutRef.current);
      }
    };
  }, [classId, router]);

  // 聚焦隐藏的输入框
  useEffect(() => {
    if (!loading && timeGuard?.allowed) {
      inputRef.current?.focus();
    }
  }, [loading, timeGuard]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-pulse">📚</div>
          <p className="text-xl text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  // 系统锁定状态
  if (timeGuard && !timeGuard.allowed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full text-center">
          <CardHeader>
            <div className="text-6xl mb-4">🔒</div>
            <CardTitle className="text-2xl">收作业已结束</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg text-gray-600 mb-4">{timeGuard.reason}</p>
            <Button onClick={() => router.push('/student')} variant="outline">
              返回选择班级
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex flex-col"
      tabIndex={0}
      ref={(el) => el?.focus()}
    >
      {/* 顶部标题栏 */}
      <header className="bg-white shadow-md p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.push('/student')} className="text-gray-600 hover:text-gray-900">
              <span className="text-2xl">←</span>
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">滴！交作业</h1>
              <p className="text-sm text-gray-500">{classInfo?.name}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-500">
              {new Date().toLocaleDateString('zh-CN', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            <p className="text-lg font-semibold text-green-600">收作业中</p>
          </div>
        </div>
      </header>

      {/* 隐藏的输入框（用于接收扫码枪输入） */}
      <input
        ref={inputRef}
        type="text"
        className="opacity-0 absolute pointer-events-none"
        onChange={(e) => {
          if (e.target.value.endsWith('\n')) {
            const value = e.target.value.trim();
            if (value) {
              handleScanInput(value);
            }
            e.target.value = '';
          }
        }}
      />

      {/* 主内容区 */}
      <main className="flex-1 flex flex-col items-center justify-center p-4">
        {/* 扫描动画区域 */}
        <div className="relative w-full max-w-md">
          <div className="aspect-square bg-white rounded-3xl shadow-xl flex flex-col items-center justify-center relative overflow-hidden">
            {/* 扫描线动画 */}
            <div className="absolute inset-0 bg-gradient-to-b from-green-400/10 via-transparent to-green-400/10 animate-pulse" />
            
            {/* 图标 */}
            <div className="text-8xl mb-6 animate-bounce">
              📱
            </div>
            
            {/* 提示文字 */}
            <p className="text-xl text-gray-600 text-center px-4">
              请扫描作业本上的二维码
            </p>
            
            {/* 扫描状态指示 */}
            {scanning && (
              <div className="mt-4 flex items-center gap-2 text-green-600">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-ping" />
                <span>处理中...</span>
              </div>
            )}
          </div>
        </div>

        {/* 结果提示 */}
        {lastResult && (
          <div 
            className={`fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 animate-in fade-in zoom-in duration-300`}
          >
            <Card className={`min-w-[300px] text-center ${
              lastResult.type === 'success' ? 'bg-green-50 border-green-500' :
              lastResult.type === 'duplicate' ? 'bg-amber-50 border-amber-500' :
              'bg-red-50 border-red-500'
            }`}>
              <CardContent className="pt-6">
                <div className="text-5xl mb-4">
                  {lastResult.type === 'success' ? '✅' :
                   lastResult.type === 'duplicate' ? '❌' : '⚠️'}
                </div>
                <p className={`text-xl font-semibold ${
                  lastResult.type === 'success' ? 'text-green-700' :
                  lastResult.type === 'duplicate' ? 'text-amber-700' :
                  'text-red-700'
                }`}>
                  {lastResult.message}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 提示信息 */}
        <div className="mt-8 text-center text-gray-500">
          <p className="text-sm">系统支持自动识别扫码枪输入</p>
          <p className="text-xs mt-1">也可直接在此页面输入二维码编号</p>
        </div>
      </main>

      {/* 底部状态栏 */}
      <footer className="bg-white border-t p-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span>等待扫码</span>
          </div>
          <div>
            今日已提交: {lastResult?.type === 'success' ? '1' : '0'} 条
          </div>
        </div>
      </footer>
    </div>
  );
}

function ScannerLoading() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-4 animate-pulse">📚</div>
        <p className="text-xl text-gray-600">加载中...</p>
      </div>
    </div>
  );
}

export default function ScannerPage() {
  return (
    <Suspense fallback={<ScannerLoading />}>
      <ScannerContent />
    </Suspense>
  );
}
