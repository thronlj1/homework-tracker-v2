// 数据库类型定义

export interface Class {
  id: number;
  name: string;
  class_image: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface Student {
  id: number;
  class_id: number;
  name: string;
  student_code: string;
  avatar_image: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface Subject {
  id: number;
  class_id: number;
  name: string;
  subject_image: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface HomeworkRecord {
  id: number;
  class_id: number;
  student_id: number;
  subject_id: number;
  submit_date: string;
  submit_time: string;
  created_at: string;
}

export interface HomeworkExemption {
  id: number;
  class_id: number;
  student_id: number;
  subject_id: number;
  exempt_date: string;
  reason: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface SystemConfig {
  id: number;
  class_id: number | null;
  scan_start_time: string;
  scan_end_time: string;
  alert_continuous_days: number;
  reminder_broadcast_times: number;
  reminder_schedule_times: string | null;
  reminder_poll_interval_minutes: number;
  student_reminder_voice_enabled: boolean;
  global_task_status: 'semester' | 'vacation';
  today_override_date: string | null;
  today_override_status: 'auto' | 'force_open' | 'force_close';
  created_at: string;
  updated_at: string | null;
}

// 二维码格式: Class_<class_id>_Subject_<subject_id>_Student_<student_id>
export interface QRCodeData {
  class_id: number;
  subject_id: number;
  student_id: number;
}

export interface SubmitResult {
  success: boolean;
  message: string;
  type: 'success' | 'duplicate' | 'invalid' | 'error';
  student?: Student;
  subject?: Subject;
  /** 本次尝试写入的 submit_date（仅 duplicate / 部分 error 时便于与库内数据对照） */
  attemptedSubmitDate?: string;
  /** 原始 Postgres 错误码，如 23505=唯一约束（勿依赖 message 子串，避免误判） */
  postgresCode?: string;
}

export interface TimeGuardStatus {
  allowed: boolean;
  reason: string;
  /** 时间守卫层级；当前仅时段校验，固定为 1 */
  level: 1;
}

// 班级统计数据
export interface ClassStats {
  class_id: number;
  total_students: number;
  subjects: SubjectStats[];
}

export interface SubjectStats {
  subject_id: number;
  subject_name: string;
  total: number;
  submitted: number;
  exempted: number;
  not_submitted: number;
  percentage: number;
}

export interface StudentStatus {
  student_id: number;
  student_name: string;
  student_code: string;
  status: 'submitted' | 'not_submitted' | 'exempted';
  record_id?: number;
  submit_time?: string;
  /** 豁免记录 id，仅 status 为 exempted 时有值，用于取消豁免 */
  exemption_id?: number;
}
