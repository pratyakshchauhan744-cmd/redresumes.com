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

type TabType = "overview" | "students" | "faculty" | "credits" | "reports";

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
  const handleExportCsv = () => {
    if (!reports.length) return;
    const headers = [
      "Student Name",
      "Enrollment No",
      "Program",
      "Course",
      "Section",
      "Batch",
      "Target Role",
      "Difficulty",
      "Overall Score",
      "Date",
    ];
    const rows = reports.map((r) => [
      r.session?.user?.name || "",
      r.session?.user?.studentProfile?.enrollmentNumber || "",
      r.session?.user?.studentProfile?.program || "",
      r.session?.user?.studentProfile?.course || "",
      r.session?.user?.studentProfile?.section || "",
      r.session?.user?.studentProfile?.batch || "",
      r.session?.targetRole || "",
      r.session?.difficulty || "",
      r.overallScore || "",
      new Date(r.createdAt).toLocaleDateString(),
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.map((val) => `"${val}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Interview_Reports_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

                <button
                  onClick={handleExportCsv}
                  disabled={reports.length === 0}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer disabled:opacity-40"
                >
                  <Download className="w-4 h-4" /> Export CSV Ledger
                </button>
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
