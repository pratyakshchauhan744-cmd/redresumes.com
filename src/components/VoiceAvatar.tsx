import React from 'react';
import { VoiceState } from '../hooks/useWebSpeech';

interface VoiceAvatarProps {
  state: VoiceState;
  className?: string;
}

export const VoiceAvatar: React.FC<VoiceAvatarProps> = ({ state, className = '' }) => {
  return (
    <div className={`relative flex items-center justify-center ${className}`}>
      {/* Background ripples / auras based on state */}
      
      {state === 'listening' && (
        <>
          <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping"></div>
          <div className="absolute inset-2 rounded-full bg-red-500/30 animate-pulse"></div>
        </>
      )}
      
      {state === 'speaking' && (
        <>
          <div className="absolute inset-0 rounded-full bg-red-500/20 animate-[ping_1.5s_cubic-bezier(0,0,0.2,1)_infinite]"></div>
          <div className="absolute inset-[-10px] rounded-full border-2 border-red-500/40 opacity-40 animate-[spin_3s_linear_infinite]"></div>
        </>
      )}
      
      {state === 'thinking' && (
        <div className="absolute inset-2 rounded-full bg-amber-400 opacity-40 animate-pulse"></div>
      )}

      {/* Avatar Image */}
      <div className={`relative z-10 w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-gradient-to-br from-primary to-rose-600 flex items-center justify-center shadow-xl overflow-hidden ${state === 'thinking' ? 'animate-bounce' : ''}`}>
        {/* Placeholder Avatar Icon */}
        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white opacity-90" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
        </svg>
      </div>
      
      {/* State badge */}
      <div className="absolute -bottom-2 z-20 px-3 py-1 bg-white shadow-md rounded-full text-xs font-semibold text-gray-700 flex items-center gap-1.5 border border-gray-100">
        {state === 'idle' && (
          <>
            <span className="w-2 h-2 rounded-full bg-gray-400"></span>
            Ready
          </>
        )}
        {state === 'listening' && (
          <>
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            Listening...
          </>
        )}
        {state === 'thinking' && (
          <>
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
            Thinking...
          </>
        )}
        {state === 'speaking' && (
          <>
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
            Speaking
          </>
        )}
      </div>
    </div>
  );
};
