// src/components/chatbot/MessageBubble.tsx
"use client";

import type { Message } from './Chatbot';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { BrainCircuit, User } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MessageBubbleProps {
  message: Message;
}

export default function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.sender === 'user';

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
          'max-w-[82%] px-4 py-3 text-sm leading-relaxed shadow-xl sm:max-w-[76%] sm:px-6 sm:py-4 sm:text-base', 
          isUser
            ? 'rounded-[1.75rem] rounded-br-lg border border-white/10 bg-white/10 text-foreground shadow-black/20' 
            : 'cream-surface rounded-[1.75rem] rounded-bl-lg border border-black/5 shadow-black/20' 
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
