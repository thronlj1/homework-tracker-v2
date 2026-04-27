import { getSupabaseClient } from '@/storage/database/supabase-client';
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

// 获取今日日期 (YYYY-MM-DD)
export function getTodayDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 获取当前时间 (HH:mm)
export function getCurrentTime(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

// 判断是否为周末
function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

// ==================== 班级操作 ====================

export async function getClasses(): Promise<Class[]> {
  const client = await getSupabaseClient();
  const { data, error } = await client.from('classes').select('*').order('name');
  if (error) throw new Error(`获取班级列表失败: ${error.message}`);
  return data || [];
}

export async function getClassById(id: number): Promise<Class | null> {
  const client = await getSupabaseClient();
  const { data, error } = await client.from('classes').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`获取班级失败: ${error.message}`);
  return data;
}

export async function createClass(name: string, classImage?: string): Promise<Class> {
  const client = await getSupabaseClient();
  const { data, error } = await client.from('classes').insert({ name, class_image: classImage }).select().single();
  if (error) throw new Error(`创建班级失败: ${error.message}`);
  return data;
}

export async function updateClass(
  id: number,
  updates: Partial<Pick<Class, 'name' | 'class_image'>>
): Promise<Class> {
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
  const client = await getSupabaseClient();
  const { error } = await client.from('classes').delete().eq('id', id);
  if (error) throw new Error(`删除班级失败: ${error.message}`);
}

// ==================== 学生操作 ====================

export async function getStudentsByClass(classId: number): Promise<Student[]> {
  const client = await getSupabaseClient();
  const { data, error } = await client.from('students').select('*').eq('class_id', classId).order('student_code');
  if (error) throw new Error(`获取学生列表失败: ${error.message}`);
  return data || [];
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
  const client = await getSupabaseClient();
  const { error } = await client.from('students').delete().eq('id', id);
  if (error) throw new Error(`删除学生失败: ${error.message}`);
}

// ==================== 科目操作 ====================

export async function getSubjectsByClass(classId: number): Promise<Subject[]> {
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

export async function checkDuplicateSubmission(
  studentId: number,
  subjectId: number,
  date: string
): Promise<boolean> {
  const client = await getSupabaseClient();
  const { data, error } = await client
    .from('homework_records')
    .select('id')
    .eq('student_id', studentId)
    .eq('subject_id', subjectId)
    .eq('submit_date', date)
    .maybeSingle();
  if (error) throw new Error(`检查重复提交失败: ${error.message}`);
  return data !== null;
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
  const client = await getSupabaseClient();
  
  if (classId) {
    // 先查班级专属配置
    const { data, error } = await client.from('system_configs').select('*').eq('class_id', classId).maybeSingle();
    if (error) throw new Error(`获取系统配置失败: ${error.message}`);
    if (data) return data;
    
    // 再查全局配置
    const { data: globalData, error: globalError } = await client.from('system_configs').select('*').is('class_id', null).maybeSingle();
    if (globalError) throw new Error(`获取全局配置失败: ${globalError.message}`);
    return globalData;
  }
  
  const { data, error } = await client.from('system_configs').select('*').is('class_id', null).maybeSingle();
  if (error) throw new Error(`获取系统配置失败: ${error.message}`);
  return data;
}

export async function updateSystemConfig(
  id: number,
  updates: Partial<Omit<SystemConfig, 'id' | 'created_at' | 'updated_at'>>
): Promise<SystemConfig> {
  const client = await getSupabaseClient();
  const { data, error } = await client
    .from('system_configs')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw new Error(`更新系统配置失败: ${error.message}`);
  return data;
}

export async function createSystemConfig(config: {
  class_id?: number;
  scan_start_time?: string;
  scan_end_time?: string;
  alert_continuous_days?: number;
  global_task_status?: 'semester' | 'vacation';
}): Promise<SystemConfig> {
  const client = await getSupabaseClient();
  const { data, error } = await client.from('system_configs').insert(config).select().single();
  if (error) throw new Error(`创建系统配置失败: ${error.message}`);
  return data;
}

// ==================== 多级时间守卫 ====================

// 调用节假日 API 检查是否为法定节假日
async function checkHolidayApi(): Promise<boolean> {
  try {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;
    
    const response = await fetch(
      `https://api.apihub.cn/calendar/holiday?date=${dateStr}`
    );
    if (!response.ok) return false;
    
    const data = await response.json();
    // 假设返回的 is_holiday 为 true 表示节假日
    return data?.data?.is_holiday === true;
  } catch {
    return false;
  }
}

export async function checkTimeGuard(classId?: number): Promise<TimeGuardStatus> {
  const config = await getSystemConfig(classId);
  const today = getTodayDate();
  const currentTime = getCurrentTime();
  
  // 默认配置
  const defaultConfig: SystemConfig = {
    id: 0,
    class_id: null,
    scan_start_time: '07:00',
    scan_end_time: '12:00',
    alert_continuous_days: 3,
    global_task_status: 'semester',
    today_override_date: null,
    today_override_status: 'auto',
    created_at: '',
    updated_at: null,
  };
  
  const effectiveConfig = config || defaultConfig;
  
  // 优先级 1: 全局状态检查
  if (effectiveConfig.global_task_status === 'vacation') {
    return {
      allowed: false,
      reason: '当前为休假状态，系统已关闭',
      level: 1,
    };
  }
  
  // 优先级 2: 今日人工干预
  if (
    effectiveConfig.today_override_date === today &&
    effectiveConfig.today_override_status === 'force_close'
  ) {
    return {
      allowed: false,
      reason: '今日免交',
      level: 2,
    };
  }
  
  if (
    effectiveConfig.today_override_date === today &&
    effectiveConfig.today_override_status === 'force_open'
  ) {
    return {
      allowed: true,
      reason: '正常开放',
      level: 2,
    };
  }
  
  // 优先级 3: 法定日历检查
  const isWeekendDay = isWeekend(new Date());
  let isHoliday = false;
  
  try {
    isHoliday = await checkHolidayApi();
  } catch {
    // API 调用失败，静默处理
  }
  
  if (isWeekendDay || isHoliday) {
    return {
      allowed: false,
      reason: isHoliday ? '今日为法定休息日，无需提交' : '今日为周末，无需提交',
      level: 3,
    };
  }
  
  // 优先级 4: 时段检查
  if (currentTime < effectiveConfig.scan_start_time || currentTime > effectiveConfig.scan_end_time) {
    return {
      allowed: false,
      reason: '今日收作业已结束',
      level: 4,
    };
  }
  
  return {
    allowed: true,
    reason: '正常开放',
    level: 4,
  };
}

// ==================== 统计数据 ====================

export async function getClassStats(classId: number, date: string): Promise<ClassStats> {
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
    const percentage = total > 0 ? Math.round((submitted / total) * 100) : 0;
    
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
  
  // 3. 获取学生和科目信息
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
  
  // 4. 检查是否已提交
  const today = getTodayDate();
  const isDuplicate = await checkDuplicateSubmission(
    qrData.student_id,
    qrData.subject_id,
    today
  );
  
  if (isDuplicate) {
    return {
      success: false,
      message: '请勿重复提交',
      type: 'duplicate',
      student,
      subject,
    };
  }
  
  // 5. 提交作业
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
    return {
      success: false,
      message: '提交失败，请重试',
      type: 'error',
    };
  }
}

// ==================== 预警检查 ====================

export async function checkStudentWarnings(
  classId: number,
  subjectId: number,
  thresholdDays: number = 3
): Promise<number[]> {
  const client = await getSupabaseClient();
  const students = await getStudentsByClass(classId);
  const warningStudents: number[] = [];
  
  // 获取最近 N 个工作日的日期
  const workDays: string[] = [];
  const today = new Date();
  
  for (let i = 1; workDays.length < thresholdDays && i <= 30; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    
    if (!isWeekend(date)) {
      const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
      workDays.push(dateStr);
    }
  }
  
  if (workDays.length < thresholdDays) {
    return warningStudents;
  }
  
  // 检查每个学生的连续未交天数
  for (const student of students) {
    let consecutiveDays = 0;
    
    for (const date of workDays) {
      // 检查豁免记录
      const { data: exemption } = await client
        .from('homework_exemptions')
        .select('id')
        .eq('student_id', student.id)
        .eq('subject_id', subjectId)
        .eq('exempt_date', date)
        .maybeSingle();
      
      if (exemption) continue;
      
      // 检查提交记录
      const { data: record } = await client
        .from('homework_records')
        .select('id')
        .eq('student_id', student.id)
        .eq('subject_id', subjectId)
        .eq('submit_date', date)
        .maybeSingle();
      
      if (record) {
        consecutiveDays = 0;
      } else {
        consecutiveDays++;
        if (consecutiveDays >= thresholdDays) {
          warningStudents.push(student.id);
          break;
        }
      }
    }
  }
  
  return warningStudents;
}
