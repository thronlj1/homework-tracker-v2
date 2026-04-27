import type { Metadata } from 'next';
import { Inspector } from 'react-dev-inspector';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: '滴！交作业！',
    template: '%s | 滴！交作业！',
  },
  description:
    '班级作业追踪系统，支持学生扫码提交、教师端实时看板、催交提醒与豁免管理。',
  keywords: [
    '作业追踪',
    '学生扫码',
    '教师看板',
    '催交提醒',
    '班级管理',
    '作业雷达',
    '滴交作业',
  ],
  authors: [{ name: 'Homework Tracker Team' }],
  generator: 'Homework Tracker',
  // icons: {
  //   icon: '',
  // },
  openGraph: {
    title: '滴！交作业！ | 班级作业追踪系统',
    description:
      '支持学生扫码提交、教师端实时监控、催交提醒与数据导出的一体化作业管理平台。',
    siteName: '滴！交作业！',
    locale: 'zh_CN',
    type: 'website',
    // images: [
    //   {
    //     url: '',
    //     width: 1200,
    //     height: 630,
    //     alt: '滴！交作业！',
    //   },
    // ],
  },
  // twitter: {
  //   card: 'summary_large_image',
  //   title: '滴！交作业！ | 班级作业追踪系统',
  //   description:
  //     'Build and deploy full-stack applications through AI conversation. No env setup, just flow.',
  //   // images: [''],
  // },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.COZE_PROJECT_ENV === 'DEV';

  return (
    <html lang="en">
      <body className={`antialiased`}>
        {isDev && <Inspector />}
        {children}
      </body>
    </html>
  );
}
