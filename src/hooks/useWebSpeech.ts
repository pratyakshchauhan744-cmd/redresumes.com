import { useState, useEffect, useCallback, useRef } from 'react';

// Basic Web Speech API declarations if missing
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
    _activeUtterances?: SpeechSynthesisUtterance[];
  }
}

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

export function useWebSpeech() {
  const [isSupported, setIsSupported] = useState<boolean>(true);
  const [transcript, setTranscript] = useState<string>('');
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const transcriptRef = useRef<string>('');
  const accumulatedTranscriptRef = useRef<string>('');

  const recognitionRef = useRef<any>(null);
  const shouldListenRef = useRef<boolean>(false);
  const isRecognitionRunningRef = useRef<boolean>(false); // track actual running state
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const resumeIntervalRef = useRef<any>(null); // Chrome long-text keep-alive
  const isFirstSpeakRef = useRef<boolean>(true);

  // Pre-load / warm up SpeechSynthesis voices list early
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('speechSynthesis' in window)) return;

    // Trigger initial voice load
    window.speechSynthesis.getVoices();

    const handleVoicesChanged = () => {
      window.speechSynthesis.getVoices();
    };
    window.speechSynthesis.addEventListener('voiceschanged', handleVoicesChanged);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', handleVoicesChanged);
      // Clear keep-alive on unmount
      if (resumeIntervalRef.current) {
        clearInterval(resumeIntervalRef.current);
      }
    };
  }, []);

  // Initialize SpeechRecognition once
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setIsSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false; // Use false + auto-restart — more reliable than continuous=true in Chrome
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      isRecognitionRunningRef.current = true;
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      let currentRunTranscript = '';
      // Loop from 0 to capture everything in the current run (avoid index overwrite bug)
      for (let i = 0; i < event.results.length; i++) {
        currentRunTranscript += event.results[i][0].transcript;
      }
      
      const fullTranscript = [accumulatedTranscriptRef.current, currentRunTranscript]
        .filter(Boolean)
        .join(' ');

      if (fullTranscript.trim()) {
        transcriptRef.current = fullTranscript;
        setTranscript(fullTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.warn('SpeechRecognition error:', event.error);
      isRecognitionRunningRef.current = false;
      // Don't kill mic on common transient errors — let onend handle restart
      if (event.error === 'no-speech' || event.error === 'aborted') {
        return;
      }
      // For fatal errors, stop listening
      shouldListenRef.current = false;
      setIsListening(false);
    };

    recognition.onend = () => {
      isRecognitionRunningRef.current = false;
      if (transcriptRef.current) {
        accumulatedTranscriptRef.current = transcriptRef.current;
      }
      if (shouldListenRef.current) {
        // Auto-restart after a short delay to avoid rapid-fire errors
        setTimeout(() => {
          if (shouldListenRef.current && !isRecognitionRunningRef.current) {
            try {
              isRecognitionRunningRef.current = true; // eager track
              recognition.start();
            } catch (err) {
              isRecognitionRunningRef.current = false;
              console.warn('Could not restart SpeechRecognition:', err);
            }
          }
        }, 200);
      } else {
        setIsListening(false);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      shouldListenRef.current = false;
      try {
        recognition.stop();
      } catch (_) {}
    };
  }, []);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) return;
    if (isRecognitionRunningRef.current) return; // already running, do nothing
    shouldListenRef.current = true;
    // Reset all transcript state for a fresh listening session
    accumulatedTranscriptRef.current = '';
    transcriptRef.current = '';
    setTranscript('');
    try {
      isRecognitionRunningRef.current = true; // eager track
      recognitionRef.current.start();
      // onstart will set isListening=true
    } catch (err) {
      isRecognitionRunningRef.current = false;
      console.warn('Could not start listening:', err);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (!recognitionRef.current) return;
    shouldListenRef.current = false;
    isRecognitionRunningRef.current = false;
    setIsListening(false);
    try {
      recognitionRef.current.stop();
    } catch (err) {
      console.warn('Could not stop listening:', err);
    }
  }, []);

  const speak = useCallback((text: string, onEnd?: () => void) => {
    if (!('speechSynthesis' in window)) {
      onEnd?.();
      return;
    }

    // Stop any previous keep-alive
    if (resumeIntervalRef.current) {
      clearInterval(resumeIntervalRef.current);
      resumeIntervalRef.current = null;
    }

    // Cancel any ongoing speech first
    window.speechSynthesis.cancel();

    let startTimeout: any = null;

    const performSpeak = (textToSpeak: string, isRetryAttempt: boolean) => {
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utteranceRef.current = utterance;
      let hasStarted = false;

      // Prevent garbage collection by keeping a strong global reference
      window._activeUtterances = window._activeUtterances || [];
      window._activeUtterances.push(utterance);

      const cleanup = () => {
        if (startTimeout) {
          clearTimeout(startTimeout);
          startTimeout = null;
        }
        if (resumeIntervalRef.current) {
          clearInterval(resumeIntervalRef.current);
          resumeIntervalRef.current = null;
        }
        if (window._activeUtterances) {
          const idx = window._activeUtterances.indexOf(utterance);
          if (idx > -1) window._activeUtterances.splice(idx, 1);
        }
        if (utteranceRef.current === utterance) {
          utteranceRef.current = null;
        }
      };

      // Select a good English voice
      const voices = window.speechSynthesis.getVoices();
      const preferredVoice =
        voices.find(v => v.name === 'Google US English') ||
        voices.find(v => v.name === 'Samantha') ||
        voices.find(v => v.lang === 'en-US' && !v.localService) || // prefer remote/neural
        voices.find(v => v.lang === 'en-US') ||
        voices.find(v => v.lang.startsWith('en'));
      if (preferredVoice) utterance.voice = preferredVoice;

      utterance.rate = 0.95;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onstart = () => {
        hasStarted = true;
        if (startTimeout) {
          clearTimeout(startTimeout);
          startTimeout = null;
        }
        setIsSpeaking(true);

        // CHROME BUG FIX: Chrome pauses speechSynthesis after ~15s.
        // Keep-alive by calling resume() every 10 seconds while speaking.
        if (resumeIntervalRef.current) {
          clearInterval(resumeIntervalRef.current);
        }
        resumeIntervalRef.current = setInterval(() => {
          if (window.speechSynthesis.speaking && !window.speechSynthesis.paused) return;
          if (window.speechSynthesis.paused) {
            window.speechSynthesis.resume();
          }
        }, 10000);
      };

      utterance.onend = () => {
        cleanup();
        setIsSpeaking(false);
        onEnd?.();
      };

      utterance.onerror = (e) => {
        // 'interrupted' fires when cancel() is called — don't treat as fatal
        if (e.error === 'interrupted' || e.error === 'canceled') {
          cleanup();
          setIsSpeaking(false);
          return;
        }
        console.error('Speech synthesis error:', e.error);
        cleanup();
        setIsSpeaking(false);
        onEnd?.();
      };

      window.speechSynthesis.resume();
      window.speechSynthesis.speak(utterance);

      // Fallback: if onstart hasn't fired in 3s, the utterance was likely swallowed.
      // Cancel & retry once.
      if (!isRetryAttempt) {
        startTimeout = setTimeout(() => {
          if (!hasStarted) {
            console.warn('TTS: utterance appears stuck, retrying...');
            cleanup();
            window.speechSynthesis.cancel();
            setTimeout(() => {
              performSpeak(textToSpeak, true);
            }, 300);
          }
        }, 3000);
      } else {
        // Retry attempt watchdog: if still not started in 3.5s, trigger fallback so they aren't stuck
        startTimeout = setTimeout(() => {
          if (!hasStarted) {
            console.warn('TTS: retry failed, falling back to text-only mode.');
            cleanup();
            setIsSpeaking(false);
            onEnd?.();
          }
        }, 3500);
      }
    };

    const isFirst = isFirstSpeakRef.current;
    if (isFirst) {
      isFirstSpeakRef.current = false;
    }

    const isSpeakingAlready = window.speechSynthesis.speaking || window.speechSynthesis.pending;

    if (isSpeakingAlready || isFirst) {
      window.speechSynthesis.cancel();
      setTimeout(() => {
        performSpeak(text, false);
      }, 200);
    } else {
      performSpeak(text, false);
    }
  }, []);

  const stopSpeaking = useCallback(() => {
    if (resumeIntervalRef.current) {
      clearInterval(resumeIntervalRef.current);
      resumeIntervalRef.current = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  }, []);

  return {
    isSupported,
    transcript,
    setTranscript,
    isListening,
    isSpeaking,
    startListening,
    stopListening,
    speak,
    stopSpeaking,
  };
}
