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
        'flex items-start gap-2.5 my-3 sm:my-4', 
        isUser ? 'justify-end' : 'justify-start'
      )}
    >
      {!isUser && (
        <Avatar className="h-8 w-8 sm:h-9 sm:w-9 shrink-0">
          <AvatarFallback className="bg-muted text-muted-foreground">
            <BrainCircuit size={18} />
          </AvatarFallback>
        </Avatar>
      )}
      <div
        className={cn(
          'max-w-[75%] sm:max-w-[70%] rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-md text-sm sm:text-base leading-relaxed', 
          isUser
            ? 'bg-primary text-primary-foreground rounded-br-lg' 
            : 'bg-card text-card-foreground rounded-bl-lg' 
        )}
      >
        <ReactMarkdown
          className="prose prose-sm sm:prose-base dark:prose-invert max-w-none"
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
        <Avatar className="h-8 w-8 sm:h-9 sm:w-9 shrink-0">
          <AvatarFallback className="bg-secondary text-secondary-foreground">
            <User size={18} />
          </AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
