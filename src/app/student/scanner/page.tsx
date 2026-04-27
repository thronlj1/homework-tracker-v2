'use client';

import { Suspense, useEffect, useState, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { checkTimeGuard, getClassById, getSystemConfig } from '@/lib/database';
import type { Class, TimeGuardStatus, SubmitResult } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';

function ScannerContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const classId = parseInt(searchParams.get('classId') || '0', 10);
  const appMode = process.env.NEXT_PUBLIC_APP_MODE ?? 'prod';
  const debugFeatureEnabled = appMode === 'debug';
  const debugFromQuery = debugFeatureEnabled && searchParams.get('debug') === '1';
  
  const [classInfo, setClassInfo] = useState<Class | null>(null);
  const [timeGuard, setTimeGuard] = useState<TimeGuardStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [lastResult, setLastResult] = useState<SubmitResult | null>(null);
  const [inputBuffer, setInputBuffer] = useState('');
  const [debugMode, setDebugMode] = useState(debugFromQuery);
  const [manualCode, setManualCode] = useState('');
  const [reminderText, setReminderText] = useState<string | null>(null);
  const [reminderId, setReminderId] = useState<string | null>(null);
  const [dismissedReminderId, setDismissedReminderId] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [reminderBroadcastTimes, setReminderBroadcastTimes] = useState(1);
  const lastPlayedReminderIdRef = useRef<string | null>(null);

  const parsedReminder = (() => {
    if (!reminderText) return null;
    const matched = reminderText.match(/^(.+?)还有\s*(\d+)\s*位同学未交[:：](.+)$/);
    if (!matched) return null;
    return {
      subjectName: matched[1].trim(),
      count: matched[2].trim(),
      names: matched[3].trim(),
    };
  })();
  const inputRef = useRef<HTMLInputElement>(null);
  const bufferTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 播放提示音
  const playSound = useCallback((type: 'success' | 'duplicate' | 'invalid' | 'error' | 'reminder') => {
    const audioContext = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();

    function playTone(
      frequency: number,
      durationMs: number,
      startDelayMs: number,
      oscillatorType: OscillatorType = 'sine',
      volume: number = 0.2
    ) {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      oscillator.frequency.value = frequency;
      oscillator.type = oscillatorType;
      gainNode.gain.value = volume;

      const startTime = audioContext.currentTime + startDelayMs / 1000;
      const endTime = startTime + durationMs / 1000;
      oscillator.start(startTime);
      oscillator.stop(endTime);
    }

    if (type === 'success') {
      // 通过提示音：短促双音，上扬
      playTone(740, 120, 0, 'sine', 0.22);
      playTone(988, 150, 140, 'sine', 0.26);
    } else if (type === 'duplicate') {
      // 重复提交：双“嘟嘟”
      playTone(420, 130, 0, 'square', 0.18);
      playTone(420, 130, 180, 'square', 0.18);
    } else if (type === 'invalid' || type === 'error') {
      // 异常提示：低频长音
      playTone(320, 260, 0, 'square', 0.2);
    } else if (type === 'reminder') {
      // 教师提醒：温和三连音
      playTone(660, 110, 0, 'triangle', 0.17);
      playTone(784, 110, 130, 'triangle', 0.17);
      playTone(988, 140, 260, 'triangle', 0.19);
    }

    setTimeout(() => {
      audioContext.close();
    }, 1200);
  }, []);

  const speakText = useCallback(
    (text: string, options?: { cancelPrevious?: boolean }) => {
      if (!voiceEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = 1;
      utterance.pitch = 1;
      if (options?.cancelPrevious !== false) {
        window.speechSynthesis.cancel();
      }
      window.speechSynthesis.speak(utterance);
    },
    [voiceEnabled]
  );

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
      if (result.type === 'success') {
        speakText(result.message);
      }
      
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
      setManualCode('');
    }
  }, [classId, playSound, speakText]);

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
        const configData = await getSystemConfig(classId);
        
        if (!classData) {
          router.push('/student');
          return;
        }
        
        setClassInfo(classData);
        setTimeGuard(guardStatus);
        setReminderBroadcastTimes(
          Math.max(1, Math.min(5, configData?.reminder_broadcast_times ?? 1))
        );
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

  // 记住语音播报开关
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem('student_voice_enabled');
    if (stored !== null) {
      setVoiceEnabled(stored === '1');
    }
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('student_voice_enabled', voiceEnabled ? '1' : '0');
  }, [voiceEnabled]);

  // 轮询获取教师端催交提醒
  useEffect(() => {
    if (!classId) return;

    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function pollReminder() {
      try {
        const response = await fetch(`/api/reminder?classId=${classId}`, {
          cache: 'no-store',
        });
        if (!response.ok || cancelled) return;
        const payload = await response.json();
        const record = payload?.data as { id?: string; message?: string } | null;
        if (!record?.id || !record.message) return;
        if (record.id === dismissedReminderId) return;
        setReminderId(record.id);
        setReminderText(record.message);
        if (lastPlayedReminderIdRef.current !== record.id) {
          lastPlayedReminderIdRef.current = record.id;
          const times = Math.max(1, Math.min(5, reminderBroadcastTimes));
          for (let i = 0; i < times; i++) {
            window.setTimeout(() => {
              playSound('reminder');
              speakText(`老师提醒：${record.message}`, { cancelPrevious: i === 0 });
            }, i * 1600);
          }
        }
      } catch {
        // Ignore reminder polling failures.
      }
    }

    pollReminder();
    timer = setInterval(pollReminder, 5000);

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [classId, dismissedReminderId, playSound, speakText, reminderBroadcastTimes]);

  // 提醒自动关闭（显示 1 分钟）
  useEffect(() => {
    if (!reminderText || !reminderId) return;
    const timer = setTimeout(() => {
      setDismissedReminderId(reminderId);
      setReminderText(null);
    }, 60 * 1000);
    return () => clearTimeout(timer);
  }, [reminderText, reminderId]);

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
              <p className="text-sm font-bold text-gray-700">{classInfo?.name}</p>
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
        {/* 教师端催交提醒 */}
        {reminderText && (
          <div className="w-full max-w-md mb-4">
            <Card className="border-amber-300 bg-amber-50">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-amber-700 mb-1">老师提醒</p>
                    {parsedReminder ? (
                      <>
                        <p className="text-sm text-amber-700">
                          <span className="font-bold text-amber-900">【{parsedReminder.subjectName}】</span>
                          <span> 还有 </span>
                          <span className="font-extrabold text-amber-900">{parsedReminder.count}</span>
                          <span> 位同学未交作业</span>
                        </p>
                        <p className="text-xs text-amber-700 mt-1">
                          未交名单：{parsedReminder.names}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-amber-700">{reminderText}</p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setDismissedReminderId(reminderId);
                      setReminderText(null);
                    }}
                  >
                    关闭
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

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

        {/* Debug: 手动输入作业码（仅 NEXT_PUBLIC_APP_MODE=debug 时显示） */}
        {debugFeatureEnabled && (
          <div className="mt-6 w-full max-w-md">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">调试模式</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDebugMode((prev) => !prev)}
                  >
                    {debugMode ? '关闭' : '开启'}
                  </Button>
                </div>
              </CardHeader>
              {debugMode && (
                <CardContent>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && manualCode.trim() && !scanning) {
                          handleScanInput(manualCode);
                        }
                      }}
                      placeholder="例如: Class_1_Subject_1_Student_1"
                      className="flex-1 h-10 rounded-md border border-input bg-background px-3 text-sm"
                    />
                    <Button
                      onClick={() => handleScanInput(manualCode)}
                      disabled={!manualCode.trim() || scanning}
                    >
                      提交
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-gray-500">
                    仅用于本地联调；可通过 URL 参数 <code>?debug=1</code> 进入页面时自动开启。
                  </p>
                </CardContent>
              )}
            </Card>
          </div>
        )}
      </main>

      {/* 底部状态栏 */}
      <footer className="bg-white border-t p-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span>等待扫码</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="voice-switch"
                checked={voiceEnabled}
                onCheckedChange={setVoiceEnabled}
              />
              <label htmlFor="voice-switch" className="text-xs text-gray-600 cursor-pointer">
                语音播报
              </label>
            </div>
            <div>
            今日已提交: {lastResult?.type === 'success' ? '1' : '0'} 条
            </div>
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
