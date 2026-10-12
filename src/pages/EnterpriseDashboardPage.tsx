import { invitationFeedback, invitationRetryFailure, safeInvitationError, completeStudentOnboarding, studentCreationFailure } from "../utils/studentOnboarding";
import { authorizedInitialCredits } from "../utils/enterprisePermissions";
import { beginCreditSubmission } from "../utils/creditIdempotency";
import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
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
  LogOut,
  Pencil,
  UserX,
} from "lucide-react";
import { backendApi, AuthUser, isAbortError } from "../lib/backendApi";
import { isLocalAccessToken, setStoredAuthTokens } from "../lib/auth";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { AccessibleDialog } from "../components/AccessibleDialog";
import { EnterpriseReportRow } from "../types/enterpriseReports";
import { EnterpriseAuditLog, AUDIT_ACTION_FILTER_OPTIONS } from "../types/enterpriseAudit";
import {
  formatEntityName,
  getTargetUser,
  formatAuditDetails,
  calculatePaginationRange,
} from "../utils/auditFormatting";
import { interviewReportPath } from "../lib/routes";
import {
  getDistributionPreviewParams,
  isDistributionPreviewValid,
  type DistributionPreviewParams,
} from "../utils/distributionPreview";
import {
  acquireRequestLock,
  getFacultyCreationFeedback,
  releaseRequestLock,
} from "../utils/facultyCreation";
import {
  canResendStudentInvitation,
  hasEnterprisePermission,
} from "../utils/enterprisePermissions";
import { getPaginationMeta } from "../utils/pagination";
import type { CreditLedgerTransaction } from "../types/creditLedger";
import { getCreditLedgerActorLabel } from "../utils/creditLedger";
import {
  DEFAULT_FACULTY_PERMISSIONS,
  FACULTY_PERMISSION_OPTIONS,
  cohortAccessKey,
  getFacultyAuthorizationPayload,
  resolveFacultyCohortAccess,
  toggleCohortAccess,
  toggleFacultyPermission,
  type FacultyCohortAccessRule,
  type FacultyAuthorizationValues,
} from "../utils/facultyAccess";
import {
  isOfflineOrDemoToken,
  getInitialLoadingStates,
  getOfflineFallbackStats,
  getTableEmptyMessage,
} from "../utils/enterpriseLoading";

const STUDENT_PAGE_SIZE = 10;
const FACULTY_PAGE_SIZE = 15;
const CREDIT_PAGE_SIZE = 20;
const REPORT_PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 400;

interface FacultyFormValues extends FacultyAuthorizationValues {
  name: string;
  email: string;
  phone: string;
  employeeId: string;
  department: string;
  designation: string;
  isMainFaculty: false;
}

const createEmptyFacultyForm = (): FacultyFormValues => ({
  name: "",
  email: "",
  phone: "",
  employeeId: "",
  department: "Computer Science & Engineering",
  designation: "Assistant Professor",
  isMainFaculty: false,
  permissions: [...DEFAULT_FACULTY_PERMISSIONS],
  programAccess: [],
  courseAccess: [],
  sectionAccess: [],
  batchAccess: [],
  scopeUnrestricted: true,
  cohortAccess: [],
});

const createEmptyStudentForm = () => ({
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

function FacultyAuthorizationFields({
  values,
  filterOptions,
  onChange,
}: {
  values: FacultyAuthorizationValues;
  filterOptions: { cohorts: FacultyCohortAccessRule[] };
  onChange: (values: FacultyAuthorizationValues) => void;
}) {
  return (
    <div className="sm:col-span-2 space-y-4 border-t border-zinc-800 pt-4">
      <div>
        <div className="flex items-center justify-between gap-3 mb-2">
          <label className="font-semibold text-zinc-200">Permissions</label>
          <span className="text-[10px] text-zinc-500">Select only what this faculty member needs</span>
        </div>
        <div className="grid sm:grid-cols-2 gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
          {FACULTY_PERMISSION_OPTIONS.map((permission) => (
            <label key={permission.value} className="flex items-center gap-2 text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={values.permissions.includes(permission.value)}
                onChange={() => onChange({
                  ...values,
                  permissions: toggleFacultyPermission(values.permissions, permission.value),
                })}
                className="accent-rose-500"
              />
              <span>{permission.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3 mb-2">
          <div>
            <label className="font-semibold text-zinc-200">Exact cohort access</label>
            <p className="mt-0.5 text-[10px] text-zinc-500">
              Each selection is one exact program, course, section, and batch combination.
              {!values.scopeUnrestricted && values.cohortAccess.length === 0 && " No selection currently denies all cohort access."}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onChange({
              ...values,
              programAccess: [],
              courseAccess: [],
              sectionAccess: [],
              batchAccess: [],
              scopeUnrestricted: true,
              cohortAccess: [],
            })}
            className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-semibold ${
              values.scopeUnrestricted
                ? "border-emerald-700 bg-emerald-950/40 text-emerald-300"
                : "border-zinc-700 bg-zinc-900 text-zinc-400 hover:text-white"
            }`}
          >
            All cohorts (unrestricted)
          </button>
        </div>
        <div className="max-h-52 overflow-y-auto grid sm:grid-cols-2 gap-2 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
          {filterOptions.cohorts.length > 0 ? filterOptions.cohorts.map((cohort) => {
            const selected = values.cohortAccess.some(
              (value) => cohortAccessKey(value) === cohortAccessKey(cohort)
            );
            return (
              <label key={cohortAccessKey(cohort)} className="flex items-start gap-2 rounded-lg border border-zinc-800 p-2 text-zinc-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={() => {
                    const cohortAccess = toggleCohortAccess(values.cohortAccess, cohort);
                    onChange({
                      ...values,
                      scopeUnrestricted: false,
                      cohortAccess,
                      programAccess: [...new Set(cohortAccess.map((item) => item.program))],
                      courseAccess: [...new Set(cohortAccess.map((item) => item.course))],
                      sectionAccess: [...new Set(cohortAccess.map((item) => item.section))],
                      batchAccess: [...new Set(cohortAccess.map((item) => item.batch))],
                    });
                  }}
                  className="mt-0.5 accent-rose-500"
                />
                <span>
                  <span className="block font-medium text-zinc-200">{cohort.course} · Section {cohort.section}</span>
                  <span className="block mt-0.5 text-[10px] text-zinc-500">{cohort.program} · Batch {cohort.batch}</span>
                </span>
              </label>
            );
          }) : (
            <span className="col-span-2 text-[10px] text-zinc-500">No student cohorts have been configured yet.</span>
          )}
        </div>
      </div>
    </div>
  );
}

function PaginationControls({
  page,
  total,
  pageSize,
  itemLabel,
  onPageChange,
}: {
  page: number;
  total: number;
  pageSize: number;
  itemLabel: string;
  onPageChange: (page: number) => void;
}) {
  const meta = getPaginationMeta(page, total, pageSize);

  return (
    <div className="p-3 border-t border-zinc-800 bg-zinc-900/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-zinc-400">
      <span>
        Showing {meta.start}–{meta.end} of {total} {itemLabel}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={!meta.hasPrevious}
          onClick={() => onPageChange(meta.page - 1)}
          className="px-3 py-1 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-xs transition-colors"
          aria-label={`Previous ${itemLabel} page`}
        >
          Previous
        </button>
        <span className="font-mono text-zinc-300 min-w-24 text-center">
          Page {meta.page} of {meta.totalPages}
        </span>
        <button
          type="button"
          disabled={!meta.hasNext}
          onClick={() => onPageChange(meta.page + 1)}
          className="px-3 py-1 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded text-xs transition-colors"
          aria-label={`Next ${itemLabel} page`}
        >
          Next
        </button>
      </div>
    </div>
  );
}

function TableStatusRow({
  colSpan,
  loading,
  error,
  loadingMessage,
  onRetry,
}: {
  colSpan: number;
  loading: boolean;
  error: string | null;
  loadingMessage: string;
  onRetry: () => void;
}) {
  if (!loading && !error) return null;

  return (
    <tr>
      <td colSpan={colSpan} className="px-6 py-12 text-center text-zinc-500 text-sm">
        {loading ? (
          <>
            <RefreshCw className="w-5 h-5 mx-auto animate-spin text-rose-500 mb-2" />
            {loadingMessage}
          </>
        ) : (
          <div className="flex flex-col items-center gap-3 text-rose-300">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={onRetry}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-semibold"
            >
              <RefreshCw className="w-3.5 h-3.5" /> Retry
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

function SectionStatus({
  loading,
  error,
  loadingMessage,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  loadingMessage: string;
  onRetry: () => void;
}) {
  if (!loading && !error) return null;

  return (
    <div className={`p-4 rounded-xl border text-xs flex items-center justify-between gap-3 ${
      error
        ? "bg-rose-950/40 border-rose-800/60 text-rose-200"
        : "bg-zinc-900/40 border-zinc-800 text-zinc-400"
    }`}>
      <div className="flex items-center gap-2">
        {loading ? (
          <RefreshCw className="w-4 h-4 animate-spin text-rose-400" />
        ) : (
          <AlertCircle className="w-4 h-4 text-rose-400" />
        )}
        <span>{loading ? loadingMessage : error}</span>
      </div>
      {error && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 font-semibold shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Retry
        </button>
      )}
    </div>
  );
}

interface EnterpriseDashboardPageProps {
  user: AuthUser;
  token: string;
  initialTab?: TabType;
  onLogout?: () => void;
}

type TabType = "overview" | "students" | "faculty" | "credits" | "reports" | "audit";

export default function EnterpriseDashboardPage({ user, token, initialTab = "overview", onLogout }: EnterpriseDashboardPageProps) {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [effectiveToken, setEffectiveToken] = useState<string>(token);

  const hasPermission = useCallback((permission: string) => hasEnterprisePermission(user, permission), [user]);

  const canViewStudents = hasPermission("STUDENT_VIEW");
  const canCreateStudents = hasPermission("STUDENT_CREATE");
  const canResendStudentInvite = canResendStudentInvitation(user);
  const canViewFaculty = hasPermission("FACULTY_VIEW");
  const canCreateFaculty = hasPermission("FACULTY_CREATE");
  const canEditFaculty = hasPermission("FACULTY_EDIT");
  const canManageFacultyAuthorization = user.role === "super_admin" ||
    (user.role === "college_main_faculty" && user.isMainFaculty === true);
  const canViewCredits = hasPermission("INTERVIEW_CREDIT_VIEW");
  const canDistributeCredits = hasPermission("INTERVIEW_CREDIT_ASSIGN");
  const canViewReports = hasPermission("REPORT_VIEW");
  const canExportReports = hasPermission("REPORT_EXPORT");
  const canViewAuditLogs = hasPermission("AUDIT_VIEW");

  const tabPermissions = useMemo(() => ({
    canViewStudents,
    canViewFaculty,
    canViewCredits,
    canViewReports,
    canViewAuditLogs,
  }), [canViewStudents, canViewFaculty, canViewCredits, canViewReports, canViewAuditLogs]);

  const initialLoading = useMemo(() => getInitialLoadingStates(token, tabPermissions), []);

  const [stats, setStats] = useState<any>(null);
  const [filterOptions, setFilterOptions] = useState<{
    programs: string[];
    courses: string[];
    sections: string[];
    batches: string[];
    departments: string[];
    cohorts: FacultyCohortAccessRule[];
  }>({ programs: [], courses: [], sections: [], batches: [], departments: [], cohorts: [] });

  const [statsLoading, setStatsLoading] = useState(initialLoading.statsLoading);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [filterOptionsLoading, setFilterOptionsLoading] = useState(initialLoading.filterOptionsLoading);
  const [filterOptionsError, setFilterOptionsError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "warning" | "info" | "error"; message: string } | null>(null);

  const setAllOfflineLoadingSettled = useCallback(() => {
    setStatsLoading(false);
    setFilterOptionsLoading(false);
    setStudentsLoading(false);
    setFacultyLoading(false);
    setCreditsLoading(false);
    setReportsLoading(false);
    setReportSummaryLoading(false);
    setAuditLoading(false);
  }, []);

  useEffect(() => {
    setEffectiveToken(token);
    if (isOfflineOrDemoToken(token)) {
      setAllOfflineLoadingSettled();
    }
  }, [token, setAllOfflineLoadingSettled]);

  // Students tab state
  const [students, setStudents] = useState<any[]>([]);
  const [studentTotal, setStudentTotal] = useState(0);
  const [studentPage, setStudentPage] = useState(1);
  const [studentSearch, setStudentSearch] = useState("");
  const [studentProgram, setStudentProgram] = useState("");
  const [studentCourse, setStudentCourse] = useState("");
  const [studentSection, setStudentSection] = useState("");
  const [studentBatch, setStudentBatch] = useState("");
  const [studentsLoading, setStudentsLoading] = useState(initialLoading.studentsLoading);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [isAddStudentOpen, setIsAddStudentOpen] = useState(false);
  const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
  const [selectedStudentDetail, setSelectedStudentDetail] = useState<any | null>(null);
  const [singleAssignStudent, setSingleAssignStudent] = useState<any | null>(null);

  // Faculty tab state
  const [facultyList, setFacultyList] = useState<any[]>([]);
  const [facultyTotal, setFacultyTotal] = useState(0);
  const [facultyPage, setFacultyPage] = useState(1);
  const [facultyLoading, setFacultyLoading] = useState(initialLoading.facultyLoading);
  const [facultyError, setFacultyError] = useState<string | null>(null);
  const [isAddFacultyOpen, setIsAddFacultyOpen] = useState(false);
  const [editingFaculty, setEditingFaculty] = useState<any | null>(null);
  const [facultyCreationLoading, setFacultyCreationLoading] = useState(false);
  const [facultyCreationError, setFacultyCreationError] = useState<string | null>(null);
  const [facultyUpdateLoading, setFacultyUpdateLoading] = useState(false);
  const [facultyUpdateError, setFacultyUpdateError] = useState<string | null>(null);
  const [deactivatingFacultyId, setDeactivatingFacultyId] = useState<string | null>(null);
  const [resendingFacultyId, setResendingFacultyId] = useState<string | null>(null);
  const facultyCreationInFlightRef = useRef(false);
  const facultyResendInFlightRef = useRef(false);

  // Credits tab state
  const [creditLedger, setCreditLedger] = useState<CreditLedgerTransaction[]>([]);
  const [creditTotal, setCreditTotal] = useState(0);
  const [creditPage, setCreditPage] = useState(1);
  const [creditsLoading, setCreditsLoading] = useState(initialLoading.creditsLoading);
  const [creditsError, setCreditsError] = useState<string | null>(null);
  const [bulkDistData, setBulkDistData] = useState({
    creditsPerStudent: 2,
    reason: "Institutional mock interview allocation",
    program: "",
    course: "",
    section: "",
    batch: "",
  });
  const [distPreview, setDistPreview] = useState<(any & {
    previewParams: DistributionPreviewParams;
    previewRevision: number;
  }) | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [distributionLoading, setDistributionLoading] = useState(false);
  const [previewWasInvalidated, setPreviewWasInvalidated] = useState(false);
  const distributionRevisionRef = useRef(0);
  const previewRequestIdRef = useRef(0);
  const distributionRequestInFlightRef = useRef(false);

  const [reports, setReports] = useState<EnterpriseReportRow[]>([]);
  const [reportTotal, setReportTotal] = useState(0);
  const [reportPage, setReportPage] = useState(1);
  const [reportSummary, setReportSummary] = useState<any | null>(null);
  const [reportProgram, setReportProgram] = useState("");
  const [reportCourse, setReportCourse] = useState("");
  const [reportSection, setReportSection] = useState("");
  const [reportBatch, setReportBatch] = useState("");
  const [reportSearch, setReportSearch] = useState("");
  const exportRequestInFlightRef = useRef(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [reportsLoading, setReportsLoading] = useState(initialLoading.reportsLoading);
  const [reportsError, setReportsError] = useState<string | null>(null);
  const [reportSummaryLoading, setReportSummaryLoading] = useState(initialLoading.reportSummaryLoading);
  const [reportSummaryError, setReportSummaryError] = useState<string | null>(null);

  // Audit logs tab state
  const [auditLogs, setAuditLogs] = useState<EnterpriseAuditLog[]>([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(0);
  const [auditActionFilter, setAuditActionFilter] = useState("");
  const [auditSearch, setAuditSearch] = useState("");
  const [auditLoading, setAuditLoading] = useState(initialLoading.auditLoading);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [selectedAuditLog, setSelectedAuditLog] = useState<EnterpriseAuditLog | null>(null);
  const statsRequestIdRef = useRef(0);
  const filterOptionsRequestIdRef = useRef(0);
  const studentRequestIdRef = useRef(0);
  const facultyRequestIdRef = useRef(0);
  const creditRequestIdRef = useRef(0);
  const reportsRequestIdRef = useRef(0);
  const reportSummaryRequestIdRef = useRef(0);
  const auditRequestIdRef = useRef(0);
  const statsAbortControllerRef = useRef<AbortController | null>(null);
  const filterOptionsAbortControllerRef = useRef<AbortController | null>(null);
  const reportSummaryAbortControllerRef = useRef<AbortController | null>(null);
  const studentAbortControllerRef = useRef<AbortController | null>(null);
  const reportsAbortControllerRef = useRef<AbortController | null>(null);
  const auditAbortControllerRef = useRef<AbortController | null>(null);

  // Student Form Data
  const [studentForm, setStudentForm] = useState(() => {
    const form = createEmptyStudentForm();
    return { ...form, initialCredits: authorizedInitialCredits(user, form.initialCredits) };
  });
  const [studentCreationLoading, setStudentCreationLoading] = useState(false);
  const [studentCreationFeedbackType, setStudentCreationFeedbackType] = useState<"error" | "warning" | "info" | "success">("error");
  const [studentCreationError, setStudentCreationError] = useState<string | null>(null);
  const studentCreationInFlightRef = useRef(false);

  // Faculty Form Data
  const [facultyForm, setFacultyForm] = useState<FacultyFormValues>(createEmptyFacultyForm);
  const [facultyEditForm, setFacultyEditForm] = useState<FacultyFormValues>(createEmptyFacultyForm);

  // Single assign form
  const [singleAssignAmount, setSingleAssignAmount] = useState(1);
  const [singleAssignReason, setSingleAssignReason] = useState("Bonus mock interview credit");

  // Bulk import state
  const [bulkImportFile, setBulkImportFile] = useState<File | null>(null);
  const [bulkImportAtomic, setBulkImportAtomic] = useState(false);
  const [bulkImportCredits, setBulkImportCredits] = useState(0);
  const [bulkImportLoading, setBulkImportLoading] = useState(false);
  const [bulkImportError, setBulkImportError] = useState<string | null>(null);
  const bulkImportInFlightRef = useRef(false);
  const [bulkImportResult, setBulkImportResult] = useState<{
    totalProcessed: number;
    totalCreated: number;
    totalFailed: number;
    emailsSent: number;
    emailsFailed: number;
    errors: Array<{ row: number; email?: string; enrollmentNumber?: string; reason: string }>;
  } | null>(null);
  const [resendingStudentId, setResendingStudentId] = useState<string | null>(null);
  const [resendConfirmationStudent, setResendConfirmationStudent] = useState<any | null>(null);
  const resendRequestInFlightRef = useRef(false);
  const facultyUpdateInFlightRef = useRef(false);
  const singleAssignInFlightRef = useRef(false);
  const [singleAssignLoading, setSingleAssignLoading] = useState(false);
  const [singleAssignError, setSingleAssignError] = useState<string | null>(null);

  useEffect(() => {
    if (!canDistributeCredits) {
      setStudentForm(form => form.initialCredits === 0 ? form : { ...form, initialCredits: 0 });
      setBulkImportCredits(0);
    }
  }, [canDistributeCredits]);
  const loading = statsLoading || filterOptionsLoading;
  const debouncedStudentSearch = useDebouncedValue(studentSearch, SEARCH_DEBOUNCE_MS);
  const debouncedReportSearch = useDebouncedValue(reportSearch, SEARCH_DEBOUNCE_MS);
  const debouncedAuditSearch = useDebouncedValue(auditSearch, SEARCH_DEBOUNCE_MS);

  const loadStats = async (activeToken = effectiveToken) => {
    if (isOfflineOrDemoToken(activeToken)) {
      setStatsLoading(false);
      return;
    }
    statsAbortControllerRef.current?.abort();
    const controller = new AbortController();
    statsAbortControllerRef.current = controller;
    const currentRequestId = ++statsRequestIdRef.current;
    setStatsLoading(true);
    setStatsError(null);
    try {
      const statsRes = await backendApi.enterprise.getStats(activeToken, controller.signal);
      if (currentRequestId !== statsRequestIdRef.current) return;
      setStats(statsRes);
    } catch (err: any) {
      if (isAbortError(err)) return;
      if (currentRequestId !== statsRequestIdRef.current) return;
      console.error("Failed to load enterprise statistics:", err);
      setStatsError("Failed to load dashboard statistics.");
    } finally {
      if (currentRequestId === statsRequestIdRef.current) setStatsLoading(false);
    }
  };

  const loadFilterOptions = async (activeToken = effectiveToken) => {
    if (isOfflineOrDemoToken(activeToken)) {
      setFilterOptionsLoading(false);
      return;
    }
    filterOptionsAbortControllerRef.current?.abort();
    const controller = new AbortController();
    filterOptionsAbortControllerRef.current = controller;
    const currentRequestId = ++filterOptionsRequestIdRef.current;
    setFilterOptionsLoading(true);
    setFilterOptionsError(null);
    try {
      const optionsRes = await backendApi.enterprise.getFilterOptions(activeToken, controller.signal);
      if (currentRequestId !== filterOptionsRequestIdRef.current) return;
      setFilterOptions({ ...optionsRes, cohorts: optionsRes.cohorts ?? [] });
    } catch (err: any) {
      if (isAbortError(err)) return;
      if (currentRequestId !== filterOptionsRequestIdRef.current) return;
      console.error("Failed to load enterprise filter options:", err);
      setFilterOptionsError("Failed to load filter options.");
    } finally {
      if (currentRequestId === filterOptionsRequestIdRef.current) setFilterOptionsLoading(false);
    }
  };

  // Initial Load
  const loadInitialData = async () => {
    let activeToken = effectiveToken;
    if (isOfflineOrDemoToken(activeToken)) {
      if (user.email.toLowerCase() === "faculty@apex.edu" || user.email.toLowerCase().includes("demo")) {
        try {
          const auth = await backendApi.login({ email: user.email.toLowerCase(), password: "Password@123" });
          if (auth.accessToken) {
            setStoredAuthTokens(auth.accessToken);
            setEffectiveToken(auth.accessToken);
            activeToken = auth.accessToken;
          }
        } catch (upgradeErr) {
          console.warn("Auto-upgrade demo token to live session failed:", upgradeErr);
        }
      }

      if (isOfflineOrDemoToken(activeToken)) {
        setAllOfflineLoadingSettled();
        setStatsError(null);
        setFilterOptionsError(null);
        setStats((prev: any) => prev || getOfflineFallbackStats());
        setFeedback({
          type: "info",
          message: "You are currently signed in with an offline demo session. Live enterprise data is unavailable. Please sign in with your enterprise credentials."
        });
        return;
      }
    }

    await Promise.allSettled([loadStats(activeToken), loadFilterOptions(activeToken)]);
  };

  useEffect(() => {
    loadInitialData();
    return () => {
      statsAbortControllerRef.current?.abort();
      filterOptionsAbortControllerRef.current?.abort();
      statsRequestIdRef.current += 1;
      filterOptionsRequestIdRef.current += 1;
    };
  }, [effectiveToken]);

  const showStudentList = activeTab === "students" || activeTab === "overview";

  // Load Students
  const loadStudents = async () => {
    if (!canViewStudents || isOfflineOrDemoToken(effectiveToken)) {
      setStudentsLoading(false);
      return;
    }
    studentAbortControllerRef.current?.abort();
    const controller = new AbortController();
    studentAbortControllerRef.current = controller;
    const currentRequestId = ++studentRequestIdRef.current;
    setStudentsLoading(true);
    setStudentsError(null);
    try {
      const res = await backendApi.enterprise.listStudents(
        {
          page: studentPage,
          limit: STUDENT_PAGE_SIZE,
          search: debouncedStudentSearch,
          program: studentProgram,
          course: studentCourse,
          section: studentSection,
          batch: studentBatch,
        },
        effectiveToken,
        controller.signal
      );
      if (currentRequestId !== studentRequestIdRef.current) return;
      setStudents(res.students);
      setStudentTotal(res.total);
    } catch (err: any) {
      if (currentRequestId !== studentRequestIdRef.current) return;
      if (isAbortError(err)) return;
      console.error("Failed to load students:", err);
      setStudentsError("Failed to load students.");
    } finally {
      if (currentRequestId === studentRequestIdRef.current) {
        if (studentAbortControllerRef.current === controller) studentAbortControllerRef.current = null;
        setStudentsLoading(false);
      }
    }
  };

  useEffect(() => {
    studentAbortControllerRef.current?.abort();
    studentRequestIdRef.current += 1;
    setStudentsLoading(false);
  }, [studentSearch]);

  useEffect(() => {
    if (!canViewStudents) {
      setStudentsLoading(false);
      return;
    }
    if (showStudentList) {
      if (isOfflineOrDemoToken(effectiveToken)) {
        setStudentsLoading(false);
      } else {
        loadStudents();
      }
    }
    return () => {
      studentAbortControllerRef.current?.abort();
      studentRequestIdRef.current += 1;
    };
  }, [showStudentList, effectiveToken, studentPage, debouncedStudentSearch, studentProgram, studentCourse, studentSection, studentBatch, canViewStudents]);

  useEffect(() => {
    const lastPage = getPaginationMeta(studentPage, studentTotal, STUDENT_PAGE_SIZE).page;
    if (lastPage !== studentPage) setStudentPage(lastPage);
  }, [studentPage, studentTotal]);

  // Load Faculty
  const loadFaculty = async () => {
    if (!canViewFaculty || isOfflineOrDemoToken(effectiveToken)) {
      setFacultyLoading(false);
      return;
    }
    const currentRequestId = ++facultyRequestIdRef.current;
    setFacultyLoading(true);
    setFacultyError(null);
    try {
      const res = await backendApi.enterprise.listFaculty(
        { page: facultyPage, limit: FACULTY_PAGE_SIZE },
        effectiveToken
      );
      if (currentRequestId !== facultyRequestIdRef.current) return;
      setFacultyList(res.faculty);
      setFacultyTotal(res.total);
    } catch (err: any) {
      if (currentRequestId !== facultyRequestIdRef.current) return;
      console.error("Failed to load faculty:", err);
      setFacultyError("Failed to load faculty.");
    } finally {
      if (currentRequestId === facultyRequestIdRef.current) setFacultyLoading(false);
    }
  };

  useEffect(() => {
    if (!canViewFaculty) {
      setFacultyLoading(false);
      return;
    }
    if (activeTab === "faculty") {
      if (isOfflineOrDemoToken(effectiveToken)) {
        setFacultyLoading(false);
      } else {
        loadFaculty();
      }
    }
    return () => {
      facultyRequestIdRef.current += 1;
    };
  }, [activeTab, effectiveToken, facultyPage, canViewFaculty]);

  useEffect(() => {
    const lastPage = getPaginationMeta(facultyPage, facultyTotal, FACULTY_PAGE_SIZE).page;
    if (lastPage !== facultyPage) setFacultyPage(lastPage);
  }, [facultyPage, facultyTotal]);

  // Load Credits Ledger
  const loadCredits = async () => {
    if (!canViewCredits || isOfflineOrDemoToken(effectiveToken)) {
      setCreditsLoading(false);
      return;
    }
    const currentRequestId = ++creditRequestIdRef.current;
    setCreditsLoading(true);
    setCreditsError(null);
    try {
      const res = await backendApi.enterprise.getCreditLedger(
        { page: creditPage, limit: CREDIT_PAGE_SIZE },
        effectiveToken
      );
      if (currentRequestId !== creditRequestIdRef.current) return;
      setCreditLedger(res.transactions);
      setCreditTotal(res.total);
    } catch (err: any) {
      if (currentRequestId !== creditRequestIdRef.current) return;
      console.error("Failed to load credit ledger:", err);
      setCreditsError("Failed to load credit transactions.");
    } finally {
      if (currentRequestId === creditRequestIdRef.current) setCreditsLoading(false);
    }
  };

  useEffect(() => {
    if (!canViewCredits) {
      setCreditsLoading(false);
      return;
    }
    if (activeTab === "credits") {
      if (isOfflineOrDemoToken(effectiveToken)) {
        setCreditsLoading(false);
      } else {
        loadCredits();
      }
    }
    return () => {
      creditRequestIdRef.current += 1;
    };
  }, [activeTab, effectiveToken, creditPage, canViewCredits]);

  useEffect(() => {
    const lastPage = getPaginationMeta(creditPage, creditTotal, CREDIT_PAGE_SIZE).page;
    if (lastPage !== creditPage) setCreditPage(lastPage);
  }, [creditPage, creditTotal]);

  // Load Reports
  const loadReports = async () => {
    if (!canViewReports || isOfflineOrDemoToken(effectiveToken)) {
      setReportsLoading(false);
      return;
    }
    reportsAbortControllerRef.current?.abort();
    const controller = new AbortController();
    reportsAbortControllerRef.current = controller;
    const currentRequestId = ++reportsRequestIdRef.current;
    setReportsLoading(true);
    setReportsError(null);
    try {
      const reportsRes = await backendApi.enterprise.getReports(
        {
          page: reportPage,
          limit: REPORT_PAGE_SIZE,
          program: reportProgram,
          course: reportCourse,
          section: reportSection,
          batch: reportBatch,
          search: debouncedReportSearch,
        },
        effectiveToken,
        controller.signal
      );
      if (currentRequestId !== reportsRequestIdRef.current) return;
      setReports(reportsRes.reports);
      setReportTotal(reportsRes.total);
    } catch (err: any) {
      if (currentRequestId !== reportsRequestIdRef.current) return;
      if (isAbortError(err)) return;
      console.error("Failed to load reports:", err);
      setReportsError("Failed to load reports.");
    } finally {
      if (currentRequestId === reportsRequestIdRef.current) {
        if (reportsAbortControllerRef.current === controller) reportsAbortControllerRef.current = null;
        setReportsLoading(false);
      }
    }
  };

  useEffect(() => {
    reportsAbortControllerRef.current?.abort();
    reportsRequestIdRef.current += 1;
    setReportsLoading(false);
  }, [reportSearch]);

  const loadReportSummary = async () => {
    if (!canViewReports || isOfflineOrDemoToken(effectiveToken)) {
      setReportSummaryLoading(false);
      return;
    }
    reportSummaryAbortControllerRef.current?.abort();
    const controller = new AbortController();
    reportSummaryAbortControllerRef.current = controller;
    const currentRequestId = ++reportSummaryRequestIdRef.current;
    setReportSummaryLoading(true);
    setReportSummaryError(null);
    try {
      const summaryRes = await backendApi.enterprise.getReportSummary(
        {
          program: reportProgram,
          course: reportCourse,
          section: reportSection,
          batch: reportBatch,
        },
        effectiveToken,
        controller.signal
      );
      if (currentRequestId !== reportSummaryRequestIdRef.current) return;
      setReportSummary(summaryRes);
    } catch (err: any) {
      if (isAbortError(err)) return;
      if (currentRequestId !== reportSummaryRequestIdRef.current) return;
      console.error("Failed to load report summary:", err);
      setReportSummaryError("Failed to load report summary.");
    } finally {
      if (currentRequestId === reportSummaryRequestIdRef.current) setReportSummaryLoading(false);
    }
  };

  useEffect(() => {
    if (!canViewReports) {
      setReportsLoading(false);
      return;
    }
    if (activeTab === "reports") {
      if (isOfflineOrDemoToken(effectiveToken)) {
        setReportsLoading(false);
      } else {
        loadReports();
      }
    }
    return () => {
      reportsAbortControllerRef.current?.abort();
      reportsRequestIdRef.current += 1;
    };
  }, [activeTab, effectiveToken, reportPage, reportProgram, reportCourse, reportSection, reportBatch, debouncedReportSearch, canViewReports]);

  useEffect(() => {
    if (!canViewReports) {
      setReportSummaryLoading(false);
      return;
    }
    if (activeTab === "reports") {
      if (isOfflineOrDemoToken(effectiveToken)) {
        setReportSummaryLoading(false);
      } else {
        loadReportSummary();
      }
    }
    return () => {
      reportSummaryAbortControllerRef.current?.abort();
      reportSummaryRequestIdRef.current += 1;
    };
  }, [activeTab, effectiveToken, reportProgram, reportCourse, reportSection, reportBatch, canViewReports]);

  useEffect(() => {
    const lastPage = getPaginationMeta(reportPage, reportTotal, REPORT_PAGE_SIZE).page;
    if (lastPage !== reportPage) setReportPage(lastPage);
  }, [reportPage, reportTotal]);

  // Load Audit Logs
  const loadAuditLogs = async () => {
    if (!canViewAuditLogs || isOfflineOrDemoToken(effectiveToken)) {
      setAuditLoading(false);
      return;
    }
    auditAbortControllerRef.current?.abort();
    const controller = new AbortController();
    auditAbortControllerRef.current = controller;
    const currentRequestId = ++auditRequestIdRef.current;
    try {
      setAuditLoading(true);
      setAuditError(null);
      const res = await backendApi.enterprise.getAuditLogs(
        {
          page: auditPage,
          limit: 15,
          action: auditActionFilter || undefined,
          search: debouncedAuditSearch || undefined,
        },
        effectiveToken,
        controller.signal
      );
      if (currentRequestId !== auditRequestIdRef.current) return;
      setAuditLogs(res.logs || []);
      setAuditTotal(res.pagination?.total ?? 0);
      setAuditTotalPages(res.pagination?.totalPages ?? 0);
    } catch (err: any) {
      if (currentRequestId !== auditRequestIdRef.current) return;
      if (isAbortError(err)) return;
      console.error("Failed to load audit logs:", err);
      setAuditError("Failed to load audit logs.");
    } finally {
      if (currentRequestId === auditRequestIdRef.current) {
        if (auditAbortControllerRef.current === controller) auditAbortControllerRef.current = null;
        setAuditLoading(false);
      }
    }
  };

  useEffect(() => {
    auditAbortControllerRef.current?.abort();
    auditRequestIdRef.current += 1;
    setAuditLoading(false);
  }, [auditSearch]);

  useEffect(() => {
    if (!canViewAuditLogs) {
      setAuditLoading(false);
      return;
    }
    if (activeTab === "audit") {
      if (isOfflineOrDemoToken(effectiveToken)) {
        setAuditLoading(false);
      } else {
        loadAuditLogs();
      }
    }
    return () => {
      auditAbortControllerRef.current?.abort();
      auditRequestIdRef.current += 1;
    };
  }, [activeTab, effectiveToken, auditPage, auditActionFilter, debouncedAuditSearch, canViewAuditLogs]);

  const currentDistributionParams = getDistributionPreviewParams(bulkDistData);
  const isCurrentPreviewValid = isDistributionPreviewValid(
    currentDistributionParams,
    distPreview?.previewParams ?? null,
    distributionRevisionRef.current,
    distPreview?.previewRevision ?? null
  );

  const updateBulkDistributionData = <K extends keyof typeof bulkDistData>(
    field: K,
    value: (typeof bulkDistData)[K]
  ) => {
    if (bulkDistData[field] === value) return;

    if (field !== "reason") {
      const hadPreviewOrPendingRequest = Boolean(distPreview) || previewLoading;
      distributionRevisionRef.current += 1;
      previewRequestIdRef.current += 1;
      setDistPreview(null);
      setPreviewLoading(false);
      if (hadPreviewOrPendingRequest) setPreviewWasInvalidated(true);
    }

    setBulkDistData((current) => ({ ...current, [field]: value }));
  };

  // Handle preview calculation
  const handleCalculatePreview = async () => {
    if (distributionRequestInFlightRef.current) return;

    const previewParams = getDistributionPreviewParams(bulkDistData);
    const previewRevision = distributionRevisionRef.current;
    const requestId = ++previewRequestIdRef.current;

    try {
      setPreviewLoading(true);
      setDistPreview(null);
      setPreviewWasInvalidated(false);
      const res = await backendApi.enterprise.previewCreditDistribution(
        {
          creditsPerStudent: previewParams.creditsPerStudent,
          program: previewParams.program || undefined,
          course: previewParams.course || undefined,
          section: previewParams.section || undefined,
          batch: previewParams.batch || undefined,
        },
        effectiveToken
      );
      if (
        requestId !== previewRequestIdRef.current ||
        previewRevision !== distributionRevisionRef.current
      ) return;

      setDistPreview({ ...res, previewParams, previewRevision });
    } catch (err: any) {
      if (requestId !== previewRequestIdRef.current) return;
      setFeedback({ type: "error", message: err.message || "Failed to calculate preview" });
    } finally {
      if (requestId === previewRequestIdRef.current) setPreviewLoading(false);
    }
  };

  // Handle bulk credit distribution
  const handleExecuteDistribution = async () => {
    if (distributionRequestInFlightRef.current) return;

    if (!distPreview || !isCurrentPreviewValid) {
      setFeedback({
        type: "error",
        message: "Distribution settings changed. Please generate a new preview before confirming.",
      });
      return;
    }

    // Confirmation deliberately uses the immutable preview snapshot, never mutable form state.
    const confirmedParams = distPreview.previewParams;
    distributionRequestInFlightRef.current = true;
    try {
      setDistributionLoading(true);
      const payload = {
        creditsPerStudent: confirmedParams.creditsPerStudent,
        reason: bulkDistData.reason,
        program: confirmedParams.program || undefined,
        course: confirmedParams.course || undefined,
        section: confirmedParams.section || undefined,
        batch: confirmedParams.batch || undefined,
      };
      const submission = await beginCreditSubmission(user.id, user.collegeId, "BULK_DISTRIBUTION", payload);
      const res = await backendApi.enterprise.distributeCredits(payload, effectiveToken, submission.key);
      await submission.complete();
      setFeedback({ type: "success", message: res.message });
      setDistPreview(null);
      setPreviewWasInvalidated(false);
      loadInitialData();
      loadCredits();
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Distribution failed" });
    } finally {
      distributionRequestInFlightRef.current = false;
      setDistributionLoading(false);
    }
  };

  // Handle single student credit assign
  const handleAssignStudentCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleAssignStudent || !acquireRequestLock(singleAssignInFlightRef)) return;
    setSingleAssignLoading(true);
    setSingleAssignError(null);
    try {
      const payload = {
        studentId: singleAssignStudent.id,
        amount: Number(singleAssignAmount),
        reason: singleAssignReason,
      };
      const submission = await beginCreditSubmission(user.id, user.collegeId, "STUDENT_ASSIGNMENT", payload);
      await backendApi.enterprise.assignStudentCredits(payload, effectiveToken, submission.key);
      await submission.complete();
      setFeedback({
        type: "success",
        message: `Successfully allocated ${singleAssignAmount} credits to ${singleAssignStudent.user?.name}`,
      });
      setSingleAssignStudent(null);
      loadStudents();
      loadInitialData();
    } catch (err: any) {
      const message = err.message || "Assignment failed";
      setSingleAssignError(message);
    } finally {
      releaseRequestLock(singleAssignInFlightRef);
      setSingleAssignLoading(false);
    }
  };

  // Handle add student
  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acquireRequestLock(studentCreationInFlightRef)) return;
    setStudentCreationLoading(true);
    setStudentCreationError(null);
    let submission: { key: string; complete: () => Promise<void> } | null = null;
    try {
      const payload = {
        ...studentForm,
        initialCredits: authorizedInitialCredits(user, studentForm.initialCredits),
      };
      if (user?.id && user?.collegeId) {
        submission = await beginCreditSubmission(user.id, user.collegeId, "STUDENT_CREATION", payload);
      }
      const feedback = await completeStudentOnboarding(
        () => backendApi.enterprise.createStudent(payload, effectiveToken, submission?.key),
        async () => {
          if (submission) await submission.complete();
          setStudentForm(() => {
            const form = createEmptyStudentForm();
            return { ...form, initialCredits: authorizedInitialCredits(user, form.initialCredits) };
          });
          setIsAddStudentOpen(false);
          loadStudents();
          loadInitialData();
        }
      );
      setFeedback(feedback);
      if (feedback.type === "error") {
        setStudentCreationFeedbackType("error");
        setStudentCreationError(feedback.message);
      }
    } catch (err: unknown) {
      const feedback = studentCreationFailure(err);
      setStudentCreationFeedbackType(feedback.type);
      setStudentCreationError(feedback.message);
      setFeedback(feedback);
      loadStudents();
    } finally {
      releaseRequestLock(studentCreationInFlightRef);
      setStudentCreationLoading(false);
    }
  };

  // Handle bulk import file upload
  const handleBulkImportFileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkImportFile || !acquireRequestLock(bulkImportInFlightRef)) return;
    try {
      setBulkImportLoading(true);
      setBulkImportError(null);
      setBulkImportResult(null);
      const res = await backendApi.enterprise.bulkImportFile(
        bulkImportFile,
        { atomic: bulkImportAtomic, initialCredits: authorizedInitialCredits(user, bulkImportCredits) },
        effectiveToken
      );
      setBulkImportResult({
        totalProcessed: res.totalProcessed,
        totalCreated: res.totalCreated,
        totalFailed: res.totalFailed,
        emailsSent: res.emailsSent,
        emailsFailed: res.emailsFailed,
        errors: res.errors || [],
      });
      if (res.totalCreated > 0) {
        setFeedback({
          type: res.emailsFailed > 0 ? "warning" : "success",
          message: `Created ${res.totalCreated} student accounts. Welcome emails accepted by the email service: ${res.emailsSent}; failed: ${res.emailsFailed}.`,
        });
        loadStudents();
        loadInitialData();
      } else if (res.totalFailed > 0) {
        setBulkImportError(`Bulk import completed with ${res.totalFailed} failure(s). Please review the errors below.`);
      }
    } catch (err: any) {
      const message = err.message || "Failed to process bulk import file.";
      setBulkImportError(message);
    } finally {
      releaseRequestLock(bulkImportInFlightRef);
      setBulkImportLoading(false);
    }
  };

  // Send a password setup link only after explicit confirmation. The ref closes
  // the same-render double-click window before React applies loading state.
  const handleResendInvite = async (student: any) => {
    if (!canResendStudentInvite) return;
    if (resendRequestInFlightRef.current) return;
    resendRequestInFlightRef.current = true;
    try {
      setResendingStudentId(student.id);
      const result = await backendApi.enterprise.resendStudentInvite(student.id, effectiveToken);
      setFeedback(invitationFeedback(result));
      setResendConfirmationStudent(null);
      loadStudents();
    } catch (err: unknown) {
      setFeedback(invitationRetryFailure(err));
      setResendConfirmationStudent(null);
      loadStudents();
    } finally {
      resendRequestInFlightRef.current = false;
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
    if (!acquireRequestLock(facultyCreationInFlightRef)) return;
    setFacultyCreationLoading(true);
    setFacultyCreationError(null);
    try {
      const {
        permissions,
        programAccess,
        courseAccess,
        sectionAccess,
        batchAccess,
        scopeUnrestricted,
        cohortAccess,
        ...profile
      } = facultyForm;
      const result = await backendApi.enterprise.createFaculty({
        ...profile,
        ...getFacultyAuthorizationPayload(canManageFacultyAuthorization, {
          permissions,
          programAccess,
          courseAccess,
          sectionAccess,
          batchAccess,
          scopeUnrestricted,
          cohortAccess,
        }),
      }, effectiveToken);
      setFeedback(getFacultyCreationFeedback(result));
      setIsAddFacultyOpen(false);
      setFacultyForm(createEmptyFacultyForm());
      void loadFaculty();
      void loadStats();
    } catch (err: any) {
      const message = err.message || "Failed to add faculty";
      setFacultyCreationError(message);
    } finally {
      releaseRequestLock(facultyCreationInFlightRef);
      setFacultyCreationLoading(false);
    }
  };

  const openFacultyEditor = (faculty: any) => {
    setFacultyUpdateError(null);
    setFacultyEditForm({
      name: faculty.user?.name || faculty.name || "",
      email: faculty.user?.email || faculty.email || "",
      phone: faculty.user?.phone || faculty.phone || "",
      employeeId: faculty.employeeId || "",
      department: faculty.department || "",
      designation: faculty.designation || "",
      isMainFaculty: false,
      permissions: Array.isArray(faculty.permissions) ? [...faculty.permissions] : [],
      programAccess: Array.isArray(faculty.programAccess) ? [...faculty.programAccess] : [],
      courseAccess: Array.isArray(faculty.courseAccess) ? [...faculty.courseAccess] : [],
      sectionAccess: Array.isArray(faculty.sectionAccess) ? [...faculty.sectionAccess] : [],
      batchAccess: Array.isArray(faculty.batchAccess) ? [...faculty.batchAccess] : [],
      scopeUnrestricted: typeof faculty.scopeUnrestricted === "boolean"
        ? faculty.scopeUnrestricted
        : ![faculty.programAccess, faculty.courseAccess, faculty.sectionAccess, faculty.batchAccess]
          .some((values) => Array.isArray(values) && values.length > 0),
      cohortAccess: resolveFacultyCohortAccess(faculty, filterOptions.cohorts),
    });
    setEditingFaculty(faculty);
  };

  const handleUpdateFaculty = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingFaculty || !acquireRequestLock(facultyUpdateInFlightRef)) return;
    setFacultyUpdateLoading(true);
    setFacultyUpdateError(null);
    try {
      await backendApi.enterprise.updateFaculty(editingFaculty.id, {
        name: facultyEditForm.name,
        phone: facultyEditForm.phone,
        employeeId: facultyEditForm.employeeId,
        department: facultyEditForm.department,
        designation: facultyEditForm.designation,
        ...getFacultyAuthorizationPayload(canManageFacultyAuthorization, {
          permissions: facultyEditForm.permissions,
          programAccess: facultyEditForm.programAccess,
          courseAccess: facultyEditForm.courseAccess,
          sectionAccess: facultyEditForm.sectionAccess,
          batchAccess: facultyEditForm.batchAccess,
          scopeUnrestricted: facultyEditForm.scopeUnrestricted,
          cohortAccess: facultyEditForm.cohortAccess,
        }),
      }, effectiveToken);
      setFeedback({ type: "success", message: `Faculty member ${facultyEditForm.name} was updated.` });
      setEditingFaculty(null);
      await loadFaculty();
    } catch (err: any) {
      const message = err.message || "Failed to update faculty member";
      setFacultyUpdateError(message);
    } finally {
      releaseRequestLock(facultyUpdateInFlightRef);
      setFacultyUpdateLoading(false);
    }
  };

  const handleDeactivateFaculty = async (faculty: any) => {
    const name = faculty.user?.name || faculty.name || "this faculty member";
    if (!window.confirm(`Deactivate ${name}? They will no longer be able to sign in.`)) return;
    setDeactivatingFacultyId(faculty.id);
    try {
      const result = await backendApi.enterprise.deleteFaculty(faculty.id, effectiveToken);
      setFeedback({ type: "success", message: result.message || `${name} was deactivated.` });
      await Promise.all([loadFaculty(), loadInitialData()]);
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to deactivate faculty member" });
    } finally {
      setDeactivatingFacultyId(null);
    }
  };

  const handleResendFacultyInvite = async (faculty: any) => {
    if (!acquireRequestLock(facultyResendInFlightRef)) return;
    setResendingFacultyId(faculty.id);
    try {
      const result = await backendApi.enterprise.resendFacultyInvite(faculty.id, effectiveToken);
      setFeedback({ type: "success", message: result.message });
      await loadFaculty();
    } catch (err: any) {
      setFeedback({
        type: "error",
        message: err.message || "Unable to resend the invitation. The faculty account and credentials were not changed.",
      });
    } finally {
      releaseRequestLock(facultyResendInFlightRef);
      setResendingFacultyId(null);
    }
  };

  // CSV Export
  const handleExportCsv = async () => {
    if (!acquireRequestLock(exportRequestInFlightRef)) return;
    try {
      setExportingCsv(true);
      setFeedback(null);
      await backendApi.enterprise.downloadReports({
        format: 'csv',
        program: reportProgram,
        course: reportCourse,
        section: reportSection,
        batch: reportBatch,
        search: reportSearch,
      }, effectiveToken);
      setFeedback({ type: "success", message: "Student reports successfully exported as sanitized CSV." });
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to export CSV" });
    } finally {
      releaseRequestLock(exportRequestInFlightRef);
      setExportingCsv(false);
    }
  };

  const handleExportExcel = async () => {
    if (!acquireRequestLock(exportRequestInFlightRef)) return;
    try {
      setExportingExcel(true);
      setFeedback(null);
      await backendApi.enterprise.downloadReports({
        format: 'xlsx',
        program: reportProgram,
        course: reportCourse,
        section: reportSection,
        batch: reportBatch,
        search: reportSearch,
      }, effectiveToken);
      setFeedback({ type: "success", message: "Student reports successfully exported as Excel (.xlsx) workbook." });
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Failed to export Excel" });
    } finally {
      releaseRequestLock(exportRequestInFlightRef);
      setExportingExcel(false);
    }
  };

  return (
    <div className="enterprise-dashboard min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* Top Banner Header */}
      <div className="enterprise-header border-b border-slate-200/80 bg-white/95 backdrop-blur-xl sticky top-0 z-30">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-5">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-100 shadow-sm flex items-center justify-center text-rose-600">
                <Building2 className="w-5 h-5" strokeWidth={2.2} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-950 tracking-tight font-headline">
                    {user.college?.name || "Campus Enterprise Portal"}
                  </h1>
                  <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full bg-rose-50 border border-rose-100 text-[10px] font-bold text-rose-700 uppercase tracking-wider">
                    {user.isMainFaculty ? "Main Faculty Admin" : "Faculty Evaluator"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Code: <span className="font-mono font-medium text-slate-700">{user.college?.code || "CAMPUS"}</span> &bull; Domain:{" "}
                  <span className="font-mono font-medium text-slate-700">{user.college?.domain || "institutional"}</span>
                </p>
              </div>
            </div>

            {/* Quick Balance Badge */}
            <div className="flex items-center gap-3">
              {canViewCredits && <div className="px-3.5 sm:px-4 py-2 rounded-2xl bg-emerald-50 border border-emerald-100 shadow-sm flex items-center gap-2.5">
                <Coins className="w-4 h-4 text-emerald-600" />
                <div>
                  <span className="hidden sm:block text-[10px] text-emerald-700/70 font-semibold uppercase tracking-wider">Institutional Balance</span>
                  <span className="text-sm font-bold text-emerald-700 font-mono">
                    {statsLoading ? "Loading…" : statsError ? "Unavailable" : `${stats?.credits?.balance ?? 0} Credits`}
                  </span>
                </div>
              </div>}
              <button
                onClick={loadInitialData}
                disabled={loading}
                className="p-2.5 rounded-xl bg-white border border-slate-200 hover:border-slate-300 hover:bg-slate-50 text-slate-500 hover:text-slate-900 shadow-sm transition-all duration-200"
                title="Refresh Metrics"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-rose-400" : ""}`} />
              </button>

              {/* Administrator Profile Pill */}
              <div className="hidden lg:flex items-center gap-2.5 pl-3 border-l border-slate-200">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-rose-50 to-rose-100 border border-rose-200 flex items-center justify-center text-xs font-bold text-rose-700 shadow-sm">
                  {user.name ? user.name.charAt(0).toUpperCase() : "F"}
                </div>
                <div className="text-left">
                  <span className="text-xs font-semibold text-slate-900 block leading-tight">{user.name}</span>
                  <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">{user.email}</span>
                </div>
              </div>

              {/* Institutional Sign Out Button */}
              <button
                onClick={() => {
                  if (onLogout) {
                    onLogout();
                  } else {
                    backendApi.logout().catch(() => {});
                    if (typeof window !== "undefined") {
                      window.localStorage.removeItem("redresumes_user");
                      window.localStorage.removeItem("redresumes_access_token");
                      window.location.href = "/login?portal=enterprise";
                    }
                  }
                }}
                className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-rose-50 hover:border-rose-200 text-slate-600 hover:text-rose-700 text-xs font-semibold shadow-sm transition-all duration-200"
                title="Sign Out of Enterprise Session"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="enterprise-tabs flex items-center gap-1.5 mt-4 pt-3 border-t border-slate-100 overflow-x-auto scrollbar-none" role="tablist" aria-label="Enterprise dashboard sections">
            <button
              onClick={() => setActiveTab("overview")}
              role="tab"
              aria-selected={activeTab === "overview"}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === "overview"
                  ? "bg-rose-600 text-white shadow-lg shadow-rose-950/50"
                  : "text-zinc-400 hover:text-white hover:bg-zinc-900/60"
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              Overview
            </button>
            {canViewStudents && (
              <button
                onClick={() => setActiveTab("students")}
                role="tab"
                aria-selected={activeTab === "students"}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "students"
                    ? "bg-rose-600 text-white shadow-lg shadow-rose-950/50"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-900/60"
                }`}
              >
                <GraduationCap className="w-4 h-4" />
                Students Directory ({statsError ? "—" : stats?.students?.total ?? 0})
              </button>
            )}
            {canViewFaculty && (
              <button
                onClick={() => setActiveTab("faculty")}
                role="tab"
                aria-selected={activeTab === "faculty"}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "faculty"
                    ? "bg-rose-600 text-white shadow-lg shadow-rose-950/50"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-900/60"
                }`}
              >
                <Users className="w-4 h-4" />
                Faculty Members ({statsError ? "—" : stats?.faculty?.total ?? 0})
              </button>
            )}
            {canViewCredits && (
              <button
                onClick={() => setActiveTab("credits")}
                role="tab"
                aria-selected={activeTab === "credits"}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "credits"
                    ? "bg-rose-600 text-white shadow-lg shadow-rose-950/50"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-900/60"
                }`}
              >
                <Coins className="w-4 h-4" />
                Interview Credits & Allocation
              </button>
            )}
            {canViewReports && (
                <button
                  onClick={() => setActiveTab("reports")}
                  role="tab"
                  aria-selected={activeTab === "reports"}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === "reports"
                      ? "bg-rose-600 text-white shadow-lg shadow-rose-950/50"
                      : "text-zinc-400 hover:text-white hover:bg-zinc-900/60"
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  Cohort Reports & Analytics
                </button>
            )}
            {canViewAuditLogs && (
              <button
                onClick={() => setActiveTab("audit")}
                role="tab"
                aria-selected={activeTab === "audit"}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === "audit"
                    ? "bg-rose-600 text-white shadow-lg shadow-rose-950/50"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-900/60"
                }`}
              >
                <ShieldCheck className="w-4 h-4" />
                Audit Logs
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="enterprise-main max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 pt-6 lg:pt-8 space-y-6">
        {/* Feedback Alert */}
        {feedback && (
          <div
            role={feedback.type === "error" ? "alert" : "status"}
            aria-live={feedback.type === "error" ? "assertive" : "polite"}
            aria-atomic="true"
            className={`p-4 rounded-xl border flex items-start justify-between gap-3 text-xs ${
              feedback.type === "success"
                ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-200"
                : feedback.type === "warning"
                  ? "bg-amber-950/40 border-amber-800/60 text-amber-200"
                : feedback.type === "info"
                  ? "bg-sky-950/40 border-sky-800/60 text-sky-200"
                  : "bg-rose-950/40 border-rose-800/60 text-rose-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {feedback.type === "success" ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : feedback.type === "warning" ? (
                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              ) : feedback.type === "info" ? (
                <AlertCircle className="w-4 h-4 text-sky-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
            <button onClick={() => setFeedback(null)} className="text-zinc-400 hover:text-white" aria-label="Dismiss notification">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {(["students", "faculty", "credits", "reports"] as TabType[]).includes(activeTab) && (
          <SectionStatus
            loading={filterOptionsLoading}
            error={filterOptionsError}
            loadingMessage="Loading filter options..."
            onRetry={() => loadFilterOptions()}
          />
        )}

        {/* ========================================================================= */}
        {/* 1. OVERVIEW TAB */}
        {/* ========================================================================= */}
        {activeTab === "overview" && (
          <div className="enterprise-tab-content space-y-6">
            {/* KPI Ribbon */}
            {statsLoading || statsError ? (
              <SectionStatus
                loading={statsLoading}
                error={statsError}
                loadingMessage="Loading dashboard statistics..."
                onRetry={() => loadStats()}
              />
            ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {canViewStudents && <div className="enterprise-kpi p-5 rounded-2xl bg-white border border-slate-200/80 glass-panel">
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
              </div>}

              {canViewReports && <div className="enterprise-kpi p-5 rounded-2xl bg-white border border-slate-200/80 glass-panel">
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
              </div>}

              {canViewReports && <div className="enterprise-kpi p-5 rounded-2xl bg-white border border-slate-200/80 glass-panel">
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
              </div>}

              {canViewCredits && <div className="enterprise-kpi p-5 rounded-2xl bg-white border border-slate-200/80 glass-panel">
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
              </div>}
            </div>
            )}

            {/* Quick Actions Panel */}
            <div className="enterprise-panel p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/80 glass-panel">
              <div className="mb-5">
                <h2 className="text-base font-bold text-slate-950">Quick actions</h2>
                <p className="text-xs text-slate-500 mt-1">Common tasks for managing your institution and cohorts.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {canCreateStudents && <button
                  onClick={() => {
                    setActiveTab("students");
                    setStudentCreationError(null);
                    setIsAddStudentOpen(true);
                  }}
                  className="enterprise-action-card p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-rose-200 hover:bg-rose-50/60 transition-all duration-200 text-left flex items-start gap-3 group"
                >
                  <div className="p-2.5 rounded-lg bg-rose-600/20 text-rose-400 group-hover:scale-105 transition-transform">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-zinc-200 group-hover:text-white">Onboard New Student</h3>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Add individual student with roll number and program quota.</p>
                  </div>
                </button>}

                {canDistributeCredits && <button
                  onClick={() => {
                    setActiveTab("credits");
                  }}
                  className="enterprise-action-card p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-emerald-200 hover:bg-emerald-50/60 transition-all duration-200 text-left flex items-start gap-3 group"
                >
                  <div className="p-2.5 rounded-lg bg-emerald-600/20 text-emerald-400 group-hover:scale-105 transition-transform">
                    <Coins className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-zinc-200 group-hover:text-white">Bulk Credit Allocation</h3>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Distribute interview credits across entire batches or sections.</p>
                  </div>
                </button>}

                {canViewReports && <button
                  onClick={() => setActiveTab("reports")}
                  className="enterprise-action-card p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-sky-200 hover:bg-sky-50/60 transition-all duration-200 text-left flex items-start gap-3 group"
                >
                  <div className="p-2.5 rounded-lg bg-sky-600/20 text-sky-400 group-hover:scale-105 transition-transform">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-zinc-200 group-hover:text-white">Cohort Performance Reports</h3>
                    <p className="text-[11px] text-zinc-500 mt-0.5">Inspect AI evaluation metrics and export batch results.</p>
                  </div>
                </button>}
              </div>
            </div>

            {/* Recent Students Preview */}
            {canViewStudents && <div className="enterprise-table-card rounded-3xl border border-slate-200/80 bg-white overflow-hidden glass-panel">
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
                    {studentsLoading || studentsError ? (
                      <TableStatusRow
                        colSpan={5}
                        loading={studentsLoading}
                        error={studentsError}
                        loadingMessage="Loading recently enrolled students..."
                        onRetry={loadStudents}
                      />
                    ) : students.length > 0 ? students.slice(0, 5).map((s) => (
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
                    )) : (
                      <tr>
                        <td colSpan={5} className="px-6 py-12 text-center text-zinc-500 text-sm">
                          {getTableEmptyMessage(isOfflineOrDemoToken(effectiveToken), "No recently enrolled students found.")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>}
          </div>
        )}

        {/* ========================================================================= */}
        {/* 2. STUDENTS TAB */}
        {/* ========================================================================= */}
        {activeTab === "students" && canViewStudents && (
          <div className="enterprise-tab-content space-y-5">
            {/* Filter Bar */}
            <div className="enterprise-panel p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 glass-panel space-y-3">
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

                {canCreateStudents && <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setBulkImportResult(null);
                      setBulkImportFile(null);
                      setBulkImportError(null);
                      setIsBulkImportOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 rounded-lg text-xs font-semibold transition-all cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-sky-400" /> Bulk Import
                  </button>
                  <button
                    onClick={() => {
                      setStudentCreationError(null);
                      setIsAddStudentOpen(true);
                    }}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-lg shadow-rose-950/40"
                  >
                    <Plus className="w-4 h-4" /> Add Student
                  </button>
                </div>}
              </div>

              {/* Multi-Dimensional Cohort Filters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-zinc-900 text-xs">
                <div>
                  <select
                    value={studentProgram}
                    onChange={(e) => {
                      setStudentProgram(e.target.value);
                      setStudentPage(1);
                    }}
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
                    onChange={(e) => {
                      setStudentCourse(e.target.value);
                      setStudentPage(1);
                    }}
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
                    onChange={(e) => {
                      setStudentSection(e.target.value);
                      setStudentPage(1);
                    }}
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
                    onChange={(e) => {
                      setStudentBatch(e.target.value);
                      setStudentPage(1);
                    }}
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
            <div className="enterprise-table-card rounded-2xl border border-slate-200/80 bg-white overflow-hidden glass-panel">
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
                    {studentsLoading || studentsError ? (
                      <TableStatusRow
                        colSpan={8}
                        loading={studentsLoading}
                        error={studentsError}
                        loadingMessage="Loading students..."
                        onRetry={loadStudents}
                      />
                    ) : students.length > 0 ? (
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
                            {student.invitationStatus === "failed" || student.invitationStatus === "delivery_failed" ? (
                              <div className="flex items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20" title={safeInvitationError(student.emailError)}>
                                  <AlertCircle className="w-3 h-3 text-rose-400" /> Failed
                                </span>
                                {canResendStudentInvite && (
                                  <button
                                    onClick={() => setResendConfirmationStudent(student)}
                                    disabled={resendingStudentId === student.id}
                                    className="text-[10px] font-bold text-rose-300 hover:underline cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {resendingStudentId === student.id ? "Sending..." : "Resend"}
                                  </button>
                                )}
                              </div>
                            ) : student.invitationStatus === "sent" || student.invitationStatus === "delivered" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" /> {student.invitationStatus === "delivered" ? "Delivered" : "Sent"}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                {student.invitationStatus === "pending" ? "Pending" : student.invitationStatus === "accepted" ? "Accepted" : student.invitationStatus === "expired" ? "Expired" : student.invitationStatus === "revoked" ? "Revoked" : "Unknown"}
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
                                  onClick={() => {
                                    setSingleAssignError(null);
                                    setSingleAssignStudent(student);
                                  }}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-800/60 text-emerald-300 text-xs font-medium cursor-pointer"
                                  title="Assign Credits"
                                >
                                  + Credits
                                </button>
                              )}
                              {canResendStudentInvite && (
                                <button
                                  onClick={() => setResendConfirmationStudent(student)}
                                  disabled={resendingStudentId === student.id}
                                  className="p-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                                  title="Send Password Setup Email"
                                >
                                  {resendingStudentId === student.id ? (
                                    <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-400" />
                                  ) : (
                                    <Send className="w-3.5 h-3.5" />
                                  )}
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
                        <td colSpan={8} className="px-6 py-12 text-center text-zinc-500 text-sm">
                          {getTableEmptyMessage(isOfflineOrDemoToken(effectiveToken), "No students match the selected filter criteria.")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {!studentsLoading && !studentsError && (
                <PaginationControls
                  page={studentPage}
                  total={studentTotal}
                  pageSize={STUDENT_PAGE_SIZE}
                  itemLabel="students"
                  onPageChange={setStudentPage}
                />
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3. FACULTY TAB */}
        {/* ========================================================================= */}
        {activeTab === "faculty" && canViewFaculty && (
          <div className="enterprise-tab-content space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-white">Department Faculty & Placement Officers</h2>
                <p className="text-xs text-zinc-400">
                  Authorize faculty members to manage cohort interviews, view evaluations, and distribute credits.
                </p>
              </div>
              {canCreateFaculty && (
                <button
                  onClick={() => {
                    setFacultyForm(createEmptyFacultyForm());
                    setFacultyCreationError(null);
                    setIsAddFacultyOpen(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold transition-all cursor-pointer shadow-lg shadow-rose-950/40"
                >
                  <Plus className="w-4 h-4" /> Add Faculty Member
                </button>
              )}
            </div>

            <div className="enterprise-table-card rounded-2xl border border-slate-200/80 bg-white overflow-hidden glass-panel">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-950/80 text-[10px] font-mono text-zinc-400 uppercase tracking-wider border-b border-zinc-800/80">
                    <tr>
                      <th className="px-6 py-4">Faculty Member</th>
                      <th className="px-6 py-4">Emp ID / Dept</th>
                      <th className="px-6 py-4">Designation</th>
                      <th className="px-6 py-4">Role / Permissions</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/40 text-zinc-300">
                    {facultyLoading || facultyError ? (
                      <TableStatusRow
                        colSpan={6}
                        loading={facultyLoading}
                        error={facultyError}
                        loadingMessage="Loading faculty..."
                        onRetry={loadFaculty}
                      />
                    ) : facultyList.length > 0 ? facultyList.map((fac) => (
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
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-2">
                            {canEditFaculty && (!fac.isMainFaculty || canManageFacultyAuthorization) && (
                              <button
                                type="button"
                                onClick={() => openFacultyEditor(fac)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
                              >
                                <Pencil className="w-3.5 h-3.5" /> Edit
                              </button>
                            )}
                            {canManageFacultyAuthorization && !fac.isMainFaculty && fac.userId !== user.id && fac.status !== "inactive" && (
                              <button
                                type="button"
                                disabled={deactivatingFacultyId === fac.id}
                                onClick={() => handleDeactivateFaculty(fac)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-rose-800/60 bg-rose-950/30 text-rose-300 hover:bg-rose-900/40 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {deactivatingFacultyId === fac.id ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <UserX className="w-3.5 h-3.5" />
                                )}
                                Deactivate
                              </button>
                            )}
                            {canCreateFaculty && fac.status === "invited" && (
                              <button
                                type="button"
                                disabled={resendingFacultyId === fac.id}
                                onClick={() => handleResendFacultyInvite(fac)}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-amber-700/50 bg-amber-950/30 text-amber-300 hover:bg-amber-900/40 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {resendingFacultyId === fac.id ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Send className="w-3.5 h-3.5" />
                                )}
                                Resend Invitation
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-zinc-500 text-sm">
                          {getTableEmptyMessage(isOfflineOrDemoToken(effectiveToken), "No faculty members found.")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {!facultyLoading && !facultyError && (
                <PaginationControls
                  page={facultyPage}
                  total={facultyTotal}
                  pageSize={FACULTY_PAGE_SIZE}
                  itemLabel="faculty members"
                  onPageChange={setFacultyPage}
                />
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 4. CREDITS TAB */}
        {/* ========================================================================= */}
        {activeTab === "credits" && canViewCredits && (
          <div className="enterprise-tab-content space-y-6">
            {/* Bulk Distribution Wizard */}
            {canDistributeCredits && (
              <div className="enterprise-panel p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/80 glass-panel space-y-4">
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
                      onChange={(e) => updateBulkDistributionData("program", e.target.value)}
                      disabled={distributionLoading}
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
                      onChange={(e) => updateBulkDistributionData("course", e.target.value)}
                      disabled={distributionLoading}
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
                      onChange={(e) => updateBulkDistributionData("batch", e.target.value)}
                      disabled={distributionLoading}
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
                      onChange={(e) => updateBulkDistributionData("creditsPerStudent", Number(e.target.value))}
                      disabled={distributionLoading}
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-zinc-300 font-medium mb-1">Allocation Reason *</label>
                    <input
                      type="text"
                      value={bulkDistData.reason}
                      onChange={(e) => updateBulkDistributionData("reason", e.target.value)}
                      disabled={distributionLoading}
                      placeholder="e.g. Placement Drive Pre-assessment Allowance"
                      className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleCalculatePreview}
                    disabled={previewLoading || distributionLoading}
                    className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    {previewLoading ? "Calculating..." : "Preview Distribution Impact"}
                  </button>
                  {previewWasInvalidated && !distPreview && (
                    <p className="text-xs text-amber-400">
                      Distribution settings changed. Please generate a new preview before confirming.
                    </p>
                  )}
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
                        disabled={
                          distributionLoading ||
                          !isCurrentPreviewValid ||
                          !distPreview.hasSufficientBalance ||
                          distPreview.matchingStudentsCount === 0
                        }
                        className="ml-auto inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-all disabled:opacity-40 cursor-pointer shadow-lg shadow-emerald-950/40"
                      >
                        <Send className="w-3.5 h-3.5" />
                        {distributionLoading ? "Distributing..." : "Confirm & Distribute Credits"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Credit Transaction Ledger */}
            <div className="enterprise-table-card rounded-2xl border border-slate-200/80 bg-white overflow-hidden glass-panel">
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
                    {creditsLoading || creditsError ? (
                      <TableStatusRow
                        colSpan={6}
                        loading={creditsLoading}
                        error={creditsError}
                        loadingMessage="Loading credit transactions..."
                        onRetry={loadCredits}
                      />
                    ) : creditLedger.length > 0 ? creditLedger.map((tx) => (
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
                        <td className="px-6 py-4 text-[11px] text-zinc-400">
                          <span className="block font-medium text-zinc-300">
                            {getCreditLedgerActorLabel(tx.performedBy)}
                          </span>
                          <span className="block font-mono text-[10px] text-zinc-500">{tx.performedBy.email}</span>
                        </td>
                        <td className="px-6 py-4 font-mono text-zinc-500">
                          {new Date(tx.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={6} className="px-6 py-12 text-center text-zinc-500 text-sm">
                          {getTableEmptyMessage(isOfflineOrDemoToken(effectiveToken), "No credit transactions found.")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {!creditsLoading && !creditsError && (
                <PaginationControls
                  page={creditPage}
                  total={creditTotal}
                  pageSize={CREDIT_PAGE_SIZE}
                  itemLabel="credit transactions"
                  onPageChange={setCreditPage}
                />
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 5. REPORTS TAB */}
        {/* ========================================================================= */}
        {activeTab === "reports" && canViewReports && (
          <div className="enterprise-tab-content space-y-6">
            {/* Summary Insights */}
            {reportSummaryLoading || reportSummaryError ? (
              <SectionStatus
                loading={reportSummaryLoading}
                error={reportSummaryError}
                loadingMessage="Loading report summary..."
                onRetry={loadReportSummary}
              />
            ) : reportSummary && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="enterprise-kpi p-5 rounded-2xl bg-white border border-slate-200/80 glass-panel">
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

                <div className="enterprise-kpi p-5 rounded-2xl bg-white border border-slate-200/80 glass-panel">
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

                <div className="enterprise-kpi p-5 rounded-2xl bg-white border border-slate-200/80 glass-panel">
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
            <div className="enterprise-panel p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/80 glass-panel space-y-3">
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                  <input
                    type="text"
                    placeholder="Search candidate name, role, email, or roll number..."
                    value={reportSearch}
                    onChange={(e) => {
                      setReportSearch(e.target.value);
                      setReportPage(1);
                    }}
                    className="w-full pl-9 pr-8 py-2 bg-zinc-950/70 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-rose-500"
                  />
                  {reportSearch && (
                    <button
                      type="button"
                      onClick={() => {
                        setReportSearch("");
                        setReportPage(1);
                      }}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 transition-colors"
                      title="Clear search"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {canExportReports && <div className="flex items-center gap-2">
                  <button
                    onClick={handleExportCsv}
                    disabled={exportingCsv || exportingExcel}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-zinc-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    {exportingCsv ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-zinc-400" />
                    ) : (
                      <Download className="w-3.5 h-3.5 text-zinc-400" />
                    )}
                    {exportingCsv ? "Exporting CSV..." : "Export CSV"}
                  </button>
                  <button
                    onClick={handleExportExcel}
                    disabled={exportingCsv || exportingExcel}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-600/20 hover:bg-rose-600/30 disabled:opacity-50 disabled:cursor-not-allowed border border-rose-500/30 text-rose-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                  >
                    {exportingExcel ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-rose-400" />
                    ) : (
                      <FileText className="w-3.5 h-3.5 text-rose-400" />
                    )}
                    {exportingExcel ? "Exporting Excel..." : "Export Excel (.xlsx)"}
                  </button>
                </div>}
              </div>

              {/* Cohort Filter Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-zinc-900 text-xs">
                <div>
                  <select
                    value={reportProgram}
                    onChange={(e) => {
                      setReportProgram(e.target.value);
                      setReportPage(1);
                    }}
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
                    onChange={(e) => {
                      setReportCourse(e.target.value);
                      setReportPage(1);
                    }}
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
                    onChange={(e) => {
                      setReportSection(e.target.value);
                      setReportPage(1);
                    }}
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
                    onChange={(e) => {
                      setReportBatch(e.target.value);
                      setReportPage(1);
                    }}
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
            <div className="enterprise-table-card rounded-2xl border border-slate-200/80 bg-white overflow-hidden glass-panel">
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
                    {reportsLoading || reportsError ? (
                      <TableStatusRow
                        colSpan={7}
                        loading={reportsLoading}
                        error={reportsError}
                        loadingMessage="Loading reports..."
                        onRetry={loadReports}
                      />
                    ) : reports.length > 0 ? (
                      reports.map((report) => {
                        const scoreVal = Math.round(Number(report.overallScore));

                        return (
                          <tr key={report.reportId || report.id} className="hover:bg-zinc-900/20">
                            <td className="px-6 py-4 font-semibold text-white">
                              {report.student?.name || report.name || "Student"}
                            </td>
                            <td className="px-6 py-4 font-mono text-zinc-400">
                              {report.student?.enrollmentNumber || report.enrollmentNumber || "—"} &bull;{" "}
                              {report.student?.program || report.program || report.student?.course || "—"}
                            </td>
                            <td className="px-6 py-4">
                              <span className="font-medium text-zinc-200 block">
                                {report.targetRole}
                              </span>
                              <span className="text-[10px] font-mono text-zinc-500 capitalize">
                                {report.difficulty || "Standard"} level
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`text-sm font-bold font-mono px-2 py-0.5 rounded ${
                                  scoreVal >= 80
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/25"
                                    : scoreVal >= 60
                                    ? "bg-amber-500/10 text-amber-400 border border-amber-500/25"
                                    : "bg-rose-500/10 text-rose-400 border border-rose-500/25"
                                }`}
                              >
                                {scoreVal}%
                              </span>
                            </td>
                            <td className="px-6 py-4 font-mono text-[11px] text-zinc-400">
                              {report.speakingPace !== null && report.speakingPace !== undefined
                                ? `${report.speakingPace} WPM`
                                : "—"}{" "}
                              &bull;{" "}
                              {report.fillerWords !== null && report.fillerWords !== undefined
                                ? `${report.fillerWords} Fillers`
                                : "—"}
                            </td>
                            <td className="px-6 py-4 font-mono text-zinc-500">
                              {new Date(report.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <a
                                href={interviewReportPath(report.sessionId)}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1.5 rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 text-[11px] inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" /> Full Report
                              </a>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={7} className="px-6 py-12 text-center text-zinc-500 text-sm">
                          {getTableEmptyMessage(isOfflineOrDemoToken(effectiveToken), "No interview evaluation records found.")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {!reportsLoading && !reportsError && (
                <PaginationControls
                  page={reportPage}
                  total={reportTotal}
                  pageSize={REPORT_PAGE_SIZE}
                  itemLabel="interview evaluations"
                  onPageChange={setReportPage}
                />
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* AUDIT LOGS TAB */}
        {/* ========================================================================= */}
        {activeTab === "audit" && canViewAuditLogs && (
          <div className="enterprise-tab-content space-y-6">
            {/* Header info */}
            <div className="enterprise-panel p-5 sm:p-6 rounded-3xl bg-white border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
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
                  {AUDIT_ACTION_FILTER_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
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
                    {auditLoading || auditError ? (
                      <TableStatusRow
                        colSpan={6}
                        loading={auditLoading}
                        error={auditError}
                        loadingMessage="Loading institutional audit logs..."
                        onRetry={loadAuditLogs}
                      />
                    ) : auditLogs.length > 0 ? (
                      auditLogs.map((log) => {
                        const actionColor =
                          log.action?.includes("CREATED") || log.action?.includes("IMPORTED")
                            ? "bg-emerald-950/50 border-emerald-800/60 text-emerald-400"
                            : log.action?.includes("DISTRIBUTED") ||
                              log.action?.includes("ALLOCATED") ||
                              log.action?.includes("ASSIGNED")
                            ? "bg-purple-950/50 border-purple-800/60 text-purple-300"
                            : log.action?.includes("EXPORTED")
                            ? "bg-sky-950/50 border-sky-800/60 text-sky-300"
                            : log.action?.includes("DEACTIVATED") || log.action?.includes("FAILED")
                            ? "bg-rose-950/50 border-rose-800/60 text-rose-400"
                            : "bg-amber-950/50 border-amber-800/60 text-amber-300";

                        const detailsFormatted = formatAuditDetails(log);
                        const targetUser = getTargetUser(log);
                        const entityName = formatEntityName(log.entity);

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
                              {targetUser ? (
                                <div>
                                  <div className="text-zinc-200 font-medium">
                                    {targetUser.name || targetUser.email}
                                  </div>
                                  {targetUser.email && targetUser.name && (
                                    <div className="text-[10px] text-zinc-500 font-mono">{targetUser.email}</div>
                                  )}
                                  <div className="text-[10px] text-zinc-400 font-mono flex items-center gap-1.5 mt-0.5">
                                    <span className="px-1.5 py-0.2 bg-zinc-800 rounded text-[9px] text-zinc-300">
                                      {entityName}
                                    </span>
                                    {log.entityId && (
                                      <span className="truncate max-w-[120px]" title={log.entityId}>
                                        #{log.entityId.slice(-6)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              ) : log.entityId ? (
                                <div>
                                  <div className="text-zinc-200 font-medium">{entityName}</div>
                                  <div className="font-mono text-zinc-500 text-[10px] truncate max-w-[140px]" title={log.entityId}>
                                    ID: {log.entityId}
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <div className="text-zinc-200 font-medium">{entityName}</div>
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3 max-w-xs">
                              <button
                                type="button"
                                onClick={() => setSelectedAuditLog(log)}
                                className="group flex items-center gap-1.5 text-left max-w-full truncate"
                                title="Click to inspect full audit details"
                              >
                                <code className="text-[10px] text-zinc-300 bg-zinc-900/90 group-hover:bg-zinc-800 px-2 py-1 rounded border border-zinc-800 transition-colors truncate block">
                                  {detailsFormatted}
                                </code>
                              </button>
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
                          {getTableEmptyMessage(isOfflineOrDemoToken(effectiveToken), "No audit trail records found matching your filters.")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {!auditLoading && !auditError && <div className="p-3 border-t border-zinc-800 bg-zinc-900/30 flex items-center justify-between text-xs text-zinc-400">
                <span>
                  {calculatePaginationRange(auditPage, 15, auditTotal).text}
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
                    Page {auditTotal === 0 ? 1 : auditPage} of {Math.max(1, auditTotalPages)}
                  </span>
                  <button
                    disabled={auditPage >= auditTotalPages || auditTotal === 0 || auditLoading}
                    onClick={() => setAuditPage((p) => p + 1)}
                    className="px-3 py-1 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 disabled:opacity-50 text-white rounded text-xs transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* Audit Log Inspection Modal */}
      {selectedAuditLog && (
        <AccessibleDialog
          titleId="audit-inspection-title"
          onClose={() => setSelectedAuditLog(null)}
          className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        >
            <div className="flex items-center justify-between p-5 border-b border-zinc-800 bg-zinc-900/50">
              <div>
                <h3 id="audit-inspection-title" className="text-base font-bold text-white flex items-center gap-2">
                  <span>Audit Log Inspection</span>
                  <span className="text-xs px-2 py-0.5 rounded-full border border-zinc-700 bg-zinc-900 font-mono text-zinc-300">
                    {selectedAuditLog.action}
                  </span>
                </h3>
                <p className="text-xs text-zinc-400 mt-1 font-mono">
                  {new Date(selectedAuditLog.createdAt).toLocaleString()} • {selectedAuditLog.id}
                </p>
              </div>
              <button
                onClick={() => setSelectedAuditLog(null)}
                aria-label="Close audit log inspection"
                className="text-zinc-400 hover:text-white p-1 rounded-lg hover:bg-zinc-800/80 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-zinc-900/40 p-3 rounded-xl border border-zinc-800/80">
                <div>
                  <span className="text-zinc-500 uppercase text-[10px] font-semibold block">Actor</span>
                  <span className="text-zinc-200 font-medium">{selectedAuditLog.actor?.name || selectedAuditLog.actor?.email || "System"}</span>
                  {selectedAuditLog.actor?.email && (
                    <span className="text-zinc-500 block font-mono text-[10px]">{selectedAuditLog.actor.email}</span>
                  )}
                  {selectedAuditLog.actor?.role && (
                    <span className="text-zinc-400 block font-mono text-[9px] uppercase mt-0.5">
                      {selectedAuditLog.actor.role.replace("college_", "").replace("_", " ")}
                    </span>
                  )}
                </div>
                <div>
                  <span className="text-zinc-500 uppercase text-[10px] font-semibold block">Target Entity</span>
                  <span className="text-zinc-200 font-medium">{formatEntityName(selectedAuditLog.entity)}</span>
                  {selectedAuditLog.entityId && (
                    <span className="text-zinc-500 block font-mono text-[10px]">ID: {selectedAuditLog.entityId}</span>
                  )}
                  <span className="text-zinc-500 block font-mono text-[10px] mt-0.5">IP: {selectedAuditLog.ipAddress || "Internal"}</span>
                </div>
              </div>

              {selectedAuditLog.oldValue !== null && selectedAuditLog.oldValue !== undefined && (
                <div>
                  <span className="text-zinc-400 font-semibold block mb-1">Previous State (Old Value)</span>
                  <pre className="p-3 bg-zinc-900/80 rounded-lg border border-zinc-800 font-mono text-[11px] text-rose-300/90 overflow-x-auto">
                    {JSON.stringify(selectedAuditLog.oldValue, null, 2)}
                  </pre>
                </div>
              )}

              {selectedAuditLog.newValue !== null && selectedAuditLog.newValue !== undefined && (
                <div>
                  <span className="text-zinc-400 font-semibold block mb-1">New State (New Value)</span>
                  <pre className="p-3 bg-zinc-900/80 rounded-lg border border-zinc-800 font-mono text-[11px] text-emerald-300/90 overflow-x-auto">
                    {JSON.stringify(selectedAuditLog.newValue, null, 2)}
                  </pre>
                </div>
              )}

              {selectedAuditLog.metadata !== null && selectedAuditLog.metadata !== undefined && (
                <div>
                  <span className="text-zinc-400 font-semibold block mb-1">Metadata</span>
                  <pre className="p-3 bg-zinc-900/80 rounded-lg border border-zinc-800 font-mono text-[11px] text-zinc-300 overflow-x-auto">
                    {JSON.stringify(selectedAuditLog.metadata, null, 2)}
                  </pre>
                </div>
              )}
            </div>

            <div className="p-4 border-t border-zinc-800 bg-zinc-900/30 flex justify-end">
              <button
                onClick={() => setSelectedAuditLog(null)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg text-xs font-medium transition-colors"
              >
                Close
              </button>
            </div>
        </AccessibleDialog>
      )}

      {/* Password setup email confirmation */}
      {resendConfirmationStudent && canResendStudentInvite && (
        <AccessibleDialog
          titleId="resend-credentials-title"
          descriptionId="resend-credentials-description"
          closeDisabled={resendingStudentId === resendConfirmationStudent.id}
          onClose={() => setResendConfirmationStudent(null)}
          className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-2xl p-6 shadow-2xl space-y-5"
        >
            <div className="flex items-start justify-between gap-4 border-b border-zinc-800 pb-3">
              <div>
                <h3 id="resend-credentials-title" className="text-sm font-bold text-white">Send password setup email?</h3>
                <p id="resend-credentials-description" className="mt-1 text-[11px] leading-5 text-zinc-400">
                  A secure, single-use setup link will be sent. The student's current password will remain valid until they choose a new one.
                </p>
              </div>
              <button
                type="button"
                disabled={resendingStudentId === resendConfirmationStudent.id}
                onClick={() => setResendConfirmationStudent(null)}
                className="text-zinc-500 hover:text-white disabled:opacity-50"
                aria-label="Cancel password setup email"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 text-xs">
              <span className="block font-semibold text-white">
                {resendConfirmationStudent.user?.name || resendConfirmationStudent.name}
              </span>
              <span className="mt-1 block font-mono text-zinc-400">
                {resendConfirmationStudent.user?.email || resendConfirmationStudent.email}
              </span>
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                disabled={resendingStudentId === resendConfirmationStudent.id}
                onClick={() => setResendConfirmationStudent(null)}
                className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg text-xs disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={resendingStudentId === resendConfirmationStudent.id}
                onClick={() => void handleResendInvite(resendConfirmationStudent)}
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-60"
              >
                {resendingStudentId === resendConfirmationStudent.id ? (
                  <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Sending…</>
                ) : (
                  <><Send className="w-3.5 h-3.5" /> Send setup email</>
                )}
              </button>
            </div>
        </AccessibleDialog>
      )}

      {/* Add Student Modal */}
      {isAddStudentOpen && (
        <AccessibleDialog
          titleId="add-student-title"
          closeDisabled={studentCreationLoading}
          onClose={() => setIsAddStudentOpen(false)}
          className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-zinc-950 border border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-2xl space-y-4"
        >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 id="add-student-title" className="text-sm font-bold text-white">Enroll Student</h3>
              <button type="button" disabled={studentCreationLoading} onClick={() => setIsAddStudentOpen(false)} className="text-zinc-500 hover:text-white disabled:opacity-50" aria-label="Close add student dialog">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateStudent} className="space-y-3 text-xs" aria-busy={studentCreationLoading}>
              {studentCreationError && (
                <div role={studentCreationFeedbackType === "error" ? "alert" : "status"} className={`rounded-lg border p-3 ${studentCreationFeedbackType === "error" ? "border-rose-800/60 bg-rose-950/40 text-rose-200" : "border-amber-800/60 bg-amber-950/40 text-amber-200"}`}>
                  {studentCreationError}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="student-name" className="block text-zinc-300 mb-1">Full Name *</label>
                  <input
                    id="student-name"
                    data-dialog-autofocus
                    required
                    type="text"
                    value={studentForm.name}
                    onChange={(e) => setStudentForm({ ...studentForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label htmlFor="student-email" className="block text-zinc-300 mb-1">Email Address *</label>
                  <input
                    id="student-email"
                    required
                    type="email"
                    value={studentForm.email}
                    onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label htmlFor="student-enrollment" className="block text-zinc-300 mb-1">Enrollment / Roll No *</label>
                  <input
                    id="student-enrollment"
                    required
                    type="text"
                    value={studentForm.enrollmentNumber}
                    onChange={(e) => setStudentForm({ ...studentForm, enrollmentNumber: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="student-program" className="block text-zinc-300 mb-1">Program *</label>
                  <input
                    id="student-program"
                    required
                    type="text"
                    value={studentForm.program}
                    onChange={(e) => setStudentForm({ ...studentForm, program: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label htmlFor="student-course" className="block text-zinc-300 mb-1">Course / Branch *</label>
                  <input
                    id="student-course"
                    required
                    type="text"
                    value={studentForm.course}
                    onChange={(e) => setStudentForm({ ...studentForm, course: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label htmlFor="student-section" className="block text-zinc-300 mb-1">Section *</label>
                  <input
                    id="student-section"
                    required
                    type="text"
                    value={studentForm.section}
                    onChange={(e) => setStudentForm({ ...studentForm, section: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label htmlFor="student-batch" className="block text-zinc-300 mb-1">Batch *</label>
                  <input
                    id="student-batch"
                    required
                    type="text"
                    value={studentForm.batch}
                    onChange={(e) => setStudentForm({ ...studentForm, batch: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
                  />
                </div>
                {canDistributeCredits ? (
                <div>
                  <label htmlFor="student-initial-credits" className="block text-zinc-300 mb-1">Initial Credits</label>
                  <input
                    id="student-initial-credits"
                    type="number"
                    min={0}
                    value={studentForm.initialCredits}
                    onChange={(e) => setStudentForm({ ...studentForm, initialCredits: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white font-mono"
                  />
                </div>
                ) : (
                  <p className="text-zinc-400">Students will start with zero credits. Credit assignment requires additional permission.</p>
                )}
              </div>

              <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={studentCreationLoading}
                  onClick={() => setIsAddStudentOpen(false)}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg text-xs disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={studentCreationLoading}
                  aria-busy={studentCreationLoading}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {studentCreationLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  {studentCreationLoading ? "Adding Student..." : "Enroll Student"}
                </button>
              </div>
            </form>
        </AccessibleDialog>
      )}

      {/* Bulk Import Students Modal */}
      {isBulkImportOpen && (
        <AccessibleDialog
          titleId="bulk-import-title"
          descriptionId="bulk-import-description"
          closeDisabled={bulkImportLoading}
          onClose={() => {
            setIsBulkImportOpen(false);
            setBulkImportResult(null);
            setBulkImportFile(null);
          }}
          className="w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
        >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 id="bulk-import-title" className="text-sm font-bold text-white flex items-center gap-2">
                  <Upload className="w-4 h-4 text-sky-400" /> Bulk Import Students
                </h3>
                <p id="bulk-import-description" className="text-[11px] text-zinc-400 mt-0.5">
                  Upload an Excel (.xlsx, .xls) or CSV cohort spreadsheet
                </p>
              </div>
              <button
                type="button"
                disabled={bulkImportLoading}
                onClick={() => {
                  setIsBulkImportOpen(false);
                  setBulkImportResult(null);
                  setBulkImportFile(null);
                }}
                className="text-zinc-500 hover:text-white disabled:opacity-50"
                aria-label="Close bulk import dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleBulkImportFileSubmit} className="space-y-4 text-xs" aria-busy={bulkImportLoading}>
              {bulkImportError && (
                <div role="alert" className="rounded-lg border border-rose-800/60 bg-rose-950/40 p-3 text-rose-200">
                  {bulkImportError}
                </div>
              )}
              {/* File upload zone */}
              <div className="border-2 border-dashed border-zinc-800 hover:border-sky-500/60 rounded-xl p-6 text-center transition-all bg-zinc-900/30">
                <input
                  type="file"
                  id="excelFileInput"
                  accept=".xlsx, .xls, .csv"
                  disabled={bulkImportLoading}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setBulkImportFile(e.target.files[0]);
                      setBulkImportResult(null);
                      setBulkImportError(null);
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {canDistributeCredits ? (
                <div>
                  <label htmlFor="bulk-initial-credits" className="block text-zinc-300 mb-1">Initial Credits Per Student</label>
                  <input
                    id="bulk-initial-credits"
                    type="number"
                    min={0}
                    value={bulkImportCredits}
                    onChange={(e) => setBulkImportCredits(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white font-mono"
                    placeholder="0"
                  />
                </div>
                ) : (
                  <p className="text-zinc-400">Students will start with zero credits. Remove positive credit values from the uploaded file; credit assignment requires additional permission.</p>
                )}
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
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center">
                    <div className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-800/40">
                      <span className="text-lg font-bold font-mono text-emerald-400 block">{bulkImportResult.totalCreated}</span>
                      <span className="text-[10px] text-zinc-400 uppercase font-semibold">Created</span>
                    </div>
                    <div className="p-2 rounded-lg bg-rose-950/30 border border-rose-800/40">
                      <span className="text-lg font-bold font-mono text-rose-400 block">{bulkImportResult.totalFailed}</span>
                      <span className="text-[10px] text-zinc-400 uppercase font-semibold">Failed</span>
                    </div>
                    <div className="p-2 rounded-lg bg-sky-950/30 border border-sky-800/40">
                      <span className="text-lg font-bold font-mono text-sky-400 block">{bulkImportResult.emailsSent}</span>
                      <span className="text-[10px] text-zinc-400 uppercase font-semibold">Emails Sent</span>
                      {bulkImportResult.emailsFailed > 0 && (
                        <span className="text-[9px] text-amber-400 block">{bulkImportResult.emailsFailed} failed</span>
                      )}
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
                  disabled={bulkImportLoading}
                  onClick={() => {
                    setIsBulkImportOpen(false);
                    setBulkImportResult(null);
                    setBulkImportFile(null);
                  }}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg text-xs disabled:opacity-50"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={!bulkImportFile || bulkImportLoading}
                  aria-busy={bulkImportLoading}
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
        </AccessibleDialog>
      )}

      {/* Add Faculty Modal */}
      {isAddFacultyOpen && (
        <AccessibleDialog
          titleId="add-faculty-title"
          closeDisabled={facultyCreationLoading}
          onClose={() => setIsAddFacultyOpen(false)}
          className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-zinc-950 border border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-2xl space-y-4"
        >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 id="add-faculty-title" className="text-sm font-bold text-white">Add Faculty Member</h3>
              <button type="button" disabled={facultyCreationLoading} onClick={() => setIsAddFacultyOpen(false)} className="text-zinc-500 hover:text-white disabled:opacity-50" aria-label="Close add faculty dialog">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateFaculty} className="space-y-3 text-xs" aria-busy={facultyCreationLoading}>
              {facultyCreationError && (
                <div role="alert" className="rounded-lg border border-rose-800/60 bg-rose-950/40 p-3 text-rose-200">
                  {facultyCreationError}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="faculty-name" className="block text-zinc-300 mb-1">Faculty Name *</label>
                  <input
                    id="faculty-name"
                    data-dialog-autofocus
                    required
                    type="text"
                    value={facultyForm.name}
                    onChange={(e) => setFacultyForm({ ...facultyForm, name: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label htmlFor="faculty-email" className="block text-zinc-300 mb-1">Email Address *</label>
                  <input
                    id="faculty-email"
                    required
                    type="email"
                    value={facultyForm.email}
                    onChange={(e) => setFacultyForm({ ...facultyForm, email: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label htmlFor="faculty-employee-id" className="block text-zinc-300 mb-1">Employee ID</label>
                  <input
                    id="faculty-employee-id"
                    type="text"
                    value={facultyForm.employeeId}
                    onChange={(e) => setFacultyForm({ ...facultyForm, employeeId: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="faculty-phone" className="block text-zinc-300 mb-1">Phone</label>
                  <input
                    id="faculty-phone"
                    type="tel"
                    value={facultyForm.phone}
                    onChange={(e) => setFacultyForm({ ...facultyForm, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label htmlFor="faculty-department" className="block text-zinc-300 mb-1">Department</label>
                  <input
                    id="faculty-department"
                    type="text"
                    value={facultyForm.department}
                    onChange={(e) => setFacultyForm({ ...facultyForm, department: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="faculty-designation" className="block text-zinc-300 mb-1">Designation</label>
                  <input
                    id="faculty-designation"
                    type="text"
                    value={facultyForm.designation}
                    onChange={(e) => setFacultyForm({ ...facultyForm, designation: e.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
                  />
                </div>
                {canManageFacultyAuthorization && (
                  <FacultyAuthorizationFields
                    values={facultyForm}
                    filterOptions={filterOptions}
                    onChange={(authorization) => setFacultyForm({ ...facultyForm, ...authorization })}
                  />
                )}
              </div>

              <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={facultyCreationLoading}
                  onClick={() => setIsAddFacultyOpen(false)}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={facultyCreationLoading}
                  aria-busy={facultyCreationLoading}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {facultyCreationLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  {facultyCreationLoading ? "Sending Invitation..." : "Send Invitation"}
                </button>
              </div>
            </form>
        </AccessibleDialog>
      )}

      {/* Edit Faculty Modal */}
      {editingFaculty && (
        <AccessibleDialog
          titleId="edit-faculty-title"
          descriptionId="edit-faculty-description"
          closeDisabled={facultyUpdateLoading}
          onClose={() => setEditingFaculty(null)}
          className="w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-zinc-950 border border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-2xl space-y-4"
        >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h3 id="edit-faculty-title" className="text-sm font-bold text-white">Edit Faculty Member</h3>
                <p id="edit-faculty-description" className="mt-1 text-[11px] text-zinc-500">Update profile details, permissions, and assigned cohort scope.</p>
              </div>
              <button
                type="button"
                disabled={facultyUpdateLoading}
                onClick={() => setEditingFaculty(null)}
                className="text-zinc-500 hover:text-white disabled:opacity-50"
                aria-label="Close edit faculty dialog"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateFaculty} className="space-y-3 text-xs" aria-busy={facultyUpdateLoading}>
              {facultyUpdateError && (
                <div role="alert" className="rounded-lg border border-rose-800/60 bg-rose-950/40 p-3 text-rose-200">
                  {facultyUpdateError}
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="edit-faculty-name" className="block text-zinc-300 mb-1">Faculty Name *</label>
                  <input
                    id="edit-faculty-name"
                    data-dialog-autofocus
                    required
                    value={facultyEditForm.name}
                    onChange={(event) => setFacultyEditForm({ ...facultyEditForm, name: event.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label htmlFor="edit-faculty-email" className="block text-zinc-300 mb-1">Email Address</label>
                  <input
                    id="edit-faculty-email"
                    disabled
                    value={facultyEditForm.email}
                    className="w-full px-3 py-2 bg-zinc-900/60 border border-zinc-800 rounded-lg text-zinc-500 cursor-not-allowed"
                  />
                </div>
                <div>
                  <label htmlFor="edit-faculty-phone" className="block text-zinc-300 mb-1">Phone</label>
                  <input
                    id="edit-faculty-phone"
                    type="tel"
                    value={facultyEditForm.phone}
                    onChange={(event) => setFacultyEditForm({ ...facultyEditForm, phone: event.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label htmlFor="edit-faculty-employee-id" className="block text-zinc-300 mb-1">Employee ID</label>
                  <input
                    id="edit-faculty-employee-id"
                    value={facultyEditForm.employeeId}
                    onChange={(event) => setFacultyEditForm({ ...facultyEditForm, employeeId: event.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="edit-faculty-department" className="block text-zinc-300 mb-1">Department</label>
                  <input
                    id="edit-faculty-department"
                    value={facultyEditForm.department}
                    onChange={(event) => setFacultyEditForm({ ...facultyEditForm, department: event.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
                  />
                </div>
                <div>
                  <label htmlFor="edit-faculty-designation" className="block text-zinc-300 mb-1">Designation</label>
                  <input
                    id="edit-faculty-designation"
                    value={facultyEditForm.designation}
                    onChange={(event) => setFacultyEditForm({ ...facultyEditForm, designation: event.target.value })}
                    className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white"
                  />
                </div>

                {canManageFacultyAuthorization && (
                  <FacultyAuthorizationFields
                    values={facultyEditForm}
                    filterOptions={filterOptions}
                    onChange={(authorization) => setFacultyEditForm({ ...facultyEditForm, ...authorization })}
                  />
                )}
              </div>

              <div className="pt-3 border-t border-zinc-800 flex items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={facultyUpdateLoading}
                  onClick={() => setEditingFaculty(null)}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={facultyUpdateLoading}
                  aria-busy={facultyUpdateLoading}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg font-semibold disabled:opacity-50"
                >
                  {facultyUpdateLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  {facultyUpdateLoading ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
        </AccessibleDialog>
      )}

      {/* Single Assign Credit Modal */}
      {singleAssignStudent && (
        <AccessibleDialog
          titleId="assign-credit-title"
          closeDisabled={singleAssignLoading}
          onClose={() => setSingleAssignStudent(null)}
          className="w-full max-w-sm bg-zinc-950 border border-zinc-800 rounded-2xl p-4 sm:p-6 shadow-2xl space-y-4"
        >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 id="assign-credit-title" className="text-sm font-bold text-white">Assign Credits to Student</h3>
              <button type="button" disabled={singleAssignLoading} onClick={() => setSingleAssignStudent(null)} className="text-zinc-500 hover:text-white disabled:opacity-50" aria-label="Close assign credits dialog">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAssignStudentCredit} className="space-y-3 text-xs" aria-busy={singleAssignLoading}>
              {singleAssignError && (
                <div role="alert" className="rounded-lg border border-rose-800/60 bg-rose-950/40 p-3 text-rose-200">
                  {singleAssignError}
                </div>
              )}
              <div>
                <span className="text-zinc-400 block mb-1">Student:</span>
                <span className="text-white font-bold block">{singleAssignStudent.user?.name}</span>
                <span className="text-zinc-500 font-mono block">Roll: {singleAssignStudent.enrollmentNumber}</span>
              </div>

              <div>
                <label htmlFor="assign-credit-amount" className="block text-zinc-300 mb-1">Amount to Add *</label>
                <input
                  id="assign-credit-amount"
                  data-dialog-autofocus
                  required
                  type="number"
                  min={1}
                  value={singleAssignAmount}
                  onChange={(e) => setSingleAssignAmount(Number(e.target.value))}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-white font-mono"
                />
              </div>

              <div>
                <label htmlFor="assign-credit-reason" className="block text-zinc-300 mb-1">Reason *</label>
                <input
                  id="assign-credit-reason"
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
                  disabled={singleAssignLoading}
                  onClick={() => setSingleAssignStudent(null)}
                  className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 rounded-lg text-xs disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={singleAssignLoading}
                  aria-busy={singleAssignLoading}
                  className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold disabled:opacity-50"
                >
                  {singleAssignLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  {singleAssignLoading ? "Granting..." : "Grant Credits"}
                </button>
              </div>
            </form>
        </AccessibleDialog>
      )}

      {/* Student Details Slideout */}
      {selectedStudentDetail && (
        <AccessibleDialog
          titleId="student-details-title"
          onClose={() => setSelectedStudentDetail(null)}
          overlayClassName="justify-end"
          className="w-full max-w-md bg-zinc-950 border-l border-zinc-800 p-4 sm:p-6 flex flex-col justify-between overflow-y-auto space-y-6"
        >
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
                <h3 id="student-details-title" className="text-sm font-bold text-white">Student Cohort Record</h3>
                <button
                  onClick={() => setSelectedStudentDetail(null)}
                  className="text-zinc-500 hover:text-white"
                  aria-label="Close student details"
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-zinc-900/40 rounded-xl border border-zinc-800/80">
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
        </AccessibleDialog>
      )}
    </div>
  );
}
