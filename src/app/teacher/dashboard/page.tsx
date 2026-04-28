'use client';

import { Suspense, useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { getClassById, getClassStats, getStudentStatuses, checkStudentWarnings, createExemption, deleteHomeworkRecord, getTodayDate } from '@/lib/database';
import type { Class, ClassStats, StudentStatus } from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Toaster, toast } from 'sonner';

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const classId = parseInt(searchParams.get('classId') || '0', 10);
  const initialSubjectId = parseInt(searchParams.get('subjectId') || '0', 10);
  const initialTab = searchParams.get('tab');
  
  const [classInfo, setClassInfo] = useState<Class | null>(null);
  const [stats, setStats] = useState<ClassStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSubject, setSelectedSubject] = useState<number | null>(initialSubjectId || null);
  const [studentStatuses, setStudentStatuses] = useState<StudentStatus[]>([]);
  const [warningStudents, setWarningStudents] = useState<number[]>([]);
  const [statusesLoading, setStatusesLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(
    initialTab === 'submitted' || initialTab === 'not_submitted' || initialTab === 'overview'
      ? initialTab
      : 'overview'
  );
  const [exemptDialogOpen, setExemptDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<StudentStatus | null>(null);
  const [teacherReminderVoiceEnabled, setTeacherReminderVoiceEnabled] = useState(true);
  const [voiceToggleSaving, setVoiceToggleSaving] = useState(false);
  const [remindingSubjectId, setRemindingSubjectId] = useState<number | null>(null);
  const latestStatusRequestRef = useRef(0);

  const today = getTodayDate();

  const loadStats = useCallback(async () => {
    if (!classId) return;
    
    try {
      const statsData = await getClassStats(classId, today);
      setStats(statsData);
      
      // 默认选中第一个科目
      if (statsData.subjects.length > 0 && !selectedSubject) {
        setSelectedSubject(statsData.subjects[0].subject_id);
      }
    } catch (error) {
      console.error('Load stats error:', error);
    }
  }, [classId, today, selectedSubject]);

  const loadStudentStatuses = useCallback(async (subjectId: number) => {
    if (!classId || !subjectId) return;

    const requestId = latestStatusRequestRef.current + 1;
    latestStatusRequestRef.current = requestId;
    setStatusesLoading(true);

    try {
      // 先加载名单（快路径），避免预警计算慢导致“列表空白像 bug”
      const statuses = await getStudentStatuses(classId, subjectId, today);
      if (requestId !== latestStatusRequestRef.current) return;
      setStudentStatuses(statuses);
      setStatusesLoading(false);

      // 再异步加载预警（慢路径）
      checkStudentWarnings(classId, subjectId, 3)
        .then((warnings) => {
          if (requestId !== latestStatusRequestRef.current) return;
          setWarningStudents(warnings);
        })
        .catch((error) => {
          if (requestId !== latestStatusRequestRef.current) return;
          console.error('Load warning students error:', error);
        });
    } catch (error) {
      if (requestId !== latestStatusRequestRef.current) return;
      console.error('Load student statuses error:', error);
    } finally {
      if (requestId === latestStatusRequestRef.current) {
        setStatusesLoading(false);
      }
    }
  }, [classId, today]);

  useEffect(() => {
    async function loadData() {
      if (!classId) {
        router.push('/teacher');
        return;
      }
      
      try {
        setLoading(true);
        const [classData] = await Promise.all([
          getClassById(classId),
        ]);
        
        if (!classData) {
          router.push('/teacher');
          return;
        }
        
        setClassInfo(classData);
        await loadStats();
      } catch (error) {
        console.error('Load data error:', error);
      } finally {
        setLoading(false);
      }
    }
    
    loadData();
  }, [classId, router, loadStats]);

  // 加载学生状态
  useEffect(() => {
    if (!selectedSubject) return;
    loadStudentStatuses(selectedSubject);
  }, [selectedSubject, stats, loadStudentStatuses]);

  const loadReminderVoiceToggle = useCallback(async () => {
    try {
      const response = await fetch(`/api/reminder/voice?classId=${classId}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok || !payload?.success) return;
      setTeacherReminderVoiceEnabled(Boolean(payload?.data?.enabled));
    } catch {
      // Ignore toggle loading errors.
    }
  }, [classId]);

  useEffect(() => {
    if (!classId) return;
    void loadReminderVoiceToggle();
  }, [classId, loadReminderVoiceToggle]);

  // 刷新数据
  async function handleRefresh() {
    await loadStats();
    if (selectedSubject) {
      await loadStudentStatuses(selectedSubject);
    }
    await loadReminderVoiceToggle();
  }

  async function handleToggleReminderVoice(nextEnabled: boolean) {
    const previous = teacherReminderVoiceEnabled;
    setTeacherReminderVoiceEnabled(nextEnabled);
    setVoiceToggleSaving(true);
    try {
      const response = await fetch('/api/reminder/voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId, enabled: nextEnabled }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || '更新失败');
      }
      toast.success(nextEnabled ? '已开启学生端教师提醒语音' : '已关闭学生端教师提醒语音');
    } catch {
      setTeacherReminderVoiceEnabled(previous);
      toast.error('语音开关更新失败，请重试');
    } finally {
      setVoiceToggleSaving(false);
    }
  }

  // 一键催交
  async function handleSendReminder(subjectId: number) {
    if (!stats) return;

    const subjectStats = stats.subjects.find(s => s.subject_id === subjectId);
    if (!subjectStats) return;
    if (remindingSubjectId === subjectId) return;

    setRemindingSubjectId(subjectId);
    try {
      // 每次点击都直接拉取该科目最新名单，避免依赖页面刷新后的本地缓存状态。
      const statuses = await getStudentStatuses(classId, subjectId, today);
      const notSubmitted = statuses.filter(s => s.status === 'not_submitted');
      if (notSubmitted.length === 0) {
        toast.info(`${subjectStats.subject_name} 当前无人未交`);
        return;
      }

      const names = notSubmitted.map(s => s.student_name).join('、');
      const response = await fetch('/api/reminder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          classId,
          message: `${subjectStats.subject_name}还有 ${notSubmitted.length} 位同学未交：${names}。请尽快提交。`,
        }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || '发送催交失败');
      }
      toast.success(`已发送${subjectStats.subject_name}催交提醒（${notSubmitted.length} 人未交）`);
    } catch {
      toast.error('催交发送失败，请重试');
    } finally {
      setRemindingSubjectId(null);
    }
  }

  function escapeCsvCell(value: string): string {
    if (/[",\n]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  async function handleExportSubjectStatus() {
    if (!selectedSubject || !stats || !classInfo) return;

    try {
      const subject = stats.subjects.find((s) => s.subject_id === selectedSubject);
      if (!subject) return;

      const statuses = await getStudentStatuses(classId, selectedSubject, today);
      const warningSet = new Set(await checkStudentWarnings(classId, selectedSubject, 3));

      const rows: string[] = [
        ['班级', '日期', '科目', '学生姓名', '学号', '状态', '是否预警', '提交时间'].join(','),
      ];

      for (const item of statuses) {
        const statusLabel =
          item.status === 'submitted'
            ? '已提交'
            : item.status === 'exempted'
              ? '已豁免'
              : '未提交';

        rows.push(
          [
            escapeCsvCell(classInfo.name),
            today,
            escapeCsvCell(subject.subject_name),
            escapeCsvCell(item.student_name),
            escapeCsvCell(item.student_code),
            statusLabel,
            warningSet.has(item.student_id) ? '是' : '否',
            item.submit_time ? escapeCsvCell(item.submit_time) : '',
          ].join(',')
        );
      }

      const csv = `\uFEFF${rows.join('\n')}`;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${classInfo.name}-${subject.subject_name}-${today}-作业情况.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export subject status error:', error);
      alert('导出失败，请重试');
    }
  }

  // 豁免操作
  async function handleExempt(student: StudentStatus, reason: string) {
    if (!classId || !selectedSubject) return;
    
    try {
      await createExemption(classId, student.student_id, selectedSubject, today, reason);
      await loadStats();
      setExemptDialogOpen(false);
      setSelectedStudent(null);
    } catch (error) {
      console.error('Exempt error:', error);
      alert('豁免失败，请重试');
    }
  }

  // 撤销提交
  async function handleRevoke(recordId: number) {
    if (!confirm('确定要撤销这条提交记录吗？')) return;
    
    try {
      await deleteHomeworkRecord(recordId);
      await loadStats();
    } catch (error) {
      console.error('Revoke error:', error);
      alert('撤销失败，请重试');
    }
  }

  if (loading || !stats) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <Skeleton className="h-12 w-48 mb-4" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <Skeleton className="h-24 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => router.push('/teacher')}
                className="text-gray-600 hover:text-gray-900"
              >
                <span className="text-2xl">←</span>
              </button>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{classInfo?.name}</h1>
                <p className="text-sm text-gray-500">{today}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-lg border px-3 py-1.5 bg-white">
                <span className="text-xs text-gray-600">学生端教师提醒语音</span>
                <Switch
                  checked={teacherReminderVoiceEnabled}
                  onCheckedChange={handleToggleReminderVoice}
                  disabled={voiceToggleSaving}
                />
              </div>
              <Button onClick={handleRefresh} variant="outline" size="sm">
                🔄 刷新
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* 统计概览 */}
      <main className="max-w-4xl mx-auto p-4">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-3">今日作业进度</h2>
          <div className="grid grid-cols-3 gap-2">
            {stats.subjects.map((subject) => (
              <Card 
                key={subject.subject_id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedSubject === subject.subject_id ? 'ring-2 ring-purple-500' : ''
                }`}
                onClick={() => setSelectedSubject(subject.subject_id)}
              >
                <CardContent className="p-3 text-center">
                  <p className="text-xs text-gray-500 mb-1">{subject.subject_name}</p>
                  <p className="text-xl font-bold text-purple-600">{subject.percentage}%</p>
                  <p className="text-[11px] text-gray-400 mt-1">
                    {subject.submitted + subject.exempted}/{subject.total}
                  </p>
                  <Button
                    size="sm"
                    variant={selectedSubject === subject.subject_id ? 'default' : 'outline'}
                    className="mt-2 h-7 px-2 text-[11px]"
                    disabled={remindingSubjectId === subject.subject_id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedSubject(subject.subject_id);
                      void handleSendReminder(subject.subject_id);
                    }}
                  >
                    {remindingSubjectId === subject.subject_id ? '发送中...' : '一键催交'}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* 科目详情 */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">概览</TabsTrigger>
            <TabsTrigger value="submitted">已交名单</TabsTrigger>
            <TabsTrigger value="not_submitted">未交名单</TabsTrigger>
          </TabsList>
          
          <TabsContent value="overview" className="mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>
                    {stats.subjects.find(s => s.subject_id === selectedSubject)?.subject_name} 详情
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={handleExportSubjectStatus}>
                    导出作业情况
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-3xl font-bold text-green-600">{stats.subjects.find(s => s.subject_id === selectedSubject)?.submitted}</p>
                    <p className="text-sm text-gray-600">已提交</p>
                  </div>
                  <div className="p-4 bg-amber-50 rounded-lg">
                    <p className="text-3xl font-bold text-amber-600">{stats.subjects.find(s => s.subject_id === selectedSubject)?.exempted}</p>
                    <p className="text-sm text-gray-600">已豁免</p>
                  </div>
                  <div className="p-4 bg-red-50 rounded-lg">
                    <p className="text-3xl font-bold text-red-600">{stats.subjects.find(s => s.subject_id === selectedSubject)?.not_submitted}</p>
                    <p className="text-sm text-gray-600">未提交</p>
                  </div>
                  <div className="p-4 bg-gray-100 rounded-lg">
                    <p className="text-3xl font-bold text-gray-600">{stats.subjects.find(s => s.subject_id === selectedSubject)?.total}</p>
                    <p className="text-sm text-gray-600">总人数</p>
                  </div>
                </div>
                
                {/* 预警提示 */}
                {warningStudents.length > 0 && (
                  <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-red-700 font-semibold mb-2">⚠️ 预警提醒</p>
                    <p className="text-red-600 text-sm">
                      有 {warningStudents.length} 名同学连续 3 天以上未交作业，请关注！
                    </p>
                  </div>
                )}
                
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="submitted" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>
                  已提交名单
                  {statusesLoading ? '（加载中...）' : ` (${studentStatuses.filter(s => s.status === 'submitted').length}人)`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {studentStatuses
                    .filter(s => s.status === 'submitted')
                    .map((student) => (
                      <div 
                        key={student.student_id}
                        className="flex items-center justify-between p-3 bg-green-50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">✅</span>
                          <div>
                            <p className="font-medium">{student.student_name}</p>
                            <p className="text-xs text-gray-500">学号: {student.student_code}</p>
                          </div>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={() => {
                            if (!student.record_id) {
                              alert('未找到可撤销的提交记录');
                              return;
                            }
                            handleRevoke(student.record_id);
                          }}
                        >
                          撤销
                        </Button>
                      </div>
                    ))}
                  
                  {studentStatuses.filter(s => s.status === 'submitted').length === 0 && (
                    <p className="text-center text-gray-500 py-8">
                      {statusesLoading ? '名单加载中...' : '暂无已提交记录'}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="not_submitted" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>
                  未提交名单
                  {statusesLoading ? '（加载中...）' : ` (${studentStatuses.filter(s => s.status === 'not_submitted').length}人)`}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {studentStatuses
                    .filter(s => s.status === 'not_submitted')
                    .map((student) => (
                      <div 
                        key={student.student_id}
                        className={`flex items-center justify-between p-3 rounded-lg ${
                          warningStudents.includes(student.student_id) 
                            ? 'bg-red-100 border border-red-300' 
                            : 'bg-red-50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xl">❌</span>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-medium">{student.student_name}</p>
                              {warningStudents.includes(student.student_id) && (
                                <Badge variant="destructive">预警</Badge>
                              )}
                            </div>
                            <p className="text-xs text-gray-500">学号: {student.student_code}</p>
                          </div>
                        </div>
                        <Dialog open={exemptDialogOpen} onOpenChange={setExemptDialogOpen}>
                          <DialogTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => setSelectedStudent(student)}
                            >
                              豁免
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>豁免学生作业</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 pt-4">
                              <p>学生: {selectedStudent?.student_name}</p>
                              <Input 
                                placeholder="豁免原因（如：请假、体育课）"
                                id="exemptReason"
                              />
                              <Button 
                                onClick={() => {
                                  const reason = (document.getElementById('exemptReason') as HTMLInputElement).value;
                                  if (selectedStudent) {
                                    handleExempt(selectedStudent, reason);
                                  }
                                }}
                                className="w-full"
                              >
                                确认豁免
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    ))}
                  
                  {studentStatuses.filter(s => s.status === 'not_submitted').length === 0 && (
                    <p className="text-center text-green-600 py-8">
                      {statusesLoading ? '名单加载中...' : '🎉 所有同学都已提交作业！'}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
      <Toaster position="top-center" richColors />
    </div>
  );
}

function DashboardLoading() {
  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-4xl mx-auto">
        <Skeleton className="h-12 w-48 mb-4" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardContent />
    </Suspense>
  );
}
