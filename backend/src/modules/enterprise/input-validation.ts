import { z } from "zod";
import type { RequestHandler } from "express";

const text = (field: string, minimum = 1, maximum = 200) => z
  .string({ required_error: `${field} is required`, invalid_type_error: `${field} must be a string` })
  .trim()
  .min(minimum, `${field} is required`)
  .max(maximum, `${field} must be at most ${maximum} characters`);

// The existing student creation contract supports semesters 1–12.
export const semesterSchema = z.number().finite().int()
  .min(1, "Semester must be between 1 and 12")
  .max(12, "Semester must be between 1 and 12");
const studentFields = {
  name: text("Name", 2),
  email: z.string().trim().email("Valid email is required").max(254),
  enrollmentNumber: text("Enrollment number", 1, 100),
  program: text("Program"),
  course: text("Course"),
  section: text("Section"),
  batch: text("Batch", 4, 50),
  // These fields are optional and support an empty string in the existing API.
  department: z.string().trim().max(200).optional(),
  academicYear: z.string().trim().max(50).optional(),
  semester: semesterSchema.optional(),
  phone: z.string().trim().max(50).optional(),
  gender: z.string().trim().max(50).optional(),
  initialCredits: z.number().int().max(2147483647).min(0).default(0),
};
export const studentCreationSchema = z.object(studentFields);
export const studentUpdateSchema = studentCreationSchema
  .pick({ program: true, course: true, department: true, section: true, batch: true, semester: true, academicYear: true })
  .partial()
  .extend({ status: z.enum(["active", "graduated", "inactive"]).optional() });

/** Validate the calendar components before Date can normalize impossible dates.
 * Date-only input remains UTC midnight. Timestamp input requires an explicit zone.
 */
export function isValidReportDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2}))?$/.exec(value);
  if (!match) return false;
  const [, y, m, d, h, minute, second, , zone] = match;
  const year = Number(y), month = Number(m), day = Number(d);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (month < 1 || month > 12 || day < 1 || day > days[month - 1]) return false;
  if (h !== undefined && (Number(h) > 23 || Number(minute) > 59 || Number(second) > 59)) return false;
  if (zone && zone !== "Z") {
    const hours = Number(zone.slice(1, 3)), minutes = Number(zone.slice(4));
    if (hours > 14 || minutes > 59 || (hours === 14 && minutes !== 0)) return false;
  }
  return Number.isFinite(new Date(value).getTime());
}
const dateSchema = z.string().refine(isValidReportDate, "Use a valid YYYY-MM-DD date or ISO timestamp with timezone");
const direction = z.enum(["asc", "desc"]);
export const reportQuerySchema = z.object({
  sortBy: z.enum(["createdAt", "date", "latestInterviewDate", "overallScore", "averageScore", "score", "name", "studentName", "enrollmentNumber", "rollNumber", "targetRole"]).optional(),
  sortOrder: direction.optional(), sortDirection: direction.optional(),
  startDate: dateSchema.optional(), endDate: dateSchema.optional(), dateFrom: dateSchema.optional(), dateTo: dateSchema.optional(),
  search: z.string().optional(), program: z.string().optional(), course: z.string().optional(), section: z.string().optional(), batch: z.string().optional(),
  status: z.string().optional(), scoreTier: z.string().optional(), reportType: z.string().optional(), view: z.string().optional(), format: z.string().optional(),
}).passthrough().superRefine((query, context) => {
  if (query.sortOrder && query.sortDirection && query.sortOrder !== query.sortDirection) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["sortDirection"], message: "sortDirection conflicts with sortOrder" });
  }
  const start = query.startDate ?? query.dateFrom, end = query.endDate ?? query.dateTo;
  if (start && end && new Date(start).getTime() > new Date(end).getTime()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: [query.endDate ? "endDate" : "dateTo"], message: "End date must not precede start date" });
  }
});
export const validateReportQuery: RequestHandler = (req, _res, next) => {
  try {
    const query = reportQuerySchema.parse(req.query);
    if (query.sortDirection && !query.sortOrder) req.query.sortOrder = query.sortDirection;
    next();
  } catch (error) {
    next(error);
  }
};
