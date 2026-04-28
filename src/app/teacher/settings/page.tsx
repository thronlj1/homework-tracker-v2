'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getClasses, createClass, updateClass, deleteClass, getSubjectsByClass, createSubject, updateSubject, deleteSubject, getStudentsByClass, createStudent, updateStudent, deleteStudent, getSystemConfig, updateSystemConfig, createSystemConfig } from '@/lib/database';
import type { Class, Subject, Student, SystemConfig } from '@/types/database';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Download, Pencil, Trash2 } from 'lucide-react';
import { Toaster, toast } from 'sonner';

type EditableConfig = Pick<
  SystemConfig,
  | 'scan_start_time'
  | 'scan_end_time'
  | 'alert_continuous_days'
  | 'reminder_broadcast_times'
  | 'reminder_schedule_times'
  | 'reminder_poll_interval_minutes'
  | 'student_reminder_voice_enabled'
  | 'global_task_status'
  | 'today_override_status'
  | 'today_override_date'
>;

const DEFAULT_EDITABLE_CONFIG: EditableConfig = {
  scan_start_time: '07:00',
  scan_end_time: '12:00',
  alert_continuous_days: 3,
  reminder_broadcast_times: 1,
  reminder_schedule_times: null,
  reminder_poll_interval_minutes: 5,
  student_reminder_voice_enabled: true,
  global_task_status: 'semester',
  today_override_status: 'auto',
  today_override_date: null,
};

function normalizeReminderScheduleTimes(input: string): { value: string | null; error: string | null } {
  const raw = input.trim();
  if (!raw) return { value: null, error: null };
  const parts = raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (parts.length === 0) return { value: null, error: null };

  const pattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  for (const part of parts) {
    if (!pattern.test(part)) {
      return { value: null, error: `时间格式无效：${part}（请使用 HH:mm，如 09:30）` };
    }
  }

  const uniqueSorted = Array.from(new Set(parts)).sort();
  return { value: uniqueSorted.join(','), error: null };
}

export default function SettingsPage() {
  const router = useRouter();
  
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [configDraft, setConfigDraft] = useState<EditableConfig>(DEFAULT_EDITABLE_CONFIG);
  const [alertDaysInput, setAlertDaysInput] = useState(String(DEFAULT_EDITABLE_CONFIG.alert_continuous_days));
  const [reminderTimesInput, setReminderTimesInput] = useState(String(DEFAULT_EDITABLE_CONFIG.reminder_broadcast_times));
  const [reminderScheduleInput, setReminderScheduleInput] = useState('');
  const [reminderPollIntervalInput, setReminderPollIntervalInput] = useState(
    String(DEFAULT_EDITABLE_CONFIG.reminder_poll_interval_minutes)
  );
  const [configDirty, setConfigDirty] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authChecking, setAuthChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [authSubmitting, setAuthSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('classes');

  // 表单状态
  const [newClassName, setNewClassName] = useState('');
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentCode, setNewStudentCode] = useState('');

  useEffect(() => {
    checkAdminSession();
  }, []);

  useEffect(() => {
    if (authenticated) {
      loadData();
      return;
    }
    if (!authChecking) {
      setLoading(false);
    }
  }, [authenticated, authChecking]);

  async function loadData() {
    try {
      setLoading(true);
      const [classesData, configData] = await Promise.all([
        getClasses(),
        getSystemConfig(),
      ]);
      
      setClasses(classesData);
      setConfig(configData);
      setConfigDraft({
        ...DEFAULT_EDITABLE_CONFIG,
        ...(configData
          ? {
              scan_start_time: configData.scan_start_time,
              scan_end_time: configData.scan_end_time,
              alert_continuous_days: configData.alert_continuous_days,
              reminder_broadcast_times: configData.reminder_broadcast_times,
              reminder_schedule_times: configData.reminder_schedule_times,
              reminder_poll_interval_minutes: configData.reminder_poll_interval_minutes,
              student_reminder_voice_enabled: configData.student_reminder_voice_enabled,
              global_task_status: configData.global_task_status,
              today_override_status: configData.today_override_status,
              today_override_date: configData.today_override_date,
            }
          : {}),
      });
      const nextAlertDays = configData?.alert_continuous_days ?? DEFAULT_EDITABLE_CONFIG.alert_continuous_days;
      const nextReminderTimes =
        configData?.reminder_broadcast_times ?? DEFAULT_EDITABLE_CONFIG.reminder_broadcast_times;
      const nextReminderSchedule = configData?.reminder_schedule_times ?? DEFAULT_EDITABLE_CONFIG.reminder_schedule_times;
      const nextReminderPollInterval =
        configData?.reminder_poll_interval_minutes ?? DEFAULT_EDITABLE_CONFIG.reminder_poll_interval_minutes;
      setAlertDaysInput(String(nextAlertDays));
      setReminderTimesInput(String(nextReminderTimes));
      setReminderScheduleInput(nextReminderSchedule ?? '');
      setReminderPollIntervalInput(String(nextReminderPollInterval));
      setConfigDirty(false);
      
      if (classesData.length > 0 && !selectedClassId) {
        setSelectedClassId(classesData[0].id);
      }
    } catch (error) {
      console.error('Load data error:', error);
    } finally {
      setLoading(false);
    }
  }

  async function checkAdminSession() {
    try {
      setAuthChecking(true);
      const response = await fetch('/api/admin/session', { cache: 'no-store' });
      const payload = await response.json();
      setAuthenticated(Boolean(payload?.data?.authenticated));
    } catch {
      setAuthenticated(false);
    } finally {
      setAuthChecking(false);
    }
  }

  async function handleAdminLogin() {
    if (!adminUsername.trim() || !adminPassword.trim()) {
      alert('请输入管理员账号和密码');
      return;
    }
    try {
      setAuthSubmitting(true);
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: adminUsername.trim(),
          password: adminPassword,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload?.success) {
        throw new Error(payload?.message || '登录失败');
      }
      setAuthenticated(true);
      setAdminPassword('');
      await loadData();
    } catch (error) {
      alert(error instanceof Error ? error.message : '登录失败');
    } finally {
      setAuthSubmitting(false);
    }
  }

  async function handleAdminLogout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    setAuthenticated(false);
    setClasses([]);
    setSubjects([]);
    setStudents([]);
    setConfig(null);
  }

  // 加载班级相关数据
  useEffect(() => {
    async function loadClassData() {
      if (!authenticated || !selectedClassId) return;
      
      try {
        const [subjectsData, studentsData] = await Promise.all([
          getSubjectsByClass(selectedClassId),
          getStudentsByClass(selectedClassId),
        ]);
        
        setSubjects(subjectsData);
        setStudents(studentsData);
      } catch (error) {
        console.error('Load class data error:', error);
      }
    }
    
    loadClassData();
  }, [selectedClassId, authenticated]);

  // 创建班级
  async function handleCreateClass() {
    if (!newClassName.trim()) return;
    
    try {
      await createClass(newClassName.trim());
      setNewClassName('');
      await loadData();
    } catch (error) {
      console.error('Create class error:', error);
      alert('创建班级失败');
    }
  }

  async function handleEditClass(classItem: Class) {
    const name = window.prompt('请输入新的班级名称', classItem.name);
    if (!name || !name.trim() || name.trim() === classItem.name) return;
    try {
      await updateClass(classItem.id, { name: name.trim() });
      await loadData();
    } catch (error) {
      console.error('Update class error:', error);
      alert('修改班级失败');
    }
  }

  async function handleDeleteClass(classItem: Class) {
    if (!window.confirm(`确认删除班级「${classItem.name}」？关联的学生和科目也会被删除。`)) return;
    const confirmName = window.prompt(`请输入班级名称「${classItem.name}」以确认删除`);
    if (confirmName !== classItem.name) {
      alert('输入的班级名称不匹配，已取消删除');
      return;
    }
    try {
      await deleteClass(classItem.id);
      if (selectedClassId === classItem.id) {
        setSelectedClassId(null);
      }
      await loadData();
    } catch (error) {
      console.error('Delete class error:', error);
      alert('删除班级失败');
    }
  }

  function escapeCsvCell(value: string): string {
    if (/[",\n]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }

  async function handleExportClassCodes() {
    if (!selectedClassId) {
      alert('请先选择一个班级再导出');
      return;
    }

    const classItem = classes.find((c) => c.id === selectedClassId);
    if (!classItem) {
      alert('未找到当前班级信息');
      return;
    }

    try {
      const [subjectsData, studentsData] = await Promise.all([
        getSubjectsByClass(selectedClassId),
        getStudentsByClass(selectedClassId),
      ]);

      if (subjectsData.length === 0 || studentsData.length === 0) {
        alert('当前班级缺少科目或学生，无法导出二维码码表');
        return;
      }

      const header = ['班级', '班级ID', '科目', '科目ID', '学生', '学生ID', '学号', '二维码码串'];
      const rows: string[] = [header.join(',')];

      for (const subject of subjectsData) {
        for (const student of studentsData) {
          const qrCode = `Class_${selectedClassId}_Subject_${subject.id}_Student_${student.id}`;
          rows.push(
            [
              escapeCsvCell(classItem.name),
              String(selectedClassId),
              escapeCsvCell(subject.name),
              String(subject.id),
              escapeCsvCell(student.name),
              String(student.id),
              escapeCsvCell(student.student_code),
              qrCode,
            ].join(',')
          );
        }
      }

      // Add UTF-8 BOM for better Chinese display in spreadsheet tools.
      const csv = `\uFEFF${rows.join('\n')}`;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${classItem.name}-二维码码表.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export class codes error:', error);
      alert('导出失败，请重试');
    }
  }

  // 创建科目
  async function handleCreateSubject() {
    if (!newSubjectName.trim() || !selectedClassId) return;
    
    try {
      await createSubject(selectedClassId, newSubjectName.trim());
      setNewSubjectName('');
      const subjectsData = await getSubjectsByClass(selectedClassId);
      setSubjects(subjectsData);
    } catch (error) {
      console.error('Create subject error:', error);
      alert('创建科目失败');
    }
  }

  async function handleEditSubject(subject: Subject) {
    const name = window.prompt('请输入新的科目名称', subject.name);
    if (!name || !name.trim() || name.trim() === subject.name || !selectedClassId) return;
    try {
      await updateSubject(subject.id, { name: name.trim() });
      const subjectsData = await getSubjectsByClass(selectedClassId);
      setSubjects(subjectsData);
    } catch (error) {
      console.error('Update subject error:', error);
      alert('修改科目失败');
    }
  }

  async function handleDeleteSubject(subject: Subject) {
    if (!window.confirm(`确认删除科目「${subject.name}」？`)) return;
    if (!selectedClassId) return;
    try {
      await deleteSubject(subject.id);
      const subjectsData = await getSubjectsByClass(selectedClassId);
      setSubjects(subjectsData);
    } catch (error) {
      console.error('Delete subject error:', error);
      alert('删除科目失败');
    }
  }

  // 创建学生
  async function handleCreateStudent() {
    if (!newStudentName.trim() || !newStudentCode.trim() || !selectedClassId) return;
    
    try {
      await createStudent(selectedClassId, newStudentName.trim(), newStudentCode.trim());
      setNewStudentName('');
      setNewStudentCode('');
      const studentsData = await getStudentsByClass(selectedClassId);
      setStudents(studentsData);
    } catch (error) {
      console.error('Create student error:', error);
      alert('创建学生失败');
    }
  }

  async function handleEditStudent(student: Student) {
    if (!selectedClassId) return;
    const name = window.prompt('请输入新的学生姓名', student.name);
    if (!name || !name.trim()) return;
    const studentCode = window.prompt('请输入新的学号', student.student_code);
    if (!studentCode || !studentCode.trim()) return;

    try {
      await updateStudent(student.id, {
        name: name.trim(),
        student_code: studentCode.trim(),
      });
      const studentsData = await getStudentsByClass(selectedClassId);
      setStudents(studentsData);
    } catch (error) {
      console.error('Update student error:', error);
      alert('修改学生失败');
    }
  }

  async function handleDeleteStudent(student: Student) {
    if (!window.confirm(`确认删除学生「${student.name}」？`)) return;
    if (!selectedClassId) return;
    try {
      await deleteStudent(student.id);
      const studentsData = await getStudentsByClass(selectedClassId);
      setStudents(studentsData);
    } catch (error) {
      console.error('Delete student error:', error);
      alert('删除学生失败');
    }
  }

  // 更新系统配置
  async function handleSaveConfig() {
    if (configSaving || !configDirty) return;

    try {
      setConfigSaving(true);
      const normalizedDraft: EditableConfig = {
        ...configDraft,
        alert_continuous_days: Math.max(1, Math.min(30, configDraft.alert_continuous_days)),
        reminder_broadcast_times: Math.max(1, Math.min(5, configDraft.reminder_broadcast_times)),
        reminder_poll_interval_minutes: Math.max(1, Math.min(60, configDraft.reminder_poll_interval_minutes)),
        today_override_date:
          configDraft.today_override_status === 'auto'
            ? null
            : new Date().toISOString().split('T')[0],
      };
      const normalizedReminderSchedule = normalizeReminderScheduleTimes(reminderScheduleInput);
      if (normalizedReminderSchedule.error) {
        toast.error(normalizedReminderSchedule.error);
        return;
      }
      normalizedDraft.reminder_schedule_times = normalizedReminderSchedule.value;

      if (config) {
        await updateSystemConfig(config.id, normalizedDraft);
      } else {
        await createSystemConfig(normalizedDraft as Parameters<typeof createSystemConfig>[0]);
      }

      const newConfig = await getSystemConfig();
      setConfig(newConfig);
      setConfigDraft({
        ...DEFAULT_EDITABLE_CONFIG,
        ...(newConfig
          ? {
              scan_start_time: newConfig.scan_start_time,
              scan_end_time: newConfig.scan_end_time,
              alert_continuous_days: newConfig.alert_continuous_days,
              reminder_broadcast_times: newConfig.reminder_broadcast_times,
              reminder_schedule_times: newConfig.reminder_schedule_times,
              reminder_poll_interval_minutes: newConfig.reminder_poll_interval_minutes,
              student_reminder_voice_enabled: newConfig.student_reminder_voice_enabled,
              global_task_status: newConfig.global_task_status,
              today_override_status: newConfig.today_override_status,
              today_override_date: newConfig.today_override_date,
            }
          : {}),
      });
      const nextAlertDays = newConfig?.alert_continuous_days ?? DEFAULT_EDITABLE_CONFIG.alert_continuous_days;
      const nextReminderTimes =
        newConfig?.reminder_broadcast_times ?? DEFAULT_EDITABLE_CONFIG.reminder_broadcast_times;
      const nextReminderSchedule = newConfig?.reminder_schedule_times ?? DEFAULT_EDITABLE_CONFIG.reminder_schedule_times;
      const nextReminderPollInterval =
        newConfig?.reminder_poll_interval_minutes ?? DEFAULT_EDITABLE_CONFIG.reminder_poll_interval_minutes;
      setAlertDaysInput(String(nextAlertDays));
      setReminderTimesInput(String(nextReminderTimes));
      setReminderScheduleInput(nextReminderSchedule ?? '');
      setReminderPollIntervalInput(String(nextReminderPollInterval));
      setConfigDirty(false);
      toast.success('系统配置已保存');
    } catch (error) {
      console.error('Update config error:', error);
      toast.error('更新配置失败，请重试');
    } finally {
      setConfigSaving(false);
    }
  }

  function updateConfigDraft(updates: Partial<EditableConfig>) {
    setConfigDraft((prev) => ({ ...prev, ...updates }));
    setConfigDirty(true);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-4xl mx-auto">
          <Skeleton className="h-12 w-48 mb-4" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gray-50 p-4">
        <div className="max-w-md mx-auto pt-16">
          <Card>
            <CardHeader>
              <CardTitle>管理员登录</CardTitle>
              <CardDescription>请输入管理员账号和密码后再进入系统设置</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="admin-username">管理员账号</Label>
                <Input
                  id="admin-username"
                  value={adminUsername}
                  onChange={(e) => setAdminUsername(e.target.value)}
                  placeholder="例如：admin"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-password">管理员密码</Label>
                <Input
                  id="admin-password"
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !authSubmitting) {
                      handleAdminLogin();
                    }
                  }}
                  placeholder="请输入密码"
                />
              </div>
              <Button onClick={handleAdminLogin} className="w-full" disabled={authSubmitting}>
                {authSubmitting ? '登录中...' : '登录并进入设置'}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto p-4">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => router.push('/teacher')}
              className="text-gray-600 hover:text-gray-900"
            >
              <span className="text-2xl">←</span>
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">系统设置</h1>
              <p className="text-sm text-gray-500">管理班级、科目、学生和系统配置</p>
            </div>
            <Button variant="outline" size="sm" onClick={handleAdminLogout}>
              退出管理员
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="classes">班级管理</TabsTrigger>
            <TabsTrigger value="subjects">科目管理</TabsTrigger>
            <TabsTrigger value="students">学生管理</TabsTrigger>
            <TabsTrigger value="config">系统配置</TabsTrigger>
          </TabsList>
          
          {/* 班级管理 */}
          <TabsContent value="classes" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>班级管理</CardTitle>
                <CardDescription>添加和管理班级</CardDescription>
              </CardHeader>
              <CardContent>
                {/* 添加班级 */}
                <div className="flex gap-2 mb-6">
                  <Input 
                    placeholder="输入班级名称"
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateClass()}
                  />
                  <Button onClick={handleCreateClass}>添加班级</Button>
                  <Button
                    variant="outline"
                    onClick={handleExportClassCodes}
                    disabled={!selectedClassId}
                  >
                    <Download className="h-4 w-4 mr-1" />
                    导出当前班级码表
                  </Button>
                </div>
                
                {/* 班级列表 */}
                <div className="space-y-2">
                  {classes.map((classItem) => (
                    <div 
                      key={classItem.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        selectedClassId === classItem.id ? 'bg-purple-50 border-purple-300' : 'bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xl">🏫</span>
                        <span className="font-medium">{classItem.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedClassId(classItem.id)}
                        >
                          {selectedClassId === classItem.id ? '已选中' : '选择'}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEditClass(classItem)}
                        >
                          编辑
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDeleteClass(classItem)}
                        >
                          删除
                        </Button>
                      </div>
                    </div>
                  ))}
                  
                  {classes.length === 0 && (
                    <p className="text-center text-gray-500 py-8">暂无班级，请添加</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* 科目管理 */}
          <TabsContent value="subjects" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>科目管理</CardTitle>
                <CardDescription>
                  {selectedClassId 
                    ? `当前班级: ${classes.find(c => c.id === selectedClassId)?.name}`
                    : '请先选择班级'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!selectedClassId ? (
                  <p className="text-center text-gray-500 py-8">请先在班级管理中选择一个班级</p>
                ) : (
                  <>
                    {/* 添加科目 */}
                    <div className="flex gap-2 mb-6">
                      <Input 
                        placeholder="输入科目名称"
                        value={newSubjectName}
                        onChange={(e) => setNewSubjectName(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateSubject()}
                      />
                      <Button onClick={handleCreateSubject}>添加科目</Button>
                    </div>
                    
                    {/* 科目列表 */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {subjects.map((subject) => (
                        <div 
                          key={subject.id}
                          className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg border"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-2xl">📚</span>
                            <span className="font-medium">{subject.name}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={() => handleEditSubject(subject)}>
                              编辑
                            </Button>
                            <Button variant="destructive" size="sm" onClick={() => handleDeleteSubject(subject)}>
                              删除
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {subjects.length === 0 && (
                      <p className="text-center text-gray-500 py-8">暂无科目，请添加</p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* 学生管理 */}
          <TabsContent value="students" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>学生管理</CardTitle>
                <CardDescription>
                  {selectedClassId 
                    ? `当前班级: ${classes.find(c => c.id === selectedClassId)?.name} (${students.length}人)`
                    : '请先选择班级'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!selectedClassId ? (
                  <p className="text-center text-gray-500 py-8">请先在班级管理中选择一个班级</p>
                ) : (
                  <>
                    {/* 添加学生 */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-6">
                      <Input 
                        placeholder="学生姓名"
                        value={newStudentName}
                        onChange={(e) => setNewStudentName(e.target.value)}
                      />
                      <Input 
                        placeholder="学号"
                        value={newStudentCode}
                        onChange={(e) => setNewStudentCode(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleCreateStudent()}
                      />
                      <Button onClick={handleCreateStudent}>添加学生</Button>
                    </div>
                    
                    {/* 学生列表 */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {students.map((student) => (
                        <div 
                          key={student.id}
                          className="flex items-center justify-between gap-2 p-3 bg-gray-50 rounded-lg border"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xl">👤</span>
                            <div className="min-w-0">
                              <p className="font-medium truncate">{student.name}</p>
                              <p className="text-xs text-gray-500">{student.student_code}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleEditStudent(student)}
                              aria-label={`编辑${student.name}`}
                              title="编辑"
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => handleDeleteStudent(student)}
                              aria-label={`删除${student.name}`}
                              title="删除"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {students.length === 0 && (
                      <p className="text-center text-gray-500 py-8">暂无学生，请添加</p>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* 系统配置 */}
          <TabsContent value="config" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>系统配置</CardTitle>
                <CardDescription>配置收作业时间和预警规则</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 全局状态 */}
                <div className="space-y-2">
                  <Label>全局任务状态</Label>
                  <Select 
                    value={configDraft.global_task_status}
                    onValueChange={(value) =>
                      updateConfigDraft({ global_task_status: value as 'semester' | 'vacation' })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="semester">学期中（进行中）</SelectItem>
                      <SelectItem value="vacation">寒暑假（暂停）</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* 今日覆盖 */}
                <div className="space-y-2">
                  <Label>今日状态覆盖</Label>
                  <Select 
                    value={configDraft.today_override_status}
                    onValueChange={(value) =>
                      updateConfigDraft({
                        today_override_status: value as 'auto' | 'force_open' | 'force_close',
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">跟随日历自动</SelectItem>
                      <SelectItem value="force_open">今日强制开启（如补课）</SelectItem>
                      <SelectItem value="force_close">今日强制关闭（如运动会）</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* 收作业时间 */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>收作业开始时间</Label>
                    <Input 
                      type="time"
                      value={configDraft.scan_start_time}
                      onChange={(e) => updateConfigDraft({ scan_start_time: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>收作业结束时间</Label>
                    <Input 
                      type="time"
                      value={configDraft.scan_end_time}
                      onChange={(e) => updateConfigDraft({ scan_end_time: e.target.value })}
                    />
                  </div>
                </div>
                
                {/* 预警天数 */}
                <div className="space-y-2">
                  <Label>连续未交预警天数</Label>
                  <Input 
                    type="text"
                    inputMode="numeric"
                    value={alertDaysInput}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '');
                      setAlertDaysInput(digits);
                      if (!digits) return;
                      const parsed = parseInt(digits, 10);
                      if (!Number.isFinite(parsed)) return;
                      updateConfigDraft({ alert_continuous_days: Math.max(1, Math.min(30, parsed)) });
                    }}
                    onBlur={() => {
                      const parsed = parseInt(alertDaysInput, 10);
                      const normalized = Number.isFinite(parsed) ? Math.max(1, Math.min(30, parsed)) : 3;
                      setAlertDaysInput(String(normalized));
                      updateConfigDraft({ alert_continuous_days: normalized });
                    }}
                  />
                  <p className="text-xs text-gray-500">
                    连续 N 天未交作业的学生将被标记为预警
                  </p>
                </div>

                {/* 催交播报次数 */}
                <div className="space-y-2">
                  <Label>教师催交播报次数</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={reminderTimesInput}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '');
                      setReminderTimesInput(digits);
                      if (!digits) return;
                      const parsed = parseInt(digits, 10);
                      if (!Number.isFinite(parsed)) return;
                      updateConfigDraft({ reminder_broadcast_times: Math.max(1, Math.min(5, parsed)) });
                    }}
                    onBlur={() => {
                      const parsed = parseInt(reminderTimesInput, 10);
                      const normalized = Number.isFinite(parsed) ? Math.max(1, Math.min(5, parsed)) : 1;
                      setReminderTimesInput(String(normalized));
                      updateConfigDraft({ reminder_broadcast_times: normalized });
                    }}
                  />
                  <p className="text-xs text-gray-500">
                    学生端收到教师催交时的语音播报次数，默认 1 次，最多 5 次
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>定时催交时间点</Label>
                  <Input
                    type="text"
                    value={reminderScheduleInput}
                    onChange={(e) => {
                      setReminderScheduleInput(e.target.value);
                      setConfigDirty(true);
                    }}
                    onBlur={() => {
                      const normalized = normalizeReminderScheduleTimes(reminderScheduleInput);
                      if (normalized.error) return;
                      const nextValue = normalized.value ?? '';
                      setReminderScheduleInput(nextValue);
                      updateConfigDraft({ reminder_schedule_times: normalized.value });
                    }}
                    placeholder="例如：09:30,10:15"
                  />
                  <p className="text-xs text-gray-500">
                    到达这些时点后，系统会自动对仍有未交学生的科目触发催交播报（24小时制，逗号分隔）
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>定时任务轮询间隔（分钟）</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={reminderPollIntervalInput}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, '');
                      setReminderPollIntervalInput(digits);
                      if (!digits) return;
                      const parsed = parseInt(digits, 10);
                      if (!Number.isFinite(parsed)) return;
                      updateConfigDraft({ reminder_poll_interval_minutes: Math.max(1, Math.min(60, parsed)) });
                    }}
                    onBlur={() => {
                      const parsed = parseInt(reminderPollIntervalInput, 10);
                      const normalized = Number.isFinite(parsed) ? Math.max(1, Math.min(60, parsed)) : 5;
                      setReminderPollIntervalInput(String(normalized));
                      updateConfigDraft({ reminder_poll_interval_minutes: normalized });
                    }}
                  />
                  <p className="text-xs text-gray-500">
                    默认 5 分钟轮询一次；测试时可设为 1 分钟
                  </p>
                </div>

                <div className="space-y-2">
                  <Label>学生端教师提醒语音播报</Label>
                  <div className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <p className="text-sm font-medium">允许教师提醒在学生端播放声音</p>
                      <p className="text-xs text-gray-500">
                        关闭后，学生端仍显示提醒卡片，但不会播放提醒音和语音
                      </p>
                    </div>
                    <Switch
                      checked={configDraft.student_reminder_voice_enabled}
                      onCheckedChange={(checked) =>
                        updateConfigDraft({ student_reminder_voice_enabled: checked })
                      }
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 border-t pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (!config) {
                        setConfigDraft(DEFAULT_EDITABLE_CONFIG);
                        setAlertDaysInput(String(DEFAULT_EDITABLE_CONFIG.alert_continuous_days));
                        setReminderTimesInput(String(DEFAULT_EDITABLE_CONFIG.reminder_broadcast_times));
                        setReminderScheduleInput(DEFAULT_EDITABLE_CONFIG.reminder_schedule_times ?? '');
                        setReminderPollIntervalInput(
                          String(DEFAULT_EDITABLE_CONFIG.reminder_poll_interval_minutes)
                        );
                      } else {
                        setConfigDraft({
                          scan_start_time: config.scan_start_time,
                          scan_end_time: config.scan_end_time,
                          alert_continuous_days: config.alert_continuous_days,
                          reminder_broadcast_times: config.reminder_broadcast_times,
                          reminder_schedule_times: config.reminder_schedule_times,
                          reminder_poll_interval_minutes: config.reminder_poll_interval_minutes,
                          student_reminder_voice_enabled: config.student_reminder_voice_enabled,
                          global_task_status: config.global_task_status,
                          today_override_status: config.today_override_status,
                          today_override_date: config.today_override_date,
                        });
                        setAlertDaysInput(String(config.alert_continuous_days));
                        setReminderTimesInput(String(config.reminder_broadcast_times));
                        setReminderScheduleInput(config.reminder_schedule_times ?? '');
                        setReminderPollIntervalInput(String(config.reminder_poll_interval_minutes));
                      }
                      setConfigDirty(false);
                    }}
                    disabled={!configDirty || configSaving}
                  >
                    取消修改
                  </Button>
                  <Button onClick={handleSaveConfig} disabled={!configDirty || configSaving}>
                    {configSaving ? '保存中...' : '保存配置'}
                  </Button>
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
