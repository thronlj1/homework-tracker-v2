'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getClasses } from '@/lib/database';
import type { Class } from '@/types/database';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function TeacherHomePage() {
  const router = useRouter();
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);
      const data = await getClasses();
      setClasses(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载数据失败');
    } finally {
      setLoading(false);
    }
  }

  function handleSelectClass(classId: number) {
    router.push(`/teacher/dashboard?classId=${classId}`);
  }

  function handleOpenSettings() {
    router.push('/teacher/settings');
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8 pt-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">作业雷达</h1>
            <p className="text-gray-600">选择班级查看作业情况</p>
          </div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
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
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 flex items-center justify-center p-4">
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100">
      {/* 顶部标题栏 */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto p-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">作业雷达</h1>
            <p className="text-sm text-gray-500">教师管理端</p>
          </div>
          <Button variant="outline" onClick={handleOpenSettings}>
            ⚙️ 系统设置
          </Button>
        </div>
      </header>

      {/* 班级列表 */}
      <main className="max-w-4xl mx-auto p-4">
        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold text-gray-700">选择班级</h2>
        </div>
        
        {classes.length === 0 ? (
          <Card className="text-center">
            <CardHeader>
              <CardTitle>暂无班级</CardTitle>
              <CardDescription>请先在系统设置中添加班级</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleOpenSettings}>前往设置</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {classes.map((classItem) => (
              <Card 
                key={classItem.id} 
                className="cursor-pointer hover:shadow-lg transition-all hover:scale-[1.02] border-2 border-transparent hover:border-purple-400"
                onClick={() => handleSelectClass(classItem.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <span className="text-2xl">🏫</span>
                      {classItem.name}
                    </CardTitle>
                    <span className="text-2xl">→</span>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-gray-500">点击查看班级作业情况</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
