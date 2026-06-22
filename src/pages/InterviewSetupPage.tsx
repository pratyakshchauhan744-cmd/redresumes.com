import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UploadCloud, Briefcase, FileText, Settings, Loader2, Building, Sparkles, AlertCircle, ArrowRight } from 'lucide-react';
import { backendApi } from '../lib/backendApi';
import { getStoredAccessToken, isLocalAccessToken, USER_STORAGE_KEY } from '../lib/auth';
import { Seo } from '../components/Seo';

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export const InterviewSetupPage = ({ currentUser, onUserUpdated }: { currentUser: any; onUserUpdated?: (user: any) => void }) => {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [resumeId, setResumeId] = useState<string | null>(null);
  const [targetRole, setTargetRole] = useState('Software Engineer');
  const [companyType, setCompanyType] = useState('Google');
  const [difficulty, setDifficulty] = useState('Medium');
  const [style, setStyle] = useState('Mixed');
  const [durationMins, setDurationMins] = useState(15);
  const [jobDescription, setJobDescription] = useState('');
  const [interviewerPersona, setInterviewerPersona] = useState('Technical Interviewer');
  const [stressMode, setStressMode] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState('');
  
  // Credits and Paywall States
  const [credits, setCredits] = useState<number>(currentUser?.credits ?? 0);
  const [showPaywall, setShowPaywall] = useState(false);
  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null);

  useEffect(() => {
    const token = getStoredAccessToken();
    if (token && !isLocalAccessToken(token)) {
      backendApi.getCreditTransactions(token)
        .then(data => {
          setCredits(data.balance);
        })
        .catch(console.error);
    }
  }, [currentUser]);

  const handleBuyCredits = async (packageKey: string) => {
    const token = getStoredAccessToken();
    if (!token) {
      setError("Please log in to purchase credits.");
      return;
    }
    setPurchaseLoading(packageKey);
    try {
      const res = await backendApi.createCreditCheckoutSession(packageKey, token);
      
      // Handle mock dev bypass or redirect URL if provided
      if (res.url) {
        window.location.href = res.url;
        return;
      }

      // Load Razorpay script
      const loaded = await loadRazorpayScript();
      if (!loaded) {
        throw new Error("Failed to load Razorpay SDK. Please check your internet connection.");
      }

      const options = {
        key: res.keyId,
        amount: res.amount,
        currency: res.currency,
        name: res.productName,
        description: res.productDescription,
        order_id: res.orderId,
        handler: async function (response: any) {
          setPurchaseLoading(packageKey);
          setError("Verifying payment...");
          try {
            const verifyResult = await backendApi.verifyCreditPayment({
              razorpayPaymentId: response.razorpay_payment_id,
              razorpayOrderId: response.razorpay_order_id,
              razorpaySignature: response.razorpay_signature,
              packageKey
            }, token);

            setCredits(verifyResult.balance);
            setShowPaywall(false);
            setError("");

            // Update context user and local storage
            const storedUserRaw = window.localStorage.getItem(USER_STORAGE_KEY);
            if (storedUserRaw) {
              const storedUser = JSON.parse(storedUserRaw);
              storedUser.credits = verifyResult.balance;
              window.localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(storedUser));
              if (onUserUpdated) {
                onUserUpdated(storedUser);
              }
            }
          } catch (err: any) {
            console.error("Payment verification failed:", err);
            setError(err.message || "Payment verification failed. Please contact support.");
          } finally {
            setPurchaseLoading(null);
          }
        },
        prefill: {
          name: currentUser?.name || '',
          email: currentUser?.email || '',
        },
        theme: {
          color: "#e11d48", // matches the theme rose-600
        },
        modal: {
          ondismiss: function () {
            setPurchaseLoading(null);
          }
        }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      alert(err.message || "Checkout error.");
      setError(err.message || "Checkout error.");
      setPurchaseLoading(null);
    }
  };

  // AI Intelligence Screen State
  const [showIntelligenceScreen, setShowIntelligenceScreen] = useState(false);
  const [parsedProfile, setParsedProfile] = useState<any>(null);
  const [analysisStep, setAnalysisStep] = useState(0);

  const analysisSteps = [
    "Analyzing Resume credentials...",
    "Scanning Job Description requirements...",
    "Calibrating Interviewer Persona...",
    "Synthesizing dynamic questions...",
    "Configuring Google Meet room..."
  ];

  useEffect(() => {
    if (isStarting) {
      const interval = setInterval(() => {
        setAnalysisStep((prev) => {
          if (prev < analysisSteps.length - 1) {
            return prev + 1;
          }
          clearInterval(interval);
          return prev;
        });
      }, 1500);
      return () => clearInterval(interval);
    }
  }, [isStarting]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!file) return;
    
    if (credits <= 0) {
      setShowPaywall(true);
      return;
    }

    setIsUploading(true);
    setError('');
    
    try {
      const user = currentUser;
      if (!user) {
        throw new Error('You must be logged in to analyze your resume.');
      }
      const token = getStoredAccessToken() || '';

      const data = await backendApi.analyzeInterviewResume(file, token);
      setResumeId(data.resumeId);
      setParsedProfile(data.parsedData);
      setShowIntelligenceScreen(true);
      
      // Auto-hide intelligence screen after a few seconds
      setTimeout(() => {
        setShowIntelligenceScreen(false);
      }, 5000);
    } catch (err: any) {
      setError(err.message || 'Error uploading resume');
    } finally {
      setIsUploading(false);
    }
  };

  const handleStart = async () => {
    if (!resumeId) {
      setError('Please upload and analyze a resume first.');
      return;
    }

    if (credits <= 0) {
      setShowPaywall(true);
      return;
    }

    setIsStarting(true);
    setError('');

    // Pre-create the session, but wait for the animation steps to finish before navigating
    try {
      const user = currentUser;
      if (!user) {
        throw new Error('Your session has expired. Please sign in again.');
      }
      const token = getStoredAccessToken() || '';
      
      const sessionPromise = backendApi.startInterviewSession({
        resumeId,
        targetRole,
        companyType,
        difficulty,
        style,
        durationMins,
        jobDescription: jobDescription || undefined,
        interviewerPersona: interviewerPersona || undefined,
        stressMode
      }, token);

      // Simulate step-by-step loading for premium feel
      setTimeout(async () => {
        try {
          const data = await sessionPromise;
          navigate(`/interview/session/${data.sessionId}`);
        } catch (err: any) {
          setError(err.message || 'Error starting interview');
          setIsStarting(false);
        }
      }, analysisSteps.length * 1500);

    } catch (err: any) {
      setError(err.message || 'Error starting interview');
      setIsStarting(false);
    }
  };

  return (
    <>
      <Seo
        title="AI Interview Practice | Prepare for Mock Interviews | Red Resumes"
        description="Set up personalized AI-powered mock interviews. Receive realistic questions and instant feedback tailored to your job role."
      />
      <div className="max-w-5xl mx-auto py-12 px-4 sm:px-6 lg:px-8 min-h-[85vh]">
      {/* Step 2: Full-screen AI Analysis loader overlay */}
      {isStarting && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-zinc-950 text-white p-4 transition-all">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.12)_0%,transparent_70%)] pointer-events-none" />
          
          <div className="max-w-md w-full text-center relative z-10 space-y-8">
            <div className="relative w-28 h-28 mx-auto flex items-center justify-center">
              {/* Spinning visualizer rings */}
              <div className="absolute inset-0 border-4 border-primary/20 rounded-full" />
              <div className="absolute inset-0 border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin duration-1000" />
              <div className="absolute inset-2 border-4 border-rose-500/15 rounded-full" />
              <div className="absolute inset-2 border-4 border-t-rose-500 border-r-transparent border-b-transparent border-l-transparent rounded-full animate-[spin_2s_linear_infinite]" />
              <Sparkles className="w-10 h-10 text-red-400 animate-pulse" />
            </div>

            <div className="space-y-3">
              <h2 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-red-200 via-red-100 to-rose-200">
                Calibrating Meeting Room
              </h2>
              <p className="text-zinc-400 text-sm">
                Establishing dynamic environment variables for {companyType}...
              </p>
            </div>

            {/* Steps checklist with animations */}
            <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl p-6 text-left space-y-4 shadow-2xl backdrop-blur-md">
              {analysisSteps.map((step, idx) => (
                <div key={idx} className="flex items-center gap-3 text-sm">
                  {analysisStep > idx ? (
                    <div className="w-5 h-5 rounded-full bg-emerald-500/10 border border-emerald-500 text-emerald-400 flex items-center justify-center shrink-0">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  ) : analysisStep === idx ? (
                    <div className="w-5 h-5 rounded-full border border-primary text-primary flex items-center justify-center shrink-0 animate-pulse">
                      <Loader2 className="w-3 h-3 animate-spin" />
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full border border-zinc-700 text-zinc-600 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold">{idx + 1}</span>
                    </div>
                  )}
                  <span className={`transition-colors duration-300 ${analysisStep === idx ? 'text-white font-semibold' : analysisStep > idx ? 'text-zinc-400' : 'text-zinc-600'}`}>
                    {step}
                  </span>
                </div>
              ))}
            </div>

            <div className="text-xs text-zinc-500 animate-pulse">
              Please grant camera & microphone permissions when requested.
            </div>
          </div>
        </div>
      )}

      {/* Profile summary drawer overlay after analysis */}
      {showIntelligenceScreen && parsedProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
          <div className="bg-zinc-900 border border-zinc-800 text-white rounded-2xl shadow-2xl max-w-xl w-full p-8 animate-in fade-in zoom-in duration-300">
            <div className="flex flex-col items-center text-center mb-8">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-primary to-rose-600 rounded-full flex items-center justify-center animate-pulse">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
              </div>
              <h2 className="text-2xl font-black bg-clip-text text-transparent bg-gradient-to-r from-red-200 to-white">
                Hi {parsedProfile.fullName || 'Candidate'}, profile analysis loaded!
              </h2>
              <p className="text-zinc-400 text-sm mt-2">
                We've synthesized custom question paths matching your skills.
              </p>
            </div>

            <div className="space-y-4">
              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-500/20">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Detected Core Strengths</h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    {parsedProfile.skills?.slice(0, 5).join(', ') || 'Analytical thinking, system engineering, problem solving'}
                  </p>
                </div>
              </div>

              <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center shrink-0 border border-amber-500/20">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm">Target Areas for Follow-Ups</h3>
                  <p className="text-xs text-zinc-400 mt-1">
                    Architectural scaling, metrics metrics verification, and strategic alignment.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-8 text-center">
              <button onClick={() => setShowIntelligenceScreen(false)} className="bg-primary hover:bg-primary-container text-white font-semibold py-2 px-6 rounded-lg text-sm transition-colors">
                Configure Room Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Screen 1: Interview Setup Interface */}
      <div className="mb-10 text-center md:text-left">
        <h1 className="text-4xl font-black text-zinc-900 dark:text-white flex flex-col md:flex-row items-center gap-3">
          <Briefcase className="w-10 h-10 text-primary" />
          AI Mock Interview Setup
        </h1>
        <p className="mt-3 text-zinc-600 dark:text-zinc-400 text-lg max-w-3xl">
          Upload your resume, paste the job description, and customize your mock interview parameters. Our AI will host a Google Meet styled video call testing your background dynamically.
        </p>
      </div>

      {error && (
        <div className="mb-8 p-4 bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 rounded-xl text-sm font-semibold flex items-center gap-2 border border-red-100 dark:border-red-900/30">
          <AlertCircle className="w-5 h-5 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Upload Resume & JD */}
        <div className="lg:col-span-5 space-y-6">
          {/* Upload Resume Card */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-3 text-zinc-900 dark:text-white">
              <span className="bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">1</span>
              Upload Resume
            </h2>
            
            {!resumeId ? (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-xl p-8 text-center hover:border-primary transition-colors cursor-pointer relative">
                  <input 
                    type="file" 
                    accept=".pdf,.txt" 
                    onChange={handleFileChange} 
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                    id="resume-upload" 
                  />
                  <div className="flex flex-col items-center">
                    <UploadCloud className="w-12 h-12 text-zinc-400 mb-3" />
                    <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                      {file ? file.name : "Click or drag PDF/TXT to upload"}
                    </span>
                    <span className="text-xs text-zinc-400 mt-1">Maximum size 5MB</span>
                  </div>
                </div>

                <button
                  onClick={handleUpload}
                  disabled={!file || isUploading}
                  className="w-full bg-zinc-950 hover:bg-zinc-800 dark:bg-white dark:hover:bg-zinc-100 dark:text-zinc-950 text-white font-bold py-3 px-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all shadow-sm"
                >
                  {isUploading ? <><Loader2 className="w-5 h-5 animate-spin" /> Extracting details...</> : <><FileText className="w-5 h-5" /> Analyze Resume</>}
                </button>
              </div>
            ) : (
              <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-6 text-center">
                <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-3 border border-emerald-200/50">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 className="text-emerald-800 dark:text-emerald-300 font-bold mb-1">Resume Parsed successfully</h3>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">Strategy mapping completed</p>
                <button onClick={() => setResumeId(null)} className="mt-4 text-xs font-semibold text-primary hover:text-primary-container hover:underline">Upload a different resume</button>
              </div>
            )}
          </div>

          {/* Job Description Card */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-3 text-zinc-900 dark:text-white">
              <span className="bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">2</span>
              Job Description
            </h2>
            <div>
              <textarea 
                value={jobDescription} 
                onChange={(e) => setJobDescription(e.target.value)} 
                placeholder="Paste the target job description here to generate tailored, hyper-targeted interview scenarios..."
                className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary min-h-[180px] leading-relaxed dark:text-white" 
              />
              <span className="text-[11px] text-zinc-400 block mt-2">Optional but highly recommended for role-specific calibration.</span>
            </div>
          </div>
        </div>

        {/* Right Column: Configuration & Run */}
        <div className="lg:col-span-7">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 p-8 shadow-sm space-y-6">
            <h2 className="text-2xl font-bold flex items-center gap-3 text-zinc-900 dark:text-white">
              <span className="bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">3</span>
              Room Configuration
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Target Role</label>
                <input 
                  type="text" 
                  value={targetRole} 
                  onChange={(e) => setTargetRole(e.target.value)} 
                  placeholder="e.g. Senior Frontend Engineer"
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:text-white" 
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2 flex items-center gap-1.5">
                  <Building className="w-3.5 h-3.5" /> Company Simulation
                </label>
                <select 
                  value={companyType} 
                  onChange={(e) => setCompanyType(e.target.value)} 
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:text-white"
                >
                  <option>Google</option>
                  <option>Netflix</option>
                  <option>Amazon</option>
                  <option>Meta</option>
                  <option>Apple</option>
                  <option>Stripe</option>
                  <option>Y-Combinator Startup</option>
                  <option>Custom Enterprise</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Difficulty</label>
                <select 
                  value={difficulty} 
                  onChange={(e) => setDifficulty(e.target.value)} 
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:text-white"
                >
                  <option>Easy</option>
                  <option>Medium</option>
                  <option>Hard</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Interviewer style</label>
                <select 
                  value={style} 
                  onChange={(e) => setStyle(e.target.value)} 
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:text-white"
                >
                  <option>HR</option>
                  <option>Technical</option>
                  <option>Behavioral</option>
                  <option>Mixed</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Duration</label>
                <select 
                  value={durationMins} 
                  onChange={(e) => setDurationMins(Number(e.target.value))} 
                  className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:text-white"
                >
                  <option value={15}>15 Minutes (5 Qs)</option>
                  <option value={30}>30 Minutes (10 Qs)</option>
                  <option value={45}>45 Minutes (15 Qs)</option>
                </select>
              </div>
            </div>

            <div className="pt-6 border-t border-zinc-100 dark:border-zinc-800 space-y-4">
              <h3 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-wider">Interviewer Configuration</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">Interviewer Persona</label>
                  <select 
                    value={interviewerPersona} 
                    onChange={(e) => setInterviewerPersona(e.target.value)} 
                    className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-4 py-3 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary dark:text-white"
                  >
                    <option>HR Recruiter</option>
                    <option>Hiring Manager</option>
                    <option>Technical Interviewer</option>
                    <option>Startup Founder</option>
                  </select>
                  <span className="text-[10px] text-zinc-400 block mt-1.5">
                    {interviewerPersona === 'HR Recruiter' && 'Focuses on background verification, cultural fit, and high-level fit.'}
                    {interviewerPersona === 'Hiring Manager' && 'Tests KPI outcomes, system execution, business decisions and ownership.'}
                    {interviewerPersona === 'Technical Interviewer' && 'Asks for algorithms, data modeling, architecture, logic and detail.'}
                    {interviewerPersona === 'Startup Founder' && 'Aggressive speed review, scaling vision, independence and drive.'}
                  </span>
                </div>

                <div className="flex items-start gap-3 p-4 bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 rounded-xl">
                  <div className="flex items-center h-5">
                    <input
                      id="stress-mode"
                      type="checkbox"
                      checked={stressMode}
                      onChange={(e) => setStressMode(e.target.checked)}
                      className="w-4.5 h-4.5 text-red-600 bg-zinc-100 border-zinc-300 rounded focus:ring-red-500 focus:ring-2 dark:bg-zinc-800 dark:border-zinc-700"
                    />
                  </div>
                  <div className="text-sm">
                    <label htmlFor="stress-mode" className="font-bold text-zinc-900 dark:text-white">Stress Interview Mode</label>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">Interviewer adopts a highly analytical, interrupting posture demanding exact data and metrics.</p>
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleStart}
              disabled={!resumeId || isStarting}
              className="w-full mt-6 bg-primary hover:bg-primary-container text-white font-bold py-4 px-6 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-red-500/10 transition-all hover:scale-[1.01]"
            >
              <Settings className="w-5 h-5" /> Start Meeting Room <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Paywall Warning and Redirect Modal */}
      {showPaywall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white rounded-3xl shadow-2xl max-w-lg w-full p-8 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-bl-[100px] -z-10" />
            
            <div className="flex flex-col items-center text-center mb-6">
              <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center mb-4">
                <AlertCircle className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-black tracking-tight text-zinc-950 dark:text-white">
                Out of Interview Credits
              </h3>
              <p className="text-zinc-500 dark:text-zinc-400 text-sm mt-2 leading-relaxed max-w-sm">
                You have no interview credits remaining. Purchase a package below to start practicing with the AI Interviewer and unlock your feedback reports.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 mb-6">
              {/* Starter Pack */}
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 p-5 flex flex-col justify-between hover:border-primary/20 transition-all">
                <div>
                  <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block">Starter Pack</span>
                  <span className="text-xl font-black text-zinc-900 dark:text-white mt-1 block">5 Credits</span>
                  <span className="text-xs text-zinc-500 mt-2 block">Practice 5 full rounds.</span>
                </div>
                <button
                  disabled={purchaseLoading !== null}
                  onClick={() => handleBuyCredits('starter')}
                  className="mt-5 w-full rounded-xl bg-zinc-950 hover:bg-zinc-850 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white font-bold py-2 text-xs transition-colors disabled:opacity-50"
                >
                  {purchaseLoading === 'starter' ? 'Loading...' : 'Buy for ₹499'}
                </button>
              </div>

              {/* Pro Pack */}
              <div className="rounded-2xl border-2 border-primary bg-white dark:bg-zinc-900 p-5 flex flex-col justify-between hover:shadow-md transition-all relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-primary text-white text-[8px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-bl-lg">
                  Popular
                </div>
                <div>
                  <span className="text-[10px] font-bold text-primary uppercase tracking-widest block">Pro Pack</span>
                  <span className="text-xl font-black text-zinc-900 dark:text-white mt-1 block">15 Credits</span>
                  <span className="text-xs text-zinc-500 mt-2 block">Practice 15 full rounds.</span>
                </div>
                <button
                  disabled={purchaseLoading !== null}
                  onClick={() => handleBuyCredits('pro')}
                  className="mt-5 w-full rounded-xl bg-primary hover:bg-primary-container text-white font-bold py-2 text-xs transition-colors disabled:opacity-50"
                >
                  {purchaseLoading === 'pro' ? 'Loading...' : 'Buy for ₹999'}
                </button>
              </div>
            </div>

            <div className="flex gap-3 justify-end border-t border-zinc-150 dark:border-zinc-800 pt-4">
              <button
                disabled={purchaseLoading !== null}
                onClick={() => setShowPaywall(false)}
                className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 px-5 py-2.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:border-zinc-400"
              >
                Cancel
              </button>
              <button
                disabled={purchaseLoading !== null}
                onClick={() => navigate('/dashboard')}
                className="rounded-xl bg-zinc-950 hover:bg-zinc-850 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-white font-bold px-5 py-2.5 text-xs transition-colors"
              >
                Go to Billing
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </>
  );
};
