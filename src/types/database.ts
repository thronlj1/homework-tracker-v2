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
}

export interface TimeGuardStatus {
  allowed: boolean;
  reason: string;
  level: 1 | 2 | 3 | 4;
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
}
