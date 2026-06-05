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
        <Avatar className="h-8 w-8 shrink-0 border border-border/80 shadow-sm sm:h-9 sm:w-9">
          <AvatarFallback className="bg-primary/10 text-primary">
            <BrainCircuit size={18} />
          </AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          'max-w-[82%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm sm:max-w-[72%] sm:px-4 sm:py-3 sm:text-base', 
          isUser
            ? 'rounded-br-md bg-primary text-primary-foreground shadow-primary/10' 
            : 'rounded-bl-md border border-border/70 bg-card/90 text-card-foreground' 
        )}
      >
        <ReactMarkdown
          className={cn(
            "prose prose-sm max-w-none sm:prose-base dark:prose-invert prose-p:my-0 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-strong:text-inherit",
            isUser ? "prose-a:text-primary-foreground" : "prose-a:text-accent"
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
        <Avatar className="h-8 w-8 shrink-0 border border-border/80 shadow-sm sm:h-9 sm:w-9">
          <AvatarFallback className="bg-secondary text-secondary-foreground">
            <User size={18} />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
