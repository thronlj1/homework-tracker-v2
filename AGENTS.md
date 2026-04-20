# 作业追踪系统 (Homework Tracker)

## 项目概述

班级作业轻量级扫码管家，支持学生扫码提交作业和教师端实时监控、催交、豁免等管理功能。

### 产品命名
- **学生端**：`滴！交作业` - 用于教室希沃白板（扫码采集）
- **教师端**：`作业雷达` - 用于教师手机（管理监控）

## 技术架构

### 技术栈
- **框架**: Next.js 16 (App Router)
- **核心**: React 19
- **语言**: TypeScript 5
- **UI组件**: shadcn/ui (基于 Radix UI)
- **样式**: Tailwind CSS 4
- **数据库**: Supabase (PostgreSQL)

### 系统架构
```
├── 学生端（采集器）     # /student/*
│   ├── 班级选择页面     # /student
│   └── 扫码采集页面     # /student/scanner
│
├── 教师端（管理台）     # /teacher/*
│   ├── 班级列表页面     # /teacher
│   ├── 数据看板页面     # /teacher/dashboard
│   └── 系统设置页面     # /teacher/settings
│
├── API Routes          # /api/*
│   ├── /api/classes    # 班级管理
│   ├── /api/subjects   # 科目管理
│   ├── /api/students   # 学生管理
│   ├── /api/submit     # 作业提交
│   ├── /api/exemptions # 豁免管理
│   ├── /api/stats      # 统计数据
│   ├── /api/config     # 系统配置
│   └── /api/time-guard # 时间守卫
│
└── 数据库表结构         # Supabase
    ├── classes          # 班级表
    ├── students         # 学生表
    ├── subjects         # 科目表
    ├── homework_records # 作业记录表
    ├── homework_exemptions # 豁免记录表
    └── system_configs   # 系统配置表
```

## 二维码格式

每个学生-科目对应一张二维码，格式为：
```
Class_<class_id>_Subject_<subject_id>_Student_<student_id>
```

示例：
```
Class_1_Subject_1_Student_1
```

## 多级时间守卫

系统支持 4 级时间校验，按优先级依次为：

1. **优先级 1（全局状态）**: 检查系统是否为"寒暑假/长假暂停"状态
2. **优先级 2（今日人工干预）**: 检查教师是否对今日下达了"强制关闭"或"强制开启"指令
3. **优先级 3（法定日历）**: 自动调用节假日 API，判断是否为周末或法定节假日
4. **优先级 4（每日时段）**: 校验当前时间是否在"有效收作业时间段"内（默认 07:00-12:00）

## 数据库表设计

### classes（班级表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | serial | 主键 |
| name | varchar(100) | 班级名称 |
| class_image | text | 班级图片 |
| created_at | timestamp | 创建时间 |
| updated_at | timestamp | 更新时间 |

### students（学生表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | serial | 主键 |
| class_id | integer | 班级ID（外键） |
| name | varchar(100) | 学生姓名 |
| student_code | varchar(50) | 学号 |
| avatar_image | text | 学生头像 |
| created_at | timestamp | 创建时间 |
| updated_at | timestamp | 更新时间 |

### subjects（科目表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | serial | 主键 |
| class_id | integer | 班级ID（外键） |
| name | varchar(100) | 科目名称 |
| subject_image | text | 科目图片 |
| created_at | timestamp | 创建时间 |
| updated_at | timestamp | 更新时间 |

### homework_records（作业记录表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | serial | 主键 |
| class_id | integer | 班级ID（外键） |
| student_id | integer | 学生ID（外键） |
| subject_id | integer | 科目ID（外键） |
| submit_date | varchar(10) | 提交日期 (YYYY-MM-DD) |
| submit_time | timestamp | 提交时间 |
| created_at | timestamp | 创建时间 |

### homework_exemptions（豁免记录表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | serial | 主键 |
| class_id | integer | 班级ID（外键） |
| student_id | integer | 学生ID（外键） |
| subject_id | integer | 科目ID（外键） |
| exempt_date | varchar(10) | 豁免日期 (YYYY-MM-DD) |
| reason | varchar(255) | 豁免原因 |
| created_at | timestamp | 创建时间 |
| updated_at | timestamp | 更新时间 |

### system_configs（系统配置表）
| 字段 | 类型 | 说明 |
|------|------|------|
| id | serial | 主键 |
| class_id | integer | 班级ID（可空表示全局配置） |
| scan_start_time | varchar(5) | 收作业开始时间 (HH:mm) |
| scan_end_time | varchar(5) | 收作业结束时间 (HH:mm) |
| alert_continuous_days | integer | 预警连续天数 |
| global_task_status | varchar(20) | 全局任务状态 (semester/vacation) |
| today_override_date | varchar(10) | 今日覆盖日期 |
| today_override_status | varchar(20) | 今日覆盖状态 (auto/force_open/force_close) |
| created_at | timestamp | 创建时间 |
| updated_at | timestamp | 更新时间 |

## 开发命令

```bash
# 安装依赖
pnpm install

# 开发环境运行
pnpm dev

# 构建生产版本
pnpm build

# 静态检查
pnpm lint

# 类型检查
pnpm ts-check
```

## 数据库操作

```bash
# 同步数据库模型
coze-coding-ai db generate-models

# 执行数据库迁移
coze-coding-ai db upgrade
```

## 环境变量

系统使用 Supabase 数据库，需要配置以下环境变量：
- `COZE_SUPABASE_URL`: Supabase 项目 URL
- `COZE_SUPABASE_ANON_KEY`: Supabase 匿名密钥
- `COZE_SUPABASE_SERVICE_ROLE_KEY`: Supabase 服务端密钥

## 功能特性

### 学生端功能
- [x] 班级选择入口
- [x] 扫码枪全局监听
- [x] 二维码解析与验证
- [x] 重复提交拦截
- [x] 视听反馈（成功音/失败音）
- [x] 多级时间守卫校验
- [x] 系统锁定状态展示

### 教师端功能
- [x] 班级列表展示
- [x] 今日作业进度看板
- [x] 各科目提交统计
- [x] 已交/未交名单
- [x] 一键复制催交文案
- [x] 学生豁免操作
- [x] 提交记录撤销
- [x] 学情预警提示
- [x] 系统规则与日历控制台

### 系统功能
- [x] 班级管理（增删改）
- [x] 科目管理（增删改）
- [x] 学生管理（增删改）
- [x] 全局任务开关（学期中/寒暑假）
- [x] 今日状态覆盖（强制开启/强制关闭）
- [x] 收作业时段配置
- [x] 预警天数配置
