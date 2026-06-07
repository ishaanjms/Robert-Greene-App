// src/components/chatbot/MessageBubble.tsx
"use client";

import type { ChatbotDepthMode, ChatbotTone, Message } from './Chatbot';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { BrainCircuit, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MessageBubbleProps {
  message: Message;
}

const toneLabels: Record<ChatbotTone, string> = {
  classic: 'Classic Greene',
  modern: 'Modern Clarity',
};

const depthLabels: Record<ChatbotDepthMode, string> = {
  surface: 'Surface Strategy',
  philosophical: 'Philosophical Depth',
  tactical: 'Tactical Combat Plan',
};

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.sender === 'user';
  const toneLabel = message.tone ? toneLabels[message.tone] : undefined;
  const depthLabel = message.depthMode ? depthLabels[message.depthMode] : undefined;
  const shouldShowMode = !isUser && !message.isTyping && toneLabel && depthLabel;

  return (
    <div
      className={cn(
        'my-4 flex items-start gap-2.5 sm:my-5', 
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      {!isUser && (
        <Avatar className="h-8 w-8 shrink-0 border border-white/15 shadow-sm sm:h-9 sm:w-9">
          <AvatarFallback className="bg-white/10 text-primary">
            <BrainCircuit size={18} />
          </AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          'max-w-[82%] px-4 py-3 text-sm leading-relaxed shadow-lg sm:max-w-[76%] sm:px-6 sm:py-4 sm:text-base', 
          isUser
            ? 'rounded-[1.75rem] rounded-br-lg border border-white/10 bg-white/10 text-foreground shadow-black/20' 
            : 'cream-surface rounded-[1.75rem] rounded-bl-lg border border-white/10 shadow-black/15' 
        )}
      >
        <ReactMarkdown
          className={cn(
            "prose prose-sm max-w-none sm:prose-base prose-p:my-0 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-strong:text-inherit",
            isUser
              ? "dark:prose-invert prose-a:text-primary"
              : "prose-neutral prose-a:text-stone-700"
          )}
          remarkPlugins={[remarkGfm]}
          // You can customize components if needed, e.g., for links or images
          // components={{
          //   a: ({node, ...props}) => <a target="_blank" rel="noopener noreferrer" {...props} />
          // }}
        >
          {message.text}
        </ReactMarkdown>
        {shouldShowMode && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px] leading-none text-stone-700/55">
            <span className="mr-0.5">Used</span>
            <span className="rounded-full bg-black/5 px-2 py-1">{toneLabel}</span>
            <span className="rounded-full bg-black/5 px-2 py-1">{depthLabel}</span>
          </div>
        )}
      </div>
      {isUser && (
        <Avatar className="h-8 w-8 shrink-0 border border-white/15 shadow-sm sm:h-9 sm:w-9">
          <AvatarFallback className="bg-white/10 text-secondary-foreground">
            <User size={18} />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
