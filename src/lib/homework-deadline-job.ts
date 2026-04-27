import {
  getClasses,
  getCurrentTime,
  getStudentsByClass,
  getStudentStatuses,
  getSubjectsByClass,
  getSystemConfig,
  getTodayDate,
} from '@/lib/database';

const JOB_INTERVAL_MS = 30 * 60 * 1000;
const sentReminderKeys = new Set<string>();
let running = false;

function shouldRunForClass(scanEndTime: string): boolean {
  return getCurrentTime() > scanEndTime;
}

function buildReminderText(params: {
  className: string;
  classId: number;
  subjectName: string;
  subjectId: number;
  total: number;
  submitted: number;
  exempted: number;
  notSubmittedNames: string[];
  baseUrl: string;
}): { text: string; reminderUrl: string; triggerUrl: string } {
  const {
    className,
    classId,
    subjectName,
    subjectId,
    total,
    submitted,
    exempted,
    notSubmittedNames,
    baseUrl,
  } = params;

  const accountedSubmitted = submitted + exempted;
  const notSubmittedCount = notSubmittedNames.length;
  const reminderUrl = `${baseUrl}/teacher/dashboard?classId=${classId}&subjectId=${subjectId}&tab=not_submitted`;
  const triggerUrl = `${baseUrl}/api/reminder/trigger?classId=${classId}&subjectId=${subjectId}`;

  const text = [
    `### 作业到期提醒｜${className}【${subjectName}】`,
    '',
    `- 今日作业已截止收取（作业）`,
    `- 已交：${accountedSubmitted}/${total}（含豁免 ${exempted}）`,
    `- <font color="#d93025">未交：${notSubmittedCount} 人</font>`,
    `- <font color="#d93025">未交名单：${notSubmittedCount > 0 ? notSubmittedNames.join('、') : '无'}</font>`,
  ].join('\n');

  return { text, reminderUrl, triggerUrl };
}

async function sendDingTalkActionCard(
  webhook: string,
  title: string,
  text: string,
  reminderUrl: string,
  triggerUrl: string
): Promise<void> {
  const response = await fetch(webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      msgtype: 'actionCard',
      actionCard: {
        title,
        text,
        btnOrientation: '1',
        btns: [
          { title: '查看名单', actionURL: reminderUrl },
          { title: '一键催交（推送学生端）', actionURL: triggerUrl },
        ],
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`钉钉发送失败: HTTP ${response.status} ${body}`);
  }
}

export async function runHomeworkDeadlineJob(baseUrl: string): Promise<void> {
  return runHomeworkDeadlineJobWithOptions(baseUrl);
}

type HomeworkDeadlineJobOptions = {
  force?: boolean;
  ignoreDedup?: boolean;
  onlyClassId?: number;
};

export async function runHomeworkDeadlineJobWithOptions(
  baseUrl: string,
  options: HomeworkDeadlineJobOptions = {}
): Promise<void> {
  const webhook = process.env.DINGTALK_ROBOT_WEBHOOK;
  if (!webhook) return;
  if (running) return;
  running = true;

  try {
    const today = getTodayDate();
    const classes = await getClasses();

    for (const classItem of classes) {
      if (options.onlyClassId && classItem.id !== options.onlyClassId) {
        continue;
      }
      const config = await getSystemConfig(classItem.id);
      if (config?.global_task_status === 'vacation') continue;
      const scanEndTime = config?.scan_end_time ?? '12:00';
      if (!options.force && !shouldRunForClass(scanEndTime)) continue;

      const [subjects, students] = await Promise.all([
        getSubjectsByClass(classItem.id),
        getStudentsByClass(classItem.id),
      ]);
      if (subjects.length === 0 || students.length === 0) continue;

      for (const subject of subjects) {
        const statuses = await getStudentStatuses(classItem.id, subject.id, today);
        const submitted = statuses.filter((s) => s.status === 'submitted').length;
        const exempted = statuses.filter((s) => s.status === 'exempted').length;
        const notSubmittedNames = statuses
          .filter((s) => s.status === 'not_submitted')
          .map((s) => s.student_name);

        // 每天每班级每科只推送一次，避免半小时轮询反复轰炸
        const sentKey = `${today}:${classItem.id}:${subject.id}`;
        if (!options.ignoreDedup && sentReminderKeys.has(sentKey)) continue;

        const title = `作业提醒 ${classItem.name}-${subject.name}`;
        const { text, reminderUrl, triggerUrl } = buildReminderText({
          className: classItem.name,
          classId: classItem.id,
          subjectName: subject.name,
          subjectId: subject.id,
          total: students.length,
          submitted,
          exempted,
          notSubmittedNames,
          baseUrl,
        });

        await sendDingTalkActionCard(webhook, title, text, reminderUrl, triggerUrl);
        if (!options.ignoreDedup) {
          sentReminderKeys.add(sentKey);
        }
      }
    }

    // 清理历史 key，避免集合无限增长
    for (const key of Array.from(sentReminderKeys)) {
      if (!key.startsWith(`${today}:`)) {
        sentReminderKeys.delete(key);
      }
    }
  } catch (error) {
    console.error('Homework deadline job failed:', error);
  } finally {
    running = false;
  }
}

export function startHomeworkDeadlineJob(baseUrl: string): void {
  runHomeworkDeadlineJob(baseUrl).catch((error) => {
    console.error('Initial homework deadline scan failed:', error);
  });

  setInterval(() => {
    runHomeworkDeadlineJob(baseUrl).catch((error) => {
      console.error('Scheduled homework deadline scan failed:', error);
    });
  }, JOB_INTERVAL_MS);
}
