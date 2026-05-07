import { relations } from "drizzle-orm/relations";
import { classes, homeworkRecords, students, subjects, homeworkExemptions, systemConfigs } from "./schema";

export const homeworkRecordsRelations = relations(homeworkRecords, ({one}) => ({
	class: one(classes, {
		fields: [homeworkRecords.classId],
		references: [classes.id]
	}),
	student: one(students, {
		fields: [homeworkRecords.studentId],
		references: [students.id]
	}),
	subject: one(subjects, {
		fields: [homeworkRecords.subjectId],
		references: [subjects.id]
	}),
}));

export const classesRelations = relations(classes, ({many}) => ({
	homeworkRecords: many(homeworkRecords),
	homeworkExemptions: many(homeworkExemptions),
	students: many(students),
	subjects: many(subjects),
	systemConfigs: many(systemConfigs),
}));

export const studentsRelations = relations(students, ({one, many}) => ({
	homeworkRecords: many(homeworkRecords),
	homeworkExemptions: many(homeworkExemptions),
	class: one(classes, {
		fields: [students.classId],
		references: [classes.id]
	}),
}));

export const subjectsRelations = relations(subjects, ({one, many}) => ({
	homeworkRecords: many(homeworkRecords),
	homeworkExemptions: many(homeworkExemptions),
	class: one(classes, {
		fields: [subjects.classId],
		references: [classes.id]
	}),
}));

export const homeworkExemptionsRelations = relations(homeworkExemptions, ({one}) => ({
	class: one(classes, {
		fields: [homeworkExemptions.classId],
		references: [classes.id]
	}),
	student: one(students, {
		fields: [homeworkExemptions.studentId],
		references: [students.id]
	}),
	subject: one(subjects, {
		fields: [homeworkExemptions.subjectId],
		references: [subjects.id]
	}),
}));

export const systemConfigsRelations = relations(systemConfigs, ({one}) => ({
	class: one(classes, {
		fields: [systemConfigs.classId],
		references: [classes.id]
	}),
}));