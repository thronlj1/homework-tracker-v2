'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getClasses, createClass, getSubjectsByClass, createSubject, getStudentsByClass, createStudent, getSystemConfig, updateSystemConfig, createSystemConfig } from '@/lib/database';
import type { Class, Subject, Student, SystemConfig } from '@/types/database';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function SettingsPage() {
  const router = useRouter();
  
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [config, setConfig] = useState<SystemConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('classes');

  // 表单状态
  const [newClassName, setNewClassName] = useState('');
  const [newSubjectName, setNewSubjectName] = useState('');
  const [newStudentName, setNewStudentName] = useState('');
  const [newStudentCode, setNewStudentCode] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      const [classesData, configData] = await Promise.all([
        getClasses(),
        getSystemConfig(),
      ]);
      
      setClasses(classesData);
      setConfig(configData);
      
      if (classesData.length > 0 && !selectedClassId) {
        setSelectedClassId(classesData[0].id);
      }
    } catch (error) {
      console.error('Load data error:', error);
    } finally {
      setLoading(false);
    }
  }

  // 加载班级相关数据
  useEffect(() => {
    async function loadClassData() {
      if (!selectedClassId) return;
      
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
  }, [selectedClassId]);

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

  // 更新系统配置
  async function handleUpdateConfig(updates: Partial<SystemConfig>) {
    try {
      if (config) {
        await updateSystemConfig(config.id, updates);
      } else {
        await createSystemConfig(updates as Parameters<typeof createSystemConfig>[0]);
      }
      const newConfig = await getSystemConfig();
      setConfig(newConfig);
    } catch (error) {
      console.error('Update config error:', error);
      alert('更新配置失败');
    }
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
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setSelectedClassId(classItem.id)}
                      >
                        {selectedClassId === classItem.id ? '已选中' : '选择'}
                      </Button>
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
                          className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border"
                        >
                          <span className="text-2xl">📚</span>
                          <span className="font-medium">{subject.name}</span>
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
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {students.map((student) => (
                        <div 
                          key={student.id}
                          className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg border"
                        >
                          <span className="text-xl">👤</span>
                          <div className="min-w-0">
                            <p className="font-medium truncate">{student.name}</p>
                            <p className="text-xs text-gray-500">{student.student_code}</p>
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
                    value={config?.global_task_status || 'semester'}
                    onValueChange={(value) => handleUpdateConfig({ global_task_status: value as 'semester' | 'vacation' })}
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
                    value={config?.today_override_status || 'auto'}
                    onValueChange={(value) => handleUpdateConfig({ 
                      today_override_status: value as 'auto' | 'force_open' | 'force_close',
                      today_override_date: new Date().toISOString().split('T')[0]
                    })}
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
                      value={config?.scan_start_time || '07:00'}
                      onChange={(e) => handleUpdateConfig({ scan_start_time: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>收作业结束时间</Label>
                    <Input 
                      type="time"
                      value={config?.scan_end_time || '12:00'}
                      onChange={(e) => handleUpdateConfig({ scan_end_time: e.target.value })}
                    />
                  </div>
                </div>
                
                {/* 预警天数 */}
                <div className="space-y-2">
                  <Label>连续未交预警天数</Label>
                  <Input 
                    type="number"
                    min={1}
                    max={30}
                    value={config?.alert_continuous_days || 3}
                    onChange={(e) => handleUpdateConfig({ alert_continuous_days: parseInt(e.target.value, 10) })}
                  />
                  <p className="text-xs text-gray-500">
                    连续 N 天未交作业的学生将被标记为预警
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
