import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Award, CheckCircle, XCircle, ChevronRight, BarChart3, Loader2, Mic, Activity, AlertTriangle, Clock, ArrowRight, Play, BookOpen, Download, ArrowLeft } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { backendApi, isAbortError } from '../lib/backendApi';
import { getStoredAccessToken } from '../lib/auth';
import { Seo } from '../components/Seo';
import { normalizeInterviewScore, formatScore } from '../utils/score';

type EnterpriseReportContext = {
  studentId: string; sessionId: string; token: string;
  onBack: () => void; onDownload: () => void; downloading: boolean;
};

export const InterviewReportPage: React.FC<{ enterprise?: EnterpriseReportContext }> = ({ enterprise }) => {
  const { id: routeSessionId } = useParams<{ id: string }>();
  const sessionId = enterprise?.sessionId ?? routeSessionId;
  const navigate = useNavigate();
  const [report, setReport] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const title = useRef<HTMLHeadingElement>(null);
  const studentId = enterprise?.studentId;
  const enterpriseToken = enterprise?.token;

  // Timeline Active state
  const [activeQuestionIdx, setActiveQuestionIdx] = useState<number>(0);

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true); setReport(null); setError(''); setActiveQuestionIdx(0);
    const fetchReport = async () => {
      try {
        const token = enterpriseToken || getStoredAccessToken();
        if (!token) throw new Error('Your session has expired. Please log in again.');
        if (!sessionId) throw new Error('Interview ID is missing.');
        const data = studentId
          ? await backendApi.enterprise.getStudentInterviewReport(studentId, sessionId, token, controller.signal)
          : await backendApi.getInterviewReport(sessionId, token);
        if (!controller.signal.aborted) setReport(data);
      } catch (err: any) {
        if (!controller.signal.aborted && !isAbortError(err)) setError(err.message || 'Error loading report');
      } finally { if (!controller.signal.aborted) setIsLoading(false); }
    };
    void fetchReport();
    return () => controller.abort();
  }, [sessionId, studentId, enterpriseToken, retry]);
  useEffect(() => {
    if (report) { title.current?.focus({ preventScroll: true }); if (studentId) window.scrollTo({ top: 0 }); }
  }, [report, studentId]);

  if (isLoading) {
    return (
      <div role="status" aria-label="Loading interview report" className="min-h-[80vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center">
        <div className="p-8 bg-zinc-900 border border-zinc-800 rounded-3xl space-y-6 shadow-2xl">
          <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h1 className="text-xl font-bold text-white">Unable to load interview report</h1>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {error || 'Unable to generate report because insufficient interview data was collected.'}
            </p>
          </div>
          <button onClick={() => setRetry(value => value + 1)} className="text-primary font-bold underline">Retry report</button>
          <button
            onClick={enterprise?.onBack ?? (() => navigate('/dashboard'))}
            className="w-full bg-primary hover:bg-primary-container text-white font-bold py-3 px-4 rounded-xl transition-all"
          >
            {enterprise ? 'Back to Interview History' : 'Back to Dashboard'}
          </button>
        </div>
      </div>
    );
  }

  const { overallScore, scoreScale, categoryScores, strengths, weaknesses, session, speakingPace, fillerWords, voiceConfidence } = report;

  const sortedQuestions = session?.questions ? [...session.questions].sort((a: any, b: any) => a.orderIndex - b.orderIndex) : [];
  const answeredCount = sortedQuestions.filter((q: any) => q.answer?.answerText?.trim()).length;
  const totalQuestions = sortedQuestions.length;
  const completionPercentage = totalQuestions ? Math.round((answeredCount / totalQuestions) * 100) : null;

  // Evaluation status must reflect real answer evidence — never fabricate a status.
  // The enterprise endpoint only serves completed sessions, so the typical flow always
  // reaches "Full Evaluation Available". Edge states are shown transparently.
  let evaluationStatus: 'full' | 'partial' | 'none' | 'no_questions';
  if (totalQuestions === 0) {
    // No question records found — report was generated but question data is absent.
    evaluationStatus = 'no_questions';
  } else if (answeredCount === totalQuestions) {
    evaluationStatus = 'full';
  } else if (answeredCount > 0) {
    evaluationStatus = 'partial';
  } else {
    evaluationStatus = 'none';
  }

  const evaluationStatusLabel = {
    full: 'Full Evaluation Available',
    partial: 'Partial Evaluation',
    none: 'No Answers Recorded',
    no_questions: 'Evaluation Not Available',
  }[evaluationStatus];

  // Only display the overall score percentage when there is actual evaluation evidence.
  // If no answers were recorded the report database row should not have been created,
  // but we guard against this edge case here to prevent contradictory UI.
  const hasEvaluationEvidence = answeredCount > 0 && overallScore != null;
  const normalizedOverall = hasEvaluationEvidence ? normalizeInterviewScore(overallScore, scoreScale) : null;

  const categoryValue = (value: unknown) => typeof value === 'number' ? normalizeInterviewScore(value, scoreScale) : null;

  const radarData = [
    { subject: 'Communication', A: categoryValue(categoryScores?.communicationQuality ?? categoryScores?.communication), fullMark: 100 },
    { subject: 'Technical Accuracy', A: categoryValue(categoryScores?.technicalAccuracy ?? categoryScores?.technical), fullMark: 100 },
    { subject: 'Problem Solving', A: categoryValue(categoryScores?.problemSolving), fullMark: 100 },
    { subject: 'Confidence', A: categoryValue(categoryScores?.confidence), fullMark: 100 },
    { subject: 'Completeness', A: categoryValue(categoryScores?.completeness), fullMark: 100 },
    { subject: 'Domain Knowledge', A: categoryValue(categoryScores?.domainKnowledge), fullMark: 100 }
  ].filter(item => item.A !== null && hasEvaluationEvidence);

  // Voice analytics: null means the metric was not captured (text-only interviews do not
  // record speaking pace, filler words, or voice confidence). Never display hardcoded defaults.
  const hasVoiceData = speakingPace != null || fillerWords != null || voiceConfidence != null;


  // Navigate the actual recorded questions.
  const getTimelineChapters = (questions: any[]) => {
    return questions.map((q, idx) => {
      const topic = q.questionText.length > 35 ? q.questionText.slice(0, 35) + "..." : q.questionText;
      return {
        label: `Question ${idx + 1}: ${topic}`,
        isAnswered: Boolean(q.answer?.answerText?.trim()),
        idx
      };
    });
  };

  const timelineChapters = getTimelineChapters(sortedQuestions);

  return (
    <>
      {!enterprise && <Seo
        title="Interview Report & AI Feedback | Red Resumes"
        description="Review detailed feedback, grammar suggestions, and AI evaluation of your responses from your mock interview session."
      />}
      <div className="max-w-6xl mx-auto py-12 px-4 sm:px-6 lg:px-8">

      {enterprise && <div className="mb-6 flex flex-wrap gap-3">
        <button onClick={enterprise.onBack} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 font-semibold focus-visible:outline-primary"><ArrowLeft className="w-4 h-4" /> Back to Interview History</button>
        <button onClick={enterprise.onDownload} disabled={enterprise.downloading} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary !text-white font-semibold disabled:opacity-50 focus-visible:outline-primary"><Download className="w-4 h-4" /> {enterprise.downloading ? 'Preparing download…' : 'Download PDF'}</button>
      </div>}
      {/* Top Banner */}
      <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h1 ref={title} tabIndex={-1} className="focus:outline-none text-2xl sm:text-4xl font-black text-zinc-900 dark:text-white flex items-center gap-3">
            <Award className="w-10 h-10 text-primary" />
            Interview Debrief & Analytics
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400 text-lg">
            Role: <span className="font-bold text-zinc-900 dark:text-zinc-200">{session.targetRole}</span> at <span className="font-bold text-zinc-900 dark:text-zinc-200">{session.companyType}</span>
          </p>
        </div>
        {!enterprise && <button onClick={() => navigate('/interview/setup')} className="bg-primary hover:bg-primary-container text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all hover:scale-105 shrink-0 flex items-center gap-2">
          Practice New Round <ArrowRight className="w-4 h-4" />
        </button>}
      </div>

      <div className="mb-6 rounded-xl bg-white border border-slate-200 p-4 text-sm text-slate-700 space-y-1">
        {report.student && <p><strong>{report.student.name}</strong> · {report.student.enrollmentNumber} · {report.student.program}</p>}
        <p className="capitalize">{session.difficulty} · Evaluated {new Date(report.createdAt).toLocaleString()} · Scheduled duration: {session.durationMins} minutes</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-10">
          {/* Overall Score Circle */}
          <div className="lg:col-span-4 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-8 flex flex-col items-center justify-center text-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-[100px] -z-10" />

            <div className="relative mb-6">
              <svg className="w-40 h-40 transform -rotate-90">
                <circle cx="80" cy="80" r="72" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-zinc-100 dark:text-zinc-800" />
                {normalizedOverall !== null && (
                  <circle
                    cx="80" cy="80" r="72"
                    stroke="currentColor"
                    strokeWidth="12"
                    fill="transparent"
                    strokeDasharray={452.389}
                    strokeDashoffset={452.389 - (452.389 * (normalizedOverall / 100))}
                    className={`${
                      normalizedOverall >= 80 ? 'text-emerald-500' :
                      normalizedOverall >= 60 ? 'text-amber-500' :
                      'text-red-500'
                    } transition-all duration-1000`}
                  />
                )}
              </svg>
              <div className="absolute inset-0 flex items-center justify-center flex-col">
                {normalizedOverall !== null ? (
                  <>
                    <span className="text-5xl font-black text-zinc-900 dark:text-white tracking-tighter">{Math.round(normalizedOverall)}%</span>
                    <span className="text-xs text-zinc-400 font-bold uppercase tracking-widest mt-1">Overall</span>
                  </>
                ) : (
                  <>
                    <span className="text-base font-bold text-zinc-400 px-2 text-center leading-tight">Not Evaluated</span>
                    <span className="text-xs text-zinc-500 mt-1">No score available</span>
                  </>
                )}
              </div>
            </div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Performance Score</h2>
            {normalizedOverall !== null ? (
              <p className="text-sm text-zinc-500 mt-2 max-w-xs">Computed from AI evaluation of actual interview answers using a documented rubric.</p>
            ) : (
              <p className="text-sm text-amber-600 dark:text-amber-400 mt-2 max-w-xs">This interview session has no evaluated answers on record.</p>
            )}

            <div className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800 w-full text-left space-y-2.5">
              <div className="flex justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                <span>Questions Answered:</span>
                <span className="text-zinc-900 dark:text-white font-bold">
                  {totalQuestions > 0 ? `${answeredCount}/${totalQuestions}` : 'No questions on record'}
                </span>
              </div>
              <div className="flex justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                <span>Interview Completion:</span>
                <span className="text-zinc-900 dark:text-white font-bold">
                  {completionPercentage === null ? 'Not recorded' : `${completionPercentage}%`}
                </span>
              </div>
              <div className="flex justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400">
                <span>Evaluation Status:</span>
                <span className={`font-bold ${
                  evaluationStatus === 'full' ? 'text-emerald-500' :
                  evaluationStatus === 'partial' ? 'text-amber-500' :
                  'text-red-500'
                }`}>
                  {evaluationStatusLabel}
                </span>
              </div>
            </div>
          </div>

        {/* Radar Chart */}
        <div className="lg:col-span-8 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-8 flex flex-col sm:flex-row items-center gap-6">
          {radarData.length > 0 ? (
            <>
              <div className="w-full sm:w-1/2 h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                    <PolarGrid stroke="#e4e4e7" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#71717a', fontSize: 12, fontWeight: 700 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      itemStyle={{ color: '#b11217', fontWeight: 'bold' }}
                    />
                    <Radar
                      name="Score"
                      dataKey="A"
                      stroke="#b11217"
                      fill="#b11217"
                      fillOpacity={0.3}
                      isAnimationActive={true}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              <div className="w-full sm:w-1/2">
                <h2 className="text-lg font-bold text-zinc-900 dark:text-white mb-5 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" /> Skill Heatmap Details
                </h2>
                <div className="space-y-4">
                  {radarData.map((item) => (
                    <div key={item.subject}>
                      <div className="flex justify-between text-sm font-semibold mb-1.5">
                        <span className="text-zinc-700 dark:text-zinc-300">{item.subject}</span>
                        <span className="text-zinc-900 dark:text-white">{item.A}%</span>
                      </div>
                      <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ${
                            item.A >= 80 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' :
                            item.A >= 60 ? 'bg-gradient-to-r from-amber-400 to-amber-500' :
                            'bg-gradient-to-r from-red-400 to-red-500'
                          }`}
                          style={{ width: `${item.A}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <div className="w-full flex flex-col items-center justify-center py-12 text-center">
              <BarChart3 className="w-10 h-10 text-zinc-300 dark:text-zinc-600 mb-3" />
              <h2 className="text-lg font-bold text-zinc-500 dark:text-zinc-400 mb-1">Skill Evaluation Not Available</h2>
              <p className="text-sm text-zinc-400 dark:text-zinc-500 max-w-xs">
                Skill scores are only computed from evaluated interview answers. No evaluated answers were recorded for this session.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Voice & Communication Analytics Section */}
      <h2 className="text-2xl font-black text-zinc-900 dark:text-white mb-6 flex items-center gap-2">
        <Mic className="w-6 h-6 text-primary" /> Voice & Communication Analytics
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {/* Speaking Pace */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-50 dark:bg-red-950/10 rounded-bl-full -z-10" />
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/30 text-primary dark:text-red-400 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${
              speakingPace >= 120 && speakingPace <= 160
                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
            }`}>
              {speakingPace === null || speakingPace === undefined ? 'Not recorded' : speakingPace >= 120 && speakingPace <= 160 ? 'Optimal' : 'Needs Work'}
            </span>
          </div>
          <h3 className="text-zinc-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-wider">Speaking Pace</h3>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-zinc-900 dark:text-white">{speakingPace ?? 'Not recorded'}</span>
            {speakingPace != null && <span className="text-xs text-zinc-400 font-bold uppercase">WPM</span>}
          </div>
          <p className="text-[10px] text-zinc-400 mt-4">Optimal range is 120 - 160 WPM.</p>
        </div>

        {/* Filler Words */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-50 dark:bg-red-950/10 rounded-bl-full -z-10" />
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950 text-red-500 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${
              fillerWords < 5
                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                : 'bg-red-500/10 text-red-500 border border-red-500/20'
            }`}>
              {fillerWords === null || fillerWords === undefined ? 'Not recorded' : fillerWords < 5 ? 'Excellent' : 'High Usage'}
            </span>
          </div>
          <h3 className="text-zinc-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-wider">Filler Words</h3>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-zinc-900 dark:text-white">{fillerWords ?? 'Not recorded'}</span>
            <span className="text-xs text-zinc-400 font-bold uppercase">detected</span>
          </div>
          <p className="text-[10px] text-zinc-400 mt-4">Um, uh, like, actually, basically.</p>
        </div>

        {/* Vocal Confidence */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-50 dark:bg-red-950/10 rounded-bl-full -z-10" />
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/30 text-primary flex items-center justify-center">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-zinc-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-wider">Vocal Confidence</h3>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-zinc-900 dark:text-white">{voiceConfidence === null || voiceConfidence === undefined ? 'Not recorded' : `${voiceConfidence}%`}</span>
          </div>
          <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5 mt-4">
            <div className="bg-primary h-1.5 rounded-full" style={{ width: `${voiceConfidence ?? 0}%` }} />
          </div>
        </div>


      </div>

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 hover:shadow-md transition-shadow">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-5 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-emerald-500" /> Key Strengths
          </h3>
          <ul className="space-y-4">
            {strengths.map((item: string, i: number) => (
              <li key={i} className="flex gap-3 text-sm text-zinc-700 dark:text-zinc-300">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-2 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 hover:shadow-md transition-shadow">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-5 flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-500" /> Areas for Improvement
          </h3>
          <ul className="space-y-4">
            {weaknesses.map((item: string, i: number) => (
              <li key={i} className="flex gap-3 text-sm text-zinc-700 dark:text-zinc-300">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-2 shrink-0" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {report.recommendations?.length > 0 && <section className="bg-white rounded-2xl border border-slate-200 p-6 mb-10"><h2 className="text-lg font-bold mb-4">AI Recommendations</h2><ul className="list-disc pl-5 space-y-2 text-sm">{report.recommendations.map((item: string, index: number) => <li key={index}>{item}</li>)}</ul></section>}
      {/* Question navigation */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 mb-10 shadow-xl">
        <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
          <Play className="w-5 h-5 text-red-400" /> Interview Questions
        </h2>

        <div className="flex flex-col md:flex-row items-stretch gap-3 md:overflow-x-auto md:pb-4 custom-scrollbar">
          {timelineChapters.map((chapter) => (
            <button
              key={chapter.idx}
              onClick={() => setActiveQuestionIdx(chapter.idx)}
              className={`flex-1 md:shrink-0 md:min-w-[220px] text-left p-4 rounded-xl border transition-all ${
                activeQuestionIdx === chapter.idx
                  ? 'bg-primary/10 border-primary text-white shadow-md'
                  : 'bg-zinc-900/60 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
              }`}
            >
              <div className="text-[10px] font-black font-mono uppercase tracking-wider text-red-400 mb-1.5 flex items-center justify-between">
                <span>Question {chapter.idx + 1}</span>
                {chapter.isAnswered ? (
                  <span className="text-emerald-500 font-bold text-[10px]">Answered ✅</span>
                ) : (
                  <span className="text-red-400 font-bold text-[10px]">Skipped ❌</span>
                )}
              </div>
              <p className="text-xs font-bold leading-relaxed line-clamp-2">{chapter.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Dynamic Detail Q&A & AI Coaching panel */}
      {sortedQuestions[activeQuestionIdx] && (
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden mb-10 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-900/50">
            <h2 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" /> AI Coaching: Chapter Detail (Question {activeQuestionIdx + 1})
            </h2>
            <span className="bg-primary !text-white px-3.5 py-1.5 rounded-full text-xs font-bold">
              Score: {sortedQuestions[activeQuestionIdx].answer ? formatScore(sortedQuestions[activeQuestionIdx].answer.score === null ? null : normalizeInterviewScore(sortedQuestions[activeQuestionIdx].answer.score, sortedQuestions[activeQuestionIdx].answer.scoreScale ?? 100)) : 'Skipped'}
            </span>
          </div>

          <div className="p-4 sm:p-8 space-y-6">
            {/* Question */}
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-sm shrink-0">
                Q
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Question Asked</span>
                <h3 className="text-lg font-bold text-zinc-900 dark:text-white">{sortedQuestions[activeQuestionIdx].questionText}</h3>
              </div>
            </div>

            {/* Answer */}
            {sortedQuestions[activeQuestionIdx].answer ? (
              <div className="space-y-6 sm:ml-14">
                <div className="bg-zinc-50 dark:bg-zinc-950 p-5 rounded-xl border border-zinc-200 dark:border-zinc-800/80 relative">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-primary rounded-l-xl" />
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-2">
                    Your Transcript Response {sortedQuestions[activeQuestionIdx].answer.durationSecs ? `(${sortedQuestions[activeQuestionIdx].answer.durationSecs}s response time)` : ''}
                  </span>
                  <p className="text-zinc-700 dark:text-zinc-300 italic leading-relaxed">
                    "{sortedQuestions[activeQuestionIdx].answer.answerText}"
                  </p>
                </div>

                {/* Feedback */}
                {sortedQuestions[activeQuestionIdx].answer.feedback && (
                  <div className="bg-primary/[0.03] p-6 rounded-xl border border-primary/10 space-y-5">
                    {sortedQuestions[activeQuestionIdx].answer.feedback.reasoning && (
                      <div className="flex gap-3 text-zinc-700 dark:text-zinc-300 border-b border-primary/5 pb-4">
                        <Activity className="w-5 h-5 shrink-0 mt-0.5 text-primary" />
                        <div>
                          <span className="text-[10px] font-bold text-primary dark:text-red-400 uppercase tracking-wider block mb-2">Evaluation Reasoning</span>
                          <p className="text-xs leading-relaxed text-zinc-500 dark:text-zinc-400">{sortedQuestions[activeQuestionIdx].answer.feedback.reasoning}</p>
                        </div>
                      </div>
                    )}
                    <div className="flex gap-3 text-zinc-700 dark:text-zinc-300">
                      <ChevronRight className="w-6 h-6 shrink-0 mt-0.5 text-primary" />
                      <div>
                        <span className="text-[10px] font-bold text-primary dark:text-red-400 uppercase tracking-wider block mb-2">AI Constructive Feedback</span>
                        <p className="text-sm leading-relaxed">{sortedQuestions[activeQuestionIdx].answer.feedback.feedback}</p>
                      </div>
                    </div>

                    {/* STAR Framework Version */}
                    <div className="pt-5 border-t border-primary/10">
                      <div className="flex gap-3 text-zinc-700 dark:text-zinc-300">
                        <Award className="w-5 h-5 shrink-0 mt-0.5 text-primary" />
                        <div>
                          <span className="text-[10px] font-bold text-primary dark:text-red-400 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                            STAR Framework Recommended Response
                          </span>
                          <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400 whitespace-pre-line bg-zinc-950 p-4 rounded-lg border border-zinc-800 mt-2">
                            {sortedQuestions[activeQuestionIdx].answer.feedback.improvedAnswerExample || "No specific example was generated for this question."}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="sm:ml-14 py-6 px-6 bg-red-500/[0.03] border border-red-500/10 rounded-xl space-y-2">
                <div className="text-red-400 font-bold text-sm flex items-center gap-1.5">
                  <XCircle className="w-4 h-4" /> Skipped / No Response ❌
                </div>
                <p className="text-sm text-zinc-400 leading-relaxed">
                  This question was skipped or not answered during the session. No score was recorded, and this question did not contribute to your final overall evaluation.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
    </>
  );
};
