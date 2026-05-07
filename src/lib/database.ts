import { getSupabaseClient } from '@/storage/database/supabase-client';
import {
  ensureSystemConfigCache,
  refreshSystemConfigCache,
  getResolvedSystemConfig,
  invalidateSystemConfigCache,
} from '@/lib/system-config-cache';
import type {
  Class,
  Student,
  Subject,
  HomeworkRecord,
  HomeworkExemption,
  SystemConfig,
  QRCodeData,
  SubmitResult,
  TimeGuardStatus,
  ClassStats,
  SubjectStats,
  StudentStatus,
} from '@/types/database';

const isBrowser = typeof window !== 'undefined';

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  message?: string;
};

async function apiRequest<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  const payload = (await response.json()) as ApiEnvelope<T>;
  if (!response.ok || !payload.success) {
    throw new Error(payload.message || '请求失败');
  }
  return payload.data as T;
}

// ==================== 辅助函数 ====================

// 解析二维码数据
export function parseQRCode(code: string): QRCodeData | null {
  const pattern = /^Class_(\d+)_Subject_(\d+)_Student_(\d+)$/;
  const match = code.match(pattern);
  if (!match) return null;
  
  return {
    class_id: parseInt(match[1], 10),
    subject_id: parseInt(match[2], 10),
    student_id: parseInt(match[3], 10),
  };
}

// ==================== 时区工具 ====================

/** 获取中国标准时间 (CST, UTC+8) 的 Date 对象 */
function getCSTDate(): Date {
  const now = new Date();
  const cstStr = now.toLocaleString('en-US', { timeZone: 'Asia/Shanghai' });
  return new Date(cstStr);
}

// 获取今日日期 (YYYY-MM-DD)，基于北京时间
export function getTodayDate(): string {
  const cst = getCSTDate();
  const year = cst.getFullYear();
  const month = String(cst.getMonth() + 1).padStart(2, '0');
  const day = String(cst.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 获取当前时间 (HH:mm)，基于北京时间
export function getCurrentTime(): string {
  const cst = getCSTDate();
  const hours = String(cst.getHours()).padStart(2, '0');
  const minutes = String(cst.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

// ==================== 班级操作 ====================

export async function getClasses(): Promise<Class[]> {
  if (isBrowser) {
    return apiRequest<Class[]>('/api/classes');
  }
  const client = await getSupabaseClient();
  const { data, error } = await client.from('classes').select('*').order('name');
  if (error) throw new Error(`获取班级列表失败: ${error.message}`);
  return data || [];
}

export async function getClassById(id: number): Promise<Class | null> {
  if (isBrowser) {
    return apiRequest<Class | null>(`/api/classes?id=${id}`);
  }
  const client = await getSupabaseClient();
  const { data, error } = await client.from('classes').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`获取班级失败: ${error.message}`);
  return data;
}

export async function createClass(name: string, classImage?: string): Promise<Class> {
  if (isBrowser) {
    return apiRequest<Class>('/api/classes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, classImage }),
    });
  }
  const client = await getSupabaseClient();
  const { data, error } = await client.from('classes').insert({ name, class_image: classImage }).select().single();
  if (error) throw new Error(`创建班级失败: ${error.message}`);
  return data;
}

export async function updateClass(
  id: number,
  updates: Partial<Pick<Class, 'name' | 'class_image'>>
): Promise<Class> {
  if (isBrowser) {
    return apiRequest<Class>('/api/classes', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, updates }),
    });
  }
  const client = await getSupabaseClient();
  const { data, error } = await client
    .from('classes')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(`更新班级失败: ${error.message}`);
  return data;
}

export async function deleteClass(id: number): Promise<void> {
  if (isBrowser) {
    await apiRequest<null>(`/api/classes?id=${id}`, { method: 'DELETE' });
    return;
  }
  const client = await getSupabaseClient();
  const { error } = await client.from('classes').delete().eq('id', id);
  if (error) throw new Error(`删除班级失败: ${error.message}`);
}

// ==================== 学生操作 ====================

const studentCodeCollator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function compareStudentCode(aCode: string, bCode: string): number {
  const a = (aCode ?? '').trim();
  const b = (bCode ?? '').trim();

  // 纯数字学号：按数值大小比较（解决 '1' 与 '10' 的字符串字典序问题）
  const aIsDigits = /^\d+$/.test(a);
  const bIsDigits = /^\d+$/.test(b);

  if (aIsDigits && bIsDigits) {
    try {
      const aNum = BigInt(a);
      const bNum = BigInt(b);
      if (aNum === bNum) return 0;
      return aNum < bNum ? -1 : 1;
    } catch {
      // BigInt 解析失败（极端超长数字）时退回到“自然序”比较
    }
  }

  // 非纯数字或解析失败：使用自然序比较（尽量符合用户直觉）
  return studentCodeCollator.compare(a, b);
}

function sortStudentsByStudentCode(students: Student[]): Student[] {
  return [...students].sort((a, b) => {
    const byCode = compareStudentCode(a.student_code, b.student_code);
    if (byCode !== 0) return byCode;
    // 兜底：学号相同则按 id 保持稳定
    return a.id - b.id;
  });
}

export async function getStudentsByClass(classId: number): Promise<Student[]> {
  const students = isBrowser
    ? await apiRequest<Student[]>(`/api/students?classId=${classId}`)
    : await (async () => {
        const client = await getSupabaseClient();
        const { data, error } = await client
          .from('students')
          .select('*')
          .eq('class_id', classId);
        if (error) throw new Error(`获取学生列表失败: ${error.message}`);
        return data || [];
      })();

  return sortStudentsByStudentCode(students);
}

export async function getStudentById(id: number): Promise<Student | null> {
  const client = await getSupabaseClient();
  const { data, error } = await client.from('students').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`获取学生失败: ${error.message}`);
  return data;
}

export async function createStudent(
  classId: number,
  name: string,
  studentCode: string,
  avatarImage?: string
): Promise<Student> {
  if (isBrowser) {
    return apiRequest<Student>('/api/students', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId, name, studentCode, avatarImage }),
    });
  }
  const client = await getSupabaseClient();
  const { data, error } = await client
    .from('students')
    .insert({ class_id: classId, name, student_code: studentCode, avatar_image: avatarImage })
    .select()
    .single();
  if (error) throw new Error(`创建学生失败: ${error.message}`);
  return data;
}

export async function updateStudent(
  id: number,
  updates: Partial<Pick<Student, 'name' | 'student_code' | 'avatar_image'>>
): Promise<Student> {
  if (isBrowser) {
    return apiRequest<Student>('/api/students', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, updates }),
    });
  }
  const client = await getSupabaseClient();
  const { data, error } = await client
    .from('students')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(`更新学生失败: ${error.message}`);
  return data;
}

export async function deleteStudent(id: number): Promise<void> {
  if (isBrowser) {
    await apiRequest<null>(`/api/students?id=${id}`, { method: 'DELETE' });
    return;
  }
  const client = await getSupabaseClient();
  const { error } = await client.from('students').delete().eq('id', id);
  if (error) throw new Error(`删除学生失败: ${error.message}`);
}

// ==================== 科目操作 ====================

export async function getSubjectsByClass(classId: number): Promise<Subject[]> {
  if (isBrowser) {
    return apiRequest<Subject[]>(`/api/subjects?classId=${classId}`);
  }
  const client = await getSupabaseClient();
  const { data, error } = await client.from('subjects').select('*').eq('class_id', classId).order('name');
  if (error) throw new Error(`获取科目列表失败: ${error.message}`);
  return data || [];
}

export async function getSubjectById(id: number): Promise<Subject | null> {
  const client = await getSupabaseClient();
  const { data, error } = await client.from('subjects').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`获取科目失败: ${error.message}`);
  return data;
}

export async function createSubject(
  classId: number,
  name: string,
  subjectImage?: string
): Promise<Subject> {
  if (isBrowser) {
    return apiRequest<Subject>('/api/subjects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId, name, subjectImage }),
    });
  }
  const client = await getSupabaseClient();
  const { data, error } = await client
    .from('subjects')
    .insert({ class_id: classId, name, subject_image: subjectImage })
    .select()
    .single();
  if (error) throw new Error(`创建科目失败: ${error.message}`);
  return data;
}

export async function updateSubject(
  id: number,
  updates: Partial<Pick<Subject, 'name' | 'subject_image'>>
): Promise<Subject> {
  if (isBrowser) {
    return apiRequest<Subject>('/api/subjects', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, updates }),
    });
  }
  const client = await getSupabaseClient();
  const { data, error } = await client
    .from('subjects')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(`更新科目失败: ${error.message}`);
  return data;
}

export async function deleteSubject(id: number): Promise<void> {
  if (isBrowser) {
    await apiRequest<null>(`/api/subjects?id=${id}`, { method: 'DELETE' });
    return;
  }
  const client = await getSupabaseClient();
  const { error } = await client.from('subjects').delete().eq('id', id);
  if (error) throw new Error(`删除科目失败: ${error.message}`);
}

// ==================== 作业记录操作 ====================

export async function getHomeworkRecords(
  classId: number,
  date: string
): Promise<HomeworkRecord[]> {
  const client = await getSupabaseClient();
  const { data, error } = await client
    .from('homework_records')
    .select('*')
    .eq('class_id', classId)
    .eq('submit_date', date);
  if (error) throw new Error(`获取作业记录失败: ${error.message}`);
  return data || [];
}

export async function submitHomework(
  classId: number,
  studentId: number,
  subjectId: number,
  date: string
): Promise<HomeworkRecord> {
  const client = await getSupabaseClient();
  const { data, error } = await client
    .from('homework_records')
    .insert({
      class_id: classId,
      student_id: studentId,
      subject_id: subjectId,
      submit_date: date,
    })
    .select()
    .single();
  if (error) throw new Error(`提交作业失败: ${error.message}`);
  return data;
}

export async function deleteHomeworkRecord(id: number): Promise<void> {
  if (isBrowser) {
    await apiRequest<null>(`/api/homework-records?id=${id}`, { method: 'DELETE' });
    return;
  }
  const client = await getSupabaseClient();
  const { error } = await client.from('homework_records').delete().eq('id', id);
  if (error) throw new Error(`删除作业记录失败: ${error.message}`);
}

// ==================== 豁免记录操作 ====================

export async function getExemptions(
  classId: number,
  date: string
): Promise<HomeworkExemption[]> {
  const client = await getSupabaseClient();
  const { data, error } = await client
    .from('homework_exemptions')
    .select('*')
    .eq('class_id', classId)
    .eq('exempt_date', date);
  if (error) throw new Error(`获取豁免记录失败: ${error.message}`);
  return data || [];
}

export async function createExemption(
  classId: number,
  studentId: number,
  subjectId: number,
  date: string,
  reason?: string
): Promise<HomeworkExemption> {
  if (isBrowser) {
    return apiRequest<HomeworkExemption>('/api/exemptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ classId, studentId, subjectId, date, reason }),
    });
  }
  const client = await getSupabaseClient();
  const { data, error } = await client
    .from('homework_exemptions')
    .insert({
      class_id: classId,
      student_id: studentId,
      subject_id: subjectId,
      exempt_date: date,
      reason,
    })
    .select()
    .single();
  if (error) throw new Error(`创建豁免记录失败: ${error.message}`);
  return data;
}

export async function deleteExemption(id: number): Promise<void> {
  const client = await getSupabaseClient();
  const { error } = await client.from('homework_exemptions').delete().eq('id', id);
  if (error) throw new Error(`删除豁免记录失败: ${error.message}`);
}

// ==================== 系统配置操作 ====================

export async function getSystemConfig(classId?: number): Promise<SystemConfig | null> {
  if (isBrowser) {
    const query = classId ? `?classId=${classId}` : '';
    return apiRequest<SystemConfig | null>(`/api/config${query}`);
  }
  await ensureSystemConfigCache();
  return getResolvedSystemConfig(classId);
}

export async function updateSystemConfig(
  id: number,
  updates: Partial<Omit<SystemConfig, 'id' | 'created_at' | 'updated_at'>>
): Promise<SystemConfig> {
  if (isBrowser) {
    return apiRequest<SystemConfig>('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
  }
  const client = await getSupabaseClient();
  const { data, error } = await client
    .from('system_configs')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(`更新系统配置失败: ${error.message}`);
  try {
    await refreshSystemConfigCache();
  } catch (e) {
    console.error('[system-config-cache] refresh failed after update:', e);
    invalidateSystemConfigCache();
  }
  return data;
}

export async function createSystemConfig(config: {
  class_id?: number;
  scan_start_time?: string;
  scan_end_time?: string;
  reminder_broadcast_times?: number;
  reminder_schedule_times?: string | null;
  reminder_poll_interval_minutes?: number;
  student_reminder_voice_enabled?: boolean;
}): Promise<SystemConfig> {
  if (isBrowser) {
    return apiRequest<SystemConfig>('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
  }
  const client = await getSupabaseClient();
  const { data, error } = await client.from('system_configs').insert(config).select().single();
  if (error) throw new Error(`创建系统配置失败: ${error.message}`);
  try {
    await refreshSystemConfigCache();
  } catch (e) {
    console.error('[system-config-cache] refresh failed after create:', e);
    invalidateSystemConfigCache();
  }
  return data;
}

// ==================== 时间守卫（多级优先级校验） ====================

export async function checkTimeGuard(classId?: number): Promise<TimeGuardStatus> {
  if (isBrowser) {
    const query = classId ? `?classId=${classId}` : '';
    return apiRequest<TimeGuardStatus>(`/api/time-guard${query}`);
  }

  const config = await getSystemConfig(classId);

  const defaultConfig: SystemConfig = {
    id: 0,
    class_id: null,
    scan_start_time: '07:00',
    scan_end_time: '12:00',
    alert_continuous_days: 3,
    reminder_broadcast_times: 1,
    reminder_schedule_times: null,
    reminder_poll_interval_minutes: 5,
    student_reminder_voice_enabled: true,
    global_task_status: 'semester',
    today_override_date: null,
    today_override_status: 'auto',
    created_at: '',
    updated_at: null,
  };

  const effectiveConfig = config || defaultConfig;
  const currentTime = getCurrentTime();
  const todayDate = getTodayDate();

  // 优先级 1：全局状态（寒暑假/长假暂停）
  if (effectiveConfig.global_task_status === 'vacation') {
    return {
      allowed: false,
      reason: '当前为假期，系统已暂停收作业',
      level: 1,
    };
  }

  // 优先级 2：今日人工干预
  if (
    effectiveConfig.today_override_date === todayDate &&
    effectiveConfig.today_override_status === 'force_close'
  ) {
    return {
      allowed: false,
      reason: '老师已关闭今日收作业',
      level: 2,
    };
  }
  if (
    effectiveConfig.today_override_date === todayDate &&
    effectiveConfig.today_override_status === 'force_open'
  ) {
    return {
      allowed: true,
      reason: '老师已强制开启今日收作业',
      level: 2,
    };
  }

  // 优先级 3：每日时段校验
  if (currentTime < effectiveConfig.scan_start_time || currentTime > effectiveConfig.scan_end_time) {
    return {
      allowed: false,
      reason: `今日收作业已结束（有效时段 ${effectiveConfig.scan_start_time}-${effectiveConfig.scan_end_time}）`,
      level: 3,
    };
  }

  return {
    allowed: true,
    reason: '正常开放',
    level: 3,
  };
}

// ==================== 统计数据 ====================

export async function getClassStats(classId: number, date: string): Promise<ClassStats> {
  if (isBrowser) {
    const result = await apiRequest<{ stats: ClassStats }>(`/api/stats?classId=${classId}&date=${date}`);
    return result.stats;
  }
  const [students, subjects, records, exemptions] = await Promise.all([
    getStudentsByClass(classId),
    getSubjectsByClass(classId),
    getHomeworkRecords(classId, date),
    getExemptions(classId, date),
  ]);
  
  const subjectsStats: SubjectStats[] = subjects.map((subject) => {
    const subjectRecords = records.filter((r) => r.subject_id === subject.id);
    const subjectExemptions = exemptions.filter((e) => e.subject_id === subject.id);
    
    const submitted = subjectRecords.length;
    const exempted = subjectExemptions.length;
    const total = students.length;
    const notSubmitted = total - submitted - exempted;
    const completed = submitted + exempted;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    return {
      subject_id: subject.id,
      subject_name: subject.name,
      total,
      submitted,
      exempted,
      not_submitted: notSubmitted,
      percentage,
    };
  });
  
  return {
    class_id: classId,
    total_students: students.length,
    subjects: subjectsStats,
  };
}

export async function getStudentStatuses(
  classId: number,
  subjectId: number,
  date: string
): Promise<StudentStatus[]> {
  if (isBrowser) {
    const result = await apiRequest<{ studentStatuses: StudentStatus[] | null }>(
      `/api/stats?classId=${classId}&subjectId=${subjectId}&date=${date}`
    );
    return result.studentStatuses || [];
  }
  const [students, records, exemptions] = await Promise.all([
    getStudentsByClass(classId),
    getHomeworkRecords(classId, date),
    getExemptions(classId, date),
  ]);
  
  const subjectRecords = records.filter((r) => r.subject_id === subjectId);
  const subjectExemptions = exemptions.filter((e) => e.subject_id === subjectId);
  
  const recordMap = new Map(subjectRecords.map((r) => [r.student_id, r]));
  const exemptionMap = new Map(subjectExemptions.map((e) => [e.student_id, e]));
  
  return students.map((student) => {
    const record = recordMap.get(student.id);
    const exemption = exemptionMap.get(student.id);
    
    if (record) {
      return {
        student_id: student.id,
        student_name: student.name,
        student_code: student.student_code,
        status: 'submitted' as const,
        record_id: record.id,
        submit_time: record.submit_time,
      };
    }
    
    if (exemption) {
      return {
        student_id: student.id,
        student_name: student.name,
        student_code: student.student_code,
        status: 'exempted' as const,
      };
    }
    
    return {
      student_id: student.id,
      student_name: student.name,
      student_code: student.student_code,
      status: 'not_submitted' as const,
    };
  });
}

// ==================== 提交作业（带校验） ====================

export async function submitHomeworkWithValidation(qrCode: string): Promise<SubmitResult> {
  // 1. 解析二维码
  const qrData = parseQRCode(qrCode);
  if (!qrData) {
    return {
      success: false,
      message: '无效二维码',
      type: 'invalid',
    };
  }
  
  // 2. 检查时间守卫
  const timeGuard = await checkTimeGuard(qrData.class_id);
  if (!timeGuard.allowed) {
    return {
      success: false,
      message: timeGuard.reason,
      type: 'error',
    };
  }
  
  // 3. 学生、科目并行查询；重复提交依赖唯一索引，由插入失败（23505）识别，不再先 SELECT
  const today = getTodayDate();
  const [student, subject] = await Promise.all([
    getStudentById(qrData.student_id),
    getSubjectById(qrData.subject_id),
  ]);

  if (!student || !subject) {
    return {
      success: false,
      message: '学生或科目不存在',
      type: 'invalid',
    };
  }

  // 4. 提交作业（与 homework_records 上 student_id+subject_id+submit_date 唯一索引配合）
  try {
    await submitHomework(qrData.class_id, qrData.student_id, qrData.subject_id, today);
    return {
      success: true,
      message: `${student.name} - ${subject.name}提交成功`,
      type: 'success',
      student,
      subject,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/23505|duplicate key|unique/i.test(message)) {
      return {
        success: false,
        message: '请勿重复提交',
        type: 'duplicate',
        student,
        subject,
      };
    }
    return {
      success: false,
      message: '提交失败，请重试',
      type: 'error',
    };
  }
}
