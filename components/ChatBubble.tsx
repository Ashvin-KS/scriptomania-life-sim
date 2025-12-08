import React, { useState, useEffect, useMemo } from 'react';
import { ChatMessage, Character } from '../types';
import { CHARACTERS } from '../constants';
import FluidText from './FluidText';

interface ChatBubbleProps {
  message: ChatMessage;
  showThinking?: boolean;
  characters?: Character[];
  onRetry?: () => void;
  onJump?: () => void;
  isLastMessage?: boolean;
  isStreaming?: boolean;
  isNew?: boolean;
  fontSize?: number;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ message, showThinking, characters = [], onRetry, onJump, isLastMessage = false, isStreaming = false, isNew = false, fontSize = 16 }) => {
  // Only animate if it's a NEW message. Old messages load instantly.
  const [currentStep, setCurrentStep] = useState((isNew && isLastMessage) ? 0 : 9999);

  // Reset step if message ID changes (new message) - only if it IS the last message AND it is new
  useEffect(() => {
    if (!isNew) return; // Never re-animate old history

    if (isLastMessage) {
      setCurrentStep(0);
    } else {
      setCurrentStep(9999);
    }
  }, [message.id, isLastMessage, isNew]);

  const textSpeed = (isNew && isLastMessage) ? 20 : 0;
  const thinkingSpeed = (isNew && isLastMessage) ? 5 : 0;

  if (message.role === 'user') {
    return (
      <div className={`flex justify-end mb-6 px-4 group relative ${isNew ? 'animate-slide-up' : ''}`}>
        {/* User Bubble: Matches Narration Glass Style */}
        <div className="relative max-w-[85%] md:max-w-[70%] bg-black/20 backdrop-transparent-md text-white rounded-2xl rounded-tr-sm px-6 py-4 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] border border-white/10 overflow-hidden">
          <p className="font-sans font-medium text-shadow-sm leading-relaxed mb-1" style={{ fontSize: `${fontSize * 1.125}px` }}>{message.content}</p>

          {/* Edit/Jump Button (Inside Bubble, Bottom Left) */}
          {onJump && (
            <div className="absolute bottom-1 left-1 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onJump();
                }}
                className="p-1.5 bg-white/10 hover:bg-pink-500/40 text-white/40 hover:text-white rounded-full backdrop-blur-md transition-colors"
                title="Edit this message"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Model response
  const story = message.structuredContent;
  if (!story) return null;

  // Normalize content for backward compatibility with old localStorage data
  const displayContent = useMemo(() => {
    if (story.content && story.content.length > 0) {
      return story.content;
    }
    // Fallback for old format
    const fallback: any[] = [];
    if (story.narration) {
      fallback.push({ type: 'narration', text: story.narration });
    }
    if (story.dialogue && story.dialogue.length > 0) {
      story.dialogue.forEach(d => fallback.push({ type: 'dialogue', character: d.character, text: d.text }));
    }
    return fallback;
  }, [story]);

  // Helper to advance step safely
  const advanceStep = (completedStepIndex: number) => {
    setCurrentStep(prev => Math.max(prev, completedStepIndex + 1));
  };

  // Completion Logic
  // Completion Logic
  const reasoningCanComplete = !isStreaming || displayContent.length > 0;

  return (
    <div className="flex flex-col space-y-6 mb-12 w-full relative group">

      {/* Reasoning Block (Step 0) */}
      {showThinking && (
        <div className={`flex justify-center w-full my-2 ${currentStep < 0 ? 'hidden' : ''} ${isNew ? 'animate-fade-in' : ''}`}>
          <details className="w-full max-w-xl mx-4 group/thinking" open={!!message.reasoning}>
            <summary className="list-none cursor-pointer text-xs text-white/40 hover:text-pink-400/80 transition-colors text-center select-none">
              ✨ Director
            </summary>
            <div className="mt-2 p-4 bg-black/20 backdrop-transparent-sm rounded-lg border border-white/5 text-white/60 font-mono whitespace-pre-wrap leading-relaxed" style={{ fontSize: `${fontSize * 0.75}px` }}>
              <FluidText
                text={message.reasoning || ''}
                speed={thinkingSpeed}
                onComplete={() => advanceStep(0)}
                canComplete={reasoningCanComplete}
              />
            </div>
          </details>
        </div>
      )}
      {/* If thinking is disabled, auto-advance step 0 immediately */}
      {!showThinking && <FluidText text="" onComplete={() => advanceStep(0)} className="hidden" />}

      {/* Content Blocks (Step 1+) */}
      <div className="flex flex-col space-y-6 px-2 md:px-8">
        {displayContent.map((item, idx) => {
          const itemStep = 1 + idx;
          if (currentStep < itemStep) return null;

          const canComplete = !isStreaming || idx < displayContent.length - 1;

          if (item.type === 'narration') {
            return (
              <div key={idx} className={`flex justify-center w-full my-4 ${isNew ? 'animate-fade-in' : ''}`}>
                <div className="relative bg-black/20 backdrop-transparent-md border border-white/10 rounded-xl p-6 shadow-xl max-w-xl mx-4 text-center group/narration hover:bg-black/30 transition-colors overflow-hidden">
                  {/* Decorative quotes */}
                  <span className="absolute -top-4 left-4 text-4xl text-white/20 font-serif group-hover/narration:text-pink-400/30 transition-colors">"</span>
                  <span className="absolute -bottom-8 right-4 text-4xl text-white/20 font-serif rotate-180 group-hover/narration:text-pink-400/30 transition-colors">"</span>

                  <p className="text-white/90 italic font-serif leading-relaxed font-light tracking-wide relative z-10" style={{ fontSize: `${fontSize * 1.125}px` }}>
                    <FluidText
                      text={item.text || ''}
                      speed={textSpeed}
                      onComplete={() => advanceStep(itemStep)}
                      canComplete={canComplete}
                    />
                  </p>



                  <div className="mt-3 flex justify-center gap-1 opacity-50">
                    <div className="w-1 h-1 rounded-full bg-white"></div>
                    <div className="w-1 h-1 rounded-full bg-white"></div>
                    <div className="w-1 h-1 rounded-full bg-white"></div>
                  </div>
                </div>
              </div>
            );
          } else {
            // Dialogue
            const normalizedCharName = item.character?.trim().toLowerCase() || '';
            const charData = characters.find(c => c.name?.trim().toLowerCase() === normalizedCharName) ||
              CHARACTERS.find(c => c.name?.trim().toLowerCase() === normalizedCharName) || {
              color: 'bg-gray-100 text-gray-800 border-gray-200',
              avatar: 'https://via.placeholder.com/150',
              name: item.character
            };

            return (
              <div key={idx} className={`flex justify-start items-end space-x-3 group/dialogue ${isNew ? 'animate-slide-up' : ''}`}>
                {/* Character Avatar */}
                <div className="relative shrink-0">
                  <div className="w-14 h-14 md:w-16 md:h-16 rounded-full overflow-hidden border-2 border-white/30 shadow-lg transition-transform duration-300 group-hover/dialogue:scale-110">
                    <img src={charData.avatar} alt={item.character} className="w-full h-full object-cover object-top filter brightness-90 group-hover/dialogue:brightness-100" />
                  </div>
                  {/* Name Tag */}
                  <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-black/60 backdrop-transparent-md text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-widest whitespace-nowrap z-10 border border-white/20 shadow-md">
                    {item.character}
                  </div>
                </div>

                {/* Speech Bubble */}
                <div className={`relative p-5 rounded-3xl rounded-tl-none shadow-[0_8px_32px_0_rgba(0,0,0,0.2)] border border-white/10 bg-black/20 backdrop-transparent-md max-w-[85%] md:max-w-[75%] hover:bg-black/30 transition-colors overflow-hidden`}>
                  <p className="text-white/95 font-body leading-snug font-medium tracking-wide mb-1" style={{ fontSize: `${fontSize}px` }}>
                    <FluidText
                      text={item.text}
                      speed={textSpeed}
                      onComplete={() => advanceStep(itemStep)}
                      canComplete={canComplete}
                    />
                  </p>


                </div>
              </div>
            );
          }
        })}
      </div>


      {/* Retry Button for Errors */}
      {
        displayContent.some(item => item.type === 'narration' && typeof item.text === 'string' && item.text.includes("The connection to the story world seems unstable")) && onRetry && (
          <div className="flex justify-center animate-fade-in">
            <button
              onClick={onRetry}
              className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/40 text-red-200 rounded-full border border-red-500/30 transition-all text-sm font-bold"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Retry Generation
            </button>
          </div>
        )
      }
    </div >
  );
};

export default ChatBubble;