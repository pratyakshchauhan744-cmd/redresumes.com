import React, { useState, useEffect, useRef, useMemo, type ChangeEvent } from 'react';
import { Download, Layout, Sparkles, User, FileText, CheckCircle, Save, HelpCircle, Briefcase, ChevronRight, PenTool, Type, Move, Plus, X, ArrowUp, ArrowDown, GripVertical, Check, MessageSquare, AlertCircle, Copy, Code, ArrowLeft, LoaderCircle, ClipboardCheck, List, ListOrdered, Lock, AlignLeft } from 'lucide-react';
import QRCode from 'qrcode';
import { Section } from '../components/Section';
import { PrimaryButton, SecondaryButton } from '../components/Buttons';
import { TemplatePreviewScaler } from '../components/TemplatePreviewScaler';
import { TemplateVisualPreview } from '../components/TemplateVisualPreview';
import { backendApi, type AtsScoreResponse, type AuthUser, type ImproveResumeResponse } from '../lib/backendApi';
import { RESUME_DRAFT_STORAGE_KEY, RESUME_HISTORY_STORAGE_KEY, buildUserScopedStorageKey, getStoredAccessToken } from '../lib/auth';
import { templates, templatePreviewThemeById } from '../data/templates';
import { resumeExamplePresets } from '../data/resumeExamples';
import { premiumFeatures } from '../data/premiumFeatures';
import { generateResumeDocx } from '../lib/docxExport';
import { downloadResumePdfFromHtml } from '../lib/resumePdfDownload';
import { getEmailHref, getWebsiteHref } from '../lib/resumeLinks';
import type { PremiumFeatureItem, TemplateItem, TemplateResumeData, ExperienceItem, CustomColumnItem, EducationItem, ResumeListStyle } from '../types';
import { useLocation, Link } from 'react-router-dom';

const MAX_RESUME_HISTORY_ITEMS = 50;
const LOCAL_PUBLIC_RESUMES_STORAGE_KEY = 'redresumes_local_public_resumes';
const DEFAULT_JOB_DESCRIPTION = 'Looking for a Senior Product Manager with experience in product analytics, SQL, roadmap ownership, stakeholder management, and experimentation.';
const cleanListLine = (line: string) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim();
const sanitizePhoneNumber = (value: string): string => value.replace(/\D/g, '').slice(0, 10);

const getEffectiveListStyle = (text: string, globalStyle: string): 'bullet' | 'number' | 'paragraph' => {
  if (!text) return 'paragraph';
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return 'paragraph';

  const listMarkerRegex = /^\s*(?:[-*•]|\d+[.)])/;
  const hasAnyListMarker = lines.some(line => listMarkerRegex.test(line));
  
  if (!hasAnyListMarker) {
    return 'paragraph';
  }

  const numberMarkerRegex = /^\s*\d+[.)]/;
  const hasNumberMarker = lines.some(line => numberMarkerRegex.test(line));
  if (hasNumberMarker) {
    return 'number';
  }

  return (globalStyle === 'number' || globalStyle === 'bullet') ? (globalStyle as 'number' | 'bullet') : 'bullet';
};

const ATS_STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'can',
  'for',
  'from',
  'has',
  'have',
  'in',
  'is',
  'it',
  'of',
  'on',
  'or',
  'our',
  'senior',
  'should',
  'that',
  'the',
  'their',
  'this',
  'to',
  'with',
  'you',
  'your',
  'looking',
  'look',
  'experience',
  'experienced',
  'role',
  'job',
  'work',
  'candidate',
  'manager',
]);

const ATS_ALLOWED_SINGLE_KEYWORDS = new Set([
  'sql',
  'python',
  'java',
  'react',
  'node.js',
  'node',
  'aws',
  'azure',
  'gcp',
  'figma',
  'jira',
  'crm',
  'erp',
  'saas',
  'kpi',
  'apis',
  'api',
  'experimentation',
  'analytics',
]);

const normalizeAtsKeyword = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^\w+#.\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const toSkillLabel = (keyword: string): string =>
  keyword
    .split(/\s+/)
    .map((part) => {
      const lower = part.toLowerCase();
      if (['sql', 'api', 'apis', 'aws', 'gcp', 'crm', 'erp', 'saas', 'kpi'].includes(lower)) {
        return lower.toUpperCase();
      }
      if (lower === 'node.js') return 'Node.js';
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(' ');

const cleanAtsKeywordWord = (word: string): string =>
  word.replace(/^[^a-z0-9+#]+|[^a-z0-9+#]+$/gi, '');

const extractAtsKeywords = (text: string, maxKeywords = 14): string[] => {
  const seen = new Set<string>();
  const addKeyword = (rawValue: string, results: string[]) => {
    const cleaned = normalizeAtsKeyword(rawValue)
      .replace(/^.*\b(?:experience|experienced|expertise|knowledge|skills?)\s+(?:in|with|of)\s+/i, '')
      .replace(/^(?:looking|seeking|hiring|need|needs|required|requires)\s+(?:for\s+)?/i, '')
      .replace(/^(?:a|an|the)\s+/i, '')
      .trim();
    const words = cleaned.split(/\s+/).map(cleanAtsKeywordWord).filter(Boolean);
    const meaningfulWords = words.filter((word) => !ATS_STOP_WORDS.has(word));

    if (meaningfulWords.length === 0 || meaningfulWords.length > 4) return;
    if (meaningfulWords.length === 1) {
      const [single] = meaningfulWords;
      if (!ATS_ALLOWED_SINGLE_KEYWORDS.has(single) && !/^[a-z+#.]*\d[a-z0-9+#.]*$/.test(single)) return;
    }

    const normalized = meaningfulWords.join(' ');
    if (seen.has(normalized)) return;
    seen.add(normalized);
    results.push(toSkillLabel(normalized));
  };

  const results: string[] = [];
  text
    .split(/[,;•\n]+|(?:\s+and\s+)/i)
    .forEach((chunk) => addKeyword(chunk, results));

  if (results.length < maxKeywords) {
    const tokens = normalizeAtsKeyword(text)
      .split(/\s+/)
      .filter((token) => token && !ATS_STOP_WORDS.has(token));
    for (const token of tokens) {
      addKeyword(token, results);
      if (results.length >= maxKeywords) break;
    }
  }

  return results.slice(0, maxKeywords);
};

export const ResumeBuilderPage = ({
  selectedTemplate,
  selectedExample,
  onSelectTemplate,
  currentUser,
}: {
  selectedTemplate: TemplateItem;
  selectedExample: string | null;
  onSelectTemplate: (template: TemplateItem) => void;
  currentUser: AuthUser | null;
}) => {
  const locationRoute = useLocation();
  const routeTemplateId = useMemo(() => new URLSearchParams(locationRoute.search).get('template'), [locationRoute.search]);
  interface ExperienceItem {
    title: string;
    dates: string;
    bullets: string;
  }

  interface CustomColumnItem {
    id: string;
    title: string;
    content: string;
  }

  interface ResumeHistorySnapshot {
    fullName: string;
    jobTitle: string;
    email: string;
    phone: string;
    location: string;
    profileLink: string;
    importantDate: string;
    importantPlace: string;
    summary: string;
    experiences: ExperienceItem[];
    skillsInput: string;
    educationItems?: EducationItem[];
    educationDegree: string;
    educationSchool: string;
    educationYear: string;
    projectsInput: string;
    certificationsInput: string;
    languagesInput: string;
    hobbiesInput: string;
    achievementsInput: string;
    volunteerInput: string;
    customColumns: CustomColumnItem[];
    jobDescriptionInput?: string;
    selectedTemplateId: string;
    selectedTemplateName: string;
    listStyle?: ResumeListStyle;
  }

  interface ResumeHistoryEntry {
    id: string;
    savedAt: string;
    note: string;
    snapshot: ResumeHistorySnapshot;
  }

  const sectionItems = [
    { id: 'contact', label: 'Contact' },
    { id: 'photo', label: 'Photo' },
    { id: 'date-place', label: 'Date & Place' },
    { id: 'summary', label: 'Summary' },
    { id: 'experience', label: 'Experience' },
    { id: 'education', label: 'Education' },
    { id: 'skills', label: 'Skills' },
    { id: 'projects', label: 'Projects' },
    { id: 'certifications', label: 'Certifications' },
    { id: 'languages', label: 'Languages' },
    { id: 'hobbies', label: 'Hobbies' },
    { id: 'achievements', label: 'Achievements' },
    { id: 'volunteer', label: 'Volunteer' },
    { id: 'custom-columns', label: 'Custom Columns' },
  ] as const;
  type SectionId = (typeof sectionItems)[number]['id'];
  const printableSectionIds: SectionId[] = [
    'summary',
    'experience',
    'skills',
    'education',
    'projects',
    'certifications',
    'languages',
    'hobbies',
    'achievements',
    'volunteer',
    'custom-columns',
  ];

  const [activeSection, setActiveSection] = useState<SectionId>('contact');
  const [sectionSelectionOrder, setSectionSelectionOrder] = useState<SectionId[]>([...printableSectionIds]);
  const [fullName, setFullName] = useState('Alex Morgan');
  const [jobTitle, setJobTitle] = useState(selectedExample || 'Senior Product Manager');
  const [email, setEmail] = useState('alexmorgan@email.com');
  const [phone, setPhone] = useState('5551234567');
  const [location, setLocation] = useState('New York, NY');
  const [profileLink, setProfileLink] = useState('linkedin.com/in/alexmorgan');
  const [photoDataUrl, setPhotoDataUrl] = useState('');
  const [importantDate, setImportantDate] = useState('');
  const [importantPlace, setImportantPlace] = useState('');
  const [listStyle, setListStyle] = useState<ResumeListStyle>('bullet');
  const [summary, setSummary] = useState('Product leader with 8+ years of experience building growth-focused digital products, leading cross-functional teams, and improving user conversion through data-driven decisions.');
  const [experiences, setExperiences] = useState<ExperienceItem[]>([
    {
      title: 'Senior Product Manager - Acme Corp',
      dates: 'Jan 2022 - Present',
      bullets: 'Led product roadmap for 2 B2B tools, improving activation by 21%.\nCollaborated with design and engineering to launch 6 major features.\nReduced onboarding friction, cutting support tickets by 34%.',
    },
  ]);
  const [skillsInput, setSkillsInput] = useState('Product Strategy, Analytics, Roadmapping, Leadership, SQL, Stakeholder Management');
  const [educationItems, setEducationItems] = useState<EducationItem[]>([
    { degree: 'B.Tech in Computer Science', school: 'National Institute of Technology', year: '2018 - 2022' },
  ]);
  const educationDegree = educationItems[0]?.degree ?? '';
  const educationSchool = educationItems[0]?.school ?? '';
  const educationYear = educationItems[0]?.year ?? '';
  const [projectsInput, setProjectsInput] = useState('Built a resume scoring tool using React and Node.js.\nCreated an analytics dashboard to track job applications.');
  const [certificationsInput, setCertificationsInput] = useState('Google Data Analytics, AWS Cloud Practitioner');
  const [languagesInput, setLanguagesInput] = useState('English, Hindi');
  const [hobbiesInput, setHobbiesInput] = useState('Reading, Running, Chess');
  const [achievementsInput, setAchievementsInput] = useState('Won hackathon among 120+ teams.\nImproved product conversion by 21% in previous role.');
  const [volunteerInput, setVolunteerInput] = useState('Mentored students in resume writing and interview prep.');
  const [customColumns, setCustomColumns] = useState<CustomColumnItem[]>([]);
  const [newCustomColumnTitle, setNewCustomColumnTitle] = useState('');
  const [newCustomColumnContent, setNewCustomColumnContent] = useState('');
  const [jobDescriptionInput, setJobDescriptionInput] = useState(DEFAULT_JOB_DESCRIPTION);
  const [atsResult, setAtsResult] = useState<AtsScoreResponse | null>(null);
  const [atsLoading, setAtsLoading] = useState(false);
  const [atsError, setAtsError] = useState<string | null>(null);
  const [atsApplyLoading, setAtsApplyLoading] = useState(false);
  const [atsApplyMessage, setAtsApplyMessage] = useState<string | null>(null);
  const [aiImproveResult, setAiImproveResult] = useState<ImproveResumeResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiApplyMessage, setAiApplyMessage] = useState<string | null>(null);
  const [resumeHistory, setResumeHistory] = useState<ResumeHistoryEntry[]>([]);
  const [historyMessage, setHistoryMessage] = useState<string | null>(null);
  const [historySearchTerm, setHistorySearchTerm] = useState('');
  const [historyRoleFilter, setHistoryRoleFilter] = useState('all');
  const [historyDateFilter, setHistoryDateFilter] = useState<'all' | 'today' | '7d' | '30d'>('all');
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [shareLinkCopied, setShareLinkCopied] = useState(false);
  const [premiumActionMessage, setPremiumActionMessage] = useState<string | null>(null);
  const [publishedResumeUrl, setPublishedResumeUrl] = useState('');
  const [premiumActionLoading, setPremiumActionLoading] = useState<PremiumFeatureItem['id'] | null>(null);
  const [pdfDownloadLoading, setPdfDownloadLoading] = useState(false);
  const [highlightedOrderSectionId, setHighlightedOrderSectionId] = useState<SectionId | null>(null);
  const [pendingOrderScrollSectionId, setPendingOrderScrollSectionId] = useState<SectionId | null>(null);
  const [saveStatus, setSaveStatus] = useState<'saving' | 'saved'>('saved');
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [undoStack, setUndoStack] = useState<ResumeHistorySnapshot[]>([]);
  const [redoStack, setRedoStack] = useState<ResumeHistorySnapshot[]>([]);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const sectionOrderListRef = useRef<HTMLDivElement | null>(null);
  const sectionOrderItemRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const lastAutoSaveAtRef = useRef<number>(0);
  const applyFromHistoryRef = useRef(false);
  const selectedTemplateRef = useRef(selectedTemplate);
  const canSaveResumeHistory = Boolean(currentUser);
  const resumeDraftStorageKey = buildUserScopedStorageKey(RESUME_DRAFT_STORAGE_KEY, currentUser?.id);
  const resumeHistoryStorageKey = buildUserScopedStorageKey(RESUME_HISTORY_STORAGE_KEY, currentUser?.id);
  const selectTemplateImmediately = (template: TemplateItem) => {
    selectedTemplateRef.current = template;
    onSelectTemplate(template);
  };
  const getTemplateForDownload = () => {
    const selectedValue = typeof document !== 'undefined'
      ? (document.getElementById('builder-template-select') as HTMLSelectElement | null)?.value
      : undefined;
    const selectedFromDom = selectedValue ? templates.find((template) => template.id === selectedValue) : undefined;
    return selectedFromDom || selectedTemplateRef.current;
  };

  useEffect(() => {
    selectedTemplateRef.current = selectedTemplate;
  }, [selectedTemplate]);

  const normalizeEducationItems = (data: Partial<ResumeHistorySnapshot> | Partial<TemplateResumeData>): EducationItem[] => {
    const items = Array.isArray(data.educationItems) ? data.educationItems : [];
    const normalized = items
      .map((item) => ({
        degree: item.degree ?? '',
        school: item.school ?? '',
        year: item.year ?? '',
      }))
      .filter((item) => item.degree || item.school || item.year);

    if (normalized.length > 0) {
      return normalized;
    }

    return [{
      degree: data.educationDegree ?? '',
      school: data.educationSchool ?? '',
      year: data.educationYear ?? '',
    }];
  };
  const updateEducation = (index: number, key: keyof EducationItem, value: string) => {
    setEducationItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, [key]: value } : item)));
  };
  const setEducationDegree = (value: string) => updateEducation(0, 'degree', value);
  const setEducationSchool = (value: string) => updateEducation(0, 'school', value);
  const setEducationYear = (value: string) => updateEducation(0, 'year', value);

  useEffect(() => {
    if (!selectedExample) return;

    const preset = resumeExamplePresets[selectedExample];
    if (!preset) {
      setJobTitle(selectedExample);
      return;
    }

    const presetTemplate = templates.find((item) => item.id === preset.templateId);
    if (presetTemplate) {
      selectTemplateImmediately(presetTemplate);
    }

    setFullName(preset.fullName);
    setJobTitle(preset.jobTitle);
    setEmail(preset.email);
    setPhone(sanitizePhoneNumber(preset.phone));
    setLocation(preset.location);
    setProfileLink(preset.profileLink);
    setSummary(preset.summary);
    setExperiences(preset.experiences);
    setSkillsInput(preset.skillsInput);
    setEducationItems([{
      degree: preset.educationDegree,
      school: preset.educationSchool,
      year: preset.educationYear,
    }]);
    setProjectsInput(preset.projectsInput);
    setCertificationsInput(preset.certificationsInput);
    setLanguagesInput(preset.languagesInput);
    setAchievementsInput(preset.achievementsInput);
    setVolunteerInput('');
    setHobbiesInput('');
    setCustomColumns([]);
    setNewCustomColumnTitle('');
    setNewCustomColumnContent('');
    setImportantDate('');
    setImportantPlace('');
    setPhotoDataUrl('');
    setActiveSection('contact');
    setHistoryMessage(`Loaded example: ${selectedExample} (${presetTemplate?.name ?? 'template'}).`);
  }, [selectedExample]);

  useEffect(() => {
    if (!routeTemplateId) return;
    const matchedTemplate = templates.find((item) => item.id === routeTemplateId);
    if (matchedTemplate && matchedTemplate.id !== selectedTemplateRef.current.id) {
      selectTemplateImmediately(matchedTemplate);
    }
  }, [routeTemplateId]);

  const buildResumeHistorySnapshot = (): ResumeHistorySnapshot => {
    const snapshotTemplate = selectedTemplateRef.current;

    return {
      fullName,
      jobTitle,
      email,
      phone,
      location,
      profileLink,
      importantDate,
      importantPlace,
      summary,
      experiences,
      skillsInput,
      educationItems,
      educationDegree,
      educationSchool,
      educationYear,
      projectsInput,
      certificationsInput,
      languagesInput,
      hobbiesInput,
      achievementsInput,
      volunteerInput,
      customColumns,
      jobDescriptionInput,
      selectedTemplateId: snapshotTemplate.id,
      selectedTemplateName: snapshotTemplate.name,
      listStyle,
    };
  };

  const persistResumeHistory = (items: ResumeHistoryEntry[]) => {
    if (!canSaveResumeHistory) return;

    try {
      window.localStorage.setItem(resumeHistoryStorageKey, JSON.stringify(items));
    } catch {
      // ignore storage errors
    }
  };

  const saveCurrentResumeToHistory = (note = 'Saved version') => {
    if (!canSaveResumeHistory) {
      setHistoryMessage('Please sign in or create an account to save resume versions.');
      return;
    }

    const snapshot = buildResumeHistorySnapshot();
    const snapshotHash = JSON.stringify(snapshot);

    setResumeHistory((prev) => {
      if (prev[0] && JSON.stringify(prev[0].snapshot) === snapshotHash) {
        return prev;
      }

      const next: ResumeHistoryEntry[] = [
        {
          id: `resume-${Date.now()}`,
          savedAt: new Date().toISOString(),
          note,
          snapshot,
        },
        ...prev,
      ].slice(0, MAX_RESUME_HISTORY_ITEMS);

      persistResumeHistory(next);
      return next;
    });
    setHistoryMessage('Resume version saved to history.');
  };

  const applySnapshotToBuilder = (data: ResumeHistorySnapshot) => {
    applyFromHistoryRef.current = true;
    if (data.selectedTemplateId && data.selectedTemplateId !== selectedTemplateRef.current.id) {
      const templateToRestore = templates.find((tpl) => tpl.id === data.selectedTemplateId);
      if (templateToRestore) {
        selectTemplateImmediately(templateToRestore);
      }
    }

    setFullName(data.fullName);
    setJobTitle(data.jobTitle);
    setEmail(data.email);
    setPhone(sanitizePhoneNumber(data.phone));
    setLocation(data.location);
    setProfileLink(data.profileLink);
    setImportantDate(data.importantDate);
    setImportantPlace(data.importantPlace);
    setSummary(data.summary);
    setExperiences(data.experiences);
    setSkillsInput(data.skillsInput);
    setEducationItems(normalizeEducationItems(data));
    setProjectsInput(data.projectsInput);
    setCertificationsInput(data.certificationsInput);
    setLanguagesInput(data.languagesInput);
    setHobbiesInput(data.hobbiesInput);
    setAchievementsInput(data.achievementsInput);
    setVolunteerInput(data.volunteerInput);
    setCustomColumns(Array.isArray(data.customColumns) ? data.customColumns : []);
    setJobDescriptionInput(data.jobDescriptionInput ?? DEFAULT_JOB_DESCRIPTION);
    setListStyle(data.listStyle === 'number' ? 'number' : data.listStyle === 'paragraph' ? 'paragraph' : 'bullet');
  };

  const restoreResumeFromHistory = (entry: ResumeHistoryEntry) => {
    applySnapshotToBuilder(entry.snapshot);
    setActiveHistoryId(entry.id);
    setHistoryMessage(`Restored version from ${new Date(entry.savedAt).toLocaleString()}.`);
    focusSection('summary');
  };

  const duplicateFromHistory = (entry: ResumeHistoryEntry) => {
    const copy: ResumeHistorySnapshot = {
      ...entry.snapshot,
      fullName: entry.snapshot.fullName ? `${entry.snapshot.fullName} Copy` : 'Resume Copy',
    };
    applySnapshotToBuilder(copy);
    const duplicateEntry: ResumeHistoryEntry = {
      id: `resume-${Date.now()}`,
      savedAt: new Date().toISOString(),
      note: 'Duplicated from history',
      snapshot: copy,
    };

    setResumeHistory((prev) => {
      const next = [duplicateEntry, ...prev].slice(0, MAX_RESUME_HISTORY_ITEMS);
      persistResumeHistory(next);
      return next;
    });
    setActiveHistoryId(duplicateEntry.id);
    setHistoryMessage('Duplicated version as new resume.');
    focusSection('contact');
  };

  const deleteHistoryEntry = (historyId: string) => {
    setResumeHistory((prev) => {
      const next = prev.filter((item) => item.id !== historyId);
      persistResumeHistory(next);
      return next;
    });
  };

  const clearResumeHistory = () => {
    setResumeHistory([]);
    persistResumeHistory([]);
    setActiveHistoryId(null);
    setHistoryMessage('Resume history cleared.');
  };

  const viewHistoryEntry = (entry: ResumeHistoryEntry) => {
    applySnapshotToBuilder(entry.snapshot);
    setActiveHistoryId(entry.id);
    setHistoryMessage(`Viewing version from ${new Date(entry.savedAt).toLocaleString()}.`);
    document.getElementById('builder-live-preview')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    if (!canSaveResumeHistory) {
      setResumeHistory([]);
      setActiveHistoryId(null);
      setHistoryMessage(null);
      return;
    }

    try {
      const raw = window.localStorage.getItem(resumeHistoryStorageKey);
      if (!raw) {
        setResumeHistory([]);
        setActiveHistoryId(null);
        return;
      }
      const parsed = JSON.parse(raw) as ResumeHistoryEntry[];
      if (Array.isArray(parsed)) {
        setResumeHistory(parsed.slice(0, MAX_RESUME_HISTORY_ITEMS));
        setActiveHistoryId(null);
      }
    } catch {
      // ignore parse/storage errors
    }
  }, [canSaveResumeHistory, resumeHistoryStorageKey]);

  const parsedSkills = skillsInput.split(',').map((item) => item.trim()).filter(Boolean);
  const parsedProjects = projectsInput.split('\n').map((item) => item.trim()).filter(Boolean);
  const projectsDisplay = parsedProjects.length <= 1 ? 'paragraph' : 'list';
  const parsedCertifications = certificationsInput.split(',').map((item) => item.trim()).filter(Boolean);
  const parsedLanguages = languagesInput.split(',').map((item) => item.trim()).filter(Boolean);
  const parsedHobbies = hobbiesInput.split(',').map((item) => item.trim()).filter(Boolean);
  const parsedAchievements = achievementsInput.split('\n').map((item) => item.trim()).filter(Boolean);
  const parsedVolunteer = volunteerInput.split('\n').map((item) => item.trim()).filter(Boolean);
  const pendingCustomColumnTitle = newCustomColumnTitle.trim();
  const pendingCustomColumnContent = newCustomColumnContent.trim();
  const effectiveCustomColumns = [
    ...customColumns,
    ...(pendingCustomColumnTitle || pendingCustomColumnContent
      ? [{
          id: 'custom-draft-preview',
          title: pendingCustomColumnTitle || `Custom section ${customColumns.length + 1}`,
          content: pendingCustomColumnContent,
        }]
      : []),
  ];
  const parsedCustomColumns = effectiveCustomColumns
    .map((item) => ({
      ...item,
      title: item.title.trim(),
      lines: item.content
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    }))
    .filter((item) => item.title || item.lines.length > 0);
  const liveTemplateResumeData: TemplateResumeData = useMemo(() => ({
    fullName,
    jobTitle,
    email,
    phone,
    location,
    profileLink,
    summary,
    skills: parsedSkills,
    educationDegree,
    educationSchool,
    educationYear,
    educationItems: educationItems.filter((item) => item.degree.trim() || item.school.trim() || item.year.trim()),
    bullets: experiences.flatMap((exp) =>
      exp.bullets
        .split('\n')
        .map(cleanListLine)
        .filter(Boolean),
    ),
    experiences,
    projects: parsedProjects,
    projectsDisplay,
    certifications: parsedCertifications,
    languages: parsedLanguages,
    hobbies: parsedHobbies,
    achievements: parsedAchievements,
    volunteer: parsedVolunteer,
    customColumns: effectiveCustomColumns,
    listStyle,
    photoDataUrl,
  }), [
    fullName,
    jobTitle,
    email,
    phone,
    location,
    profileLink,
    summary,
    skillsInput,
    educationItems,
    educationDegree,
    educationSchool,
    educationYear,
    experiences,
    projectsInput,
    certificationsInput,
    languagesInput,
    hobbiesInput,
    achievementsInput,
    volunteerInput,
    customColumns,
    newCustomColumnTitle,
    newCustomColumnContent,
    listStyle,
    photoDataUrl,
  ]);
  const datePlaceText = [
    importantDate.trim() ? `Date: ${importantDate.trim()}` : '',
    importantPlace.trim() ? `Place: ${importantPlace.trim()}` : '',
  ]
    .filter(Boolean)
    .join(' | ');
  const resumeSlug = fullName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'candidate';
  const getResumePdfFileName = (template: TemplateItem) => `${resumeSlug}-${template.id}-resume.pdf`;
  const appOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://redresumescom.vercel.app';
  const [showLoginModal, setShowLoginModal] = useState(false);
  const isLoggedIn = Boolean(currentUser);

  const templateFontById: Record<string, string> = {
    minimal: 'Georgia, serif',
    academic: 'Georgia, serif',
    finance: 'Georgia, serif',
  };
  const getTemplateTheme = (templateId: string) => {
    const previewTheme = templatePreviewThemeById[templateId] || templatePreviewThemeById.professional;
    return {
      accent: previewTheme.accent,
      headingBg: previewTheme.headerBg,
      font: templateFontById[templateId] || 'Inter, Arial, sans-serif',
      layout: previewTheme.twoColumn ? 'two-column' as const : 'single' as const,
    };
  };
  const currentTheme = getTemplateTheme(selectedTemplate.id);
  const orderedPrintableSections = useMemo(
    () => [
      ...sectionSelectionOrder.filter((id) => printableSectionIds.includes(id)),
      ...printableSectionIds.filter((id) => !sectionSelectionOrder.includes(id)),
    ],
    [sectionSelectionOrder],
  );
  const printableSectionLabel: Record<SectionId, string> = {
    contact: 'Contact',
    photo: 'Photo',
    'date-place': 'Date & Place',
    summary: 'Summary',
    experience: 'Experience',
    skills: 'Skills',
    education: 'Education',
    projects: 'Projects',
    certifications: 'Certifications',
    languages: 'Languages',
    hobbies: 'Hobbies',
    achievements: 'Achievements',
    volunteer: 'Volunteer',
    'custom-columns': 'Custom Columns',
  };
  const historyRoleOptions = Array.from(
    new Set(resumeHistory.map((item) => item.snapshot.jobTitle.trim()).filter(Boolean))
  ) as string[];
  historyRoleOptions.sort((a, b) => a.localeCompare(b));

  const filteredResumeHistory = resumeHistory.filter((entry) => {
    const search = historySearchTerm.trim().toLowerCase();
    const searchable = `${entry.snapshot.fullName} ${entry.snapshot.jobTitle} ${entry.note}`.toLowerCase();
    const matchesSearch = !search || searchable.includes(search);
    const matchesRole = historyRoleFilter === 'all' || entry.snapshot.jobTitle === historyRoleFilter;

    const entryDateMs = new Date(entry.savedAt).getTime();
    const now = Date.now();
    const matchesDate =
      historyDateFilter === 'all' ||
      (historyDateFilter === 'today' && now - entryDateMs <= 1000 * 60 * 60 * 24) ||
      (historyDateFilter === '7d' && now - entryDateMs <= 1000 * 60 * 60 * 24 * 7) ||
      (historyDateFilter === '30d' && now - entryDateMs <= 1000 * 60 * 60 * 24 * 30);

    return matchesSearch && matchesRole && matchesDate;
  });
  const isHistoryErrorMessage = (message: string): boolean => {
    const lower = message.toLowerCase();
    return (
      lower.includes('unable') ||
      lower.includes('could not') ||
      lower.includes('failed') ||
      lower.includes('error') ||
      lower.includes('please sign in')
    );
  };

  const currentBuilderSnapshot = useMemo(
    () => buildResumeHistorySnapshot(),
    [
      fullName,
      jobTitle,
      email,
      phone,
      location,
      profileLink,
      importantDate,
      importantPlace,
      summary,
      experiences,
      skillsInput,
      educationDegree,
      educationSchool,
      educationYear,
      educationItems,
      projectsInput,
      certificationsInput,
      languagesInput,
      hobbiesInput,
      achievementsInput,
      volunteerInput,
      customColumns,
      jobDescriptionInput,
      listStyle,
      selectedTemplate.id,
      selectedTemplate.name,
    ],
  );
  const currentBuilderSnapshotHash = useMemo(
    () => JSON.stringify(currentBuilderSnapshot),
    [currentBuilderSnapshot],
  );

  useEffect(() => {
    setPublishedResumeUrl('');
    setShareLinkCopied(false);
  }, [currentBuilderSnapshotHash]);

  useEffect(() => {
    try {
      const rawDraft = window.localStorage.getItem(resumeDraftStorageKey);
      if (rawDraft) {
        const parsed = JSON.parse(rawDraft) as ResumeHistorySnapshot;
        if (parsed && typeof parsed === 'object') {
          const routeTemplate = routeTemplateId ? templates.find((template) => template.id === routeTemplateId) : undefined;
          applySnapshotToBuilder({
            ...parsed,
            experiences: Array.isArray(parsed.experiences) ? parsed.experiences : [],
            customColumns: Array.isArray(parsed.customColumns) ? parsed.customColumns : [],
            selectedTemplateId: routeTemplate?.id ?? parsed.selectedTemplateId,
            selectedTemplateName: routeTemplate?.name ?? parsed.selectedTemplateName,
          });
          setHistoryMessage('Restored your locally saved draft.');
        }
      }
    } catch {
      // ignore corrupt or unavailable draft storage
    } finally {
      setDraftHydrated(true);
    }
  }, [resumeDraftStorageKey]);

  const handleUndo = () => {
    setUndoStack((prev) => {
      if (prev.length <= 1) return prev;
      const next = [...prev];
      const current = next.pop()!;
      const previous = next[next.length - 1];
      applySnapshotToBuilder(previous);
      setRedoStack((redoPrev) => [...redoPrev.slice(-79), current]);
      return next;
    });
  };

  const handleRedo = () => {
    setRedoStack((prev) => {
      if (!prev.length) return prev;
      const next = [...prev];
      const snapshot = next.pop()!;
      applySnapshotToBuilder(snapshot);
      setUndoStack((undoPrev) => [...undoPrev.slice(-79), snapshot]);
      return next;
    });
  };

  useEffect(() => {
    if (undoStack.length === 0) {
      setUndoStack([currentBuilderSnapshot]);
    }
  }, [undoStack.length, currentBuilderSnapshot]);

  useEffect(() => {
    if (!draftHydrated) {
      return;
    }

    if (applyFromHistoryRef.current) {
      applyFromHistoryRef.current = false;
    }

    setSaveStatus('saving');
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(resumeDraftStorageKey, currentBuilderSnapshotHash);
      } catch {
        // ignore storage errors
      }

      setUndoStack((prev) => {
        const last = prev[prev.length - 1];
        if (last && JSON.stringify(last) === currentBuilderSnapshotHash) {
          return prev;
        }
        return [...prev.slice(-79), currentBuilderSnapshot];
      });
      setRedoStack([]);
      setLastSavedAt(Date.now());
      setSaveStatus('saved');
    }, 380);

    return () => window.clearTimeout(timer);
  }, [currentBuilderSnapshot, currentBuilderSnapshotHash, draftHydrated, resumeDraftStorageKey]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.altKey) return;
      const key = event.key.toLowerCase();

      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        handleUndo();
      } else if (key === 'y' || (key === 'z' && event.shiftKey)) {
        event.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undoStack, redoStack]);

  const focusSection = (id: SectionId) => {
    setActiveSection(id);
    document.getElementById(`builder-section-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (printableSectionIds.includes(id)) {
      setHighlightedOrderSectionId(id);
      setPendingOrderScrollSectionId(id);
      window.setTimeout(() => {
        setHighlightedOrderSectionId((prev) => (prev === id ? null : prev));
      }, 2400);
    }
  };

  useEffect(() => {
    if (!pendingOrderScrollSectionId) return;
    const item = sectionOrderItemRefs.current[pendingOrderScrollSectionId];
    if (item) {
      item.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    const timer = window.setTimeout(() => setPendingOrderScrollSectionId(null), 250);
    return () => window.clearTimeout(timer);
  }, [pendingOrderScrollSectionId, orderedPrintableSections]);

  const movePrintableSection = (sectionId: SectionId, direction: 'up' | 'down') => {
    setSectionSelectionOrder((prev) => {
      const currentIndex = prev.indexOf(sectionId);
      if (currentIndex < 0) return prev;
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) return prev;
      const updated = [...prev];
      const [item] = updated.splice(currentIndex, 1);
      updated.splice(targetIndex, 0, item);
      return updated;
    });
  };

  const resetPrintableSectionOrder = () => {
    setSectionSelectionOrder([...printableSectionIds]);
  };

  useEffect(() => {
    if (!canSaveResumeHistory) {
      return;
    }

    const timer = window.setTimeout(() => {
      const now = Date.now();
      if (now - lastAutoSaveAtRef.current < 12000) {
        return;
      }

      const snapshotHash = JSON.stringify(buildResumeHistorySnapshot());
      if (resumeHistory[0] && JSON.stringify(resumeHistory[0].snapshot) === snapshotHash) {
        return;
      }

      lastAutoSaveAtRef.current = now;
      saveCurrentResumeToHistory('Auto-saved draft');
    }, 1500);

    return () => window.clearTimeout(timer);
  }, [
    fullName,
    jobTitle,
    email,
    phone,
    location,
    profileLink,
    importantDate,
    importantPlace,
    summary,
    experiences,
    skillsInput,
    educationDegree,
    educationSchool,
    educationYear,
    educationItems,
    projectsInput,
    certificationsInput,
    languagesInput,
    hobbiesInput,
    achievementsInput,
    volunteerInput,
    customColumns,
    selectedTemplate.id,
    selectedTemplate.name,
    resumeHistory,
    canSaveResumeHistory,
  ]);

  const updateExperience = (index: number, key: keyof ExperienceItem, value: string) => {
    setExperiences((prev) => prev.map((item, idx) => (idx === index ? { ...item, [key]: value } : item)));
  };

  const addAnotherExperience = () => {
    setExperiences((prev) => [...prev, { title: '', dates: '', bullets: '' }]);
  };

  const duplicateExperienceSection = () => {
    setExperiences((prev) => {
      const source = prev[prev.length - 1] || { title: '', dates: '', bullets: '' };
      return [...prev, { ...source }];
    });
  };

  const removeExperience = (index: number) => {
    setExperiences((prev) => {
      const next = prev.filter((_, idx) => idx !== index);
      return next.length > 0 ? next : [{ title: '', dates: '', bullets: '' }];
    });
  };

  const addAnotherEducation = () => {
    setEducationItems((prev) => [...prev, { degree: '', school: '', year: '' }]);
  };

  const duplicateEducationSection = () => {
    setEducationItems((prev) => {
      const source = prev[prev.length - 1] || { degree: '', school: '', year: '' };
      return [...prev, { ...source }];
    });
  };

  const removeEducation = (index: number) => {
    setEducationItems((prev) => {
      const next = prev.filter((_, idx) => idx !== index);
      return next.length > 0 ? next : [{ degree: '', school: '', year: '' }];
    });
  };

  const addCustomColumn = () => {
    const title = newCustomColumnTitle.trim();
    const content = newCustomColumnContent.trim();
    if (!title && !content) {
      return;
    }

    setCustomColumns((prev) => [
      ...prev,
      {
        id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        title: title || `Custom section ${prev.length + 1}`,
        content,
      },
    ]);
    setNewCustomColumnTitle('');
    setNewCustomColumnContent('');
    focusSection('custom-columns');
  };

  const updateCustomColumn = (index: number, key: 'title' | 'content', value: string) => {
    setCustomColumns((prev) => prev.map((item, idx) => (idx === index ? { ...item, [key]: value } : item)));
  };

  const moveCustomColumn = (index: number, direction: 'up' | 'down') => {
    setCustomColumns((prev) => {
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= prev.length) {
        return prev;
      }
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item);
      return next;
    });
  };

  const removeCustomColumn = (index: number) => {
    setCustomColumns((prev) => prev.filter((_, idx) => idx !== index));
  };

  const generatePortfolioHtml = () => {
    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const safeName = escapeHtml(fullName || 'Your Name');
    const safeRole = escapeHtml(jobTitle || 'Professional');
    const safeSummary = escapeHtml(summary || 'Add your professional summary from the resume builder.');
    const safeEmail = escapeHtml(email || 'your@email.com');
    const safePhone = escapeHtml(phone || '-');
    const safeLocation = escapeHtml(location || '-');
    const safeProfile = escapeHtml(profileLink || '-');
    const safeDatePlace = escapeHtml(datePlaceText || '');
    const firstEducation = normalizeEducationItems({ educationItems, educationDegree, educationSchool, educationYear })[0];
    const educationSummary = escapeHtml([firstEducation.degree, firstEducation.school].filter(Boolean).join(' - ') || 'Add your education details');
    const educationYears = escapeHtml(firstEducation.year || 'Years not specified');
    const accent = currentTheme.accent;

    const skillChips = (parsedSkills.slice(0, 14).map((skill) => `<span class="chip">${escapeHtml(skill)}</span>`).join(''))
      || '<span class="chip muted">Add skills in builder</span>';
    const languageChips = (parsedLanguages.map((language) => `<span class="chip chip-soft">${escapeHtml(language)}</span>`).join(''))
      || '<span class="chip chip-soft muted">No languages added</span>';
    const hobbyChips = (parsedHobbies.map((hobby) => `<span class="chip chip-soft">${escapeHtml(hobby)}</span>`).join(''))
      || '<span class="chip chip-soft muted">No hobbies added</span>';
    const certList = (parsedCertifications.map((cert) => `<li>${escapeHtml(cert)}</li>`).join('')) || '<li>No certifications added</li>';

    const projectsMarkup = parsedProjects.slice(0, 6).map((project, index) => `
      <article class="glass card">
        <p class="eyebrow">Project ${index + 1}</p>
        <h3>${escapeHtml(project.split(' ').slice(0, 7).join(' ') || `Project ${index + 1}`)}</h3>
        <p>${escapeHtml(project)}</p>
      </article>
    `).join('') || `
      <article class="glass card">
        <p class="eyebrow">Project</p>
        <h3>Add your featured projects</h3>
        <p>Use the Projects section in the resume builder to auto-fill this portfolio area.</p>
      </article>
    `;

    const experienceMarkup = experiences.slice(0, 4).map((exp) => {
      const title = escapeHtml(exp.title || 'Experience title');
      const dates = escapeHtml(exp.dates || 'Dates');
      const bullets = exp.bullets
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 3)
        .map((line) => `<li>${escapeHtml(line)}</li>`)
        .join('') || '<li>Add measurable work impact points.</li>';

      return `
        <article class="timeline-item">
          <div class="dot"></div>
          <div class="timeline-content">
            <h3>${title}</h3>
            <p class="meta">${dates}</p>
            <ul>${bullets}</ul>
          </div>
        </article>
      `;
    }).join('');

    return `
      <html>
        <head>
          <title>${safeName} | Portfolio</title>
          <style>
            :root {
              --accent: ${accent};
              --ink: #0f172a;
              --muted: #475569;
              --line: #d7deea;
              --surface: rgba(255, 255, 255, 0.72);
            }
            html { scroll-behavior: smooth; }
            body {
              margin: 0;
              font-family: Inter, Arial, sans-serif;
              color: var(--ink);
              background: radial-gradient(circle at 10% 0%, rgba(59,130,246,0.14), transparent 28%),
                          radial-gradient(circle at 90% 10%, rgba(236,72,153,0.12), transparent 24%),
                          linear-gradient(145deg, #f8fbff 0%, #f7f7ff 42%, #f8fafc 100%);
            }
            .blob {
              position: fixed;
              width: 280px;
              height: 280px;
              border-radius: 999px;
              filter: blur(36px);
              opacity: 0.22;
              z-index: 0;
              pointer-events: none;
            }
            .blob.one { top: 20px; left: -60px; background: #0ea5e9; }
            .blob.two { right: -70px; top: 190px; background: #f43f5e; }
            .blob.three { left: 40%; bottom: -80px; background: #8b5cf6; }
            .wrap {
              position: relative;
              z-index: 1;
              max-width: 1080px;
              margin: 0 auto;
              padding: 26px 22px 70px;
            }
            .glass {
              background: var(--surface);
              backdrop-filter: blur(8px);
              border: 1px solid rgba(255, 255, 255, 0.9);
              box-shadow: 0 14px 50px rgba(15, 23, 42, 0.08);
            }
            .nav {
              position: sticky;
              top: 16px;
              z-index: 20;
              border-radius: 18px;
              padding: 10px 14px;
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 12px;
              margin-bottom: 16px;
            }
            .logo {
              font-size: 13px;
              font-weight: 800;
              letter-spacing: 0.2em;
              text-transform: uppercase;
              color: #334155;
            }
            .nav-links {
              display: flex;
              gap: 12px;
              flex-wrap: wrap;
            }
            .nav-links a {
              text-decoration: none;
              color: #334155;
              font-size: 13px;
              font-weight: 600;
              padding: 6px 10px;
              border-radius: 999px;
            }
            .nav-links a:hover { background: rgba(148, 163, 184, 0.18); }
            .hero {
              border-radius: 28px;
              padding: 34px 30px;
              margin-top: 8px;
            }
            .hero-grid {
              display: grid;
              grid-template-columns: 1.4fr 0.8fr;
              gap: 20px;
              align-items: center;
            }
            .identity {
              display: flex;
              align-items: center;
              gap: 14px;
            }
            .avatar {
              width: 88px;
              height: 88px;
              border-radius: 18px;
              object-fit: cover;
              border: 1px solid var(--line);
              box-shadow: 0 10px 22px rgba(15, 23, 42, 0.16);
            }
            h1 {
              margin: 0;
              font-size: 44px;
              line-height: 1;
              letter-spacing: -0.03em;
            }
            .role {
              margin-top: 8px;
              color: #334155;
              font-size: 18px;
              font-weight: 600;
            }
            .summary {
              margin-top: 18px;
              line-height: 1.75;
              color: var(--muted);
              max-width: 70ch;
            }
            .meta {
              margin-top: 14px;
              color: #334155;
              font-size: 14px;
              line-height: 1.8;
            }
            .hero-actions {
              display: grid;
              gap: 12px;
            }
            .btn {
              text-decoration: none;
              border-radius: 999px;
              font-size: 14px;
              font-weight: 700;
              padding: 11px 16px;
              text-align: center;
              border: 1px solid transparent;
            }
            .btn-primary {
              background: var(--accent);
              color: white;
            }
            .btn-secondary {
              border-color: var(--line);
              color: #1e293b;
              background: white;
            }
            .stats {
              margin-top: 20px;
              display: grid;
              grid-template-columns: repeat(3, minmax(0, 1fr));
              gap: 12px;
            }
            .stat {
              border-radius: 16px;
              padding: 14px;
              text-align: center;
            }
            .stat strong {
              display: block;
              font-size: 22px;
              letter-spacing: -0.03em;
            }
            .stat span {
              font-size: 12px;
              text-transform: uppercase;
              letter-spacing: 0.12em;
              color: #64748b;
            }
            section { margin-top: 24px; }
            .section-title {
              margin: 0 0 14px;
              font-size: 24px;
              letter-spacing: -0.02em;
            }
            .two-col {
              display: grid;
              gap: 16px;
              grid-template-columns: 1.25fr 0.75fr;
            }
            .card {
              border-radius: 20px;
              padding: 20px;
            }
            .eyebrow {
              margin: 0 0 8px;
              font-size: 11px;
              text-transform: uppercase;
              letter-spacing: 0.16em;
              color: #64748b;
              font-weight: 700;
            }
            .chip-wrap {
              display: flex;
              flex-wrap: wrap;
              gap: 8px;
            }
            .chip {
              display: inline-block;
              border: 1px solid var(--line);
              border-radius: 999px;
              padding: 7px 11px;
              font-size: 12px;
              font-weight: 600;
              background: white;
            }
            .chip-soft { background: rgba(241, 245, 249, 0.9); }
            .chip.muted { color: #94a3b8; }
            ul { margin: 0; padding-left: 18px; color: #334155; line-height: 1.7; }
            .timeline { position: relative; margin-left: 10px; }
            .timeline:before {
              content: "";
              position: absolute;
              top: 6px;
              bottom: 6px;
              left: 8px;
              width: 2px;
              background: linear-gradient(to bottom, var(--accent), #cbd5e1);
            }
            .timeline-item {
              position: relative;
              padding-left: 34px;
              margin-bottom: 18px;
            }
            .dot {
              position: absolute;
              top: 5px;
              left: 2px;
              width: 14px;
              height: 14px;
              border-radius: 999px;
              background: var(--accent);
              box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.95);
            }
            .timeline-content h3 {
              margin: 0;
              font-size: 17px;
              letter-spacing: -0.02em;
            }
            .timeline-content .meta {
              margin: 3px 0 8px;
              color: #64748b;
              font-size: 13px;
            }
            .project-grid {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 14px;
            }
            .project-grid h3 { margin: 0 0 8px; font-size: 18px; letter-spacing: -0.02em; }
            .project-grid p { margin: 0; color: #475569; line-height: 1.65; font-size: 14px; }
            .footer-cta {
              margin-top: 24px;
              border-radius: 22px;
              padding: 22px;
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: 16px;
            }
            .footer-cta h3 {
              margin: 0;
              font-size: 24px;
              letter-spacing: -0.02em;
            }
            .footer-cta p { margin: 6px 0 0; color: #475569; }
            @media (max-width: 900px) {
              .hero-grid { grid-template-columns: 1fr; }
              .stats { grid-template-columns: 1fr; }
              .two-col { grid-template-columns: 1fr; }
              .project-grid { grid-template-columns: 1fr; }
              h1 { font-size: 34px; }
              .footer-cta { flex-direction: column; align-items: flex-start; }
            }
          </style>
        </head>
        <body>
          <div class="blob one"></div>
          <div class="blob two"></div>
          <div class="blob three"></div>
          <div class="wrap">
            <nav class="nav glass">
              <div class="logo">${safeName}</div>
              <div class="nav-links">
                <a href="#Home">Home</a>
                <a href="#Experience">Experience</a>
                <a href="#Educations">Educations</a>
                <a href="#Projects">Projects</a>
                <a href="#Contact">Contact</a>
              </div>
            </nav>

            <section class="hero glass" id="Home">
              <div class="hero-grid">
                <div>
                  <div class="identity">
                    ${photoDataUrl ? `<img class="avatar" src="${escapeHtml(photoDataUrl)}" alt="Profile photo" />` : ''}
                    <div>
                      <h1>${safeName}</h1>
                      <p class="role">${safeRole}</p>
                    </div>
                  </div>
                  <p class="summary">${safeSummary}</p>
                  <p class="meta">${safeEmail} | ${safePhone} | ${safeLocation}</p>
                  <p class="meta">${safeProfile}</p>
                  ${safeDatePlace ? `<p class="meta">${safeDatePlace}</p>` : ''}
                </div>
                <div class="hero-actions">
                  <a class="btn btn-primary" href="mailto:${safeEmail}">Hire Me</a>
                  <a class="btn btn-secondary" href="#Projects">View Projects</a>
                  <a class="btn btn-secondary" href="#Contact">Contact</a>
                </div>
              </div>
              <div class="stats">
                <div class="glass stat"><strong>${parsedSkills.length || 0}</strong><span>Skills</span></div>
                <div class="glass stat"><strong>${experiences.length || 0}</strong><span>Experience Roles</span></div>
                <div class="glass stat"><strong>${parsedProjects.length || 0}</strong><span>Projects</span></div>
              </div>
            </section>

            <section id="Experience">
              <h2 class="section-title">Experience</h2>
              <div class="glass card">
                <div class="timeline">
                  ${experienceMarkup || '<p>No experience added yet.</p>'}
                </div>
              </div>
            </section>

            <section id="Educations">
              <h2 class="section-title">Educations</h2>
              <div class="two-col">
                <article class="glass card">
                  <p class="eyebrow">Education</p>
                  <h3>${educationSummary}</h3>
                  <p class="meta">${educationYears}</p>
                </article>
                <article class="glass card">
                  <p class="eyebrow">Certifications</p>
                  <ul>${certList}</ul>
                </article>
              </div>
            </section>

            <section id="Projects">
              <h2 class="section-title">Featured Projects</h2>
              <div class="project-grid">
                ${projectsMarkup}
              </div>
            </section>

            <section>
              <h2 class="section-title">Skills, Languages and Hobbies</h2>
              <div class="two-col">
                <article class="glass card">
                  <p class="eyebrow">Top Skills</p>
                  <div class="chip-wrap">${skillChips}</div>
                </article>
                <article class="glass card">
                  <p class="eyebrow">Languages</p>
                  <div class="chip-wrap">${languageChips}</div>
                  <p class="eyebrow" style="margin-top:14px;">Hobbies</p>
                  <div class="chip-wrap">${hobbyChips}</div>
                </article>
              </div>
            </section>

            <section class="footer-cta glass" id="Contact">
              <div>
                <h3>Let’s build something impactful</h3>
                <p>Available for roles, freelance work, and collaborations.</p>
              </div>
              <a class="btn btn-primary" href="mailto:${safeEmail}">Email ${safeName}</a>
            </section>
          </div>
        </body>
      </html>
    `;
  };

  const openPortfolioWebsitePreview = () => {
    const popup = window.open('', '_blank', 'width=1100,height=900');
    if (!popup) return;
    popup.document.write(generatePortfolioHtml());
    popup.document.close();
  };

  const downloadPortfolioWebsiteHtml = () => {
    if (!isLoggedIn) {
      setShowLoginModal(true);
      return;
    }
    const html = generatePortfolioHtml();
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${resumeSlug}-portfolio.html`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const handlePremiumFeatureInBuilder = async (featureId: PremiumFeatureItem['id']) => {
    setPremiumActionMessage(null);

    if (featureId === 'portfolio-website-generator') {
      openPortfolioWebsitePreview();
      setPremiumActionMessage('Portfolio website preview opened in a new tab.');
      return;
    }

    const publishCurrentResume = async () => {
      const payload = {
        slug: resumeSlug,
        templateId: selectedTemplate.id,
        resumeData: liveTemplateResumeData,
      };
      const publishLocalResume = () => {
        const id = `local-${resumeSlug}-${Date.now().toString(36)}`;
        const item = {
          id,
          slug: payload.slug,
          templateId: payload.templateId,
          resumeData: payload.resumeData,
          updatedAt: new Date().toISOString(),
        };
        try {
          const raw = window.localStorage.getItem(LOCAL_PUBLIC_RESUMES_STORAGE_KEY);
          const existing = raw ? (JSON.parse(raw) as unknown) : {};
          const records = existing && typeof existing === 'object' && !Array.isArray(existing) ? existing as Record<string, unknown> : {};
          window.localStorage.setItem(LOCAL_PUBLIC_RESUMES_STORAGE_KEY, JSON.stringify({ ...records, [id]: item }));
        } catch {
          throw new Error('Unable to save local resume link. Please enable browser storage or start the backend server.');
        }
        return item;
      };

      let published;
      try {
        published = await backendApi.publishPublicResume(payload);
      } catch (error) {
        const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
        if (!isLocalHost) {
          throw error;
        }
        published = publishLocalResume();
      }
      const url = `${appOrigin}/r/${published.id}`;
      setPublishedResumeUrl(url);
      return url;
    };

    if (featureId === 'resume-shareable-link') {
      setPremiumActionLoading(featureId);
      try {
        const url = await publishCurrentResume();
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(url);
          setShareLinkCopied(true);
          setPremiumActionMessage('Resume published and shareable link copied.');
        } else {
          setShareLinkCopied(false);
          setPremiumActionMessage('Resume published. Copy the live URL from the box below.');
        }
      } catch (error) {
        setShareLinkCopied(false);
        setPremiumActionMessage(error instanceof Error ? error.message : 'Unable to publish resume link. Please try again.');
      } finally {
        setPremiumActionLoading(null);
      }
      return;
    }

    if (featureId === 'qr-code-resume') {
      setPremiumActionLoading(featureId);
      const popup = window.open('', '_blank', 'width=600,height=700');
      if (!popup) {
        setPremiumActionLoading(null);
        setPremiumActionMessage('Allow popups to generate the QR code.');
        return;
      }

      popup.document.write('<p style="font-family: Inter, Arial, sans-serif; padding: 24px;">Publishing resume and generating QR code...</p>');
      try {
        const url = await publishCurrentResume();
        const qrCodeSrc = await QRCode.toDataURL(url, {
          width: 280,
          margin: 2,
          errorCorrectionLevel: 'M',
          color: {
            dark: '#111827',
            light: '#ffffff',
          },
        });

        popup.document.open();
        popup.document.write(`
          <html>
            <head>
              <title>Resume QR Code</title>
              <style>
                body { margin: 0; font-family: Inter, Arial, sans-serif; background: #f8fafc; color: #111827; }
                .wrap { padding: 30px; max-width: 480px; margin: 0 auto; text-align: center; }
                .card { border: 1px solid #e5e7eb; border-radius: 16px; background: white; padding: 24px; box-shadow: 0 20px 50px rgba(15, 23, 42, 0.08); }
                img { border-radius: 12px; border: 1px solid #e5e7eb; }
                p { color: #4b5563; line-height: 1.5; }
                button, a.button { display: inline-flex; margin-top: 14px; border: 0; border-radius: 12px; background: #e11d48; color: white; padding: 10px 14px; font-weight: 700; text-decoration: none; cursor: pointer; }
              </style>
            </head>
            <body>
              <div class="wrap">
                <div class="card">
                  <h2>QR code resume</h2>
                  <p>Scan this QR to open your latest shareable resume.</p>
                  <img src="${qrCodeSrc}" alt="Resume QR code" width="280" height="280" />
                  <p style="margin-top: 14px; word-break: break-all;">${url}</p>
                  <a class="button" href="${qrCodeSrc}" download="${resumeSlug}-resume-qr.png">Download QR PNG</a>
                </div>
              </div>
            </body>
          </html>
        `);
        popup.document.close();
        setPremiumActionMessage('Resume published and QR code generated in a new tab.');
      } catch (error) {
        popup.close();
        setPremiumActionMessage(error instanceof Error ? error.message : 'Unable to generate QR code. Please try again.');
      } finally {
        setPremiumActionLoading(null);
      }
      return;
    }

    setPremiumActionMessage('This premium action is not available right now.');
  };

  const generateResumePdfHtml = (previewMode = false, template = selectedTemplateRef.current) => {
    const pdfTheme = getTemplateTheme(template.id);
    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    const escapeAttribute = escapeHtml;
    const contactEmail = email.trim();
    const contactPhone = phone.trim();
    const contactLocation = location.trim();
    const contactProfile = profileLink.trim();
    const contactItems = [
      contactEmail ? `<a href="${escapeAttribute(getEmailHref(contactEmail))}">${escapeHtml(contactEmail)}</a>` : '',
      contactPhone ? `<span>${escapeHtml(contactPhone)}</span>` : '',
      contactLocation ? `<span>${escapeHtml(contactLocation)}</span>` : '',
    ].filter(Boolean).join(' • ');
    const profileMarkup = contactProfile
      ? `<a href="${escapeAttribute(getWebsiteHref(contactProfile))}">${escapeHtml(contactProfile)}</a>`
      : '';

    const skillsMarkup = parsedSkills.map((skill) => `<span class="tag">${escapeHtml(skill)}</span>`).join('');
    const experienceMarkup = experiences
      .map((item) => {
        const itemStyle = getEffectiveListStyle(item.bullets, listStyle);
        if (itemStyle === 'paragraph') {
          return `
            <article class="exp-item">
              <h3>${escapeHtml(item.title || 'Experience title')}</h3>
              <p class="meta">${escapeHtml(item.dates || 'Dates')}</p>
              <p style="margin-top: 8px; white-space: pre-line; line-height: 1.5; color: var(--ink);">${escapeHtml(item.bullets)}</p>
            </article>
          `;
        }

        const bulletTag = itemStyle === 'number' ? 'ol' : 'ul';
        const bulletMarkup = item.bullets
          .split('\n')
          .map(cleanListLine)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => `<li>${escapeHtml(line)}</li>`)
          .join('');
        return `
          <article class="exp-item">
            <h3>${escapeHtml(item.title || 'Experience title')}</h3>
            <p class="meta">${escapeHtml(item.dates || 'Dates')}</p>
            <${bulletTag}>${bulletMarkup || '<li>Add measurable impact bullets</li>'}</${bulletTag}>
          </article>
        `;
      })
      .join('');
    const projectMarkup = parsedProjects.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
    const projectParagraphMarkup = escapeHtml(parsedProjects.join('\n\n')).replace(/\n/g, '<br />');
    const certificationMarkup = parsedCertifications.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
    const languageMarkup = parsedLanguages.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
    const hobbiesMarkup = parsedHobbies.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
    const achievementMarkup = parsedAchievements.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
    const volunteerMarkup = parsedVolunteer.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
    const customColumnMarkup = parsedCustomColumns
      .map((column, index) => {
        const lines = column.lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('');
        return `
          <section class="section">
            <h2>${escapeHtml(column.title || `Custom section ${index + 1}`)}</h2>
            <ul>${lines}</ul>
          </section>
        `;
      })
      .join('');

    const hasSummary = summary.trim().length > 0;
    const hasExperience = experiences.some((item) => item.title.trim() || item.dates.trim() || item.bullets.trim());
    const hasSkills = parsedSkills.length > 0;
    const activeEducationItems = educationItems.filter((item) => item.degree.trim() || item.school.trim() || item.year.trim());
    const hasEducation = activeEducationItems.length > 0;
    const hasProjects = parsedProjects.length > 0;
    const hasCertifications = parsedCertifications.length > 0;
    const hasLanguages = parsedLanguages.length > 0;
    const hasHobbies = parsedHobbies.length > 0;
    const hasAchievements = parsedAchievements.length > 0;
    const hasVolunteer = parsedVolunteer.length > 0;
    const hasCustomColumns = parsedCustomColumns.length > 0;
    const educationMarkup = activeEducationItems
      .map((item) => {
        const educationHeadline = item.degree.trim() || item.school.trim() || item.year.trim();
        const educationSubline = [item.school.trim(), item.year.trim() ? `(${item.year.trim()})` : ""]
          .filter(Boolean)
          .join(' ');

        return `
          <div class="education-item">
            <p><strong>${escapeHtml(educationHeadline)}</strong></p>
            ${educationSubline ? `<p>${escapeHtml(educationSubline)}</p>` : ''}
          </div>
        `;
      })
      .join('');

    const orderedPrintableSections = [
      ...sectionSelectionOrder.filter((id) => printableSectionIds.includes(id)),
      ...printableSectionIds.filter((id) => !sectionSelectionOrder.includes(id)),
    ];

    const sectionBlockById: Record<SectionId, string> = {
      contact: '',
      photo: '',
      'date-place': '',
      summary: hasSummary ? `
        <section class="section">
          <h2>Summary</h2>
          <p>${escapeHtml(summary)}</p>
        </section>
      ` : '',
      experience: hasExperience ? `
        <section class="section">
          <h2>Experience</h2>
          ${experienceMarkup}
        </section>
      ` : '',
      skills: hasSkills ? `
        <section class="section">
          <h2>Skills</h2>
          <div>${skillsMarkup}</div>
        </section>
      ` : '',
      education: hasEducation ? `
        <section class="section">
          <h2>Education</h2>
          ${educationMarkup}
        </section>
      ` : '',
      projects: hasProjects ? `
        <section class="section">
          <h2>Projects</h2>
          ${projectsDisplay === 'paragraph' ? `<p>${projectParagraphMarkup}</p>` : `<ul>${projectMarkup}</ul>`}
        </section>
      ` : '',
      certifications: hasCertifications ? `
        <section class="section">
          <h2>Certifications</h2>
          <ul>${certificationMarkup}</ul>
        </section>
      ` : '',
      languages: hasLanguages ? `
        <section class="section">
          <h2>Languages</h2>
          <ul>${languageMarkup}</ul>
        </section>
      ` : '',
      hobbies: hasHobbies ? `
        <section class="section">
          <h2>Hobbies</h2>
          <ul>${hobbiesMarkup}</ul>
        </section>
      ` : '',
      achievements: hasAchievements ? `
        <section class="section">
          <h2>Achievements</h2>
          <ul>${achievementMarkup}</ul>
        </section>
      ` : '',
      volunteer: hasVolunteer ? `
        <section class="section">
          <h2>Volunteer</h2>
          <ul>${volunteerMarkup}</ul>
        </section>
      ` : '',
      'custom-columns': hasCustomColumns ? customColumnMarkup : '',
    };

    const singleColumnMarkup = orderedPrintableSections.map((id) => sectionBlockById[id]).filter(Boolean).join('');
    const twoColumnSideIds = new Set<SectionId>(['skills', 'education', 'languages', 'certifications', 'hobbies']);
    const twoColumnSideMarkup = orderedPrintableSections
      .filter((id) => twoColumnSideIds.has(id))
      .map((id) => sectionBlockById[id])
      .filter(Boolean)
      .join('');
    const twoColumnMainMarkup = orderedPrintableSections
      .filter((id) => !twoColumnSideIds.has(id))
      .map((id) => sectionBlockById[id])
      .filter(Boolean)
      .join('');

    const safePdfFileName = escapeHtml(getResumePdfFileName(template));

    return `
      <html>
        <head>
          <title>${safePdfFileName}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
          <style>
            @page { size: A4; margin: 12mm; }
            * { box-sizing: border-box; }
            html { width: 100%; }
            body {
              width: 100%;
              margin: 0;
              color: #111827;
              background: #f8fafc;
              font-family: ${pdfTheme.font};
              line-height: 1.45;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              ${previewMode ? 'overflow: hidden;' : ''}
            }
            .preview-shell { ${previewMode ? 'display: flex; justify-content: center; align-items: flex-start; padding: 8px; height: 100%; overflow: hidden;' : ''} }
            .resume {
              width: 100%;
              max-width: 186mm;
              margin: 0 auto;
              background: #fff;
              border: 1px solid #e5e7eb;
              border-radius: 12px;
              overflow: hidden;
              ${previewMode ? 'transform: scale(0.34); transform-origin: top center;' : ''}
            }
            ${previewMode ? '@media (min-width: 420px) { .resume { transform: scale(0.42); } }' : ''}
            ${previewMode ? '@media (min-width: 560px) { .resume { transform: scale(0.5); } }' : ''}
            ${previewMode ? '@media (min-width: 720px) { .resume { transform: scale(0.58); } }' : ''}
            .header { background: ${pdfTheme.headingBg}; border-bottom: 1px solid #e5e7eb; padding: 18px 20px; }
            .top { display: flex; gap: 11px; align-items: center; }
            .top > div { min-width: 0; }
            .avatar { width: 48px; height: 48px; border-radius: 8px; object-fit: cover; border: 1px solid #d4d4d8; }
            h1 { margin: 0; font-size: 28pt; line-height: 1.02; letter-spacing: -0.02em; overflow-wrap: anywhere; }
            .role { margin: 4px 0 0; font-size: 15pt; font-weight: 700; color: #3f3f46; overflow-wrap: anywhere; }
            .meta { margin: 6px 0 0; color: #52525b; font-size: 10pt; line-height: 1.38; overflow-wrap: anywhere; word-break: break-word; }
            .content { padding: 18px 20px; }
            .content.single { display: block; }
            .content.two { display: grid; grid-template-columns: 0.82fr 1.42fr; gap: 16px; }
            .side { background: ${pdfTheme.headingBg}; border: 1px solid #e5e7eb; border-radius: 8px; padding: 13px; height: fit-content; }
            .main { min-width: 0; }
            .section { margin-bottom: 13px; break-inside: avoid; page-break-inside: avoid; }
            .section h2 { margin: 0 0 7px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.18em; color: ${pdfTheme.accent}; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; }
            .section p { margin: 4px 0; font-size: 12px; line-height: 1.48; color: #374151; overflow-wrap: anywhere; }
            a { color: inherit; text-decoration: none; }
            .meta a { overflow-wrap: anywhere; word-break: break-word; }
            .exp-item { margin-bottom: 10px; break-inside: avoid; page-break-inside: avoid; }
            .exp-item h3 { margin: 0; font-size: 12.5px; line-height: 1.28; color: #111827; }
            ul, ol { margin: 5px 0 0; padding-left: 16px; }
            li { font-size: 11.4px; line-height: 1.43; color: #374151; margin-bottom: 1px; overflow-wrap: anywhere; }
            .tag { display: inline-block; border: 1px solid #d4d4d8; border-radius: 999px; padding: 2px 7px; margin: 0 5px 5px 0; font-size: 10.8px; line-height: 1.35; color: #1f2937; }
            @media print {
              body { background: #fff; }
              .resume { max-width: none; border: none; border-radius: 0; box-shadow: none; }
              .content.two { grid-template-columns: minmax(0, 0.82fr) minmax(0, 1.38fr); }
            }
            @media screen {
              body { padding: 24px; }
            }
          </style>
        </head>
        <body>
          <div class="${previewMode ? 'preview-shell' : ''}">
          <div class="resume" data-template-id="${escapeAttribute(template.id)}">
            <header class="header">
              <div class="top">
                ${photoDataUrl ? `<img class="avatar" src="${escapeHtml(photoDataUrl)}" alt="Profile photo" />` : ''}
                <div>
                  <h1>${escapeHtml(fullName || 'Your Name')}</h1>
                  <p class="role">${escapeHtml(jobTitle || 'Target role')}</p>
                </div>
              </div>
              ${contactItems ? `<p class="meta">${contactItems}</p>` : ''}
              ${profileMarkup ? `<p class="meta">${profileMarkup}</p>` : ''}
              ${datePlaceText ? `<p class="meta">${escapeHtml(datePlaceText)}</p>` : ''}
            </header>
            ${
              pdfTheme.layout === 'two-column'
                ? `<div class="content two"><aside class="side">${twoColumnSideMarkup}</aside><main class="main">${twoColumnMainMarkup}</main></div>`
                : `<div class="content single">${singleColumnMarkup}</div>`
            }
          </div>
          </div>
        </body>
      </html>
    `;
  };

  const downloadResumePdf = async () => {
    if (!isLoggedIn) {
      setShowLoginModal(true);
      return;
    }
    if (pdfDownloadLoading) return;

    setPdfDownloadLoading(true);
    setHistoryMessage(null);
    try {
      const templateForDownload = getTemplateForDownload();
      saveCurrentResumeToHistory('Saved from PDF download');
      await downloadResumePdfFromHtml(generateResumePdfHtml(false, templateForDownload), getResumePdfFileName(templateForDownload));
      setHistoryMessage('Resume PDF downloaded.');
    } catch (error) {
      setHistoryMessage(error instanceof Error ? error.message : 'Unable to generate PDF. Please try again.');
    } finally {
      setPdfDownloadLoading(false);
    }
  };

  const handleDownloadDocx = () => {
    if (!isLoggedIn) {
      setShowLoginModal(true);
      return;
    }
    saveCurrentResumeToHistory('Saved from DOCX download');
    generateResumeDocx({
      fullName,
      jobTitle,
      email,
      phone,
      location,
      profileLink,
      summary,
      skills: parsedSkills,
      educationDegree,
      educationSchool,
      educationYear,
      educationItems: educationItems.filter((item) => item.degree.trim() || item.school.trim() || item.year.trim()),
      bullets: experiences.flatMap(exp => exp.bullets.split('\n').map(b => b.replace(/^-/, '').trim()).filter(Boolean)),
      experiences: experiences,
      projects: parsedProjects,
      projectsDisplay,
      certifications: parsedCertifications,
      languages: parsedLanguages,
      hobbies: parsedHobbies,
      achievements: parsedAchievements,
      volunteer: parsedVolunteer,
      customColumns: customColumns
    });
  };

  const handlePhotoUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setPhotoDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemovePhoto = () => {
    setPhotoDataUrl('');
    if (photoInputRef.current) {
      photoInputRef.current.value = '';
    }
  };

  const buildResumeTextForAi = (): string => {
    const experienceText = experiences
      .map((item) => `${item.title}\n${item.dates}\n${item.bullets}`)
      .join('\n\n');
    const customColumnsText = parsedCustomColumns
      .map((item) => `${item.title}\n${item.lines.join('\n')}`)
      .join('\n\n');

    return [
      `Name: ${fullName}`,
      `Title: ${jobTitle}`,
      `Email: ${email}`,
      `Phone: ${phone}`,
      `Location: ${location}`,
      `Profile: ${profileLink}`,
      '',
      'Summary',
      summary,
      '',
      'Experience',
      experienceText,
      '',
      'Skills',
      parsedSkills.join(', '),
      '',
      'Education',
      educationItems
        .filter((item) => item.degree.trim() || item.school.trim() || item.year.trim())
        .map((item) => `${item.degree} - ${item.school} (${item.year})`)
        .join('\n'),
      '',
      'Projects',
      parsedProjects.join('\n'),
      '',
      'Certifications',
      parsedCertifications.join(', '),
      '',
      'Languages',
      parsedLanguages.join(', '),
      '',
      'Achievements',
      parsedAchievements.join('\n'),
      '',
      'Volunteer',
      parsedVolunteer.join('\n'),
      '',
      customColumnsText,
    ]
      .filter(Boolean)
      .join('\n');
  };

  const buildLocalAtsScore = (resumeText: string, jobDescription: string): AtsScoreResponse => {
    const resumeSearchText = normalizeAtsKeyword(resumeText);
    const rankedKeywords = extractAtsKeywords(jobDescription, 12);
    const matchedKeywords = rankedKeywords.filter((keyword) => {
      const normalizedKeyword = normalizeAtsKeyword(keyword);
      const words = normalizedKeyword.split(/\s+/).filter(Boolean);
      return resumeSearchText.includes(normalizedKeyword) || words.every((word) => resumeSearchText.includes(word));
    });
    const missingKeywords = rankedKeywords.filter((keyword) => !matchedKeywords.includes(keyword));
    const total = Math.max(rankedKeywords.length, 1);
    const score = Math.max(48, Math.min(98, Math.round((matchedKeywords.length / total) * 100)));

    const strengths = [
      matchedKeywords.length ? `Aligned with ${matchedKeywords.length} core job keywords.` : 'Resume content is structured for quick scanning.',
      summary.trim() ? 'Professional summary is present.' : 'Add a summary to improve first-pass screening.',
      experiences.some((item) => /\d/.test(item.bullets)) ? 'Experience bullets include measurable impact.' : 'Add metrics to achievements for stronger ATS relevance.',
    ];

    const improvements = [
      missingKeywords.length ? `Add missing keywords like ${missingKeywords.slice(0, 3).join(', ')}.` : 'Keyword coverage looks strong for this role.',
      experiences[0]?.bullets ? 'Use stronger action verbs in the first experience section.' : 'Add at least one detailed experience section.',
      parsedSkills.length < 6 ? 'Expand the skills section with role-specific tools and competencies.' : 'Keep skills tailored to the target job description.',
    ];

    return {
      score,
      matchedKeywords,
      missingKeywords,
      strengths,
      improvements,
    };
  };

  const buildLocalImproveResume = (focus: 'summary' | 'bullets' | 'full'): ImproveResumeResponse => {
    const localAts = buildLocalAtsScore(buildResumeTextForAi(), jobDescriptionInput);
    const topKeywords = localAts.missingKeywords.slice(0, 4);
    const summaryLead = jobTitle || 'professional';
    const improvedSummary = `Results-driven ${summaryLead} with experience in ${[...parsedSkills.slice(0, 3), ...topKeywords]
      .filter(Boolean)
      .slice(0, 5)
      .join(', ')}, delivering measurable outcomes through cross-functional execution and customer-focused problem solving.`;

    const sourceBullets = experiences[0]?.bullets
      .split('\n')
      .map((line) => line.replace(/^\s*-\s*/, '').trim())
      .filter(Boolean) ?? [];

    const improvedBullets = (sourceBullets.length ? sourceBullets : ['Led cross-functional workstreams to deliver high-impact initiatives on time.'])
      .slice(0, 4)
      .map((bullet, index) => {
        const keyword = topKeywords[index % Math.max(topKeywords.length, 1)];
        const enriched = bullet.replace(/\.$/, '');
        return keyword
          ? `${enriched} while strengthening ${keyword} alignment and measurable business impact.`
          : `${enriched} with clearer ownership, stronger action verbs, and measurable outcomes.`;
      });

    return {
      improvedSummary: focus === 'bullets' ? summary : improvedSummary,
      improvedBullets: focus === 'summary' ? sourceBullets : improvedBullets,
      keywordSuggestions: [...localAts.matchedKeywords, ...topKeywords].slice(0, 8),
      atsTips: localAts.improvements,
    };
  };

  const handleRunAtsChecker = async () => {
    setAtsLoading(true);
    setAtsError(null);
    setAtsApplyMessage(null);
    try {
      const token = getStoredAccessToken();
      if (!token) throw new Error('Sign in required');
      const result = await backendApi.getAtsScore({
        resumeText: buildResumeTextForAi(),
        jobDescription: jobDescriptionInput,
      }, token);
      setAtsResult(result);
    } catch (error) {
      setAtsResult(buildLocalAtsScore(buildResumeTextForAi(), jobDescriptionInput));
      setAtsError(null);
      setAtsApplyMessage('ATS results generated locally in your browser.');
    } finally {
      setAtsLoading(false);
    }
  };

  const handleRunAiImprove = async (focus: 'summary' | 'bullets' | 'full') => {
    setAiLoading(true);
    setAiError(null);
    setAiApplyMessage(null);
    try {
      const token = getStoredAccessToken();
      if (!token) throw new Error('Sign in required');
      const result = await backendApi.improveResume({
        resumeText: buildResumeTextForAi(),
        jobDescription: jobDescriptionInput,
        jobTitle,
        focus,
      }, token);
      setAiImproveResult(result);
    } catch (error) {
      setAiImproveResult(buildLocalImproveResume(focus));
      setAiError(null);
      setAiApplyMessage('AI suggestions generated locally in your browser.');
    } finally {
      setAiLoading(false);
    }
  };

  const addMissingAtsKeywordsToSkills = (): number => {
    if (!atsResult?.missingKeywords?.length) return 0;

    const toAdd = atsResult.missingKeywords
      .slice(0, 8)
      .map((item) => toSkillLabel(normalizeAtsKeyword(item)))
      .filter(Boolean);

    const existing = new Set(parsedSkills.map((item) => item.toLowerCase()));
    const merged = [...parsedSkills];
    let addedCount = 0;
    toAdd.forEach((kw) => {
      if (!existing.has(kw.toLowerCase())) {
        merged.push(kw);
        existing.add(kw.toLowerCase());
        addedCount += 1;
      }
    });

    if (addedCount > 0) {
      setSkillsInput(merged.join(', '));
    }

    return addedCount;
  };

  const applyAtsMissingKeywords = () => {
    if (!atsResult?.missingKeywords?.length) {
      setAtsApplyMessage('No missing keywords to add.');
      return;
    }

    const addedCount = addMissingAtsKeywordsToSkills();
    setAtsApplyMessage(addedCount ? `Added ${addedCount} missing keyword(s) to Skills.` : 'No new keywords to add.');
    focusSection('skills');
  };

  const applyAllAtsFixes = async () => {
    if (!atsResult) {
      setAtsApplyMessage('Run ATS check first.');
      return;
    }

    setAtsApplyLoading(true);
    setAtsError(null);
    setAtsApplyMessage(null);
    try {
      const addedCount = addMissingAtsKeywordsToSkills();
      const token = getStoredAccessToken();
      if (!token) throw new Error('Sign in required');

      const result = await backendApi.improveResume({
        resumeText: buildResumeTextForAi(),
        jobDescription: jobDescriptionInput,
        jobTitle,
        focus: 'full',
      }, token);

      setAiImproveResult(result);
      if (result.improvedSummary?.trim()) {
        setSummary(result.improvedSummary.trim());
      }

      if (result.improvedBullets?.length) {
        setExperiences((prev) => {
          if (!prev.length) {
            return [{ title: '', dates: '', bullets: result.improvedBullets.map((line) => `- ${line}`).join('\n') }];
          }
          const updated = [...prev];
          updated[0] = {
            ...updated[0],
            bullets: result.improvedBullets.map((line) => `- ${line}`).join('\n'),
          };
          return updated;
        });
      }

      setAtsApplyMessage(
        `Applied all ATS fixes: ${addedCount} keyword(s) added, summary improved, and first experience bullets strengthened.`
      );
      focusSection('summary');
    } catch (error) {
      const addedCount = addMissingAtsKeywordsToSkills();
      const result = buildLocalImproveResume('full');
      setAiImproveResult(result);
      if (result.improvedSummary?.trim()) {
        setSummary(result.improvedSummary.trim());
      }
      if (result.improvedBullets?.length) {
        setExperiences((prev) => {
          if (!prev.length) {
            return [{ title: '', dates: '', bullets: result.improvedBullets.map((line) => `- ${line}`).join('\n') }];
          }
          const updated = [...prev];
          updated[0] = {
            ...updated[0],
            bullets: result.improvedBullets.map((line) => `- ${line}`).join('\n'),
          };
          return updated;
        });
      }
      setAtsError(null);
      setAtsApplyMessage(`Applied all ATS fixes locally: ${addedCount} keyword(s) added.`);
    } finally {
      setAtsApplyLoading(false);
    }
  };

  const applyAtsStrongerBullets = async () => {
    setAtsApplyLoading(true);
    setAtsError(null);
    setAtsApplyMessage(null);
    try {
      const token = getStoredAccessToken();
      if (!token) throw new Error('Sign in required');
      const result = await backendApi.improveResume({
        resumeText: buildResumeTextForAi(),
        jobDescription: jobDescriptionInput,
        jobTitle,
        focus: 'bullets',
      }, token);

      setAiImproveResult(result);
      if (!result.improvedBullets?.length) {
        setAtsApplyMessage('No stronger bullets were generated.');
        return;
      }

      setExperiences((prev) => {
        if (!prev.length) {
          return [{ title: '', dates: '', bullets: result.improvedBullets.map((line) => `- ${line}`).join('\n') }];
        }
        const updated = [...prev];
        updated[0] = {
          ...updated[0],
          bullets: result.improvedBullets.map((line) => `- ${line}`).join('\n'),
        };
        return updated;
      });

      setAtsApplyMessage('First experience bullets upgraded with stronger action verbs and outcomes.');
      focusSection('experience');
    } catch (error) {
      const result = buildLocalImproveResume('bullets');
      setAiImproveResult(result);
      if (!result.improvedBullets?.length) {
        setAtsApplyMessage('No stronger bullets were generated.');
        return;
      }

      setExperiences((prev) => {
        if (!prev.length) {
          return [{ title: '', dates: '', bullets: result.improvedBullets.map((line) => `- ${line}`).join('\n') }];
        }
        const updated = [...prev];
        updated[0] = {
          ...updated[0],
          bullets: result.improvedBullets.map((line) => `- ${line}`).join('\n'),
        };
        return updated;
      });

      setAtsError(null);
      setAtsApplyMessage('Strengthened bullets locally in your browser.');
    } finally {
      setAtsApplyLoading(false);
    }
  };

  const applyAiSummary = () => {
    if (!aiImproveResult?.improvedSummary) return;
    setSummary(aiImproveResult.improvedSummary);
    setAiApplyMessage('Applied to Professional Summary section.');
    focusSection('summary');
  };

  const applyAiBullets = () => {
    if (!aiImproveResult?.improvedBullets?.length) return;
    setExperiences((prev) => {
      if (!prev.length) {
        return [{ title: '', dates: '', bullets: aiImproveResult.improvedBullets.map((line) => `- ${line}`).join('\n') }];
      }

      const updated = [...prev];
      const first = updated[0];
      updated[0] = {
        ...first,
        bullets: aiImproveResult.improvedBullets.map((line) => `- ${line}`).join('\n'),
      };
      return updated;
    });
    setAiApplyMessage('Applied to first Experience section.');
    focusSection('experience');
  };

  const [parseLoading, setParseLoading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const parseInputRef = useRef<HTMLInputElement>(null);

  const handleUploadResume = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    setParseLoading(true);
    setParseError(null);
    try {
      const token = getStoredAccessToken();
      if (!token) throw new Error('Please sign in to use AI resume parsing.');
      const data = await backendApi.parseResume(file, token);
      
      saveCurrentResumeToHistory('Saved before AI parse override');
      
      if (data.fullName) setFullName(data.fullName);
      if (data.jobTitle) setJobTitle(data.jobTitle);
      if (data.email) setEmail(data.email);
      if (data.phone) setPhone(sanitizePhoneNumber(data.phone));
      if (data.location) setLocation(data.location);
      if (data.profileLink) setProfileLink(data.profileLink);
      if (data.summary) setSummary(data.summary);
      if (data.skills && Array.isArray(data.skills)) setSkillsInput(data.skills.join(', '));
      if (data.educationDegree) setEducationDegree(data.educationDegree);
      if (data.educationSchool) setEducationSchool(data.educationSchool);
      if (data.educationYear) setEducationYear(data.educationYear);
      
      if (data.experiences && Array.isArray(data.experiences) && data.experiences.length > 0) {
        setExperiences(data.experiences.map((exp: any) => ({
          title: exp.title || '',
          dates: exp.dates || '',
          bullets: Array.isArray(exp.bullets) ? exp.bullets.map((b: string) => `- ${b}`).join('\n') : (exp.bullets || '')
        })));
      }
      
      if (data.projects && Array.isArray(data.projects)) setProjectsInput(data.projects.join('\n'));
      if (data.certifications && Array.isArray(data.certifications)) setCertificationsInput(data.certifications.join(', '));
      if (data.languages && Array.isArray(data.languages)) setLanguagesInput(data.languages.join(', '));
      if (data.achievements && Array.isArray(data.achievements)) setAchievementsInput(data.achievements.join('\n'));
      if (data.volunteer && Array.isArray(data.volunteer)) setVolunteerInput(data.volunteer.join('\n'));
      
    } catch (err: any) {
      setParseError(err.message || 'Failed to parse resume');
    } finally {
      setParseLoading(false);
      if (parseInputRef.current) {
        parseInputRef.current.value = '';
      }
    }
  };

  return (
    <>
      <div className="overflow-x-clip bg-white">
      <div className="mx-auto w-full max-w-7xl min-w-0 px-4 py-8 sm:px-6 md:py-12">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-[0.68rem] font-semibold uppercase tracking-[0.18em] text-zinc-400 md:text-xs md:tracking-[0.2em]">Resume Builder</p>
            <h1 className="mt-2 text-3xl font-extrabold leading-tight text-zinc-900 md:text-4xl">Build your resume</h1>
            {selectedExample && (
              <div className="mt-3 inline-flex items-center gap-2 text-xs font-semibold text-primary bg-primary/5 px-3 py-1 rounded-full">
                Viewing example: {selectedExample}
              </div>
            )}
          </div>
          <div className="grid gap-2 sm:hidden">
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={downloadResumePdf}
                disabled={pdfDownloadLoading}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {pdfDownloadLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                {pdfDownloadLoading ? 'Downloading' : 'Download PDF'}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => saveCurrentResumeToHistory('Manual save')}
                className="rounded-full border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-900 transition hover:border-zinc-900"
              >
                Save
              </button>
              <button
                onClick={() => parseInputRef.current?.click()}
                disabled={parseLoading}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/10 disabled:opacity-50"
              >
                {parseLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                {parseLoading ? 'Parsing' : 'Auto-fill'}
              </button>
            </div>
            <details className="rounded-2xl border border-zinc-200 bg-zinc-50 px-3 py-2">
              <summary className="cursor-pointer text-center text-sm font-semibold text-zinc-700">More actions</summary>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <button
                  onClick={handleUndo}
                  disabled={undoStack.length <= 1}
                  className="rounded-full border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-900 transition hover:border-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Undo
                </button>
                <button
                  onClick={handleRedo}
                  disabled={redoStack.length === 0}
                  className="rounded-full border border-zinc-300 px-3 py-2 text-xs font-semibold text-zinc-900 transition hover:border-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Redo
                </button>
                <button
                  onClick={handleDownloadDocx}
                  className="rounded-full bg-zinc-900 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-zinc-800"
                >
                  DOCX
                </button>
              </div>
            </details>
          </div>
          <div className="hidden w-full grid-cols-2 gap-2 sm:grid sm:grid-cols-5 md:w-auto">
            <button
              onClick={handleUndo}
              disabled={undoStack.length <= 1}
              className="w-full rounded-full border border-zinc-300 px-4 py-3 text-sm font-semibold text-zinc-900 transition hover:border-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Undo
            </button>
            <button
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              className="w-full rounded-full border border-zinc-300 px-4 py-3 text-sm font-semibold text-zinc-900 transition hover:border-zinc-900 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Redo
            </button>

            <button
              onClick={() => saveCurrentResumeToHistory('Manual save')}
              className="w-full rounded-full border border-zinc-300 px-4 py-3 text-sm font-semibold text-zinc-900 transition hover:border-zinc-900"
            >
              Save version
            </button>

            <button
              onClick={handleDownloadDocx}
              className="w-full rounded-full bg-zinc-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-zinc-800"
            >
              Download DOCX
            </button>
            <button
              onClick={downloadResumePdf}
              disabled={pdfDownloadLoading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pdfDownloadLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
              {pdfDownloadLoading ? 'Downloading' : 'Download PDF'}
            </button>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-zinc-500">
            {!canSaveResumeHistory
              ? 'Sign in to save resume versions'
              : saveStatus === 'saving'
              ? 'Saving...'
              : lastSavedAt
                ? `Saved ${new Date(lastSavedAt).toLocaleTimeString()}`
                : 'Saved'}
          </p>
          <div className="hidden items-center gap-3 sm:flex">
            {parseError && <p className="text-xs text-red-500 font-medium">{parseError}</p>}
            <input
              type="file"
              accept="application/pdf"
              className="hidden"
              ref={parseInputRef}
              onChange={handleUploadResume}
            />
            <button
              onClick={() => parseInputRef.current?.click()}
              disabled={parseLoading}
              className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-xs font-semibold text-primary transition hover:bg-primary/10 disabled:opacity-50"
            >
              {parseLoading ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" /> Parsing...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" /> Auto-fill from PDF
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mt-6 grid min-w-0 gap-5 lg:mt-10 lg:grid-cols-[minmax(0,200px)_minmax(0,1fr)_minmax(0,320px)] lg:gap-5 xl:grid-cols-[220px_minmax(0,1fr)_380px] xl:gap-6">
          <aside className="h-fit min-w-0 overflow-hidden rounded-2xl border border-zinc-100 bg-zinc-50 p-3 md:p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-zinc-400 font-semibold">Sections</p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-3 lg:mt-4 lg:block lg:space-y-2">
              {sectionItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => focusSection(item.id)}
                  className={`flex w-full min-w-0 items-center justify-between rounded-lg border px-3 py-2 text-left transition ${
                    activeSection === item.id
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-zinc-100 bg-white text-zinc-900 hover:border-zinc-300'
                  }`}
                >
                  <span className="truncate">{item.label}</span>
                  <ChevronRight className="h-4 w-4 shrink-0" />
                </button>
              ))}
            </div>
            <div className="mt-5 border-t border-zinc-200 pt-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-400">Section Order</p>
                <button type="button" onClick={resetPrintableSectionOrder} className="text-[11px] font-semibold text-primary">
                  Reset
                </button>
              </div>
              <div ref={sectionOrderListRef} className="mt-3 max-h-[28rem] space-y-2 overflow-y-auto overflow-x-hidden pr-1">
                {orderedPrintableSections.map((sectionId, index) => (
                  <div
                    key={`order-${sectionId}`}
                    data-testid={`section-order-${sectionId}`}
                    ref={(el) => {
                      sectionOrderItemRefs.current[sectionId] = el;
                    }}
                    className={`min-w-0 rounded-lg border bg-white px-2 py-2 ${
                      highlightedOrderSectionId === sectionId
                        ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                        : activeSection === sectionId
                          ? 'border-primary/40 ring-1 ring-primary/20'
                          : 'border-zinc-200'
                    }`}
                  >
                    <p className="text-xs font-semibold text-zinc-700">{printableSectionLabel[sectionId]}</p>
                    <div className="mt-1 flex gap-2">
                      <button
                        type="button"
                        onClick={() => movePrintableSection(sectionId, 'up')}
                        disabled={index === 0}
                        data-testid={`section-order-${sectionId}-up`}
                        className="rounded border border-zinc-200 px-2 py-1 text-[10px] font-semibold text-zinc-600 disabled:opacity-40"
                      >
                        Up
                      </button>
                      <button
                        type="button"
                        onClick={() => movePrintableSection(sectionId, 'down')}
                        disabled={index === orderedPrintableSections.length - 1}
                        data-testid={`section-order-${sectionId}-down`}
                        className="rounded border border-zinc-200 px-2 py-1 text-[10px] font-semibold text-zinc-600 disabled:opacity-40"
                      >
                        Down
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </aside>

          <div className="min-w-0 space-y-6">
            <div id="builder-section-contact" className="rounded-2xl border border-zinc-100 bg-white p-4 md:p-6">
              <h2 className="font-semibold text-zinc-900">Contact Information</h2>
              <div className="mt-4 grid md:grid-cols-2 gap-4 text-sm">
                <input value={fullName} onChange={(e) => setFullName(e.target.value)} className="border border-zinc-200 rounded-lg px-3 py-2" placeholder="Full name" />
                <input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} className="border border-zinc-200 rounded-lg px-3 py-2" placeholder="Job title" />
                <input value={email} onChange={(e) => setEmail(e.target.value)} className="border border-zinc-200 rounded-lg px-3 py-2" placeholder="Email" />
                <input
                  type="tel"
                  inputMode="numeric"
                  pattern="[0-9]{10}"
                  value={phone}
                  onChange={(e) => setPhone(sanitizePhoneNumber(e.target.value))}
                  className="border border-zinc-200 rounded-lg px-3 py-2"
                  placeholder="Phone"
                  aria-label="Phone number"
                />
                <input value={location} onChange={(e) => setLocation(e.target.value)} className="border border-zinc-200 rounded-lg px-3 py-2" placeholder="Location" />
                <input value={profileLink} onChange={(e) => setProfileLink(e.target.value)} className="border border-zinc-200 rounded-lg px-3 py-2" placeholder="LinkedIn / Portfolio" />
              </div>
            </div>

            <div id="builder-section-photo" className="rounded-2xl border border-zinc-100 bg-white p-4 md:p-6">
              <h2 className="font-semibold text-zinc-900">Photo</h2>
              <div className="mt-4 flex items-center gap-4">
                <div className="h-20 w-20 rounded-xl border border-zinc-200 bg-zinc-50 overflow-hidden flex items-center justify-center">
                  {photoDataUrl ? (
                    <img src={photoDataUrl} alt="Profile preview" className="h-full w-full object-cover" />
                  ) : (
                    <User className="w-6 h-6 text-zinc-400" />
                  )}
                </div>
                <div className="flex-1">
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm"
                  />
                  {photoDataUrl && (
                    <button onClick={handleRemovePhoto} className="mt-2 text-xs font-semibold text-primary">
                      Remove photo
                    </button>
                  )}
                  <p className="mt-2 text-xs text-zinc-500">Upload one profile photo for resume preview and PDF.</p>
                </div>
              </div>
            </div>

            <div id="builder-section-date-place" className="rounded-2xl border border-zinc-100 bg-white p-4 md:p-6">
              <h2 className="font-semibold text-zinc-900">Date & Place</h2>
              <div className="mt-4 grid md:grid-cols-2 gap-4 text-sm">
                <input
                  type="date"
                  value={importantDate}
                  onChange={(e) => setImportantDate(e.target.value)}
                  className="border border-zinc-200 rounded-lg px-3 py-2"
                />
                <input
                  value={importantPlace}
                  onChange={(e) => setImportantPlace(e.target.value)}
                  className="border border-zinc-200 rounded-lg px-3 py-2"
                  placeholder="Place"
                />
              </div>
            </div>

            <div id="builder-section-summary" className="rounded-2xl border border-zinc-100 bg-white p-4 md:p-6">
              <h2 className="font-semibold text-zinc-900">Professional Summary</h2>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="mt-4 w-full border border-zinc-200 rounded-lg px-3 py-2 h-28"
                placeholder="Write a short summary about your experience and impact."
              />
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {['Professional', 'Confident', 'Simple', 'Executive'].map((tone) => (
                  <span key={tone} className="px-3 py-1 rounded-full border border-zinc-200 text-zinc-500">{tone}</span>
                ))}
              </div>
            </div>

            <div id="builder-section-premium" className="rounded-2xl border border-zinc-100 bg-white p-4 md:p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-zinc-400 font-semibold">Upgrade</p>
              <h2 className="font-semibold text-zinc-900 mt-2">Premium tools inside builder</h2>
              <p className="text-sm text-zinc-500 mt-2">Use all premium features directly while editing your resume.</p>

              <div className="mt-5 grid md:grid-cols-2 gap-4">
                {premiumFeatures.map((feature) => (
                  <div key={feature.id} className="rounded-xl border border-zinc-200 p-4 bg-zinc-50">
                    <h3 className="font-semibold text-zinc-900">{feature.title}</h3>
                    <p className="text-sm text-zinc-500 mt-1">{feature.desc}</p>

                    <button
                      onClick={() => handlePremiumFeatureInBuilder(feature.id)}
                      disabled={premiumActionLoading === feature.id}
                      className="mt-3 text-sm font-semibold text-primary disabled:cursor-wait disabled:opacity-60"
                    >
                      {premiumActionLoading === feature.id
                        ? 'Working...'
                        : feature.id === 'resume-shareable-link'
                          ? shareLinkCopied
                            ? 'Link copied'
                            : 'Publish & copy link'
                          : feature.id === 'qr-code-resume'
                            ? 'Publish & generate QR'
                            : 'Generate portfolio site'}
                    </button>
                    {feature.id === 'portfolio-website-generator' && (
                      <button
                        onClick={downloadPortfolioWebsiteHtml}
                        className="mt-2 block text-xs font-semibold text-zinc-600 hover:text-zinc-900"
                      >
                        Download portfolio HTML
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-xl border border-zinc-200 p-3 text-sm bg-white">
                <p className="text-zinc-500">Live shareable URL</p>
                <p className="mt-1 break-all text-zinc-900">
                  {publishedResumeUrl || 'Publish your resume to create a live URL.'}
                </p>
              </div>
              {premiumActionMessage && <p className="mt-3 text-sm text-primary font-medium">{premiumActionMessage}</p>}
            </div>

            <div id="builder-section-experience" className="rounded-2xl border border-zinc-100 bg-white p-4 md:p-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <h2 className="font-semibold text-zinc-900">Work Experience</h2>
                <div className="flex flex-wrap items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1">
                  <button
                    type="button"
                    onClick={() => setListStyle('bullet')}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${listStyle === 'bullet' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}
                    aria-pressed={listStyle === 'bullet'}
                  >
                    <List className="h-3.5 w-3.5" />
                    Points
                  </button>
                  <button
                    type="button"
                    onClick={() => setListStyle('number')}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${listStyle === 'number' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}
                    aria-pressed={listStyle === 'number'}
                  >
                    <ListOrdered className="h-3.5 w-3.5" />
                    Numbers
                  </button>
                  <button
                    type="button"
                    onClick={() => setListStyle('paragraph')}
                    className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition ${listStyle === 'paragraph' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'}`}
                    aria-pressed={listStyle === 'paragraph'}
                  >
                    <AlignLeft className="h-3.5 w-3.5" />
                    Paragraph
                  </button>
                </div>
              </div>
              <div className="mt-4 space-y-4 text-sm">
                {experiences.map((exp, index) => (
                  <div key={index} className="rounded-xl border border-zinc-200 p-4 bg-zinc-50/40">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-400">Experience {index + 1}</p>
                      {experiences.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeExperience(index)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 transition hover:border-red-200 hover:bg-red-50 hover:text-primary"
                          aria-label={`Remove experience ${index + 1}`}
                          title={`Remove experience ${index + 1}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="mt-3 space-y-3">
                      <input value={exp.title} onChange={(e) => updateExperience(index, 'title', e.target.value)} className="border border-zinc-200 rounded-lg px-3 py-2 w-full bg-white" placeholder="Company and role" />
                      <input value={exp.dates} onChange={(e) => updateExperience(index, 'dates', e.target.value)} className="border border-zinc-200 rounded-lg px-3 py-2 w-full bg-white" placeholder="Dates" />
                      <textarea
                        value={exp.bullets}
                        onChange={(e) => updateExperience(index, 'bullets', e.target.value)}
                        className="border border-zinc-200 rounded-lg px-3 py-2 w-full h-24 bg-white"
                        placeholder={
                          listStyle === 'number'
                            ? 'Write each numbered point on a new line'
                            : listStyle === 'paragraph'
                            ? 'Write your work experience in paragraph form'
                            : 'Write each point on a new line'
                        }
                      />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-3">
                <button onClick={addAnotherExperience} className="text-xs font-semibold text-primary">+ Add another experience</button>
                <button onClick={duplicateExperienceSection} className="text-xs font-semibold text-zinc-500">Duplicate section</button>
              </div>
            </div>

            <div id="builder-section-skills" className="rounded-2xl border border-zinc-100 bg-white p-4 md:p-6">
              <h2 className="font-semibold text-zinc-900">Skills</h2>
              <input
                value={skillsInput}
                onChange={(e) => setSkillsInput(e.target.value)}
                className="mt-3 w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Comma-separated skills"
              />
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {parsedSkills.length > 0 ? parsedSkills.map((skill) => (
                  <span key={skill} className="px-3 py-1 rounded-full bg-zinc-50 border border-zinc-200 text-zinc-500">{skill}</span>
                )) : (
                  <span className="text-zinc-400">Add skills to preview them live.</span>
                )}
              </div>
            </div>

            <div id="builder-section-education" className="rounded-2xl border border-zinc-100 bg-white p-4 md:p-6">
              <h2 className="font-semibold text-zinc-900">Education</h2>
              <div className="mt-4 space-y-4 text-sm">
                {educationItems.map((education, index) => (
                  <div key={index} className="rounded-2xl border border-zinc-100 bg-zinc-50/60 p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold text-zinc-500">Education {index + 1}</p>
                      {educationItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeEducation(index)}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-500 hover:text-primary"
                          aria-label={`Remove education ${index + 1}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <input value={education.degree} onChange={(e) => updateEducation(index, 'degree', e.target.value)} className="border border-zinc-200 rounded-lg px-3 py-2 bg-white" placeholder="Degree" />
                      <input value={education.school} onChange={(e) => updateEducation(index, 'school', e.target.value)} className="border border-zinc-200 rounded-lg px-3 py-2 bg-white" placeholder="School / University" />
                      <input value={education.year} onChange={(e) => updateEducation(index, 'year', e.target.value)} className="border border-zinc-200 rounded-lg px-3 py-2 bg-white md:col-span-2" placeholder="Years" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex gap-3">
                <button onClick={addAnotherEducation} className="text-xs font-semibold text-primary">+ Add another education</button>
                <button onClick={duplicateEducationSection} className="text-xs font-semibold text-zinc-500">Duplicate section</button>
              </div>
            </div>

            <div id="builder-section-projects" className="rounded-2xl border border-zinc-100 bg-white p-4 md:p-6">
              <h2 className="font-semibold text-zinc-900">Projects</h2>
              <textarea value={projectsInput} onChange={(e) => setProjectsInput(e.target.value)} className="mt-4 w-full border border-zinc-200 rounded-lg px-3 py-2 h-24" placeholder="One project per line" />
            </div>

            <div id="builder-section-certifications" className="rounded-2xl border border-zinc-100 bg-white p-4 md:p-6">
              <h2 className="font-semibold text-zinc-900">Certifications</h2>
              <input value={certificationsInput} onChange={(e) => setCertificationsInput(e.target.value)} className="mt-4 w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm" placeholder="Comma-separated certifications" />
            </div>

            <div id="builder-section-languages" className="rounded-2xl border border-zinc-100 bg-white p-4 md:p-6">
              <h2 className="font-semibold text-zinc-900">Languages</h2>
              <input value={languagesInput} onChange={(e) => setLanguagesInput(e.target.value)} className="mt-4 w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm" placeholder="Comma-separated languages" />
            </div>

            <div id="builder-section-hobbies" className="rounded-2xl border border-zinc-100 bg-white p-4 md:p-6">
              <h2 className="font-semibold text-zinc-900">Hobbies</h2>
              <input
                value={hobbiesInput}
                onChange={(e) => setHobbiesInput(e.target.value)}
                className="mt-4 w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm"
                placeholder="Comma-separated hobbies"
              />
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                {parsedHobbies.length > 0 ? parsedHobbies.map((hobby) => (
                  <span key={hobby} className="px-3 py-1 rounded-full bg-zinc-50 border border-zinc-200 text-zinc-500">{hobby}</span>
                )) : (
                  <span className="text-zinc-400">Add hobbies to preview them live.</span>
                )}
              </div>
            </div>

            <div id="builder-section-achievements" className="rounded-2xl border border-zinc-100 bg-white p-4 md:p-6">
              <h2 className="font-semibold text-zinc-900">Achievements</h2>
              <textarea value={achievementsInput} onChange={(e) => setAchievementsInput(e.target.value)} className="mt-4 w-full border border-zinc-200 rounded-lg px-3 py-2 h-24" placeholder="One achievement per line" />
            </div>

            <div id="builder-section-volunteer" className="rounded-2xl border border-zinc-100 bg-white p-4 md:p-6">
              <h2 className="font-semibold text-zinc-900">Volunteer</h2>
              <textarea value={volunteerInput} onChange={(e) => setVolunteerInput(e.target.value)} className="mt-4 w-full border border-zinc-200 rounded-lg px-3 py-2 h-24" placeholder="Volunteer work details" />
            </div>

            <div id="builder-section-custom-columns" className="rounded-2xl border border-zinc-100 bg-white p-4 md:p-6">
              <h2 className="font-semibold text-zinc-900">Custom Columns</h2>
              <p className="mt-2 text-xs text-zinc-500">Add your own section title and content. Reorder with up/down.</p>
              <div className="mt-4 space-y-3">
                <input
                  value={newCustomColumnTitle}
                  onChange={(e) => setNewCustomColumnTitle(e.target.value)}
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm"
                  placeholder="Column title (e.g., Publications)"
                />
                <textarea
                  value={newCustomColumnContent}
                  onChange={(e) => setNewCustomColumnContent(e.target.value)}
                  className="w-full border border-zinc-200 rounded-lg px-3 py-2 h-24 text-sm"
                  placeholder="One line per point"
                />
                <button onClick={addCustomColumn} className="text-xs font-semibold text-primary">
                  + Save custom column
                </button>
              </div>

              <div className="mt-4 space-y-3">
                {customColumns.length === 0 ? (
                  <p className="text-xs text-zinc-400">No custom columns added yet.</p>
                ) : (
                  customColumns.map((column, index) => (
                    <div key={column.id} className="rounded-xl border border-zinc-200 p-3 bg-zinc-50">
                      <input
                        value={column.title}
                        onChange={(e) => updateCustomColumn(index, 'title', e.target.value)}
                        className="w-full border border-zinc-200 rounded-lg px-3 py-2 text-sm bg-white"
                        placeholder="Column title"
                      />
                      <textarea
                        value={column.content}
                        onChange={(e) => updateCustomColumn(index, 'content', e.target.value)}
                        className="mt-2 w-full border border-zinc-200 rounded-lg px-3 py-2 h-20 text-sm bg-white"
                        placeholder="Column content"
                      />
                      <div className="mt-2 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => moveCustomColumn(index, 'up')}
                          disabled={index === 0}
                          className="text-xs font-semibold text-zinc-600 disabled:opacity-40"
                        >
                          Move up
                        </button>
                        <button
                          type="button"
                          onClick={() => moveCustomColumn(index, 'down')}
                          disabled={index === customColumns.length - 1}
                          className="text-xs font-semibold text-zinc-600 disabled:opacity-40"
                        >
                          Move down
                        </button>
                        <button
                          type="button"
                          onClick={() => removeCustomColumn(index)}
                          className="text-xs font-semibold text-zinc-500 hover:text-zinc-800"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="min-w-0 space-y-6">
            <div id="builder-live-preview" className="rounded-2xl border border-zinc-100 bg-white p-4 md:p-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-zinc-900">Live Preview</h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-400 font-medium">Template</span>
                  <select
                    id="builder-template-select"
                    value={selectedTemplate.id}
                    onChange={(e) => {
                      const tpl = templates.find((t) => t.id === e.target.value);
                      if (tpl) selectTemplateImmediately(tpl);
                    }}
                    className="rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-900 shadow-sm transition focus:border-primary focus:ring-1 focus:ring-primary/30 outline-none cursor-pointer"
                  >
                    {templates.map((tpl) => (
                      <option key={tpl.id} value={tpl.id}>
                        {tpl.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-zinc-200 bg-white shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
                {/* Template label header */}
                <div className="flex items-center justify-between px-5 pt-4 pb-3 text-sm text-zinc-500">
                  <span>Template</span>
                  <span className="font-bold text-zinc-900">{selectedTemplate.name}</span>
                </div>

                <div className="mx-3 mb-4 max-h-[700px] overflow-auto rounded-xl border border-zinc-200 bg-zinc-50 p-2 [scrollbar-gutter:stable]">
                  <div data-testid="builder-template-preview" className="mx-auto w-full min-w-0 max-w-[960px]">
                    <TemplatePreviewScaler pageWidth={760}>
                      <TemplateVisualPreview template={selectedTemplate} data={liveTemplateResumeData} sectionOrder={orderedPrintableSections} />
                    </TemplatePreviewScaler>
                  </div>
                </div>
              </div>


            </div>

          <div className="rounded-2xl border border-zinc-100 bg-white p-4 md:p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-zinc-900">Resume History</h3>
              <span className="text-xs px-3 py-1 rounded-full bg-zinc-100 text-zinc-500">{resumeHistory.length} saved</span>
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              {canSaveResumeHistory
                ? 'Each version is stored locally for your signed-in account.'
                : 'Sign in or create an account before saving resume versions.'}
            </p>
            {canSaveResumeHistory && (
              <div className="mt-3 grid grid-cols-1 gap-2">
                <input
                  value={historySearchTerm}
                  onChange={(e) => setHistorySearchTerm(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-xs"
                  placeholder="Search by name, role, or note"
                />
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={historyRoleFilter}
                    onChange={(e) => setHistoryRoleFilter(e.target.value)}
                    className="rounded-lg border border-zinc-200 px-2 py-2 text-xs bg-white"
                  >
                    <option value="all">All roles</option>
                    {historyRoleOptions.map((role) => (
                      <option key={role} value={role}>{role}</option>
                    ))}
                  </select>
                  <select
                    value={historyDateFilter}
                    onChange={(e) => setHistoryDateFilter(e.target.value as 'all' | 'today' | '7d' | '30d')}
                    className="rounded-lg border border-zinc-200 px-2 py-2 text-xs bg-white"
                  >
                    <option value="all">Any date</option>
                    <option value="today">Today</option>
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                  </select>
                </div>
              </div>
            )}
            {historyMessage && (
              <p
                className={`mt-3 rounded-xl border px-3 py-2 text-xs font-medium ${
                  isHistoryErrorMessage(historyMessage)
                    ? 'border-red-200 bg-red-50 text-red-700'
                    : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                }`}
              >
                {historyMessage}
              </p>
            )}
            <div className="mt-4 space-y-2 max-h-56 overflow-auto pr-1">
              {!canSaveResumeHistory ? (
                <p className="rounded-xl border border-primary/15 bg-primary/5 px-3 py-3 text-xs font-medium leading-5 text-primary">
                  Login or create an account to keep saved resume versions.
                </p>
              ) : filteredResumeHistory.length === 0 ? (
                <p className="text-xs text-zinc-400">
                  {resumeHistory.length === 0 ? 'No history yet. Edit resume and click Save version.' : 'No versions match current filters.'}
                </p>
              ) : (
                filteredResumeHistory.map((entry) => (
                  <div
                    key={entry.id}
                    className={`rounded-lg border p-3 ${
                      activeHistoryId === entry.id ? 'border-primary/40 bg-primary/5' : 'border-zinc-200 bg-zinc-50'
                    }`}
                  >
                    <p className="text-xs font-semibold text-zinc-800">
                      {entry.snapshot.fullName || 'Untitled'} - {entry.snapshot.jobTitle || 'Role not set'}
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-500">
                      {new Date(entry.savedAt).toLocaleString()} - {entry.note}
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => viewHistoryEntry(entry)}
                          className="text-xs font-semibold text-zinc-700 hover:text-zinc-900"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => restoreResumeFromHistory(entry)}
                          className="text-xs font-semibold text-primary"
                        >
                          Restore
                      </button>
                      <button
                        type="button"
                        onClick={() => duplicateFromHistory(entry)}
                        className="text-xs font-semibold text-zinc-700 hover:text-zinc-900"
                      >
                        Duplicate
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteHistoryEntry(entry.id)}
                        className="text-xs font-semibold text-zinc-500 hover:text-zinc-800"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
            {resumeHistory.length > 0 && (
              <button type="button" onClick={clearResumeHistory} className="mt-3 text-xs font-semibold text-zinc-500 hover:text-zinc-800">
                Clear history
              </button>
            )}
          </div>

          <div className="rounded-2xl border border-zinc-100 bg-white p-4 md:p-6">
            <h3 className="font-semibold text-zinc-900">Job Description Match</h3>
            <textarea
              value={jobDescriptionInput}
              onChange={(e) => setJobDescriptionInput(e.target.value)}
              className="mt-3 h-24 w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-700"
              placeholder="Paste a target job description here..."
            />
            <div className="mt-2 text-sm text-zinc-500">Match rate: {atsResult?.score ?? '--'}%</div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {(atsResult?.matchedKeywords.length ? atsResult.matchedKeywords : ['Run ATS check to see matched keywords']).slice(0, 8).map((kw) => (
                <span key={kw} className="px-3 py-1 rounded-full bg-zinc-50 border border-zinc-200 text-zinc-500">{kw}</span>
              ))}
            </div>
            {atsResult?.missingKeywords?.length ? (
              <p className="mt-3 text-xs text-zinc-400">
                Missing keywords: {atsResult.missingKeywords.slice(0, 8).join(', ')}
              </p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-zinc-100 bg-white p-4 md:p-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-zinc-900">ATS Checker</h3>
              <span className="text-xs px-3 py-1 rounded-full bg-zinc-100 text-zinc-500">
                Score {atsResult?.score ?? '--'}
              </span>
            </div>
            <button
              onClick={handleRunAtsChecker}
              disabled={atsLoading}
              className="mt-4 inline-flex items-center gap-2 rounded-full border border-zinc-300 px-4 py-2 text-xs font-semibold text-zinc-700 hover:border-zinc-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {atsLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
              {atsLoading ? 'Checking ATS...' : 'Run ATS check'}
            </button>
            {atsError && <p className="mt-3 text-xs text-red-600">{atsError}</p>}
            {atsResult && (
              <ul className="mt-3 text-sm text-zinc-500 space-y-2">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary" />
                  Keywords matched: {atsResult.matchedKeywords.length}/
                  {atsResult.matchedKeywords.length + atsResult.missingKeywords.length}
                </li>
                {atsResult.strengths.slice(0, 2).map((item) => (
                  <li key={item} className="flex items-center gap-2">
                    <Check className="w-4 h-4 text-primary" />
                    {item}
                  </li>
                ))}
                {atsResult.improvements.slice(0, 2).map((item) => (
                  <li key={item} className="flex items-center gap-2 text-zinc-400">
                    - {item}
                  </li>
                ))}
              </ul>
            )}
            {atsResult && (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={applyAtsMissingKeywords}
                  className="px-3 py-1 rounded-full border border-zinc-200 text-xs font-semibold text-zinc-700"
                >
                  Add missing keywords
                </button>
                <button
                  type="button"
                  onClick={applyAtsStrongerBullets}
                  disabled={atsApplyLoading}
                  className="px-3 py-1 rounded-full border border-zinc-200 text-xs font-semibold text-zinc-700 disabled:opacity-60"
                >
                  {atsApplyLoading ? 'Improving bullets...' : 'Strengthen bullets'}
                </button>
                <button
                  type="button"
                  onClick={applyAllAtsFixes}
                  disabled={atsApplyLoading}
                  className="px-3 py-1 rounded-full border border-emerald-300 bg-emerald-50 text-xs font-semibold text-emerald-700 disabled:opacity-60"
                >
                  {atsApplyLoading ? 'Applying all...' : 'Apply all ATS fixes'}
                </button>
              </div>
            )}
            {atsApplyMessage && <p className="mt-3 text-xs font-medium text-emerald-700">{atsApplyMessage}</p>}
          </div>

          <div className="rounded-2xl border border-zinc-100 bg-white p-4 md:p-6">
            <h3 className="font-semibold text-zinc-900">AI Writing Assistant</h3>
            <p className="text-sm text-zinc-500 mt-2">Improve bullets or generate a stronger summary.</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs">
              <button
                type="button"
                onClick={() => handleRunAiImprove('summary')}
                disabled={aiLoading}
                className="px-3 py-1 rounded-full border border-zinc-200 text-zinc-600 disabled:opacity-60"
              >
                Rewrite summary
              </button>
              <button
                type="button"
                onClick={() => handleRunAiImprove('bullets')}
                disabled={aiLoading}
                className="px-3 py-1 rounded-full border border-zinc-200 text-zinc-600 disabled:opacity-60"
              >
                Improve bullets
              </button>
              <button
                type="button"
                onClick={() => handleRunAiImprove('full')}
                disabled={aiLoading}
                className="px-3 py-1 rounded-full border border-zinc-200 text-zinc-600 disabled:opacity-60"
              >
                Full optimization
              </button>
            </div>
            {aiLoading && <p className="mt-3 text-xs text-zinc-500">Generating suggestions...</p>}
            {aiError && <p className="mt-3 text-xs text-red-600">{aiError}</p>}
            {aiImproveResult && (
              <div className="mt-4 space-y-3">
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">Suggested Summary</p>
                  <p className="mt-1 text-xs text-zinc-700 whitespace-pre-line">{aiImproveResult.improvedSummary}</p>
                  <button type="button" onClick={applyAiSummary} className="mt-2 text-xs font-semibold text-primary">
                    Apply to summary
                  </button>
                </div>
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.1em] text-zinc-500">Suggested Bullets</p>
                  <ul className="mt-1 list-disc pl-4 text-xs text-zinc-700 space-y-1">
                    {aiImproveResult.improvedBullets.slice(0, 4).map((bullet, index) => (
                      <li key={`${bullet}-${index}`}>{bullet}</li>
                    ))}
                  </ul>
                  <button type="button" onClick={applyAiBullets} className="mt-2 text-xs font-semibold text-primary">
                    Apply to first experience
                  </button>
                </div>
              </div>
            )}
            {aiApplyMessage && <p className="mt-3 text-xs font-medium text-emerald-700">{aiApplyMessage}</p>}
          </div>
        </div>
      </div>
    </div>

  {/* Login Required Modal */}
  {showLoginModal && (
    <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowLoginModal(false)}>
      <div
        className="mx-4 w-full max-w-sm animate-[fadeInScale_0.25s_ease] rounded-3xl border border-zinc-200 bg-white p-6 shadow-2xl sm:p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <Lock className="h-7 w-7 text-primary" />
        </div>
        <h3 className="mt-5 text-center text-xl font-extrabold tracking-tight text-zinc-900">Sign in to download</h3>
        <p className="mt-2 text-center text-sm leading-6 text-zinc-500">
          Create a free account or sign in to download your resume as PDF or DOCX.
        </p>
        <Link
          to="/login"
          className="mt-6 flex w-full items-center justify-center rounded-2xl bg-primary px-5 py-3.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(177,18,23,0.22)] transition hover:opacity-90"
        >
          Sign in / Create account
        </Link>
        <button
          type="button"
          onClick={() => setShowLoginModal(false)}
          className="mt-3 w-full rounded-2xl border border-zinc-200 px-5 py-3 text-sm font-semibold text-zinc-600 transition hover:border-zinc-400 hover:text-zinc-900"
        >
          Continue editing
        </button>
      </div>
    </div>
  )}
  </div>
  </>
  );
};
