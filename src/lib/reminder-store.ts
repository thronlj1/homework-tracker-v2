type ReminderRecord = {
  id: string;
  classId: number;
  message: string;
  updatedAt: number;
};

const reminderStore = new Map<number, ReminderRecord>();
const REMINDER_TTL_MS = 10 * 60 * 1000;

export function setClassReminder(classId: number, message: string): ReminderRecord {
  const record: ReminderRecord = {
    id: `${classId}-${Date.now()}`,
    classId,
    message,
    updatedAt: Date.now(),
  };
  reminderStore.set(classId, record);
  return record;
}

export function getClassReminder(classId: number): ReminderRecord | null {
  const record = reminderStore.get(classId);
  if (!record) return null;

  if (Date.now() - record.updatedAt > REMINDER_TTL_MS) {
    reminderStore.delete(classId);
    return null;
  }

  return record;
}
