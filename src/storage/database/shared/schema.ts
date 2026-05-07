import { pgTable, index, foreignKey, pgPolicy, serial, integer, varchar, timestamp, unique, text } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const homeworkRecords = pgTable("homework_records", {
	id: serial().primaryKey().notNull(),
	classId: integer("class_id").notNull(),
	studentId: integer("student_id").notNull(),
	subjectId: integer("subject_id").notNull(),
	submitDate: varchar("submit_date", { length: 10 }).notNull(),
	submitTime: timestamp("submit_time", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("homework_records_class_id_idx").using("btree", table.classId.asc().nullsLast().op("int4_ops")),
	index("homework_records_student_id_idx").using("btree", table.studentId.asc().nullsLast().op("int4_ops")),
	index("homework_records_subject_id_idx").using("btree", table.subjectId.asc().nullsLast().op("int4_ops")),
	index("homework_records_submit_date_idx").using("btree", table.submitDate.asc().nullsLast().op("text_ops")),
	index("homework_records_unique_idx").using("btree", table.studentId.asc().nullsLast().op("int4_ops"), table.subjectId.asc().nullsLast().op("int4_ops"), table.submitDate.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.classId],
			foreignColumns: [classes.id],
			name: "homework_records_class_id_classes_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.studentId],
			foreignColumns: [students.id],
			name: "homework_records_student_id_students_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.subjectId],
			foreignColumns: [subjects.id],
			name: "homework_records_subject_id_subjects_id_fk"
		}).onDelete("cascade"),
	pgPolicy("homework_records_允许公开删除", { as: "permissive", for: "delete", to: ["public"], using: sql`true` }),
	pgPolicy("homework_records_允许公开更新", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("homework_records_允许公开写入", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("homework_records_允许公开读取", { as: "permissive", for: "select", to: ["public"] }),
]);

export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const classes = pgTable("classes", {
	id: serial().primaryKey().notNull(),
	name: varchar({ length: 100 }).notNull(),
	classImage: text("class_image"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("classes_name_idx").using("btree", table.name.asc().nullsLast().op("text_ops")),
	unique("classes_name_unique").on(table.name),
	pgPolicy("classes_允许公开删除", { as: "permissive", for: "delete", to: ["public"], using: sql`true` }),
	pgPolicy("classes_允许公开更新", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("classes_允许公开写入", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("classes_允许公开读取", { as: "permissive", for: "select", to: ["public"] }),
]);

export const homeworkExemptions = pgTable("homework_exemptions", {
	id: serial().primaryKey().notNull(),
	classId: integer("class_id").notNull(),
	studentId: integer("student_id").notNull(),
	subjectId: integer("subject_id").notNull(),
	exemptDate: varchar("exempt_date", { length: 10 }).notNull(),
	reason: varchar({ length: 255 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("homework_exemptions_class_id_idx").using("btree", table.classId.asc().nullsLast().op("int4_ops")),
	index("homework_exemptions_date_idx").using("btree", table.exemptDate.asc().nullsLast().op("text_ops")),
	index("homework_exemptions_student_id_idx").using("btree", table.studentId.asc().nullsLast().op("int4_ops")),
	index("homework_exemptions_subject_id_idx").using("btree", table.subjectId.asc().nullsLast().op("int4_ops")),
	index("homework_exemptions_unique_idx").using("btree", table.studentId.asc().nullsLast().op("int4_ops"), table.subjectId.asc().nullsLast().op("int4_ops"), table.exemptDate.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.classId],
			foreignColumns: [classes.id],
			name: "homework_exemptions_class_id_classes_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.studentId],
			foreignColumns: [students.id],
			name: "homework_exemptions_student_id_students_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.subjectId],
			foreignColumns: [subjects.id],
			name: "homework_exemptions_subject_id_subjects_id_fk"
		}).onDelete("cascade"),
	pgPolicy("homework_exemptions_允许公开删除", { as: "permissive", for: "delete", to: ["public"], using: sql`true` }),
	pgPolicy("homework_exemptions_允许公开更新", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("homework_exemptions_允许公开写入", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("homework_exemptions_允许公开读取", { as: "permissive", for: "select", to: ["public"] }),
]);

export const students = pgTable("students", {
	id: serial().primaryKey().notNull(),
	classId: integer("class_id").notNull(),
	name: varchar({ length: 100 }).notNull(),
	studentCode: varchar("student_code", { length: 50 }).notNull(),
	avatarImage: text("avatar_image"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("students_class_id_idx").using("btree", table.classId.asc().nullsLast().op("int4_ops")),
	index("students_name_idx").using("btree", table.name.asc().nullsLast().op("text_ops")),
	index("students_student_code_idx").using("btree", table.studentCode.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.classId],
			foreignColumns: [classes.id],
			name: "students_class_id_classes_id_fk"
		}).onDelete("cascade"),
	pgPolicy("students_允许公开删除", { as: "permissive", for: "delete", to: ["public"], using: sql`true` }),
	pgPolicy("students_允许公开更新", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("students_允许公开写入", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("students_允许公开读取", { as: "permissive", for: "select", to: ["public"] }),
]);

export const subjects = pgTable("subjects", {
	id: serial().primaryKey().notNull(),
	classId: integer("class_id").notNull(),
	name: varchar({ length: 100 }).notNull(),
	subjectImage: text("subject_image"),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("subjects_class_id_idx").using("btree", table.classId.asc().nullsLast().op("int4_ops")),
	index("subjects_name_idx").using("btree", table.name.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.classId],
			foreignColumns: [classes.id],
			name: "subjects_class_id_classes_id_fk"
		}).onDelete("cascade"),
	pgPolicy("subjects_允许公开删除", { as: "permissive", for: "delete", to: ["public"], using: sql`true` }),
	pgPolicy("subjects_允许公开更新", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("subjects_允许公开写入", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("subjects_允许公开读取", { as: "permissive", for: "select", to: ["public"] }),
]);

export const systemConfigs = pgTable("system_configs", {
	id: serial().primaryKey().notNull(),
	classId: integer("class_id"),
	scanStartTime: varchar("scan_start_time", { length: 5 }).default('07:00').notNull(),
	scanEndTime: varchar("scan_end_time", { length: 5 }).default('12:00').notNull(),
	alertContinuousDays: integer("alert_continuous_days").default(3).notNull(),
	globalTaskStatus: varchar("global_task_status", { length: 20 }).default('semester').notNull(),
	todayOverrideDate: varchar("today_override_date", { length: 10 }),
	todayOverrideStatus: varchar("today_override_status", { length: 20 }).default('auto'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("system_configs_class_id_idx").using("btree", table.classId.asc().nullsLast().op("int4_ops")),
	foreignKey({
			columns: [table.classId],
			foreignColumns: [classes.id],
			name: "system_configs_class_id_classes_id_fk"
		}).onDelete("cascade"),
	pgPolicy("system_configs_允许公开删除", { as: "permissive", for: "delete", to: ["public"], using: sql`true` }),
	pgPolicy("system_configs_允许公开更新", { as: "permissive", for: "update", to: ["public"] }),
	pgPolicy("system_configs_允许公开写入", { as: "permissive", for: "insert", to: ["public"] }),
	pgPolicy("system_configs_允许公开读取", { as: "permissive", for: "select", to: ["public"] }),
]);
