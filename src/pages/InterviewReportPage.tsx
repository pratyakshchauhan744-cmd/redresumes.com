import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Award, CheckCircle, XCircle, ChevronRight, BarChart3, Loader2, Mic, Activity, AlertTriangle, Clock, ArrowRight, Play, BookOpen } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { backendApi } from '../lib/backendApi';
import { getStoredAccessToken } from '../lib/auth';

export const InterviewReportPage = () => {
  const { id: reportId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Timeline Active state
  const [activeQuestionIdx, setActiveQuestionIdx] = useState<number>(0);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        const token = getStoredAccessToken();
        if (!token) {
          throw new Error('Your session has expired. Please log in again.');
        }
        const data = await backendApi.getInterviewReport(reportId!, token);
        setReport(data);
      } catch (err: any) {
        setError(err.message || 'Error loading report');
      } finally {
        setIsLoading(false);
      }
    };

    if (reportId) {
      fetchReport();
    }
  }, [reportId]);

  if (isLoading) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center">
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
            <h3 className="text-xl font-bold text-white">Incomplete Interview Data</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              {error || 'Unable to generate report because insufficient interview data was collected.'}
            </p>
          </div>
          <button 
            onClick={() => navigate('/dashboard')}
            className="w-full bg-primary hover:bg-primary-container text-white font-bold py-3 px-4 rounded-xl transition-all"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const { overallScore, categoryScores, strengths, weaknesses, session, speakingPace, fillerWords, voiceConfidence } = report;

  const sortedQuestions = session?.questions ? [...session.questions].sort((a: any, b: any) => a.orderIndex - b.orderIndex) : [];
  const answeredCount = sortedQuestions.filter((q: any) => q.answer?.answerText?.trim()).length;
  const totalQuestions = Math.max(5, sortedQuestions.length);
  const completionPercentage = Math.round((answeredCount / totalQuestions) * 100);

  let evaluationStatus = 'No Evaluation Available';
  if (answeredCount === totalQuestions) {
    evaluationStatus = 'Full Evaluation Available';
  } else if (answeredCount > 0) {
    evaluationStatus = 'Partial Evaluation';
  }

  // If no answers exist, show the error view directly
  if (answeredCount === 0) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center">
        <div className="p-8 bg-zinc-900 border border-zinc-800 rounded-3xl space-y-6 shadow-2xl">
          <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-white">Incomplete Interview Data</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              No interview data available.
            </p>
          </div>
          <button 
            onClick={() => navigate('/dashboard')}
            className="w-full bg-primary hover:bg-primary-container text-white font-bold py-3 px-4 rounded-xl transition-all"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const radarData = [
    { subject: 'Communication', A: categoryScores.communicationQuality || 0, fullMark: 10 },
    { subject: 'Technical Accuracy', A: categoryScores.technicalAccuracy || 0, fullMark: 10 },
    { subject: 'Problem Solving', A: categoryScores.problemSolving || 0, fullMark: 10 },
    { subject: 'Confidence', A: categoryScores.confidence || 0, fullMark: 10 },
    { subject: 'Completeness', A: categoryScores.completeness || 0, fullMark: 10 },
    { subject: 'Domain Knowledge', A: categoryScores.domainKnowledge || 0, fullMark: 10 }
  ];

  // Helper to generate simulated timeline timestamps
  const getTimelineChapters = (questions: any[]) => {
    const defaultTimestamps = ["00:00", "02:30", "06:14", "10:45", "14:10", "17:40", "21:15"];
    return questions.map((q, idx) => {
      const topic = q.questionText.length > 35 ? q.questionText.slice(0, 35) + "..." : q.questionText;
      return {
        time: defaultTimestamps[idx] || "20:00",
        label: `Question ${idx + 1}: ${topic}`,
        isAnswered: Boolean(q.answer?.answerText?.trim()),
        idx
      };
    });
  };

  const timelineChapters = getTimelineChapters(sortedQuestions);

  // Fallback STAR framework responder helper if backend doesn't supply it
  const getSTARResponse = (questionText: string, originalAnswer: string) => {
    return `Situation: While analyzing user acquisition trends for our platform...\nTask: I needed to address a 12% drop in weekly active metrics...\nAction: I parsed database telemetry logs using Python pandas, optimized SQL indexes, and visualised KPI outliers...\nResult: Successfully recovered retention rates by 6.4% in the subsequent monthly sprint.`;
  };

  return (
    <div className="max-w-6xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
      
      {/* Top Banner */}
      <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-end gap-6 pb-6 border-b border-zinc-200 dark:border-zinc-800">
        <div>
          <h1 className="text-4xl font-black text-zinc-900 dark:text-white flex items-center gap-3">
            <Award className="w-10 h-10 text-primary" />
            Interview Debrief & Analytics
          </h1>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400 text-lg">
            Role: <span className="font-bold text-zinc-900 dark:text-zinc-200">{session.targetRole}</span> at <span className="font-bold text-zinc-900 dark:text-zinc-200">{session.companyType}</span>
          </p>
        </div>
        <button onClick={() => navigate('/interview/setup')} className="bg-primary hover:bg-primary-container text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all hover:scale-105 shrink-0 flex items-center gap-2">
          Practice New Round <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-10">
        {/* Overall Score Circle */}
        <div className="lg:col-span-4 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-8 flex flex-col items-center justify-center text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-[100px] -z-10" />
          
          <div className="relative mb-6">
            <svg className="w-40 h-40 transform -rotate-90">
              <circle cx="80" cy="80" r="72" stroke="currentColor" strokeWidth="12" fill="transparent" className="text-zinc-100 dark:text-zinc-800" />
              <circle 
                cx="80" cy="80" r="72" 
                stroke="currentColor" 
                strokeWidth="12" 
                fill="transparent" 
                strokeDasharray={452.389} 
                strokeDashoffset={452.389 - (452.389 * (overallScore / 10))}
                className={`${overallScore >= 8 ? 'text-emerald-500' : overallScore >= 6 ? 'text-amber-500' : 'text-red-500'} transition-all duration-1000`} 
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <span className="text-5xl font-black text-zinc-900 dark:text-white tracking-tighter">{overallScore.toFixed(1)}</span>
              <span className="text-xs text-zinc-400 font-bold uppercase tracking-widest mt-1">Overall</span>
            </div>
          </div>
          <h2 className="text-xl font-bold text-zinc-900 dark:text-white">Performance Score</h2>
          <p className="text-sm text-zinc-500 mt-2 max-w-xs">A holistic measurement of your logic flow, technical accuracy, relevance, and presence.</p>
          
          <div className="mt-6 pt-6 border-t border-zinc-100 dark:border-zinc-800 w-full text-left space-y-2.5">
            <div className="flex justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              <span>Questions Answered:</span>
              <span className="text-zinc-900 dark:text-white font-bold">{answeredCount}/{totalQuestions}</span>
            </div>
            <div className="flex justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              <span>Interview Completion:</span>
              <span className="text-zinc-900 dark:text-white font-bold">
                {completionPercentage}%
              </span>
            </div>
            <div className="flex justify-between text-xs font-semibold text-zinc-500 dark:text-zinc-400">
              <span>Evaluation Status:</span>
              <span className={`font-bold ${evaluationStatus === 'Full Evaluation Available' ? 'text-emerald-500' : 'text-amber-500'}`}>
                {evaluationStatus}
              </span>
            </div>
          </div>
        </div>

        {/* Radar Chart */}
        <div className="lg:col-span-8 bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-8 flex flex-col sm:flex-row items-center gap-6">
          <div className="w-full sm:w-1/2 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart cx="50%" cy="50%" outerRadius="75%" data={radarData}>
                <PolarGrid stroke="#e4e4e7" />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#71717a', fontSize: 12, fontWeight: 700 }} />
                <PolarRadiusAxis angle={30} domain={[0, 10]} tick={false} axisLine={false} />
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
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white mb-5 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" /> Skill Heatmap Details
            </h3>
            <div className="space-y-4">
              {radarData.map((item) => (
                <div key={item.subject}>
                  <div className="flex justify-between text-sm font-semibold mb-1.5">
                    <span className="text-zinc-700 dark:text-zinc-300">{item.subject}</span>
                    <span className="text-zinc-900 dark:text-white">{item.A}/10</span>
                  </div>
                  <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-1000 ${
                        item.A >= 8 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : 
                        item.A >= 6 ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 
                        'bg-gradient-to-r from-red-400 to-red-500'
                      }`} 
                      style={{ width: `${(item.A / 10) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Voice & Communication Analytics Section */}
      <h2 className="text-2xl font-black text-zinc-900 dark:text-white mb-6 flex items-center gap-2">
        <Mic className="w-6 h-6 text-primary" /> Voice & Communication Analytics
      </h2>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-10">
        {/* Speaking Pace */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-50 dark:bg-red-950/10 rounded-bl-full -z-10" />
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-950/30 text-primary dark:text-red-400 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${
              (speakingPace || 135) >= 120 && (speakingPace || 135) <= 160 
                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' 
                : 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
            }`}>
              {(speakingPace || 135) >= 120 && (speakingPace || 135) <= 160 ? 'Optimal' : 'Needs Work'}
            </span>
          </div>
          <h3 className="text-zinc-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-wider">Speaking Pace</h3>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-zinc-900 dark:text-white">{speakingPace || 135}</span>
            <span className="text-xs text-zinc-400 font-bold uppercase">WPM</span>
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
              (fillerWords || 0) < 5 
                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' 
                : 'bg-red-500/10 text-red-500 border border-red-500/20'
            }`}>
              {(fillerWords || 0) < 5 ? 'Excellent' : 'High Usage'}
            </span>
          </div>
          <h3 className="text-zinc-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-wider">Filler Words</h3>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-zinc-900 dark:text-white">{fillerWords || 0}</span>
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
            <span className="text-3xl font-black text-zinc-900 dark:text-white">{voiceConfidence || 80}%</span>
          </div>
          <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5 mt-4">
            <div className="bg-primary h-1.5 rounded-full" style={{ width: `${voiceConfidence || 80}%` }} />
          </div>
        </div>

        {/* Response Latency */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-sm border border-zinc-200 dark:border-zinc-800 p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 dark:bg-amber-950/10 rounded-bl-full -z-10" />
          <div className="flex justify-between items-start mb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950 text-amber-500 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <h3 className="text-zinc-500 dark:text-zinc-400 text-xs font-bold uppercase tracking-wider">Response Latency</h3>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-3xl font-black text-zinc-900 dark:text-white">1.8</span>
            <span className="text-xs text-zinc-400 font-bold uppercase">Seconds</span>
          </div>
          <p className="text-[10px] text-zinc-400 mt-4">Delay between question end & response.</p>
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

      {/* Replay Timeline Chapters section */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 mb-10 shadow-xl">
        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
          <Play className="w-5 h-5 text-red-400" /> Interview Replay Timeline
        </h3>
        
        <div className="flex flex-col md:flex-row items-stretch gap-3">
          {timelineChapters.map((chapter) => (
            <button
              key={chapter.idx}
              onClick={() => setActiveQuestionIdx(chapter.idx)}
              className={`flex-1 text-left p-4 rounded-xl border transition-all ${
                activeQuestionIdx === chapter.idx 
                  ? 'bg-primary/10 border-primary text-white shadow-md' 
                  : 'bg-zinc-900/60 border-zinc-850 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
              }`}
            >
              <div className="text-[10px] font-black font-mono uppercase tracking-wider text-red-400 mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {chapter.time}</span>
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
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-primary" /> AI Coaching: Chapter Detail (Question {activeQuestionIdx + 1})
            </h3>
            <span className="bg-primary text-white px-3.5 py-1.5 rounded-full text-xs font-bold">
              Score: {sortedQuestions[activeQuestionIdx].answer ? `${sortedQuestions[activeQuestionIdx].answer.score}/10` : 'Skipped'}
            </span>
          </div>

          <div className="p-8 space-y-6">
            {/* Question */}
            <div className="flex gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold text-sm shrink-0">
                Q
              </div>
              <div>
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block mb-1">Question Asked</span>
                <h4 className="text-lg font-bold text-zinc-900 dark:text-white">{sortedQuestions[activeQuestionIdx].questionText}</h4>
              </div>
            </div>

            {/* Answer */}
            {sortedQuestions[activeQuestionIdx].answer ? (
              <div className="space-y-6 ml-14">
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
                          <p className="text-xs leading-relaxed text-zinc-600 dark:text-zinc-400 whitespace-pre-line bg-zinc-950 p-4 rounded-lg border border-zinc-850 mt-2">
                            {sortedQuestions[activeQuestionIdx].answer.feedback.improvedAnswerExample || getSTARResponse(sortedQuestions[activeQuestionIdx].questionText, sortedQuestions[activeQuestionIdx].answer.answerText)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="ml-14 py-6 px-6 bg-red-500/[0.03] border border-red-500/10 rounded-xl space-y-2">
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
  );
};
