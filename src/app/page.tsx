'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function HomePage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4 animate-bounce">📋</div>
          <p className="text-xl text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-50 to-pink-100">
      {/* 顶部标题 */}
      <header className="py-12 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">
          作业追踪系统
        </h1>
        <p className="text-gray-600 text-lg">
          Homework Tracker
        </p>
      </header>

      {/* 选择入口 */}
      <main className="max-w-4xl mx-auto px-4 pb-12">
        <div className="text-center mb-8">
          <h2 className="text-xl font-semibold text-gray-700">
            请选择您的角色
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 学生端入口 */}
          <Link href="/student">
            <Card className="h-full cursor-pointer hover:shadow-xl transition-all hover:scale-[1.02] border-2 border-transparent hover:border-blue-400 bg-white/80 backdrop-blur">
              <CardHeader className="text-center pb-2">
                <div className="text-6xl mb-4">📱</div>
                <CardTitle className="text-2xl">学生端</CardTitle>
                <CardDescription>滴！交作业</CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-gray-600 mb-4">
                  用于教室希沃白板
                </p>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full">
                  <span>扫描二维码提交作业</span>
                </div>
              </CardContent>
            </Card>
          </Link>

          {/* 教师端入口 */}
          <Link href="/teacher">
            <Card className="h-full cursor-pointer hover:shadow-xl transition-all hover:scale-[1.02] border-2 border-transparent hover:border-purple-400 bg-white/80 backdrop-blur">
              <CardHeader className="text-center pb-2">
                <div className="text-6xl mb-4">📊</div>
                <CardTitle className="text-2xl">教师端</CardTitle>
                <CardDescription>作业雷达</CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <p className="text-gray-600 mb-4">
                  用于教师手机管理
                </p>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-full">
                  <span>查看统计、催交、豁免</span>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* 功能特性 */}
        <div className="mt-12">
          <h3 className="text-lg font-semibold text-gray-700 text-center mb-6">
            系统功能
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-white/60 rounded-lg">
              <div className="text-3xl mb-2">📷</div>
              <p className="text-sm text-gray-600">扫码提交</p>
            </div>
            <div className="text-center p-4 bg-white/60 rounded-lg">
              <div className="text-3xl mb-2">🔒</div>
              <p className="text-sm text-gray-600">多级时间守卫</p>
            </div>
            <div className="text-center p-4 bg-white/60 rounded-lg">
              <div className="text-3xl mb-2">📈</div>
              <p className="text-sm text-gray-600">实时统计</p>
            </div>
            <div className="text-center p-4 bg-white/60 rounded-lg">
              <div className="text-3xl mb-2">⚠️</div>
              <p className="text-sm text-gray-600">学情预警</p>
            </div>
          </div>
        </div>

        {/* 二维码格式说明 */}
        <div className="mt-8 p-4 bg-white/60 rounded-lg">
          <h4 className="font-semibold text-gray-700 mb-2">二维码格式说明</h4>
          <code className="text-sm text-purple-600 bg-purple-50 px-3 py-1 rounded block">
            Class_1_Subject_2_Student_3
          </code>
          <p className="text-xs text-gray-500 mt-2">
            每个学生-科目对应一张二维码，格式为：Class_班级ID_Subject_科目ID_Student_学生ID
          </p>
        </div>
      </main>

      {/* 底部 */}
      <footer className="py-6 text-center text-sm text-gray-500">
        <p>作业追踪系统 Homework Tracker</p>
      </footer>
    </div>
  );
}
