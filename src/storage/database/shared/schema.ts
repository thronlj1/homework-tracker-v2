import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, integer, index, serial } from "drizzle-orm/pg-core";

// ============================================
// 1. 班级表 (classes)
// ============================================
export const classes = pgTable(
  "classes",
  {
    id: serial().primaryKey(),
    name: varchar("name", { length: 100 }).notNull().unique(),
    class_image: text("class_image"), // 班级图 URL
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("classes_name_idx").on(table.name),
  ]
);

// ============================================
// 2. 学生名册表 (students)
// ============================================
export const students = pgTable(
  "students",
  {
    id: serial().primaryKey(),
    class_id: integer("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    student_code: varchar("student_code", { length: 50 }).notNull(), // 学号/学生编号
    avatar_image: text("avatar_image"), // 学生头像 URL
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("students_class_id_idx").on(table.class_id),
    index("students_student_code_idx").on(table.student_code),
    index("students_name_idx").on(table.name),
  ]
);

// ============================================
// 3. 科目表 (subjects)
// ============================================
export const subjects = pgTable(
  "subjects",
  {
    id: serial().primaryKey(),
    class_id: integer("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 100 }).notNull(),
    subject_image: text("subject_image"), // 科目图 URL
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("subjects_class_id_idx").on(table.class_id),
    index("subjects_name_idx").on(table.name),
  ]
);

// ============================================
// 4. 作业提交流水表 (homework_records)
// ============================================
export const homeworkRecords = pgTable(
  "homework_records",
  {
    id: serial().primaryKey(),
    class_id: integer("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
    student_id: integer("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
    subject_id: integer("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
    submit_date: varchar("submit_date", { length: 10 }).notNull(), // 格式: YYYY-MM-DD
    submit_time: timestamp("submit_time", { withTimezone: true }).defaultNow().notNull(),
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("homework_records_class_id_idx").on(table.class_id),
    index("homework_records_student_id_idx").on(table.student_id),
    index("homework_records_subject_id_idx").on(table.subject_id),
    index("homework_records_submit_date_idx").on(table.submit_date),
    // 复合索引用于唯一性检查：同一学生同一科目同一天只能提交一次
    index("homework_records_unique_idx").on(table.student_id, table.subject_id, table.submit_date),
  ]
);

// ============================================
// 5. 免交/豁免记录表 (homework_exemptions)
// ============================================
export const homeworkExemptions = pgTable(
  "homework_exemptions",
  {
    id: serial().primaryKey(),
    class_id: integer("class_id").notNull().references(() => classes.id, { onDelete: "cascade" }),
    student_id: integer("student_id").notNull().references(() => students.id, { onDelete: "cascade" }),
    subject_id: integer("subject_id").notNull().references(() => subjects.id, { onDelete: "cascade" }),
    exempt_date: varchar("exempt_date", { length: 10 }).notNull(), // 格式: YYYY-MM-DD
    reason: varchar("reason", { length: 255 }), // 豁免原因（如：请假、体育课等）
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("homework_exemptions_class_id_idx").on(table.class_id),
    index("homework_exemptions_student_id_idx").on(table.student_id),
    index("homework_exemptions_subject_id_idx").on(table.subject_id),
    index("homework_exemptions_date_idx").on(table.exempt_date),
    // 复合索引用于唯一性检查
    index("homework_exemptions_unique_idx").on(table.student_id, table.subject_id, table.exempt_date),
  ]
);

// ============================================
// 6. 系统配置表 (system_configs)
// ============================================
export const systemConfigs = pgTable(
  "system_configs",
  {
    id: serial().primaryKey(),
    class_id: integer("class_id").references(() => classes.id, { onDelete: "cascade" }), // 可空表示全局配置
    scan_start_time: varchar("scan_start_time", { length: 5 }).notNull().default("07:00"), // HH:mm 格式
    scan_end_time: varchar("scan_end_time", { length: 5 }).notNull().default("12:00"), // HH:mm 格式
    alert_continuous_days: integer("alert_continuous_days").notNull().default(3), // 预警连续天数
    global_task_status: varchar("global_task_status", { length: 20 }).notNull().default("semester"), // semester / vacation
    today_override_date: varchar("today_override_date", { length: 10 }), // 今日覆盖日期
    today_override_status: varchar("today_override_status", { length: 20 }).default("auto"), // auto / force_open / force_close
    created_at: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updated_at: timestamp("updated_at", { withTimezone: true }),
  },
  (table) => [
    index("system_configs_class_id_idx").on(table.class_id),
  ]
);

// 保留系统表
export const healthCheck = pgTable("health_check", {
  id: serial().notNull(),
  updated_at: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});
