'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getClasses, checkTimeGuard } from '@/lib/database';
import type { Class, TimeGuardStatus } from '@/types/database';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function StudentHomePage() {
  const router = useRouter();
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeGuard, setTimeGuard] = useState<TimeGuardStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      
      // 并行加载班级列表和时间守卫状态
      const [classesData, guardStatus] = await Promise.all([
        getClasses(),
        checkTimeGuard(),
      ]);
      
      setClasses(classesData);
      setTimeGuard(guardStatus);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载数据失败');
    } finally {
      setLoading(false);
    }
  }

  function handleSelectClass(classId: number) {
    if (timeGuard && !timeGuard.allowed) {
      return; // 系统锁定时不跳转
    }
    router.push(`/student/scanner?classId=${classId}`);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="w-full max-w-4xl">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">滴！交作业</h1>
            <p className="text-gray-600">请选择你的班级</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-24" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-10 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-red-600">加载失败</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={loadData} className="w-full">重新加载</Button>
          </CardContent>
        </Card>
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
            <CardTitle className="text-2xl">系统已锁定</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg text-gray-600 mb-4">{timeGuard.reason}</p>
            <p className="text-sm text-gray-500">
              请联系老师了解详情
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">滴！交作业</h1>
          <p className="text-gray-600">请选择你的班级</p>
        </div>
        
        {classes.length === 0 ? (
          <Card className="text-center">
            <CardHeader>
              <CardTitle>暂无班级</CardTitle>
              <CardDescription>请联系老师添加班级</CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {classes.map((classItem) => (
              <Card 
                key={classItem.id} 
                className="cursor-pointer hover:shadow-lg transition-shadow border-2 border-transparent hover:border-blue-400"
                onClick={() => handleSelectClass(classItem.id)}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-2xl">🏫</span>
                    {classItem.name}
                  </CardTitle>
                  <CardDescription>
                    点击进入扫码页面
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" size="lg">
                    选择班级
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
