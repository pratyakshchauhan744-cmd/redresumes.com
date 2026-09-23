import React, { useState, useEffect, useMemo } from "react";
import {
  GraduationCap,
  Users,
  Coins,
  FileText,
  TrendingUp,
  Plus,
  Search,
  Filter,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Eye,
  Trash2,
  ShieldCheck,
  Building2,
  ChevronRight,
  BarChart3,
  Award,
  Layers,
  Send,
  SlidersHorizontal,
  X,
  UserPlus,
  BookOpen,
} from "lucide-react";
import { backendApi, AuthUser } from "../lib/backendApi";

interface EnterpriseDashboardPageProps {
  user: AuthUser;
  token: string;
}

type TabType = "overview" | "students" | "faculty" | "credits" | "reports" | "audit";

export default function EnterpriseDashboardPage({ user, token }: EnterpriseDashboardPageProps) {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [stats, setStats] = useState<any>(null);
  const [filterOptions, setFilterOptions] = useState<{
    programs: string[];
    courses: string[];
    sections: string[];
    batches: string[];
    departments: string[];
  }>({ programs: [], courses: [], sections: [], batches: [], departments: [] });

  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Students tab state
  const [students, setStudents] = useState<any[]>([]);
  const [studentTotal, setStudentTotal] = useState(0);
  const [studentPage, setStudentPage] = useState(1);
  const [studentSearch, setStudentSearch] = useState("");
  const [studentProgram, setStudentProgram] = useState("");
  const [studentCourse, setStudentCourse] = useState("");
  const [studentSection, setStudentSection] = useState("");
  const [studentBatch, setStudentBatch] = useState("");
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [selectedStudentDetail, setSelectedStudentDetail] = useState<any | null>(null);
  const [singleAssignStudent, setSingleAssignStudent] = useState<any | null>(null);

  // Faculty tab state
  const [facultyList, setFacultyList] = useState<any[]>([]);
  const [facultyTotal, setFacultyTotal] = useState(0);
  const [isAddFacultyOpen, setIsAddFacultyOpen] = useState(false);

  // Credits tab state
  const [creditLedger, setCreditLedger] = useState<any[]>([]);
  const [creditTotal, setCreditTotal] = useState(0);
  const [bulkDistData, setBulkDistData] = useState({
    creditsPerStudent: 2,
    reason: "Institutional mock interview allocation",
    program: "",
    course: "",
    section: "",
    batch: "",
  });
  const [distPreview, setDistPreview] = useState<any | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Reports tab state
  const [reports, setReports] = useState<any[]>([]);
  const [reportTotal, setReportTotal] = useState(0);
  const [reportPage, setReportPage] = useState(1);
  const [reportSummary, setReportSummary] = useState<any | null>(null);
  const [reportProgram, setReportProgram] = useState("");
  const [reportCourse, setReportCourse] = useState("");
  const [reportSection, setReportSection] = useState("");
  const [reportBatch, setReportBatch] = useState("");
  const [reportSearch, setReportSearch] = useState("");

  // Audit logs tab state
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditActionFilter, setAuditActionFilter] = useState("");
  const [auditSearch, setAuditSearch] = useState("");
  const [auditLoading, setAuditLoading] = useState(false);

  // Student Form Data
  const [studentForm, setStudentForm] = useState({
    name: "",
    email: "",
    phone: "",
    enrollmentNumber: "",
    program: "B.Tech",
    course: "Computer Science & Engineering",
    department: "Computer Science",
    section: "A",
    batch: "2022-2026",
    semester: 6,
    gender: "Male",
    initialCredits: 2,
  });

  // Faculty Form Data
  const [facultyForm, setFacultyForm] = useState({
    name: "",
    email: "",
    phone: "",
    employeeId: "",
    department: "Computer Science & Engineering",
    designation: "Assistant Professor",
    isMainFaculty: false,
    permissions: ["manageStudents", "distributeCredits", "viewAnalytics", "exportReports"],
  });

  // Single assign form
  const [singleAssignAmount, setSingleAssignAmount] = useState(1);
  const [singleAssignReason, setSingleAssignReason] = useState("Bonus mock interview credit");

  // Bulk import state
  const [bulkImportFile, setBulkImportFile] = useState<File | null>(null);
  const [bulkImportAtomic, setBulkImportAtomic] = useState(false);
  const [bulkImportCredits, setBulkImportCredits] = useState(0);
  const [bulkImportLoading, setBulkImportLoading] = useState(false);
  const [bulkImportResult, setBulkImportResult] = useState<{
    totalProcessed: number;
    totalCreated: number;
    totalFailed: number;
    errors: Array<{ row: number; email?: string; enrollmentNumber?: string; reason: string }>;
  } | null>(null);
  const [resendingStudentId, setResendingStudentId] = useState<string | null>(null);

  const canManageFaculty = user.isMainFaculty || user.permissions?.includes("all") || user.permissions?.includes("manageFaculty");
  const canDistributeCredits = user.isMainFaculty || user.permissions?.includes("all") || user.permissions?.includes("distributeCredits");

  // Initial Load
  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [statsRes, optionsRes] = await Promise.all([
        backendApi.enterprise.getStats(token),
        backendApi.enterprise.getFilterOptions(token),
      ]);
      setStats(statsRes);
      setFilterOptions(optionsRes);
    } catch (err: any) {
      console.error("Failed to load enterprise stats:", err);
      setFeedback({ type: "error", message: err.message || "Failed to load dashboard data" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [token]);

  // Load Students
  const loadStudents = async () => {
    try {
      const res = await backendApi.enterprise.listStudents(
        {
          page: studentPage,
          limit: 10,
          search: studentSearch,
          program: studentProgram,
          course: studentCourse,
          section: studentSection,
          batch: studentBatch,
        },
        token
      );
      setStudents(res.students);
      setStudentTotal(res.total);
    } catch (err: any) {
      console.error("Failed to load students:", err);
    }
  };

  useEffect(() => {
    if (activeTab === "students" || activeTab === "overview") {
      loadStudents();
    }
  }, [activeTab, studentPage, studentSearch, studentProgram, studentCourse, studentSection, studentBatch]);

  // Load Faculty
  const loadFaculty = async () => {
    if (!canManageFaculty) return;
    try {
      const res = await backendApi.enterprise.listFaculty({}, token);
      setFacultyList(res.faculty);
      setFacultyTotal(res.total);
    } catch (err: any) {
      console.error("Failed to load faculty:", err);
    }
  };

  useEffect(() => {
    if (activeTab === "faculty") {
      loadFaculty();
    }
  }, [activeTab]);

  // Load Credits Ledger
  const loadCredits = async () => {
    try {
      const res = await backendApi.enterprise.getCreditLedger({}, token);
      setCreditLedger(res.transactions);
      setCreditTotal(res.total);
    } catch (err: any) {
      console.error("Failed to load credit ledger:", err);
    }
  };

  useEffect(() => {
    if (activeTab === "credits") {
      loadCredits();
    }
  }, [activeTab]);

  // Load Reports
  const loadReports = async () => {
    try {
      const [reportsRes, summaryRes] = await Promise.all([
        backendApi.enterprise.getReports(
          {
            page: reportPage,
            limit: 10,
            program: reportProgram,
            course: reportCourse,
            section: reportSection,
            batch: reportBatch,
            search: reportSearch,
          },
          token
        ),
        backendApi.enterprise.getReportSummary(
          {
            program: reportProgram,
            course: reportCourse,
            section: reportSection,
            batch: reportBatch,
          },
          token
        ),
      ]);
      setReports(reportsRes.reports);
      setReportTotal(reportsRes.total);
      setReportSummary(summaryRes);
    } catch (err: any) {
      console.error("Failed to load reports:", err);
    }
  };

  useEffect(() => {
    if (activeTab === "reports") {
      loadReports();
    }
  }, [activeTab, reportPage, reportProgram, reportCourse, reportSection, reportBatch, reportSearch]);

  // Load Audit Logs
  const loadAuditLogs = async () => {
    try {
      setAuditLoading(true);
      const res = await backendApi.enterprise.getAuditLogs(
        {
          page: auditPage,
          limit: 15,
          action: auditActionFilter || undefined,
          search: auditSearch || undefined,
        },
        token
      );
      setAuditLogs(res.logs || []);
      setAuditTotal(res.total || 0);
    } catch (err: any) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "audit") {
      loadAuditLogs();
    }
  }, [activeTab, auditPage, auditActionFilter, auditSearch]);

  // Handle preview calculation
  const handleCalculatePreview = async () => {
    try {
      setPreviewLoading(true);
      const res = await backendApi.enterprise.previewCreditDistribution(
        {
          creditsPerStudent: Number(bulkDistData.creditsPerStudent),
          program: bulkDistData.program || undefined,
          course: bulkDistData.course || undefined,
          section: bulkDistData.section || undefined,
          batch: bulkDistData.batch || undefined,
        },
        token
      );
      setDistPreview(res);
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to calculate preview" });
    } finally {
      setPreviewLoading(false);
    }
  };

  // Handle bulk credit distribution
  const handleExecuteDistribution = async () => {
    try {
      const res = await backendApi.enterprise.distributeCredits(
        {
          creditsPerStudent: Number(bulkDistData.creditsPerStudent),
          reason: bulkDistData.reason,
          program: bulkDistData.program || undefined,
          course: bulkDistData.course || undefined,
          section: bulkDistData.section || undefined,
          batch: bulkDistData.batch || undefined,
        },
        token
      );
      setFeedback({ type: "success", message: res.message });
      setDistPreview(null);
      loadInitialData();
      loadCredits();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Distribution failed" });
    }
  };

  // Handle single student credit assign
  const handleAssignStudentCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleAssignStudent) return;
    try {
      await backendApi.enterprise.assignStudentCredits(
        {
          studentId: singleAssignStudent.id,
          amount: Number(singleAssignAmount),
          reason: singleAssignReason,
        },
        token
      );
      setFeedback({
        type: "success",
        message: `Successfully allocated ${singleAssignAmount} credits to ${singleAssignStudent.user?.name}`,
      });
      setSingleAssignStudent(null);
      loadStudents();
      loadInitialData();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Assignment failed" });
    }
  };

  // Handle add student
  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await backendApi.enterprise.createStudent(studentForm, token);
      setFeedback({ type: "success", message: `Student ${studentForm.name} onboarded successfully.` });
      setIsAddStudentOpen(false);
      loadStudents();
      loadInitialData();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to add student" });
    }
  };

  // Handle bulk import file upload
  const handleBulkImportFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkImportFile) return;
    try {
      setBulkImportLoading(true);
      setBulkImportResult(null);
      const res = await backendApi.enterprise.bulkImportFile(
        bulkImportFile,
        { atomic: bulkImportAtomic, initialCredits: bulkImportCredits },
        token
      );
      setBulkImportResult({
        totalProcessed: res.totalProcessed,
        totalCreated: res.totalCreated,
        totalFailed: res.totalFailed,
        errors: res.errors || [],
      });
      if (res.totalCreated > 0) {
        setFeedback({
          type: "success",
          message: `Successfully created ${res.totalCreated} student accounts. Welcome credentials dispatched via email.`,
        });
        loadStudents();
        loadInitialData();
      } else if (res.totalFailed > 0) {
        setFeedback({
          type: "error",
          message: `Bulk import completed with ${res.totalFailed} failure(s). Please review the errors below.`,
        });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to process bulk import file." });
    } finally {
      setBulkImportLoading(false);
    }
  };

  // Handle resend student invitation credentials
  const handleResendInvite = async (student: any) => {
    try {
      setResendingStudentId(student.id);
      await backendApi.enterprise.resendStudentInvite(student.id, token);
      setFeedback({
        type: "success",
        message: `Welcome credentials resent to ${student.user?.name || student.name} (${student.user?.email || student.email}).`,
      });
      loadStudents();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to resend invite credentials." });
    } finally {
      setResendingStudentId(null);
    }
  };

  // Download Sample Template CSV
  const downloadSampleTemplate = () => {
    const csvContent =
      "data:text/csv;charset=utf-8," +
      "Name,Email,Enrollment Number,Program,Course,Section,Batch,Phone,Gender,Initial Credits\n" +
      "Aarav Sharma,aarav.sharma@example.edu,ENR2026001,B.Tech,Computer Science,A,2026,+91 9876543210,Male,2\n" +
      "Diya Patel,diya.patel@example.edu,ENR2026002,B.Tech,Computer Science,A,2026,+91 9876543211,Female,2\n";
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "student_bulk_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Handle add faculty
  const handleCreateFaculty = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await backendApi.enterprise.createFaculty(facultyForm, token);
      setFeedback({ type: "success", message: `Faculty ${facultyForm.name} added successfully.` });
      setIsAddFacultyOpen(false);
      loadFaculty();
      loadInitialData();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to add faculty" });
    }
  };

  // CSV Export
  const handleExportCsv = async () => {
    try {
      setFeedback(null);
      await backendApi.enterprise.downloadReports({
        format: 'csv',
        program: reportProgram,
        course: reportCourse,
        section: reportSection,
        batch: reportBatch,
        search: reportSearch,
      }, token);
      setFeedback({ type: "success", message: "Student reports successfully exported as sanitized CSV." });
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to export CSV" });
    }
  };

  const handleExportExcel = async () => {
    try {
      setFeedback(null);
      await backendApi.enterprise.downloadReports({
        format: 'xlsx',
        program: reportProgram,
        course: reportCourse,
        section: reportSection,
        batch: reportBatch,
        search: reportSearch,
      }, token);
      setFeedback({ type: "success", message: "Student reports successfully exported as Excel (.xlsx) workbook." });
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to export Excel" });
    }
  };

  return (
    <div className="min-h-screen bg-[#070a12] text-zinc-100 pb-20 select-none">
      {/* Top Banner Header */}
      <div className="border-b border-zinc-800/80 bg-zinc-950/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-600/20 border border-rose-500/30 flex items-center justify-center text-rose-400">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-bold text-white tracking-tight">
                    {user.college?.name || "Campus Enterprise Portal"}
                  </h1>
                  <span className="px-2 py-0.5 rounded bg-rose-950/60 border border-rose-800/60 text-[10px] font-mono font-bold text-rose-400 uppercase">
                    {user.isMainFaculty ? "Main Faculty Admin" : "Faculty Evaluator"}
                  </span>
                </div>
                <p className="text-xs text-zinc-400">
                  Code: <span className="font-mono text-zinc-300">{user.college?.code || "CAMPUS"}</span> &bull; Domain:{" "}
                  <span className="font-mono text-zinc-300">{user.college?.domain || "institutional"}</span>
                </p>
              </div>
            </div>

            {/* Quick Balance Badge */}
            <div className="flex items-center gap-3">
              <div className="px-4 py-2 rounded-xl bg-emerald-950/30 border border-emerald-800/50 flex items-center gap-2.5">
                <Coins className="w-4 h-4 text-emerald-400" />
                <div>
                  <span className="text-[10px] text-zinc-400 font-medium uppercase block">Institutional Balance</span>
                  <span className="text-sm font-bold text-emerald-300 font-mono">
                    {stats?.credits?.balance ?? 0} Credits
                  </span>
                </div>
              </div>
              <button
                onClick={loadInitialData}
                disabled={loading}
                className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                title="Refresh Metrics"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-rose-400" : ""}`} />
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="flex items-center gap-2 mt-4 pt-2 border-t border-zinc-900 overflow-x-auto scrollbar-none">
            <button
              onClick={() => setActiveTab("overview")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "overview"
                  ? "bg-rose-600 text-white shadow-lg shadow-rose-950/50"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-900/60"
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Overview
            </button>
            <button
              onClick={() => setActiveTab("students")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "students"
                  ? "bg-rose-600 text-white shadow-lg shadow-rose-950/50"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-900/60"
              }`}
            >
              <GraduationCap className="w-4 h-4" />
              Students Directory ({stats?.students?.total ?? 0})
            </button>
            {canManageFaculty && (
              <button
                onClick={() => setActiveTab("faculty")}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "faculty"
                    ? "bg-rose-600 text-white shadow-lg shadow-rose-950/50"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-900/60"
                }`}
              >
                <Users className="w-4 h-4" />
                Faculty Members ({stats?.faculty?.total ?? 0})
              </button>
            )}
            <button
              onClick={() => setActiveTab("credits")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "credits"
                  ? "bg-rose-600 text-white shadow-lg shadow-rose-950/50"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-900/60"
              }`}
            >
              <Coins className="w-4 h-4" />
              Interview Credits & Allocation
            </button>
            <button
              onClick={() => setActiveTab("reports")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "reports"
                  ? "bg-rose-600 text-white shadow-lg shadow-rose-950/50"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-900/60"
              }`}
            >
              <FileText className="w-4 h-4" />
              Cohort Reports & Analytics
            </button>
            <button
              onClick={() => setActiveTab("audit")}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "audit"
                  ? "bg-rose-600 text-white shadow-lg shadow-rose-950/50"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-900/60"
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              Audit Logs
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`p-4 rounded-xl border flex items-start justify-between gap-3 text-xs ${
              feedback.type === "success"
                ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-200"
                : "bg-rose-950/40 border-rose-800/60 text-rose-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="text-zinc-400 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 1. OVERVIEW TAB */}
        {/* ========================================================================= */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* KPI Ribbon */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 glass-panel">
                <div className="flex items-center justify-between text-zinc-400">
                  <span className="text-xs font-semibold uppercase tracking-wider">Enrolled Students</span>
                  <GraduationCap className="w-4 h-4 text-sky-400" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white font-mono">
                    {stats?.students?.total ?? 0}
                  </span>
                  <span className="text-xs text-emerald-400 font-medium">
                    {stats?.students?.active ?? 0} Active
                  </span>
                </div>
              </div>

              <div className="p-5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 glass-panel">
                <div className="flex items-center justify-between text-zinc-400">
                  <span className="text-xs font-semibold uppercase tracking-wider">Interviews Completed</span>
                  <Award className="w-4 h-4 text-amber-400" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white font-mono">
                    {stats?.interviews?.completedSessions ?? 0}
                  </span>
                  <span className="text-xs text-zinc-500 font-mono">
                    of {stats?.interviews?.totalSessions ?? 0} started
                  </span>
                </div>
              </div>

              <div className="p-5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 glass-panel">
                <div className="flex items-center justify-between text-zinc-400">
                  <span className="text-xs font-semibold uppercase tracking-wider">Cohort Avg Score</span>
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-emerald-400 font-mono">
                    {stats?.interviews?.avgScore ?? 0}%
                  </span>
                  <span className="text-xs text-zinc-400">AI Evaluated</span>
                </div>
              </div>

              <div className="p-5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 glass-panel">
                <div className="flex items-center justify-between text-zinc-400">
                  <span className="text-xs font-semibold uppercase tracking-wider">Credit Distribution</span>
                  <Coins className="w-4 h-4 text-rose-400" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-white font-mono">
                    {stats?.credits?.totalDistributed ?? 0}
                  </span>
                  <span className="text-xs text-zinc-500 font-mono">
                    ({stats?.credits?.balance ?? 0} left)
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Actions Panel */}
            <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 glass-panel">
              <h2 className="text-sm font-bold text-white mb-4">Quick Institutional Actions</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <button
                  onClick={() => {
                    setActiveTab("students");
                    setIsAddStudentOpen(true);
                  }}
                  className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/80 hover:border-rose-500/40 hover:bg-zinc-900/80 transition-all text-left flex items-start gap-3 group cursor-pointer"
                >
                  <div className="p-2.5 rounded-lg bg-rose-600/20 text-rose-400 group-hover:scale-105 transition-transform">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-zinc-200 group-hover:text-white">Onboard New Student</h3>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Add individual student with roll number and program quota.</p>
                  </div>
                </button>

                <button
                  onClick={() => {
                    setActiveTab("credits");
                  }}
                  className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/80 hover:border-emerald-500/40 hover:bg-zinc-900/80 transition-all text-left flex items-start gap-3 group cursor-pointer"
                >
                  <div className="p-2.5 rounded-lg bg-emerald-600/20 text-emerald-400 group-hover:scale-105 transition-transform">
                    <Coins className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-zinc-200 group-hover:text-white">Bulk Credit Allocation</h3>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Distribute interview credits across entire batches or sections.</p>
                  </div>
                </button>

                <button
                  onClick={() => setActiveTab("reports")}
                  className="p-4 rounded-xl bg-zinc-950/80 border border-zinc-800/80 hover:border-sky-500/40 hover:bg-zinc-900/80 transition-all text-left flex items-start gap-3 group cursor-pointer"
                >
                  <div className="p-2.5 rounded-lg bg-sky-600/20 text-sky-400 group-hover:scale-105 transition-transform">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-zinc-200 group-hover:text-white">Cohort Performance Reports</h3>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Inspect AI evaluation metrics and export batch results.</p>
                  </div>
                </button>
              </div>
            </div>

            {/* Recent Students Preview */}
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 overflow-hidden glass-panel">
              <div className="p-4 border-b border-zinc-800/80 flex items-center justify-between">
                <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">Recently Enrolled Cohort</h3>
                <button
                  onClick={() => setActiveTab("students")}
                  className="text-xs text-rose-400 hover:text-rose-300 font-medium flex items-center gap-1 cursor-pointer"
                >
                  View All Students <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-950/80 text-[10px] font-mono text-zinc-400 uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3">Student Name</th>
                      <th className="px-6 py-3">Roll No / Program</th>
                      <th className="px-6 py-3">Section & Batch</th>
                      <th className="px-6 py-3">Credit Balance</th>
                      <th className="px-6 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40 text-zinc-300">
                    {students.slice(0, 5).map((s) => (
                      <tr key={s.id} className="hover:bg-zinc-900/20">
                        <td className="px-6 py-3 font-medium text-white">{s.user?.name}</td>
                        <td className="px-6 py-3 font-mono text-zinc-400">
                          {s.enrollmentNumber} &bull; {s.program}
                        </td>
                        <td className="px-6 py-3 font-mono text-zinc-400">
                          Sec {s.section} &bull; {s.batch}
                        </td>
                        <td className="px-6 py-3 font-mono text-emerald-400 font-bold">
                          {s.user?.credits?.balance ?? 0} Credits
                        </td>
                        <td className="px-6 py-3 text-right">
                          <button
                            onClick={() => setSelectedStudentDetail(s)}
                            className="px-2.5 py-1 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[11px] text-zinc-300"
                          >
                            Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 2. STUDENTS TAB */}
        {/* ========================================================================= */}
        {activeTab === "students" && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80 glass-panel space-y-3">
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Search by student name, roll number, or email..."
                    value={studentSearch}
                    onChange={(e) => {
                      setStudentSearch(e.target.value);
                      setStudentPage(1);
                    }}
                    className="w-full pl-9 pr-4 py-2 bg-zinc-950/70 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setBulkImportResult(null);
                      setBulkImportFile(null);
                      setIsBulkImportOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-sky-400" /> Bulk Import
                  </button>
                  <button
                    onClick={() => setIsAddStudentOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-lg shadow-rose-950/40"
                  >
                    <Plus className="w-4 h-4" /> Add Student
                  </button>
                </div>
              </div>

              {/* Multi-Dimensional Cohort Filters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-zinc-900 text-xs">
                <div>
                  <select
                    value={studentProgram}
                    onChange={(e) => setStudentProgram(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-md text-xs text-zinc-300 focus:outline-none focus:border-rose-500"
                  >
                    <option value="">All Programs</option>
                    {filterOptions.programs.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <select
                    value={studentCourse}
                    onChange={(e) => setStudentCourse(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-md text-xs text-zinc-300 focus:outline-none focus:border-rose-500"
                  >
                    <option value="">All Courses</option>
                    {filterOptions.courses.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <select
                    value={studentSection}
                    onChange={(e) => setStudentSection(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-md text-xs text-zinc-300 focus:outline-none focus:border-rose-500"
                  >
                    <option value="">All Sections</option>
                    {filterOptions.sections.map((s) => (
                      <option key={s} value={s}>
                        Section {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <select
                    value={studentBatch}
                    onChange={(e) => setStudentBatch(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-md text-xs text-zinc-300 focus:outline-none focus:border-rose-500"
                  >
                    <option value="">All Batches</option>
                    {filterOptions.batches.map((b) => (
                      <option key={b} value={b}>
                        Batch {b}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Students Table */}
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 overflow-hidden glass-panel">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-950/80 text-[10px] font-mono text-zinc-400 uppercase tracking-wider border-b border-zinc-800/80">
                    <tr>
                      <th className="px-6 py-4">Student</th>
                      <th className="px-6 py-4">Roll Number</th>
                      <th className="px-6 py-4">Program & Course</th>
                      <th className="px-6 py-4">Section / Batch</th>
                      <th className="px-6 py-4">Credit Balance</th>
                      <th className="px-6 py-4">Invite Status</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40 text-zinc-300">
                    {students.length > 0 ? (
                      students.map((student) => (
                        <tr key={student.id} className="hover:bg-zinc-900/20 transition-colors">
                          <td className="px-6 py-4">
                            <div>
                              <span className="font-semibold text-white block">{student.user?.name}</span>
                              <span className="text-[11px] font-mono text-zinc-400 block truncate max-w-[180px]">
                                {student.user?.email}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-mono font-bold text-zinc-200">
                            {student.enrollmentNumber}
                          </td>
                          <td className="px-6 py-4">
                            <div>
                              <span className="font-medium text-zinc-200 block">{student.program}</span>
                              <span className="text-[11px] text-zinc-400 block">{student.course}</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-mono text-zinc-400">
                            Sec {student.section} &bull; {student.batch}
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-mono font-bold text-emerald-400 text-sm">
                              {student.user?.credits?.balance ?? 0}
                            </span>
                            <span className="text-[10px] text-zinc-500 font-mono block">Credits</span>
                          </td>
                          <td className="px-6 py-4">
                            {student.invitationStatus === "failed" ? (
                              <div className="flex items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20" title={student.emailError || "Email delivery failed"}>
                                  <AlertCircle className="w-3 h-3 text-rose-400" /> Failed
                                </span>
                                <button
                                  onClick={() => handleResendInvite(student)}
                                  disabled={resendingStudentId === student.id}
                                  className="text-[10px] font-bold text-rose-300 hover:underline cursor-pointer"
                                >
                                  {resendingStudentId === student.id ? "Sending..." : "Resend"}
                                </button>
                              </div>
                            ) : student.invitationStatus === "sent" || student.invitationStatus === "delivered" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" /> Delivered
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                Pending
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              {student.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {canDistributeCredits && (
                                <button
                                  onClick={() => setSingleAssignStudent(student)}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800/60 text-emerald-300 text-xs font-medium cursor-pointer"
                                  title="Assign Credits"
                                >
                                  + Credits
                                </button>
                              )}
                              <button
                                onClick={() => handleResendInvite(student)}
                                disabled={resendingStudentId === student.id}
                                className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white"
                                title="Resend Credentials via Email"
                              >
                                {resendingStudentId === student.id ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-400" />
                                ) : (
                                  <Send className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <button
                                onClick={() => setSelectedStudentDetail(student)}
                                className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white"
                                title="View Details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-zinc-500 text-sm">
                          No students match the selected filter criteria.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. FACULTY TAB */}
        {/* ========================================================================= */}
        {activeTab === "faculty" && canManageFaculty && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white">Department Faculty & Placement Officers</h2>
                <p className="text-xs text-zinc-400">
                  Authorize faculty members to manage cohort interviews, view evaluations, and distribute credits.
                </p>
              </div>
              <button
                onClick={() => setIsAddFacultyOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-lg shadow-rose-950/40"
              >
                <Plus className="w-4 h-4" /> Add Faculty Member
              </button>
            </div>

            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 overflow-hidden glass-panel">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-950/80 text-[10px] font-mono text-zinc-400 uppercase tracking-wider border-b border-zinc-800/80">
                    <tr>
                      <th className="px-6 py-4">Faculty Member</th>
                      <th className="px-6 py-4">Emp ID / Dept</th>
                      <th className="px-6 py-4">Designation</th>
                      <th className="px-6 py-4">Role / Permissions</th>
                      <th className="px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40 text-zinc-300">
                    {facultyList.map((fac) => (
                      <tr key={fac.id} className="hover:bg-zinc-900/20">
                        <td className="px-6 py-4">
                          <div>
                            <span className="font-semibold text-white block">{fac.user?.name}</span>
                            <span className="text-[11px] font-mono text-zinc-400 block">{fac.user?.email}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="font-mono font-bold text-zinc-300 block">{fac.employeeId || "—"}</span>
                          <span className="text-[11px] text-zinc-500 block">{fac.department || "General"}</span>
                        </td>
                        <td className="px-6 py-4 text-zinc-300">{fac.designation || "Faculty"}</td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {fac.isMainFaculty ? (
                              <span className="px-2 py-0.5 rounded bg-rose-950/60 border border-rose-800/60 text-[10px] font-bold text-rose-400">
                                Main Faculty Admin
                              </span>
                            ) : (
                              (fac.permissions || []).map((p: string) => (
                                <span
                                  key={p}
                                  className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[10px] text-zinc-400"
                                >
                                  {p}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            {fac.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 4. CREDITS TAB */}
        {/* ========================================================================= */}
        {activeTab === "credits" && (
          <div className="space-y-6">
            {/* Bulk Distribution Wizard */}
            {canDistributeCredits && (
              <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 glass-panel space-y-4">
                <div className="flex items-center gap-3 border-b border-zinc-800 pb-3">
                  <div className="w-8 h-8 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                    <Coins className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white">Cohort Bulk Credit Distribution Wizard</h3>
                    <p className="text-xs text-zinc-400">
                      Allocate mock interview credits to students matching target cohort filters.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="block text-zinc-300 font-medium mb-1">Target Program</label>
                    <select
                      value={bulkDistData.program}
                      onChange={(e) => setBulkDistData({ ...bulkDistData, program: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">All Programs</option>
                      {filterOptions.programs.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-zinc-300 font-medium mb-1">Target Course</label>
                    <select
                      value={bulkDistData.course}
                      onChange={(e) => setBulkDistData({ ...bulkDistData, course: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">All Courses</option>
                      {filterOptions.courses.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-zinc-300 font-medium mb-1">Target Batch</label>
                    <select
                      value={bulkDistData.batch}
                      onChange={(e) => setBulkDistData({ ...bulkDistData, batch: e.target.value })}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      <option value="">All Batches</option>
                      {filterOptions.batches.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-zinc-300 font-medium mb-1">Credits Per Student *</label>
                    <input
                      type="number"
                      min={1}
                      value={bulkDistData.creditsPerStudent}
                      onChange={(e) =>
                        setBulkDistData({ ...bulkDistData, creditsPerStudent: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-zinc-300 font-medium mb-1">Allocation Reason *</label>
                    <input
                      type="text"
                      value={bulkDistData.reason}
                      onChange={(e) => setBulkDistData({ ...bulkDistData, reason: e.target.value })}
                      placeholder="e.g. Placement Drive Pre-assessment Allowance"
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleCalculatePreview}
                    disabled={previewLoading}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    {previewLoading ? "Calculating..." : "Preview Distribution Impact"}
                  </button>
                </div>

                {/* Preview Calculation Box */}
                {distPreview && (
                  <div className="p-4 rounded-xl bg-zinc-950/80 border border-emerald-800/40 space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-zinc-500 block">Matching Students:</span>
                        <span className="text-base font-bold text-white font-mono">
                          {distPreview.matchingStudentsCount} Students
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">Credits Required:</span>
                        <span className="text-base font-bold text-emerald-400 font-mono">
                          {distPreview.totalCreditsNeeded} Credits
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">College Balance:</span>
                        <span className="text-base font-bold text-zinc-300 font-mono">
                          {distPreview.currentCollegeBalance} Available
                        </span>
                      </div>
                      <div>
                        <span className="text-zinc-500 block">Balance After:</span>
                        <span
                          className={`text-base font-bold font-mono ${
                            distPreview.hasSufficientBalance ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {distPreview.balanceAfterDistribution} Credits
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 flex items-center justify-between">
                      {!distPreview.hasSufficientBalance && (
                        <p className="text-xs text-rose-400">
                          Insufficient college balance to distribute to this cohort. Contact Super Admin for a quota top-up.
                        </p>
                      )}
                      <button
                        onClick={handleExecuteDistribution}
                        disabled={!distPreview.hasSufficientBalance || distPreview.matchingStudentsCount === 0}
                        className="ml-auto inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-40 cursor-pointer shadow-lg shadow-emerald-950/40"
                      >
                        <Send className="w-3.5 h-3.5" /> Confirm & Distribute Credits
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Credit Transaction Ledger */}
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 overflow-hidden glass-panel">
              <div className="p-4 border-b border-zinc-800/80 flex items-center justify-between">
                <h3 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
                  Credit Allocation Ledger History
                </h3>
                <span className="text-xs text-zinc-500 font-mono">{creditTotal} Total Transactions</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-950/80 text-[10px] font-mono text-zinc-400 uppercase tracking-wider border-b border-zinc-800/80">
                    <tr>
                      <th className="px-6 py-4">Transaction Type</th>
                      <th className="px-6 py-4">Amount</th>
                      <th className="px-6 py-4">Balance After</th>
                      <th className="px-6 py-4">Reason / Description</th>
                      <th className="px-6 py-4">Actor</th>
                      <th className="px-6 py-4">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40 text-zinc-300">
                    {creditLedger.map((tx) => (
                      <tr key={tx.id} className="hover:bg-zinc-900/20">
                        <td className="px-6 py-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-zinc-900 border border-zinc-800 text-zinc-300">
                            {tx.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono font-bold text-sm">
                          <span
                            className={
                              tx.type.includes("SUPER_ADMIN") || tx.type.includes("ALLOCATION")
                                ? "text-emerald-400"
                                : "text-sky-400"
                            }
                          >
                            {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-zinc-400">{tx.balanceAfter}</td>
                        <td className="px-6 py-4 text-zinc-300 max-w-[250px] truncate">{tx.reason}</td>
                        <td className="px-6 py-4 font-mono text-[11px] text-zinc-400">
                          {tx.createdBy?.name || "System"}
                        </td>
                        <td className="px-6 py-4 font-mono text-zinc-500">
                          {new Date(tx.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 5. REPORTS TAB */}
        {/* ========================================================================= */}
        {activeTab === "reports" && (
          <div className="space-y-6">
            {/* Summary Insights */}
            {reportSummary && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 glass-panel">
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Total Evaluated Reports
                  </span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-white font-mono">
                      {reportSummary.totalReports}
                    </span>
                    <span className="text-xs text-zinc-500">Sessions</span>
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 glass-panel">
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Cohort Average Score
                  </span>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-emerald-400 font-mono">
                      {reportSummary.averageOverallScore}%
                    </span>
                    <span className="text-xs text-zinc-400">AI Placement Benchmark</span>
                  </div>
                </div>

                <div className="p-5 rounded-xl bg-zinc-900/40 border border-zinc-800/80 glass-panel">
                  <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    Score Distribution
                  </span>
                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                    {reportSummary.scoreDistribution?.map((d: any) => (
                      <span
                        key={d.label}
                        className="px-2 py-0.5 rounded bg-zinc-950 border border-zinc-800 text-[10px] font-mono text-zinc-300"
                      >
                        {d.label}: {d.count}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Filter Bar */}
            <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80 glass-panel space-y-3">
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Search candidate name or roll number..."
                    value={reportSearch}
                    onChange={(e) => setReportSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-zinc-950/70 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-rose-500"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportCsv}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-zinc-400" /> Export CSV
                  </button>
                  <button
                    onClick={handleExportExcel}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 text-rose-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5 text-rose-400" /> Export Excel (.xlsx)
                  </button>
                </div>
              </div>

              {/* Cohort Filter Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-zinc-900 text-xs">
                <div>
                  <select
                    value={reportProgram}
                    onChange={(e) => setReportProgram(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-md text-xs text-zinc-300 focus:outline-none focus:border-rose-500"
                  >
                    <option value="">All Programs</option>
                    {filterOptions.programs.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <select
                    value={reportCourse}
                    onChange={(e) => setReportCourse(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-md text-xs text-zinc-300 focus:outline-none focus:border-rose-500"
                  >
                    <option value="">All Courses</option>
                    {filterOptions.courses.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <select
                    value={reportSection}
                    onChange={(e) => setReportSection(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-md text-xs text-zinc-300 focus:outline-none focus:border-rose-500"
                  >
                    <option value="">All Sections</option>
                    {filterOptions.sections.map((s) => (
                      <option key={s} value={s}>
                        Section {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <select
                    value={reportBatch}
                    onChange={(e) => setReportBatch(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-md text-xs text-zinc-300 focus:outline-none focus:border-rose-500"
                  >
                    <option value="">All Batches</option>
                    {filterOptions.batches.map((b) => (
                      <option key={b} value={b}>
                        Batch {b}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Reports Table */}
            <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 overflow-hidden glass-panel">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-950/80 text-[10px] font-mono text-zinc-400 uppercase tracking-wider border-b border-zinc-800/80">
                    <tr>
                      <th className="px-6 py-4">Student</th>
                      <th className="px-6 py-4">Roll Number & Cohort</th>
                      <th className="px-6 py-4">Target Role & Difficulty</th>
                      <th className="px-6 py-4">Overall Score</th>
                      <th className="px-6 py-4">Pace & Filler</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4 text-right">Inspect</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40 text-zinc-300">
                    {reports.length > 0 ? (
                      reports.map((report) => (
                        <tr key={report.id} className="hover:bg-zinc-900/20">
                          <td className="px-6 py-4 font-semibold text-white">
                            {report.session?.user?.name || "Student"}
                          </td>
                          <td className="px-6 py-4 font-mono text-zinc-400">
                            {report.session?.user?.studentProfile?.enrollmentNumber || "—"} &bull;{" "}
                            {report.session?.user?.studentProfile?.program}
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-medium text-zinc-200 block">
                              {report.session?.targetRole || "Software Engineer"}
                            </span>
                            <span className="text-[10px] font-mono text-zinc-500 capitalize">
                              {report.session?.difficulty} level
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`text-sm font-bold font-mono px-2 py-0.5 rounded ${
                                report.overallScore >= 75
                                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
                                  : report.overallScore >= 50
                                  ? "bg-amber-500/10 text-amber-400 border border-amber-500/25"
                                  : "bg-rose-500/10 text-rose-400 border border-rose-500/25"
                              }`}
                            >
                              {report.overallScore}%
                            </span>
                          </td>
                          <td className="px-6 py-4 font-mono text-[11px] text-zinc-400">
                            {report.speakingPace ?? "—"} WPM &bull; {report.fillerWords ?? 0} Fillers
                          </td>
                          <td className="px-6 py-4 font-mono text-zinc-500">
                            {new Date(report.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <a
                              href={`/interview-report/${report.id}`}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-[11px] inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" /> Full Report
                            </a>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-zinc-500 text-sm">
                          No interview evaluation records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* AUDIT LOGS TAB */}
        {/* ========================================================================= */}
        {activeTab === "audit" && (
          <div className="space-y-6">
            {/* Header info */}
            <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 backdrop-blur-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white tracking-tight">Institutional Audit Trail</h2>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      Immutable, tenant-scoped ledger tracking student creation, bulk imports, faculty permission changes, credit distribution, and report exports.
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={loadAuditLogs}
                  disabled={auditLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-300 text-xs font-medium transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${auditLoading ? "animate-spin text-rose-400" : ""}`} /> Refresh
                </button>
              </div>
            </div>

            {/* Filters Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/60">
              <div className="relative sm:col-span-2">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search by actor name, email, target, or details..."
                  value={auditSearch}
                  onChange={(e) => {
                    setAuditSearch(e.target.value);
                    setAuditPage(1);
                  }}
                  className="w-full pl-9 pr-4 py-2 bg-zinc-900/90 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500/50"
                />
              </div>

              <div>
                <select
                  value={auditActionFilter}
                  onChange={(e) => {
                    setAuditActionFilter(e.target.value);
                    setAuditPage(1);
                  }}
                  className="w-full px-3 py-2 bg-zinc-900/90 border border-zinc-800 rounded-lg text-xs text-zinc-300 focus:outline-none focus:border-rose-500/50"
                >
                  <option value="">All Action Types</option>
                  <option value="STUDENT_CREATED">Student Created</option>
                  <option value="STUDENTS_IMPORTED">Students Imported (Bulk)</option>
                  <option value="CREDITS_ALLOCATED">Credits Allocated (Super Admin)</option>
                  <option value="CREDITS_DISTRIBUTED">Credits Distributed (Cohort)</option>
                  <option value="FACULTY_INVITED">Faculty Invited</option>
                  <option value="FACULTY_UPDATED">Faculty Updated</option>
                  <option value="FACULTY_DEACTIVATED">Faculty Deactivated</option>
                  <option value="REPORTS_EXPORTED">Reports Exported</option>
                  <option value="REPORT_VIEWED">Report Viewed</option>
                </select>
              </div>
            </div>

            {/* Audit Table */}
            <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 backdrop-blur-sm overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-zinc-300">
                  <thead className="bg-zinc-900/70 border-b border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-400">
                    <tr>
                      <th className="px-4 py-3 font-semibold">Timestamp</th>
                      <th className="px-4 py-3 font-semibold">Action</th>
                      <th className="px-4 py-3 font-semibold">Actor</th>
                      <th className="px-4 py-3 font-semibold">Target Entity</th>
                      <th className="px-4 py-3 font-semibold">Details / Payload</th>
                      <th className="px-4 py-3 font-semibold">IP / Device</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/60 font-normal">
                    {auditLoading ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                          <RefreshCw className="w-5 h-5 mx-auto animate-spin text-rose-500 mb-2" />
                          Loading institutional audit logs...
                        </td>
                      </tr>
                    ) : auditLogs.length > 0 ? (
                      auditLogs.map((log) => {
                        const actionColor =
                          log.action?.includes("CREATED") || log.action?.includes("IMPORTED")
                            ? "bg-emerald-950/50 border-emerald-800/60 text-emerald-400"
                            : log.action?.includes("DISTRIBUTED") || log.action?.includes("ALLOCATED")
                            ? "bg-purple-950/50 border-purple-800/60 text-purple-300"
                            : log.action?.includes("EXPORTED")
                            ? "bg-sky-950/50 border-sky-800/60 text-sky-300"
                            : log.action?.includes("DEACTIVATED")
                            ? "bg-rose-950/50 border-rose-800/60 text-rose-400"
                            : "bg-amber-950/50 border-amber-800/60 text-amber-300";

                        const detailsFormatted = log.details
                          ? typeof log.details === "object"
                            ? JSON.stringify(log.details)
                            : String(log.details)
                          : "-";

                        return (
                          <tr key={log.id} className="hover:bg-zinc-900/40 transition-colors">
                            <td className="px-4 py-3 font-mono text-zinc-400 whitespace-nowrap">
                              {new Date(log.createdAt).toLocaleString(undefined, {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              })}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded-full border text-[10px] font-mono font-bold ${actionColor}`}>
                                {log.action}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-white">
                                {log.actor?.name || log.actor?.email || "System"}
                              </div>
                              {log.actor?.email && log.actor?.name && (
                                <div className="text-[10px] text-zinc-500 font-mono">{log.actor.email}</div>
                              )}
                              {log.actor?.role && (
                                <span className="text-[9px] text-zinc-400 uppercase font-mono">
                                  {log.actor.role.replace("college_", "").replace("_", " ")}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              {log.targetUser ? (
                                <div>
                                  <div className="text-zinc-200 font-medium">{log.targetUser.name || log.targetUser.email}</div>
                                  <div className="text-[10px] text-zinc-500 font-mono">{log.targetUser.email}</div>
                                </div>
                              ) : log.entityId ? (
                                <span className="font-mono text-zinc-400 text-[10px]">{log.entityType ? `${log.entityType}: ` : ""}{log.entityId}</span>
                              ) : (
                                <span className="text-zinc-600">-</span>
                              )}
                            </td>
                            <td className="px-4 py-3 max-w-xs truncate" title={detailsFormatted}>
                              <code className="text-[10px] text-zinc-400 bg-zinc-900/80 px-1.5 py-0.5 rounded border border-zinc-800">
                                {detailsFormatted.length > 60 ? detailsFormatted.slice(0, 60) + "..." : detailsFormatted}
                              </code>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap font-mono text-zinc-500 text-[10px]">
                              {log.ipAddress || "Internal"}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                          No audit trail records found matching your filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="p-3 border-t border-zinc-800 bg-zinc-900/30 flex items-center justify-between text-xs text-zinc-400">
                <span>
                  Showing {auditLogs.length} of {auditTotal} audit events
                </span>
                <div className="flex items-center gap-2">
                  <button
                    disabled={auditPage <= 1 || auditLoading}
                    onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 disabled:opacity-50 text-white rounded text-xs transition-colors"
                  >
                    Previous
                  </button>
                  <span className="font-mono text-zinc-300">
                    Page {auditPage} of {Math.max(1, Math.ceil(auditTotal / 15))}
                  </span>
                  <button
                    disabled={auditPage * 15 >= auditTotal || auditLoading}
                    onClick={() => setAuditPage((p) => p + 1)}
                    className="px-3 py-1 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 disabled:opacity-50 text-white rounded text-xs transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* Add Student Modal */}
      {isAddStudentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-white">Enroll Student</h3>
              <button onClick={() => setIsAddStudentOpen(false)} className="text-zinc-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateStudent} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 mb-1">Full Name *</label>
                  <input
                    required
                    type="text"
                    value={studentForm.name}
                    onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 mb-1">Email Address *</label>
                  <input
                    required
                    type="email"
                    value={studentForm.email}
                    onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 mb-1">Enrollment / Roll No *</label>
                  <input
                    required
                    type="text"
                    value={studentForm.enrollmentNumber}
                    onChange={(e) => setStudentForm({ ...studentForm, enrollmentNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 mb-1">Program *</label>
                  <input
                    required
                    type="text"
                    value={studentForm.program}
                    onChange={(e) => setStudentForm({ ...studentForm, program: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 mb-1">Course / Branch *</label>
                  <input
                    required
                    type="text"
                    value={studentForm.course}
                    onChange={(e) => setStudentForm({ ...studentForm, course: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 mb-1">Section *</label>
                  <input
                    required
                    type="text"
                    value={studentForm.section}
                    onChange={(e) => setStudentForm({ ...studentForm, section: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 mb-1">Batch *</label>
                  <input
                    required
                    type="text"
                    value={studentForm.batch}
                    onChange={(e) => setStudentForm({ ...studentForm, batch: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 mb-1">Initial Credits</label>
                  <input
                    type="number"
                    min={0}
                    value={studentForm.initialCredits}
                    onChange={(e) => setStudentForm({ ...studentForm, initialCredits: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddStudentOpen(false)}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold"
                >
                  Enroll Student
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bulk Import Students Modal */}
      {isBulkImportOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Upload className="w-4 h-4 text-sky-400" /> Bulk Import Students
                </h3>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Upload an Excel (.xlsx, .xls) or CSV cohort spreadsheet
                </p>
              </div>
              <button
                onClick={() => {
                  setIsBulkImportOpen(false);
                  setBulkImportResult(null);
                  setBulkImportFile(null);
                }}
                className="text-zinc-500 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleBulkImportFileSubmit} className="space-y-4 text-xs">
              {/* File upload zone */}
              <div className="border-2 border-dashed border-zinc-800 hover:border-sky-500/60 rounded-xl p-6 text-center transition-all bg-zinc-900/30">
                <input
                  type="file"
                  id="excelFileInput"
                  accept=".xlsx, .xls, .csv"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setBulkImportFile(e.target.files[0]);
                      setBulkImportResult(null);
                    }
                  }}
                  className="hidden"
                />
                <label htmlFor="excelFileInput" className="cursor-pointer block space-y-2">
                  <div className="w-10 h-10 mx-auto rounded-full bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                    <Upload className="w-5 h-5" />
                  </div>
                  {bulkImportFile ? (
                    <div>
                      <p className="text-sm font-semibold text-sky-300">{bulkImportFile.name}</p>
                      <p className="text-[11px] text-zinc-400">{(bulkImportFile.size / 1024).toFixed(1)} KB &bull; Click to change</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-semibold text-zinc-200">Click to choose spreadsheet or drag & drop</p>
                      <p className="text-[11px] text-zinc-500">Supports .xlsx, .xls, .csv (up to 15MB)</p>
                    </div>
                  )}
                </label>
              </div>

              {/* Template Download & Options */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/80">
                <div>
                  <span className="text-zinc-300 font-semibold block">Need a starting template?</span>
                  <span className="text-[11px] text-zinc-500">Includes all required cohort columns</span>
                </div>
                <button
                  type="button"
                  onClick={downloadSampleTemplate}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-rose-400" /> Download Template
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 mb-1">Initial Credits Per Student</label>
                  <input
                    type="number"
                    min={0}
                    value={bulkImportCredits}
                    onChange={(e) => setBulkImportCredits(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white font-mono"
                    placeholder="0"
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg bg-zinc-900/50 border border-zinc-800/80">
                    <input
                      type="checkbox"
                      checked={bulkImportAtomic}
                      onChange={(e) => setBulkImportAtomic(e.target.checked)}
                      className="rounded border-zinc-700 text-rose-600 focus:ring-rose-500"
                    />
                    <div>
                      <span className="text-zinc-200 font-semibold block text-[11px]">Strict Rollback Mode</span>
                      <span className="text-zinc-500 text-[10px] block">Abort all if any row fails</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Import Results Summary Card */}
              {bulkImportResult && (
                <div className="p-4 rounded-xl bg-zinc-900/70 border border-zinc-800 space-y-3">
                  <div className="flex items-center justify-between border-b border-zinc-800/80 pb-2">
                    <span className="font-bold text-white text-xs">Import Execution Summary</span>
                    <span className="font-mono text-zinc-400 text-[11px]">Total: {bulkImportResult.totalProcessed}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-800/40">
                      <span className="text-lg font-bold font-mono text-emerald-400 block">{bulkImportResult.totalCreated}</span>
                      <span className="text-[10px] text-zinc-400 uppercase font-semibold">Created</span>
                    </div>
                    <div className="p-2 rounded-lg bg-rose-950/30 border border-rose-800/40">
                      <span className="text-lg font-bold font-mono text-rose-400 block">{bulkImportResult.totalFailed}</span>
                      <span className="text-[10px] text-zinc-400 uppercase font-semibold">Failed</span>
                    </div>
                    <div className="p-2 rounded-lg bg-sky-950/30 border border-sky-800/40">
                      <span className="text-lg font-bold font-mono text-sky-400 block">{bulkImportResult.totalCreated}</span>
                      <span className="text-[10px] text-zinc-400 uppercase font-semibold">Emails Sent</span>
                    </div>
                  </div>

                  {bulkImportResult.errors.length > 0 && (
                    <div className="space-y-1.5 pt-2">
                      <span className="text-[11px] font-bold text-rose-400 uppercase tracking-wider block">
                        Error Breakdown ({bulkImportResult.errors.length})
                      </span>
                      <div className="max-h-36 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-950 p-2 space-y-1 font-mono text-[11px]">
                        {bulkImportResult.errors.map((err, idx) => (
                          <div key={idx} className="text-rose-300/90 flex items-start gap-1.5 py-0.5 border-b border-zinc-900 last:border-0">
                            <span className="text-zinc-500 shrink-0">Row {err.row}:</span>
                            <span className="truncate">{err.reason} {err.email ? `(${err.email})` : ""}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsBulkImportOpen(false);
                    setBulkImportResult(null);
                    setBulkImportFile(null);
                  }}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg text-xs"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={!bulkImportFile || bulkImportLoading}
                  className="px-5 py-2 bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-lg shadow-sky-950/40"
                >
                  {bulkImportLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Processing Cohort...
                    </>
                  ) : (
                    <>
                      <Upload className="w-3.5 h-3.5" /> Start Bulk Import
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Faculty Modal */}
      {isAddFacultyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-lg bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-white">Add Faculty Member</h3>
              <button onClick={() => setIsAddFacultyOpen(false)} className="text-zinc-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateFaculty} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-300 mb-1">Faculty Name *</label>
                  <input
                    required
                    type="text"
                    value={facultyForm.name}
                    onChange={(e) => setFacultyForm({ ...facultyForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 mb-1">Email Address *</label>
                  <input
                    required
                    type="email"
                    value={facultyForm.email}
                    onChange={(e) => setFacultyForm({ ...facultyForm, email: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 mb-1">Employee ID</label>
                  <input
                    type="text"
                    value={facultyForm.employeeId}
                    onChange={(e) => setFacultyForm({ ...facultyForm, employeeId: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-zinc-300 mb-1">Department</label>
                  <input
                    type="text"
                    value={facultyForm.department}
                    onChange={(e) => setFacultyForm({ ...facultyForm, department: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-zinc-300 mb-1">Designation</label>
                  <input
                    type="text"
                    value={facultyForm.designation}
                    onChange={(e) => setFacultyForm({ ...facultyForm, designation: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAddFacultyOpen(false)}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold"
                >
                  Send Invitation
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Single Assign Credit Modal */}
      {singleAssignStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-sm font-bold text-white">Assign Credits to Student</h3>
              <button onClick={() => setSingleAssignStudent(null)} className="text-zinc-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAssignStudentCredit} className="space-y-3 text-xs">
              <div>
                <span className="text-zinc-400 block mb-1">Student:</span>
                <span className="text-white font-bold block">{singleAssignStudent.user?.name}</span>
                <span className="text-zinc-500 font-mono block">Roll: {singleAssignStudent.enrollmentNumber}</span>
              </div>

              <div>
                <label className="block text-zinc-300 mb-1">Amount to Add *</label>
                <input
                  required
                  type="number"
                  min={1}
                  value={singleAssignAmount}
                  onChange={(e) => setSingleAssignAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-zinc-300 mb-1">Reason *</label>
                <input
                  required
                  type="text"
                  value={singleAssignReason}
                  onChange={(e) => setSingleAssignReason(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
                />
              </div>

              <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSingleAssignStudent(null)}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold"
                >
                  Grant Credits
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Student Details Slideout */}
      {selectedStudentDetail && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-xs">
          <div className="w-full max-w-md bg-zinc-950 border-l border-zinc-800 p-6 flex flex-col justify-between overflow-y-auto space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <h3 className="text-sm font-bold text-white">Student Cohort Record</h3>
                <button
                  onClick={() => setSelectedStudentDetail(null)}
                  className="text-zinc-500 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2 text-xs">
                <div className="p-4 rounded-xl bg-zinc-900/60 border border-zinc-800 space-y-1">
                  <span className="text-base font-bold text-white block">
                    {selectedStudentDetail.user?.name}
                  </span>
                  <span className="text-zinc-400 font-mono block">
                    {selectedStudentDetail.user?.email}
                  </span>
                  <span className="text-emerald-400 font-mono font-bold block pt-1">
                    Balance: {selectedStudentDetail.user?.credits?.balance ?? 0} Credits
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 p-3 bg-zinc-900/40 rounded-xl border border-zinc-800/80">
                  <div>
                    <span className="text-zinc-500 uppercase text-[9px] block">Roll Number</span>
                    <span className="font-mono text-zinc-200 font-bold">
                      {selectedStudentDetail.enrollmentNumber}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 uppercase text-[9px] block">Program</span>
                    <span className="text-zinc-200">{selectedStudentDetail.program}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 uppercase text-[9px] block">Course</span>
                    <span className="text-zinc-200">{selectedStudentDetail.course}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 uppercase text-[9px] block">Section & Batch</span>
                    <span className="font-mono text-zinc-200">
                      Sec {selectedStudentDetail.section} ({selectedStudentDetail.batch})
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-zinc-800 pt-4 flex justify-end">
              <button
                onClick={() => setSelectedStudentDetail(null)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg text-xs"
              >
                Close Drawer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
