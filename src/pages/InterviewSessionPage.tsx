import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Mic, MicOff, Video, VideoOff, Monitor, Edit2, PhoneOff, Loader2, AlertCircle, PlaySquare, Award, ArrowRight, Shield, Activity, Eraser, Trash, Building } from 'lucide-react';
import { useWebSpeech, VoiceState } from '../hooks/useWebSpeech';
import { backendApi } from '../lib/backendApi';
import { getStoredAccessToken } from '../lib/auth';
import { Seo } from '../components/Seo';

type Message = {
  id: string;
  role: 'ai' | 'user';
  text: string;
};

const FILLER_WORDS = ['um', 'uh', 'like', 'you know', 'basically', 'actually', 'literally'];

function countFillerWords(text: string): { count: number, words: Record<string, number> } {
  const words = text.toLowerCase().match(/\b(\w+(?:\s\w+)?)\b/g) || [];
  const found: Record<string, number> = {};
  let total = 0;
  
  words.forEach(w => {
    if (FILLER_WORDS.includes(w)) {
      found[w] = (found[w] || 0) + 1;
      total++;
    }
  });
  
  return { count: total, words: found };
}

export const InterviewSessionPage = ({ currentUser }: { currentUser: any }) => {
  const { id: sessionId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentQuestionId, setCurrentQuestionId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Google Meet UI States
  const [hasJoined, setHasJoined] = useState(false);
  const [pendingFirstQuestion, setPendingFirstQuestion] = useState('');
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [showExitModal, setShowExitModal] = useState(false);
  const [isEndingSession, setIsEndingSession] = useState(false);
  const [timerString, setTimerString] = useState('15:00');
  const [sessionDurationSecs, setSessionDurationSecs] = useState(900); // 15 mins default
  const [totalQuestions, setTotalQuestions] = useState(5); // derived from durationMins
  
  // Simulated video feed assets / visualizer
  // Initial values are empty strings — they are populated from the session API response.
  // Avoid hardcoded defaults like 'HR Recruiter' / 'Google' that would flash on the
  // join screen while the async fetchSession() call is in-flight.
  const [interviewerName, setInterviewerName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [difficulty, setDifficulty] = useState('');
  const [speechVisualizerBars, setSpeechVisualizerBars] = useState<number[]>(new Array(20).fill(6));
  
  // Media streams
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const userVideoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  // localStreamRef always holds the live MediaStream so cleanup callbacks and
  // useEffect cleanup functions don't read a stale closure of the state value.
  const localStreamRef = useRef<MediaStream | null>(null);

  // Whiteboard drawing states
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawColor, setDrawColor] = useState('#ef4444'); // red-500
  const [lineWidth, setLineWidth] = useState(4);
  const [isEraser, setIsEraser] = useState(false);
  
  // Voice & Avatar State
  const [avatarState, setAvatarState] = useState<VoiceState>('idle');
  const { 
    isSupported, transcript, isListening, startListening, stopListening, speak, stopSpeaking 
  } = useWebSpeech();
  
  // Auto-submit voice timeout ref
  const autoSubmitTimeoutRef = useRef<any>(null);
  // Track the last transcript value that armed the timer so isListening flickers don't re-arm it
  const lastArmedTranscriptRef = useRef<string>('');
  
  // Refs to hold latest values so callbacks never capture stale closures
  const isMicMutedRef = useRef(false);
  const hasJoinedRef = useRef(false);
  const transcriptRef = useRef('');
  const currentQuestionIdRef = useRef<string | null>(null);
  const speakingStartTimeRef = useRef<number | null>(null);
  const isCompletedRef = useRef(false);
  
  // Analytics State
  const [speakingStartTime, setSpeakingStartTime] = useState<number | null>(null);
  const [lastSpeechAnalytics, setLastSpeechAnalytics] = useState<{
    wpm: number;
    fillerCount: number;
    confidence: number;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Keep refs in sync with state
  useEffect(() => { isMicMutedRef.current = isMicMuted; }, [isMicMuted]);
  useEffect(() => { hasJoinedRef.current = hasJoined; }, [hasJoined]);
  useEffect(() => { transcriptRef.current = transcript; }, [transcript]);
  useEffect(() => { currentQuestionIdRef.current = currentQuestionId; }, [currentQuestionId]);
  useEffect(() => { speakingStartTimeRef.current = speakingStartTime; }, [speakingStartTime]);

  // Scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, transcript]);

  // Sync avatar state with hook states — only when NOT speaking or thinking
  useEffect(() => {
    if (avatarState === 'thinking' || avatarState === 'speaking') return;
    if (isListening && !isMicMuted) {
      setAvatarState('listening');
    } else {
      setAvatarState('idle');
    }
  }, [isListening, isMicMuted]); // intentionally omit avatarState to avoid feedback loop

  // AI audio waveform animation
  useEffect(() => {
    let animId: any;
    if (avatarState === 'speaking') {
      const updateBars = () => {
        setSpeechVisualizerBars(prev => prev.map(() => Math.floor(Math.random() * 45) + 6));
        animId = setTimeout(updateBars, 80);
      };
      updateBars();
    } else {
      setSpeechVisualizerBars(new Array(20).fill(6));
    }
    return () => clearTimeout(animId);
  }, [avatarState]);

  // Countdown timer logic
  useEffect(() => {
    if (isLoading || !hasJoined) return;
    const interval = setInterval(() => {
      setSessionDurationSecs((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleLeaveRoom();
          return 0;
        }
        const next = prev - 1;
        const mins = Math.floor(next / 60);
        const secs = next % 60;
        setTimerString(`${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`);
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isLoading, hasJoined]);

  // Unconditional camera cleanup on component unmount (route change, refresh, back button).
  // Uses the ref — not the state — so it always sees the live stream even in stale closures.
  useEffect(() => {
    return () => {
      const stream = localStreamRef.current;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
    };
  }, []); // empty deps: runs cleanup only on unmount

  // Handle webcam stream initialization during session
  useEffect(() => {
    if (!isLoading && isCameraActive) {
      startCamera();
    } else {
      stopCamera();
    }
    // Note: unmount cleanup is handled by the effect above (via ref)
  }, [isLoading, isCameraActive]);

  // Bind local webcam stream to the active video element (lobby or room)
  useEffect(() => {
    if (userVideoRef.current && localStream) {
      userVideoRef.current.srcObject = localStream;
      userVideoRef.current.play().catch(err => {
        console.warn("Video auto-play failed, user interaction may be required:", err);
      });
    }
  }, [localStream, hasJoined]);

  // Bind screen share stream to the screen video element
  useEffect(() => {
    if (screenVideoRef.current && screenStream) {
      screenVideoRef.current.srcObject = screenStream;
    }
  }, [screenStream]);

  // Auto-submit silence detection:
  // - 6 second silence window (gives room for natural pauses mid-answer)
  // - Minimum 8 words required before submitting (prevents cutting short interim results)
  // - Only re-arms when *new transcript content* arrives (ignores isListening flickers
  //   that occur every ~200ms during the continuous=false recognition restart cycle)
  const submitAnswerRef = useRef<(ans: string) => void>(() => {});
  const MIN_WORDS_TO_SUBMIT = 8;
  const SILENCE_TIMEOUT_MS = 6000;

  useEffect(() => {
    if (!isListening || isMicMuted) return;

    const trimmed = transcript.trim();
    if (!trimmed) return;

    // Only re-arm the timer when transcript has actually grown (new words spoken)
    if (trimmed === lastArmedTranscriptRef.current) return;
    lastArmedTranscriptRef.current = trimmed;

    if (autoSubmitTimeoutRef.current) {
      clearTimeout(autoSubmitTimeoutRef.current);
    }

    autoSubmitTimeoutRef.current = setTimeout(() => {
      const ans = transcriptRef.current.trim();
      const wordCount = ans.split(/\s+/).filter(Boolean).length;
      // Guard: require at least MIN_WORDS before treating silence as "done answering"
      if (ans && wordCount >= MIN_WORDS_TO_SUBMIT) {
        stopListening();
        submitAnswerRef.current(ans);
      }
      // If too short, just let user keep speaking — don't submit
    }, SILENCE_TIMEOUT_MS);

    return () => {
      if (autoSubmitTimeoutRef.current) {
        clearTimeout(autoSubmitTimeoutRef.current);
      }
    };
  }, [transcript, isListening, isMicMuted, stopListening]);

  // Whiteboard drawing canvas initialization
  useEffect(() => {
    if (showWhiteboard && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = canvas.parentElement?.clientWidth || 800;
      canvas.height = canvas.parentElement?.clientHeight || 500;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#09090b'; // dark zinc bg
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [showWhiteboard]);

  const handleAiSpeak = useCallback((text: string) => {
    // Always stop listening before speaking (prevents feedback loop)
    stopListening();
    setAvatarState('speaking');
    speak(text, () => {
      // Use refs so this callback always sees the current values, not stale closure
      setAvatarState('idle');
      if (!isMicMutedRef.current && hasJoinedRef.current && !isCompletedRef.current) {
        const now = Date.now();
        setSpeakingStartTime(now);
        speakingStartTimeRef.current = now;
        // Reset the deduplication guard so the next answer starts fresh
        lastArmedTranscriptRef.current = '';
        startListening();
      }
    });
  }, [speak, startListening, stopListening]); // no longer depends on isMicMuted/hasJoined — uses refs

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const token = getStoredAccessToken();
        if (!token) {
          throw new Error('Your session has expired. Please log in again.');
        }
        const data = await backendApi.getInterviewSession(sessionId!, token);
        
        if (data.status === 'completed') {
          navigate(`/interview/report/${sessionId}`);
          return;
        }

        // Calibrate metadata from database session details
        setInterviewerName(data.interviewerPersona || 'HR Recruiter');
        setCompanyName(data.companyType || 'Google');
        setDifficulty(data.difficulty || 'Medium');
        setSessionDurationSecs(data.durationMins * 60);
        // Derive total questions from duration: 15 min → 5 Qs, 30 min → 10 Qs, 45 min → 15 Qs
        setTotalQuestions(Math.round((data.durationMins / 15) * 5));

        // Reconstruct history
        const history: Message[] = [];
        let activeQuestionId = null;
        let lastAiMessage = "";
        const sortedQuestions = data.questions.sort((a: any, b: any) => a.orderIndex - b.orderIndex);
        
        sortedQuestions.forEach((q: any) => {
          history.push({ id: `q-${q.id}`, role: 'ai', text: q.questionText });
          if (q.answer) {
            history.push({ id: `a-${q.id}`, role: 'user', text: q.answer.answerText });
          } else {
            activeQuestionId = q.id;
            lastAiMessage = q.questionText;
          }
        });

        setMessages(history);
        setCurrentQuestionId(activeQuestionId);
        
        if (lastAiMessage) {
          setPendingFirstQuestion(lastAiMessage);
        }

      } catch (err: any) {
        setError(err.message || 'Error loading session');
      } finally {
        setIsLoading(false);
      }
    };

    if (sessionId) {
      fetchSession();
    }
    
    return () => {
      stopSpeaking();
    };
  }, [sessionId, navigate, stopSpeaking]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      // Store in both state (for React renders) and ref (for reliable cleanup in closures)
      localStreamRef.current = stream;
      setLocalStream(stream);
      if (userVideoRef.current) {
        userVideoRef.current.srcObject = stream;
        userVideoRef.current.play().catch(e => console.warn("Lobby video play failed:", e));
      }
    } catch (err) {
      console.error("Camera access failed:", err);
      setIsCameraActive(false);
    }
  };

  const stopCamera = () => {
    // Read from ref first — the state value can be stale inside old closures
    const stream = localStreamRef.current || localStream;
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }
  };

  const toggleCamera = () => {
    setIsCameraActive(prev => !prev);
  };

  const toggleMic = () => {
    if (isMicMuted) {
      setIsMicMuted(false);
      if (avatarState === 'idle' && hasJoined) {
        setSpeakingStartTime(Date.now());
        startListening();
      }
    } else {
      setIsMicMuted(true);
      stopListening();
    }
  };

  const startScreenShare = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      setScreenStream(stream);
      if (screenVideoRef.current) {
        screenVideoRef.current.srcObject = stream;
      }
      setIsScreenSharing(true);
      setShowWhiteboard(false); // disable whiteboard side-by-side
      
      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };
    } catch (err) {
      console.error("Screen share failed:", err);
    }
  };

  const stopScreenShare = () => {
    if (screenStream) {
      screenStream.getTracks().forEach(track => track.stop());
      setScreenStream(null);
    }
    setIsScreenSharing(false);
  };

  const toggleScreenShare = () => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      startScreenShare();
    }
  };

  const toggleWhiteboard = () => {
    if (showWhiteboard) {
      setShowWhiteboard(false);
    } else {
      setShowWhiteboard(true);
      stopScreenShare(); // disable screen sharing
    }
  };

  // Drawing whiteboard canvas controls
  const handleStartDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true);
  };

  const handleDraw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.strokeStyle = isEraser ? '#09090b' : drawColor;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'round';
    ctx.stroke();
  };

  const handleStopDrawing = () => {
    setIsDrawing(false);
  };

  const handleClearWhiteboard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#09090b';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  // Join Room Handler (Lobby validation bypass)
  const handleJoinRoom = () => {
    // Unlock Speech Synthesis engine on user gesture
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        const dummy = new SpeechSynthesisUtterance('');
        window.speechSynthesis.speak(dummy);
      } catch (e) {
        console.warn('Speech synthesis unlock failed:', e);
      }
    }
    setHasJoined(true);
    if (pendingFirstQuestion) {
      handleAiSpeak(pendingFirstQuestion);
    }
  };

  // Submission Handling — memoized so it can be safely used in effects via submitAnswerRef
  const submitAnswer = useCallback(async (answerStr: string) => {
    const qId = currentQuestionIdRef.current;
    if (!answerStr.trim() || !qId) return;

    setAvatarState('thinking');
    if (autoSubmitTimeoutRef.current) {
      clearTimeout(autoSubmitTimeoutRef.current);
    }
    
    // Calculate Analytics using ref for speakingStartTime (always current)
    let wpm = 0;
    let durationSecs = 0;
    const startTime = speakingStartTimeRef.current;
    if (startTime) {
      const elapsedMs = Date.now() - startTime;
      const durationMins = elapsedMs / 60000;
      durationSecs = Math.round(elapsedMs / 1000);
      const wordCount = answerStr.trim().split(/\s+/).length;
      wpm = durationMins > 0 ? Math.round(wordCount / durationMins) : 0;
    }
    const fillerStats = countFillerWords(answerStr);
    
    let confidence = 100;
    if (wpm < 100) confidence -= 10;
    if (wpm > 180) confidence -= 5;
    confidence -= (fillerStats.count * 3);
    confidence = Math.max(0, Math.min(100, confidence));
    
    setLastSpeechAnalytics({ wpm, fillerCount: fillerStats.count, confidence });
    setMessages(prev => [...prev, { id: `a-temp-${Date.now()}`, role: 'user', text: answerStr }]);
    setError('');

    try {
      const token = getStoredAccessToken();
      if (!token) {
        throw new Error('Your session has expired. Please sign in again.');
      }
      
      const data = await backendApi.submitInterviewAnswer({
        sessionId: sessionId!,
        questionId: qId,
        answerText: answerStr,
        wpm,
        fillerCount: fillerStats.count,
        confidence,
        durationSecs
      }, token);

      if (data.isComplete) {
        isCompletedRef.current = true;
        handleAiSpeak("Thank you, the interview is now complete. Generating your comprehensive analysis report.");
        setTimeout(() => {
          navigate(`/interview/report/${data.reportId || sessionId}`);
        }, 4000);
      } else {
        setMessages(prev => [...prev, { id: `q-${data.nextQuestion!.id}`, role: 'ai', text: data.nextQuestion!.questionText }]);
        setCurrentQuestionId(data.nextQuestion!.id);
        handleAiSpeak(data.nextQuestion!.questionText);
      }
    } catch (err: any) {
      setError(err.message || 'Error submitting answer');
      setMessages(prev => prev.filter(m => !m.id.startsWith('a-temp')));
      setAvatarState('idle');
    }
  }, [sessionId, navigate, handleAiSpeak]);

  // Keep submitAnswerRef pointing at the latest submitAnswer
  useEffect(() => {
    submitAnswerRef.current = submitAnswer;
  }, [submitAnswer]);

  const handleLeaveRoom = () => {
    const answeredCount = messages.filter(m => m.role === 'user').length;
    if (answeredCount === 0) {
      stopSpeaking();
      stopCamera();
      stopScreenShare();
      navigate('/dashboard');
      return;
    }

    stopSpeaking();
    setShowExitModal(true);
  };

  const handleConfirmExitEarly = async (generateReport: boolean) => {
    setShowExitModal(false);
    isCompletedRef.current = true;
    stopSpeaking();
    stopListening();
    stopCamera();
    stopScreenShare();

    if (generateReport) {
      setIsEndingSession(true);
      try {
        const token = getStoredAccessToken() || '';
        await backendApi.completeInterviewSession(sessionId!, {}, token);
        navigate(`/interview/report/${sessionId}`);
      } catch (err: any) {
        setError(err.message || 'Error generating report');
      } finally {
        setIsEndingSession(false);
      }
    } else {
      navigate('/dashboard');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center flex-col gap-4 text-white">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-sm font-semibold tracking-wide text-zinc-400">Loading meeting room components...</p>
      </div>
    );
  }

  if (!isSupported) {
    return (
      <div className="max-w-xl mx-auto py-16 px-4 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Voice Recognition Not Supported</h2>
        <p className="text-zinc-600 mb-6">Your browser doesn't support the Web Speech API. Please try using Google Chrome or Microsoft Edge.</p>
      </div>
    );
  }

  // Lobby view
  if (!hasJoined) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-6 relative select-none">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.08)_0%,transparent_70%)] pointer-events-none" />
        
        <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-12 gap-12 items-center relative z-10">
          {/* Left panel: Camera visual review check */}
          <div className="lg:col-span-7 flex flex-col items-center gap-4">
            <div className="w-full aspect-[4/3] bg-zinc-900 border border-zinc-800 rounded-2xl relative overflow-hidden flex items-center justify-center shadow-2xl">
              {isCameraActive ? (
                <video 
                  ref={userVideoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className="absolute inset-0 w-full h-full object-cover transform -scale-x-100"
                />
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center">
                    <VideoOff className="w-6 h-6 text-zinc-500" />
                  </div>
                  <span className="text-sm text-zinc-500 font-semibold">Webcam deactivated</span>
                </div>
              )}

              {/* Bottom camera toggle overlay inside video */}
              <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-3 z-10">
                <button
                  onClick={toggleMic}
                  className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all ${
                    isMicMuted 
                      ? 'bg-red-500 border-red-500 text-white' 
                      : 'bg-zinc-950/80 border-zinc-800 text-zinc-300 hover:bg-zinc-900'
                  }`}
                >
                  {isMicMuted ? <MicOff className="w-4.5 h-4.5" /> : <Mic className="w-4.5 h-4.5" />}
                </button>

                <button
                  onClick={toggleCamera}
                  className={`w-10 h-10 rounded-full flex items-center justify-center border transition-all ${
                    !isCameraActive 
                      ? 'bg-red-500 border-red-500 text-white' 
                      : 'bg-zinc-950/80 border-zinc-800 text-zinc-300 hover:bg-zinc-900'
                  }`}
                >
                  {isCameraActive ? <Video className="w-4.5 h-4.5" /> : <VideoOff className="w-4.5 h-4.5" />}
                </button>
              </div>
            </div>
            <p className="text-zinc-500 text-xs text-center">Check your lighting and position. Tap camera/mic icons to adjust settings.</p>
          </div>

          {/* Right panel: join options */}
          <div className="lg:col-span-5 space-y-6 text-center lg:text-left">
            <div className="space-y-2">
              <h1 className="text-4xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">Ready to join?</h1>
              <p className="text-zinc-400 text-sm">We've established the room connection. Confirm details below.</p>
            </div>

            <div className="bg-zinc-900/60 border border-zinc-800/80 p-5 rounded-2xl space-y-3 backdrop-blur-md">
              <div className="flex items-center gap-2.5 text-sm font-semibold text-zinc-200">
                <Building className="w-4 h-4 text-red-400" /> {companyName} AI Simulation
              </div>
              <div className="text-xs text-zinc-400 pl-6 leading-relaxed">
                Role: <span className="text-zinc-200 font-bold">{interviewerName} ({difficulty})</span><br />
                Audio Synthesis: WebSpeech API (female preferred)<br />
                Duration: {Math.floor(sessionDurationSecs / 60)} minutes
              </div>
            </div>

            <button
              onClick={handleJoinRoom}
              className="w-full bg-primary hover:bg-primary-container text-white font-bold py-4 px-6 rounded-xl shadow-lg shadow-red-500/10 hover:scale-[1.01] transition-all flex items-center justify-center gap-2"
            >
              Join now <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Count active panels for responsive grid layout
  const secondaryActive = isScreenSharing || showWhiteboard;
  const activeQuestionIndex = messages.filter(m => m.role === 'ai').length;
  const activeQuestionText = messages.filter(m => m.role === 'ai').slice(-1)[0]?.text;

  return (
    <>
      <Seo
        title="Interview Session | AI Mock Interview | Red Resumes"
        description="Participate in an interactive AI mock interview. Practice answering industry-specific questions under realistic constraints."
      />
      <div className="min-h-screen bg-zinc-950 text-white flex flex-col justify-between select-none relative overflow-hidden">
      
      {/* Top Header Bar */}
      <div className="bg-zinc-900/60 border-b border-zinc-800/80 px-6 py-4 flex items-center justify-between backdrop-blur-md z-10">
        <div className="flex items-center gap-3">
          <div className="px-3 py-1 bg-zinc-800 rounded-lg text-xs font-semibold text-zinc-300 flex items-center gap-1.5 border border-zinc-700/50">
            <Building className="w-3.5 h-3.5 text-red-400" /> {companyName} Session
          </div>
          <div className="text-sm font-bold text-zinc-400">
            Question {activeQuestionIndex}/{totalQuestions}
          </div>
        </div>

        {/* Live indicators */}
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            <span className="text-xs font-bold text-red-500 uppercase tracking-widest">REC</span>
          </div>
          <div className="text-lg font-black font-mono text-zinc-200 bg-zinc-950/80 px-4 py-1.5 rounded-lg border border-zinc-800/80">
            {timerString}
          </div>
        </div>
      </div>

      {/* Main Classroom/Room Area */}
      <div className="flex-1 p-6 flex flex-col lg:flex-row gap-6 items-stretch overflow-hidden min-h-[calc(100vh-160px)]">
        
        {/* Left Side: Dynamic Grid containing Streams */}
        <div className={`flex-1 flex flex-col gap-6 ${secondaryActive ? 'lg:w-[65%]' : 'w-full'}`}>
          <div className={`flex-1 grid gap-6 ${secondaryActive ? 'grid-rows-2 grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
            
            {/* 1. AI Interviewer simulated feed */}
            <div className="bg-zinc-900 border border-zinc-800/85 rounded-2xl relative overflow-hidden shadow-2xl flex flex-col justify-between p-6">
              {/* Scanline overlay effect */}
              <div className="absolute inset-0 bg-scanlines pointer-events-none opacity-[0.03]" />
              
              {/* Recording indicator dot */}
              <div className="flex items-center justify-between">
                <span className="bg-zinc-950/80 border border-zinc-800/60 px-3 py-1 rounded-full text-xs font-semibold text-zinc-300 flex items-center gap-1.5 shadow-sm">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                  🤖 {interviewerName}
                </span>
                <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest select-none">AI FEED</span>
              </div>

              {/* Central Audio visualization / Visual representation */}
              <div className="flex flex-col items-center justify-center my-4 flex-1">
                {/* Audio wave bars */}
                <div className="flex items-end justify-center gap-1.5 h-16 mb-6 min-w-[200px]">
                  {speechVisualizerBars.map((val, idx) => (
                    <div 
                      key={idx} 
                      className={`w-1.5 rounded-full transition-all duration-75 ${
                        avatarState === 'speaking' ? 'bg-gradient-to-t from-primary to-rose-500' : 'bg-zinc-700'
                      }`}
                      style={{ height: `${val}%` }}
                    />
                  ))}
                </div>
                
                {avatarState === 'speaking' && (
                  <p className="text-sm font-semibold text-red-400 animate-pulse tracking-wide uppercase text-xs">AI Interviewer Speaking...</p>
                )}
                {avatarState === 'listening' && (
                  <p className="text-sm font-semibold text-emerald-400 tracking-wide uppercase text-xs">Listening to your response...</p>
                )}
                {avatarState === 'thinking' && (
                  <div className="flex items-center gap-2 text-zinc-400 tracking-wide uppercase text-xs font-semibold">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Analyzing response...
                  </div>
                )}
                {avatarState === 'idle' && (
                  <p className="text-sm font-semibold text-zinc-500 tracking-wide uppercase text-xs">Ready</p>
                )}
              </div>

              {/* Closed Captions Subtitle Overlay */}
              {activeQuestionText && (
                <div className="mb-4 bg-zinc-950/85 border border-zinc-800/80 p-4 rounded-xl max-w-2xl w-full mx-auto text-center shadow-lg animate-in fade-in zoom-in duration-200">
                  <p className="text-sm md:text-base font-semibold tracking-wide text-zinc-100 leading-relaxed">
                    {activeQuestionText}
                  </p>
                </div>
              )}

              {/* Status footer inside tile */}
              <div className="text-xs text-zinc-500 bg-zinc-950/60 border border-zinc-800/50 p-2.5 rounded-xl text-center">
                System status: Stable connection
              </div>
            </div>

            {/* 2. User camera feed */}
            <div className="bg-zinc-900 border border-zinc-800/85 rounded-2xl relative overflow-hidden shadow-2xl flex flex-col justify-between">
              
              {/* Actual local video feed */}
              {isCameraActive ? (
                <video 
                  ref={userVideoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className="absolute inset-0 w-full h-full object-cover rounded-2xl transform -scale-x-100"
                />
              ) : (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-950">
                  <div className="w-16 h-16 rounded-full bg-zinc-850 flex items-center justify-center mb-3">
                    <VideoOff className="w-6 h-6 text-zinc-600" />
                  </div>
                  <span className="text-xs font-semibold text-zinc-500">Webcam stream deactivated</span>
                </div>
              )}

              {/* Layout controls inside stream */}
              <div className="relative z-10 p-6 w-full h-full flex flex-col justify-between pointer-events-none">
                <div className="flex justify-between items-start">
                  <span className="bg-zinc-950/80 border border-zinc-800/60 px-3 py-1 rounded-full text-xs font-semibold text-zinc-300 shadow-sm">
                    👤 You
                  </span>
                  {isMicMuted && (
                    <span className="bg-red-500/10 border border-red-500/20 text-red-400 px-3.5 py-1 rounded-full text-xs font-bold shadow-sm uppercase tracking-wide">
                      Muted
                    </span>
                  )}
                </div>
              </div>

            </div>

          </div>
        </div>

        {/* Right Side / Sidebar: Shared Screen or Whiteboard drawing canvas */}
        {secondaryActive && (
          <div className="lg:w-[35%] flex flex-col bg-zinc-900 border border-zinc-800/85 rounded-2xl shadow-2xl overflow-hidden relative">
            
            {isScreenSharing && (
              <div className="flex-1 flex flex-col">
                <div className="bg-zinc-950 px-6 py-4 border-b border-zinc-800 flex justify-between items-center">
                  <span className="text-sm font-bold text-zinc-300 flex items-center gap-2">
                    <Monitor className="w-4 h-4 text-red-400" /> Live Screen Sharing
                  </span>
                  <button onClick={stopScreenShare} className="text-xs font-semibold text-red-400 hover:underline">Stop Sharing</button>
                </div>
                <div className="flex-1 bg-zinc-950 relative overflow-hidden">
                  <video 
                    ref={screenVideoRef} 
                    autoPlay 
                    playsInline 
                    className="absolute inset-0 w-full h-full object-contain"
                  />
                </div>
              </div>
            )}

            {showWhiteboard && (
              <div className="flex-1 flex flex-col h-full">
                {/* Whiteboard headers & tools */}
                <div className="bg-zinc-950 px-6 py-4 border-b border-zinc-800 flex flex-wrap gap-4 items-center justify-between">
                  <span className="text-sm font-bold text-zinc-300 flex items-center gap-2">
                    <Edit2 className="w-4 h-4 text-red-400" /> Drawing Whiteboard
                  </span>
                  
                  {/* Tools grid */}
                  <div className="flex items-center gap-2">
                    {/* Eraser */}
                    <button 
                      onClick={() => setIsEraser(!isEraser)}
                      className={`p-1.5 rounded-lg border ${
                        isEraser ? 'bg-primary border-red-500 text-white' : 'border-zinc-800 text-zinc-400 hover:bg-zinc-850'
                      }`}
                      title="Eraser tool"
                    >
                      <Eraser className="w-4 h-4" />
                    </button>
                    {/* Clear all */}
                    <button 
                      onClick={handleClearWhiteboard}
                      className="p-1.5 rounded-lg border border-zinc-800 text-zinc-400 hover:bg-zinc-850 hover:text-white"
                      title="Clear canvas"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Drawing colors */}
                <div className="bg-zinc-950/80 px-6 py-2 border-b border-zinc-800/60 flex gap-2">
                  {['#ef4444', '#f97316', '#10b981', '#3b82f6', '#ffffff'].map(color => (
                    <button
                      key={color}
                      onClick={() => { setDrawColor(color); setIsEraser(false); }}
                      className={`w-5 h-5 rounded-full border ${drawColor === color && !isEraser ? 'ring-2 ring-primary border-transparent' : 'border-zinc-700'}`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>

                {/* Actual canvas */}
                <div className="flex-1 bg-zinc-950 relative min-h-[300px]">
                  <canvas
                    ref={canvasRef}
                    onMouseDown={handleStartDrawing}
                    onMouseMove={handleDraw}
                    onMouseUp={handleStopDrawing}
                    onMouseLeave={handleStopDrawing}
                    className="absolute inset-0 cursor-crosshair w-full h-full object-contain"
                  />
                </div>
              </div>
            )}

          </div>
        )}

      </div>

      {/* Floating text transcript/history sidebar overlay (collapsed into controls or toggleable) */}
      <div className="absolute top-24 right-8 z-20 w-80 bg-zinc-900/90 border border-zinc-800/80 rounded-2xl shadow-2xl p-4 max-h-[350px] overflow-hidden flex flex-col backdrop-blur-md">
        <div className="flex justify-between items-center mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-red-400" /> Live transcription
          </span>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
          {messages.slice(-3).map((msg) => (
            <div key={msg.id} className="flex flex-col gap-0.5">
              <span className="text-[10px] font-bold text-zinc-500 uppercase">
                {msg.role === 'ai' ? interviewerName : 'You'}
              </span>
              <p className={msg.role === 'user' ? 'text-zinc-300' : 'text-red-200 font-medium'}>
                {msg.text}
              </p>
            </div>
          ))}
          {isListening && transcript && (
            <div className="flex flex-col gap-0.5 animate-pulse">
              <span className="text-[10px] font-bold text-emerald-400 uppercase">You (Speaking...)</span>
              <p className="text-zinc-400 italic">"{transcript}"</p>
            </div>
          )}
        </div>
        {isListening && !isMicMuted && (
          <div className="mt-3 pt-2.5 border-t border-zinc-800/60 flex justify-between items-center gap-2">
            <span className="text-[10px] text-zinc-500 font-medium">Auto-submits after 6s silence...</span>
            <button 
              onClick={() => { stopListening(); submitAnswer(transcript); }}
              className="bg-primary hover:bg-primary-container text-white font-bold py-1 px-3 rounded-lg text-[10px] shadow transition-colors"
            >
              Submit Now
            </button>
          </div>
        )}
      </div>

      {/* Control Actions Footer */}
      <div className="bg-zinc-900/80 border-t border-zinc-800/80 px-6 py-6 flex items-center justify-between backdrop-blur-md z-10">
        
        {/* Session details */}
        <div className="text-zinc-400 text-sm font-semibold select-none hidden md:block">
          AI Interviewer Persona: <span className="text-white">{interviewerName}</span>
        </div>

        {/* Controls grid */}
        <div className="flex items-center gap-4 mx-auto md:mx-0">
          
          {/* Mute/Unmute Mic */}
          <button
            onClick={toggleMic}
            className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-all ${
              isMicMuted 
                ? 'bg-red-500/10 border-red-500/30 text-red-500 hover:bg-red-500/20' 
                : 'bg-zinc-800 border-zinc-700/60 text-zinc-200 hover:bg-zinc-750 hover:text-white'
            }`}
            title={isMicMuted ? "Unmute microphone" : "Mute microphone"}
          >
            {isMicMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </button>

          {/* Toggle Camera */}
          <button
            onClick={toggleCamera}
            className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-all ${
              !isCameraActive 
                ? 'bg-red-500/10 border-red-500/30 text-red-500 hover:bg-red-500/20' 
                : 'bg-zinc-800 border-zinc-700/60 text-zinc-200 hover:bg-zinc-750 hover:text-white'
            }`}
            title={isCameraActive ? "Deactivate Camera" : "Activate Camera"}
          >
            {isCameraActive ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>

          {/* Share Screen */}
          <button
            onClick={toggleScreenShare}
            className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-all ${
              isScreenSharing 
                ? 'bg-primary border-red-500 text-white' 
                : 'bg-zinc-800 border-zinc-700/60 text-zinc-200 hover:bg-zinc-750 hover:text-white'
            }`}
            title={isScreenSharing ? "Stop sharing screen" : "Share your screen"}
          >
            <Monitor className="w-5 h-5" />
          </button>

          {/* Whiteboard */}
          <button
            onClick={toggleWhiteboard}
            className={`w-12 h-12 rounded-xl flex items-center justify-center border transition-all ${
              showWhiteboard 
                ? 'bg-primary border-red-500 text-white' 
                : 'bg-zinc-800 border-zinc-700/60 text-zinc-200 hover:bg-zinc-750 hover:text-white'
            }`}
            title={showWhiteboard ? "Hide whiteboard" : "Show whiteboard drawboard"}
          >
            <Edit2 className="w-5 h-5" />
          </button>

        </div>

        {/* End interview */}
        <button
          onClick={handleLeaveRoom}
          className="bg-red-600 hover:bg-red-500 text-white font-bold px-6 py-3 rounded-xl flex items-center gap-2 shadow-lg shadow-red-900/10 hover:shadow-red-600/10 hover:scale-[1.01] transition-all"
        >
          <PhoneOff className="w-4 h-4" /> Leave Room
        </button>

      </div>

      {/* Exit early Modal overlay */}
      {showExitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-3xl max-w-md w-full p-6 space-y-6 shadow-2xl text-center">
            <div className="w-12 h-12 bg-red-500/10 border border-red-500/20 text-red-500 rounded-full flex items-center justify-center mx-auto">
              <PhoneOff className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-xl font-bold tracking-tight text-white">Leave Interview Early?</h3>
              <p className="text-sm text-zinc-400">
                You have answered {messages.filter(m => m.role === 'user').length} questions. How would you like to proceed?
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => handleConfirmExitEarly(true)}
                className="w-full bg-primary hover:bg-primary-container text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-red-500/10"
              >
                Finish &amp; Generate Report
              </button>
              <button
                onClick={() => handleConfirmExitEarly(false)}
                className="w-full bg-zinc-800 hover:bg-zinc-750 border border-zinc-700 text-zinc-300 font-semibold py-3 px-4 rounded-xl transition-all"
              >
                Discard &amp; Exit to Dashboard
              </button>
              <button
                onClick={() => setShowExitModal(false)}
                className="w-full bg-transparent hover:bg-zinc-850 text-zinc-500 font-semibold py-3 px-4 rounded-xl transition-all text-xs"
              >
                Cancel &amp; Keep Practicing
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Generating early report loader */}
      {isEndingSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md flex-col gap-4 text-white">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
          <div className="text-center space-y-1">
            <p className="font-bold tracking-wide">Compiling Interview Answers...</p>
            <p className="text-xs text-zinc-400 max-w-xs leading-relaxed">Please wait while the AI generates your comprehensive performance report early.</p>
          </div>
        </div>
      )}
      
    </div>
    </>
  );
};
