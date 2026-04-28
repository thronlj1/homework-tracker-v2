import {
  getClasses,
  getCurrentTime,
  getStudentsByClass,
  getStudentStatuses,
  getSubjectsByClass,
  getSystemConfig,
  getTodayDate,
} from '@/lib/database';

const sentReminderKeys = new Set<string>();
const scheduledBroadcastKeys = new Set<string>();
let running = false;
let scheduleTimer: ReturnType<typeof setTimeout> | null = null;

function shouldRunForClass(scanEndTime: string): boolean {
  return getCurrentTime() > scanEndTime;
}

function parseReminderScheduleTimes(value: string | null | undefined): string[] {
  if (!value) return [];
  const pattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
  return Array.from(
    new Set(
      value
        .split(',')
        .map((item) => item.trim())
        .filter((item) => pattern.test(item))
    )
  ).sort();
}

function getPollIntervalMs(value: number | null | undefined): number {
  const minutes = Number.isFinite(value) ? Math.max(1, Math.min(60, Number(value))) : 5;
  return minutes * 60 * 1000;
}

function getDueScheduleTimes(
  scheduleTimes: string[],
  nowMs: number,
  lookbackMs: number
): string[] {
  if (scheduleTimes.length === 0) return [];

  const now = new Date(nowMs);
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();
  const lowerBoundMs = nowMs - Math.max(60_000, lookbackMs);
  const due: string[] = [];

  for (const time of scheduleTimes) {
    const [hourStr, minuteStr] = time.split(':');
    const hour = Number(hourStr);
    const minute = Number(minuteStr);
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) continue;
    const slotMs = new Date(year, month, day, hour, minute, 0, 0).getTime();
    if (slotMs > lowerBoundMs && slotMs <= nowMs) {
      due.push(time);
    }
  }
  return due;
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

async function publishStudentReminder(baseUrl: string, classId: number, message: string): Promise<void> {
  const response = await fetch(`${baseUrl}/api/reminder`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ classId, message }),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`发布学生端提醒失败: HTTP ${response.status} ${body}`);
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
  if (running) return;
  running = true;

  try {
    const nowMs = Date.now();
    const today = getTodayDate();
    const classes = await getClasses();
    const globalConfig = await getSystemConfig();
    const scheduleTimes = parseReminderScheduleTimes(globalConfig?.reminder_schedule_times);
    const pollIntervalMs = getPollIntervalMs(globalConfig?.reminder_poll_interval_minutes);
    const dueScheduleTimes = options.force
      ? []
      : getDueScheduleTimes(scheduleTimes, nowMs, pollIntervalMs + 15_000);
    const shouldRunScheduledBroadcast = dueScheduleTimes.length > 0;
    if (shouldRunScheduledBroadcast) {
      console.log(
        `[scheduled-reminder] hit slots=${dueScheduleTimes.join(',')} now=${new Date(nowMs).toISOString()}`
      );
    }

    for (const classItem of classes) {
      if (options.onlyClassId && classItem.id !== options.onlyClassId) {
        continue;
      }
      const config = await getSystemConfig(classItem.id);
      if (config?.global_task_status === 'vacation') continue;
      const scanEndTime = config?.scan_end_time ?? '12:00';
      const shouldRunDeadlineReminder = Boolean(webhook) && (options.force || shouldRunForClass(scanEndTime));
      if (!shouldRunDeadlineReminder && !shouldRunScheduledBroadcast) continue;

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

        if (shouldRunDeadlineReminder) {
          if (!webhook) continue;
          // 每天每班级每科只推送一次，避免轮询反复轰炸
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

        if (shouldRunScheduledBroadcast && notSubmittedNames.length > 0) {
          const message = `定时催交 ${subject.name}还有 ${notSubmittedNames.length} 位同学未交：${notSubmittedNames.join('、')}。请尽快提交。`;
          for (const dueTime of dueScheduleTimes) {
            const scheduleKey = `${today}:${classItem.id}:${subject.id}:${dueTime}`;
            if (scheduledBroadcastKeys.has(scheduleKey)) continue;
            await publishStudentReminder(baseUrl, classItem.id, message);
            console.log(
              `[scheduled-reminder] published class=${classItem.id} subject=${subject.id} due=${dueTime} notSubmitted=${notSubmittedNames.length}`
            );
            scheduledBroadcastKeys.add(scheduleKey);
          }
        }
      }
    }

    // 清理历史 key，避免集合无限增长
    for (const key of Array.from(sentReminderKeys)) {
      if (!key.startsWith(`${today}:`)) {
        sentReminderKeys.delete(key);
      }
    }
    for (const key of Array.from(scheduledBroadcastKeys)) {
      if (!key.startsWith(`${today}:`)) {
        scheduledBroadcastKeys.delete(key);
      }
    }
  } catch (error) {
    console.error('Homework deadline job failed:', error);
  } finally {
    running = false;
  }
}

export function startHomeworkDeadlineJob(baseUrl: string): void {
  const runLoop = async () => {
    try {
      await runHomeworkDeadlineJob(baseUrl);
    } catch (error) {
      console.error('Scheduled homework deadline scan failed:', error);
    } finally {
      try {
        const config = await getSystemConfig();
        const delayMs = getPollIntervalMs(config?.reminder_poll_interval_minutes);
        if (scheduleTimer) clearTimeout(scheduleTimer);
        scheduleTimer = setTimeout(() => {
          void runLoop();
        }, delayMs);
      } catch (error) {
        console.error('Failed to schedule next homework deadline scan:', error);
        scheduleTimer = setTimeout(() => {
          void runLoop();
        }, 5 * 60 * 1000);
      }
    }
  };

  void runLoop();
}
