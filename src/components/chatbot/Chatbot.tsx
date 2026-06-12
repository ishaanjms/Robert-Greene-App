"use client";

import { useState, useRef, useEffect, type FormEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import MessageBubble from './MessageBubble';
import { getPhilosophicalGuidance, type PhilosophicalGuidanceInput } from '@/ai/flows/philosophical-guidance';
import { BrainCircuit, Send, Menu, SlidersHorizontal, Layers } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { SidebarTrigger } from '@/components/ui/sidebar';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'bot';
  tone?: ChatbotTone;
  depthMode?: ChatbotDepthMode;
  fullText?: string; // For typing effect
  isTyping?: boolean; // For typing effect
}

export type ChatbotTone = 'classic' | 'modern';
export type ChatbotDepthMode = 'surface' | 'philosophical' | 'tactical';

const TONE_STORAGE_KEY = 'greeneCounselTonePreference';
const DEPTH_MODE_STORAGE_KEY = 'greeneCounselDepthPreference';
export const CONVERSATION_HISTORY_STORAGE_KEY = 'greeneCounselConversationHistory';
export const CONVERSATION_TITLE_STORAGE_KEY = 'greeneCounselConversationTitle';
const TYPING_SPEED_MS = 2; // Milliseconds per character
const QUOTE_ROTATION_MS = 6000;
const LOADING_QUOTES: Array<{ author: string; text: string }> = [
  { author: 'Sun Tzu', text: 'All warfare is based on deception.' },
  { author: 'Voltaire', text: 'Lord, protect me from my friends; I can take care of my enemies.' },
  { author: 'Miyamoto Musashi', text: 'Think lightly of yourself and deeply of the world.' },
  { author: 'Seneca', text: 'We suffer more often in imagination than in reality.' },
  { author: 'Heraclitus', text: 'Everything flows.' },
  { author: 'Lord Chesterfield', text: 'Be wiser than other people if you can; but do not tell them so.' },
  { author: 'Thucydides', text: 'The strong do what they can and the weak suffer what they must.' },
  { author: 'Ovid', text: 'Let your hook always be cast; in the pool where you least expect it, there will be a fish.' },
  { author: 'Anton Chekhov', text: 'Man will become better when you show him what he is like.' },
  { author: 'Carl Jung', text: 'Knowing your own darkness is the best method for dealing with the darknesses of other people.' },
  { author: 'Arthur Schopenhauer', text: 'We forfeit three-fourths of ourselves in order to be like other people.' },
  { author: 'Friedrich Nietzsche', text: 'He who has a why to live for can bear almost any how.' },
  { author: 'Blaise Pascal', text: "All of humanity's problems stem from man's inability to sit quietly in a room alone." },
];

const isChatbotTone = (value: unknown): value is ChatbotTone => value === 'classic' || value === 'modern';
const isChatbotDepthMode = (value: unknown): value is ChatbotDepthMode =>
  value === 'surface' || value === 'philosophical' || value === 'tactical';

const TITLE_MAX_LENGTH = 34;
const titleStopWords = new Set([
  'a', 'about', 'am', 'an', 'and', 'are', 'at', 'be', 'but', 'can', 'do', 'for', 'from', 'getting',
  'have', 'help', 'how', 'i', 'im', 'in', 'is', 'it', 'me', 'my', 'need', 'of', 'on', 'or', 'our',
  'should', 'that', 'the', 'this', 'to', 'want', 'what', 'when', 'with',
]);

const createMessageId = () => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const toTitleCase = (text: string) =>
  text
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');

const trimTitle = (title: string) => {
  if (title.length <= TITLE_MAX_LENGTH) return title;
  const words = title.split(' ');
  let trimmed = '';

  for (const word of words) {
    const next = trimmed ? `${trimmed} ${word}` : word;
    if (next.length > TITLE_MAX_LENGTH) break;
    trimmed = next;
  }

  return trimmed || `${title.slice(0, TITLE_MAX_LENGTH - 3).trim()}...`;
};

const generateConversationTitle = (text: string) => {
  const normalized = text
    .toLowerCase()
    .replace(/\b(i'm|i am)\b/g, 'im')
    .replace(/\b(job|work)\s+loss\b/g, 'job loss')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const titlePatterns: Array<[RegExp, string]> = [
    [/\b(job loss|loss of job|loss of my job|lose my job|losing my job|fired|layoff|laid off)\b/, 'Fear of Job Loss'],
    [/\b(career path|career|profession|promotion)\b.*\b(uncertain|confused|stuck|lost)\b|\b(uncertain|confused|stuck|lost)\b.*\b(career path|career|profession|promotion)\b/, 'Career Uncertainty'],
    [/\b(boss|manager|superior)\b.*\b(power|control|politics|manipulat|conflict|difficult)\b|\b(power|control|politics|manipulat|conflict|difficult)\b.*\b(boss|manager|superior)\b/, 'Boss Power Dynamic'],
    [/\b(workplace|office|team|colleague|coworker)\b.*\b(conflict|politics|tension|power|trust)\b|\b(conflict|politics|tension|power|trust)\b.*\b(workplace|office|team|colleague|coworker)\b/, 'Workplace Power Dynamic'],
    [/\b(negotiate|negotiation|deal|offer|salary)\b/, 'Negotiation Strategy'],
    [/\b(influence|persuade|persuasion|convince)\b/, 'Influence Strategy'],
    [/\b(relationship|dating|seduction|partner|love)\b/, 'Relationship Strategy'],
    [/\b(decision|choose|choice|option|options|path|stuck between)\b/, 'Strategic Decision'],
    [/\b(fear|fearing|anxiety|afraid|worried|panic)\b/, 'Fear and Uncertainty'],
  ];

  const matchedPattern = titlePatterns.find(([pattern]) => pattern.test(normalized));
  if (matchedPattern) return matchedPattern[1];

  const keywords = normalized
    .split(' ')
    .filter(word => word.length > 2 && !titleStopWords.has(word))
    .slice(0, 4);

  return keywords.length ? trimTitle(toTitleCase(keywords.join(' '))) : 'Strategic Counsel';
};

export default function Chatbot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentTone, setCurrentTone] = useState<ChatbotTone>('classic');
  const [currentDepthMode, setCurrentDepthMode] = useState<ChatbotDepthMode>('philosophical');
  const [isClientInitialized, setIsClientInitialized] = useState(false);
  const [conversationContext, setConversationContext] = useState<string>('Awaiting topic');
  const [activeQuoteIndex, setActiveQuoteIndex] = useState(0);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  useEffect(() => {
    let initialTone = 'classic' as ChatbotTone;
    const storedTone = localStorage.getItem(TONE_STORAGE_KEY) as ChatbotTone | null;
    if (isChatbotTone(storedTone)) {
      initialTone = storedTone;
    }
    setCurrentTone(initialTone);

    let initialDepthMode = 'philosophical' as ChatbotDepthMode;
    const storedDepthMode = localStorage.getItem(DEPTH_MODE_STORAGE_KEY) as ChatbotDepthMode | null;
    if (isChatbotDepthMode(storedDepthMode)) {
      initialDepthMode = storedDepthMode;
    }
    setCurrentDepthMode(initialDepthMode);

    const storedHistory = localStorage.getItem(CONVERSATION_HISTORY_STORAGE_KEY);
    let historyMessages: Message[] = [];
    if (storedHistory) {
      try {
        const parsedHistory = JSON.parse(storedHistory);
        if (Array.isArray(parsedHistory) && parsedHistory.every(m => m.id && typeof m.text === 'string' && m.sender)) {
          historyMessages = parsedHistory.map(m => ({
            ...m,
            tone: isChatbotTone(m.tone) ? m.tone : undefined,
            depthMode: isChatbotDepthMode(m.depthMode) ? m.depthMode : undefined,
            isTyping: false,
          }));
        }
      } catch (e) {
        console.error("Failed to parse conversation history from localStorage", e);
        localStorage.removeItem(CONVERSATION_HISTORY_STORAGE_KEY);
      }
    }

    const hasOnlyLegacyWelcome =
      historyMessages.length === 1 &&
      historyMessages[0].sender === 'bot' &&
      historyMessages[0].text.startsWith("Greetings. I am a reflection");

    setMessages(hasOnlyLegacyWelcome ? [] : historyMessages);
    const storedTitle = localStorage.getItem(CONVERSATION_TITLE_STORAGE_KEY);
    if (!hasOnlyLegacyWelcome && storedTitle?.trim()) {
      setConversationContext(storedTitle.trim());
    }

    setIsClientInitialized(true);
    inputRef.current?.focus();
  }, []);


  useEffect(() => {
    if (!isClientInitialized || messages.length === 0) return;
    const savableMessages = messages.map(({ fullText, isTyping, ...msg }) => msg);
    localStorage.setItem(CONVERSATION_HISTORY_STORAGE_KEY, JSON.stringify(savableMessages));
  }, [messages, isClientInitialized]);

  // Typing effect
  useEffect(() => {
    if (!isClientInitialized) return;

    const typingMessage = messages.find(msg => msg.isTyping && msg.sender === 'bot');

    if (typingMessage) {
      const { id, fullText } = typingMessage;
      
      if (typeof fullText !== 'string') {
           setMessages(prevMessages =>
            prevMessages.map(msg => (msg.id === id ? { ...msg, isTyping: false, text: msg.text || 'Error: Response data missing.' } : msg))
          );
        return;
      }

      let currentIndex = typingMessage.text?.length || 0;

      if (currentIndex >= fullText.length) { // Already fully typed or fullText is empty
        setMessages(prevMessages =>
          prevMessages.map(msg => (msg.id === id ? { ...msg, isTyping: false } : msg))
        );
        return;
      }

      const intervalId = setInterval(() => {
        setMessages(prevMessages => {
          const currentMsgIndex = prevMessages.findIndex(m => m.id === id);
          if (currentMsgIndex === -1 || !prevMessages[currentMsgIndex].isTyping) {
            clearInterval(intervalId);
            return prevMessages;
          }

          const currentMsg = prevMessages[currentMsgIndex];
          const currentTextLength = currentMsg.text?.length || 0;

          if (currentTextLength < fullText.length) {
            return prevMessages.map(msg =>
              msg.id === id ? { ...msg, text: fullText.substring(0, currentTextLength + 1) } : msg
            );
          } else {
            clearInterval(intervalId);
            return prevMessages.map(msg =>
              msg.id === id ? { ...msg, isTyping: false } : msg
            );
          }
        });
      }, TYPING_SPEED_MS);

      return () => clearInterval(intervalId);
    }
  }, [messages, isClientInitialized]);


  // Smooth scroll effect
   useEffect(() => {
    // Automatic scrolling disabled as per user request.
    // if (!isClientInitialized) return;

    // if (scrollAreaRef.current) {
    //   const scrollViewport = scrollAreaRef.current.querySelector('div[data-radix-scroll-area-viewport]');
    //   if (scrollViewport) {
    //     setTimeout(() => {
    //       scrollViewport.scrollTo({
    //         top: scrollViewport.scrollHeight,
    //         behavior: 'smooth',
    //       });
    //     }, 50); 
    //   }
    // }
  }, [messages, isClientInitialized]);


  const handleToneChange = (newTone: ChatbotTone) => {
    setCurrentTone(newTone);
    if (isClientInitialized) {
      localStorage.setItem(TONE_STORAGE_KEY, newTone);
    }
    toast({
      title: "Tone Updated",
      description: `Advisor tone set to ${newTone === 'classic' ? 'Classic Greene' : 'Modern Clarity'}.`,
    });
  };

  const handleDepthModeChange = (newDepthMode: ChatbotDepthMode) => {
    setCurrentDepthMode(newDepthMode);
    if (isClientInitialized) {
      localStorage.setItem(DEPTH_MODE_STORAGE_KEY, newDepthMode);
    }
    let depthText = '';
    switch (newDepthMode) {
      case 'surface': depthText = 'Surface Strategy'; break;
      case 'philosophical': depthText = 'Philosophical Depth'; break;
      case 'tactical': depthText = 'Tactical Combat Plan'; break;
    }
    toast({
      title: "Depth Mode Updated",
      description: `Knowledge depth set to ${depthText}.`,
    });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!inputValue.trim() || isLoading || !isClientInitialized || messages.some(msg => msg.isTyping)) return;

    const userMessage: Message = {
      id: createMessageId(),
      text: inputValue,
      sender: 'user',
    };

    const updatedMessagesWithUser = [...messages, userMessage];
    setMessages(updatedMessagesWithUser);
    setInputValue('');
    setIsLoading(true);

    try {
      const conversationHistoryForPrompt = updatedMessagesWithUser
        .filter(msg => !msg.isTyping) 
        .map(msg => ({
          id: msg.id,
          text: msg.text,
          sender: msg.sender,
          isUser: msg.sender === 'user',
          isBot: msg.sender === 'bot',
      }));

      const input: PhilosophicalGuidanceInput = {
        situation: userMessage.text,
        tone: currentTone,
        depthMode: currentDepthMode,
        conversationHistory: conversationHistoryForPrompt,
      };
      const response = await getPhilosophicalGuidance(input);
      
      const botMessageId = createMessageId();
      setMessages((prevMessages) => [...prevMessages, {
        id: botMessageId,
        text: '', 
        sender: 'bot',
        tone: currentTone,
        depthMode: currentDepthMode,
        fullText: response.advice,
        isTyping: true,
      }]);

    } catch (error) {
      console.error('Error getting guidance:', error);
      const errorBotMessageId = createMessageId();
      const errorText = 'Apologies, I encountered an issue processing your request. Please try again later.';
      setMessages((prevMessages) => [...prevMessages, {
        id: errorBotMessageId,
        text: '', 
        sender: 'bot',
        fullText: errorText,
        isTyping: true,
      }]);
      toast({
        title: "Error",
        description: "Failed to get a response from the advisor. Please check your connection or try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  // Lock the conversation context to the first meaningful (>=3 words) user message.
  useEffect(() => {
    if (conversationContext !== 'Awaiting topic') return; // already set, do not change
    const firstMeaningfulUser = messages.find(
      (msg) => msg.sender === 'user' && typeof msg.text === 'string' && msg.text.trim().split(/\s+/).filter(Boolean).length >= 3
    );
    if (firstMeaningfulUser?.text) {
      const generatedTitle = generateConversationTitle(firstMeaningfulUser.text.trim());
      setConversationContext(generatedTitle);
      localStorage.setItem(CONVERSATION_TITLE_STORAGE_KEY, generatedTitle);
    }
  }, [messages, conversationContext]);

  const hasTypingMessage = messages.some(msg => msg.isTyping);
  const isInputDisabled = isLoading || hasTypingMessage;
  const isConversationEmpty = messages.length === 0;
  const activeQuote = LOADING_QUOTES[activeQuoteIndex % LOADING_QUOTES.length];

  useEffect(() => {
    if (!isLoading || hasTypingMessage) return;

    setActiveQuoteIndex(Math.floor(Math.random() * LOADING_QUOTES.length));
    const intervalId = window.setInterval(() => {
      setActiveQuoteIndex(index => (index + 1) % LOADING_QUOTES.length);
    }, QUOTE_ROTATION_MS);

    return () => window.clearInterval(intervalId);
  }, [isLoading, hasTypingMessage]);

  const renderComposer = (placement: 'center' | 'footer') => (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "composer-focus-glow flex w-full items-center gap-2 rounded-full border border-white/10 bg-black/25 p-1.5 shadow-2xl shadow-black/25 backdrop-blur-md",
        placement === 'center' && "bg-black/30"
      )}
    >
      <Input
        ref={inputRef}
        type="text"
        placeholder="Describe your situation..."
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        className="h-11 flex-grow rounded-full border-0 bg-transparent px-3 text-base text-foreground shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-0 focus-visible:ring-offset-0"
        disabled={isInputDisabled}
        aria-label="Chat input"
      />
      <Button
        type="submit"
        size="icon"
        className="h-10 w-10 shrink-0 rounded-full bg-primary text-primary-foreground shadow-md shadow-black/25 transition-transform hover:bg-primary/90 active:scale-95 disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none sm:h-11 sm:w-11"
        disabled={isLoading || !inputValue.trim() || hasTypingMessage}
        aria-label="Send message"
      >
        <Send size={isMobile ? 18 : 20} />
        <span className="sr-only">Send</span>
      </Button>
    </form>
  );

  if (!isClientInitialized) {
    return (
      <div className="app-shell-bg flex h-screen w-full flex-col items-center justify-center overflow-hidden text-foreground">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/10 text-primary shadow-2xl shadow-black/30">
          <BrainCircuit className="animate-pulse" size={30} />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Initializing Counsel...</p>
      </div>
    );
  }

  return (
    <div className="app-shell-bg flex h-screen w-full flex-col overflow-hidden text-foreground">
      <header className="surface-glass flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-3 py-3 sm:px-5">
        <div className="flex min-w-0 items-center space-x-2 sm:space-x-3">
          {isMobile && (
            <SidebarTrigger
              className="-ml-1 rounded-full p-1.5 text-foreground transition-colors hover:bg-white/10 hover:text-primary"
              aria-label="Open navigation menu"
            >
              <Menu size={isMobile ? 20 : 22} />
            </SidebarTrigger>
          )}
          <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-primary shadow-sm sm:flex">
            <BrainCircuit size={18} />
          </div>
          <div className="min-w-0">
            <h1
              className={cn(
                "font-serif text-foreground",
                isMobile ? "text-base" : "text-lg",
                "font-bold",
                "truncate",
              )}
              title={isConversationEmpty ? "Greene's Counsel" : conversationContext}
            >
              {isConversationEmpty ? "Greene's Counsel" : conversationContext}
            </h1>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Select value={currentTone} onValueChange={(value: ChatbotTone) => handleToneChange(value)}>
            <SelectTrigger
              className="h-9 w-9 rounded-full border border-white/15 bg-white/10 px-2 py-1.5 text-xs text-muted-foreground shadow-sm transition-colors hover:bg-white/15 hover:text-foreground focus:ring-1 focus:ring-ring focus-visible:ring-1 focus-visible:ring-ring sm:w-auto sm:px-3 sm:text-sm [&>span]:hidden sm:[&>span]:inline-flex [&_svg]:ml-0 [&_svg]:sm:ml-1.5"
              aria-label="Select response tone"
            >
              <SlidersHorizontal size={isMobile ? 14 : 16} className="text-muted-foreground sm:mr-1.5" />
              <SelectValue placeholder="Select tone" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel className="px-2 py-1 text-xs">Response Tone</SelectLabel>
                <SelectItem value="classic">Classic Greene</SelectItem>
                <SelectItem value="modern">Modern Clarity</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>

          <Select value={currentDepthMode} onValueChange={(value: ChatbotDepthMode) => handleDepthModeChange(value)}>
            <SelectTrigger
              className="h-9 w-9 rounded-full border border-white/15 bg-white/10 px-2 py-1.5 text-xs text-muted-foreground shadow-sm transition-colors hover:bg-white/15 hover:text-foreground focus:ring-1 focus:ring-ring focus-visible:ring-1 focus-visible:ring-ring sm:w-auto sm:px-3 sm:text-sm [&>span]:hidden sm:[&>span]:inline-flex [&_svg]:ml-0 [&_svg]:sm:ml-1.5"
              aria-label="Select knowledge depth"
            >
              <Layers size={isMobile ? 14 : 16} className="text-muted-foreground sm:mr-1.5" />
              <SelectValue placeholder="Select depth" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel className="px-2 py-1 text-xs">Knowledge Depth</SelectLabel>
                <SelectItem value="surface">Surface Strategy</SelectItem>
                <SelectItem value="philosophical">Philosophical Depth</SelectItem>
                <SelectItem value="tactical">Tactical Combat Plan</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </header>

      {isConversationEmpty ? (
        <main className="flex flex-grow items-center justify-center px-4 pb-20">
          <div className="w-full max-w-3xl">
            <div className="mb-7 text-center">
              <h2 className="text-3xl font-normal text-foreground sm:text-4xl">What are you navigating?</h2>
            </div>
            {renderComposer('center')}
          </div>
        </main>
      ) : (
        <>
          <ScrollArea className="flex-grow px-3 py-5 sm:px-5 sm:py-8" ref={scrollAreaRef}>
            <div className="mx-auto w-full max-w-3xl px-1 py-2 sm:px-4 sm:py-4">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {isLoading && !messages.some(msg => msg.isTyping && msg.sender === 'bot') && (
                <div className="flex justify-center py-4">
                  <div className="max-w-xl rounded-3xl border border-white/10 bg-white/[0.07] px-5 py-4 text-center shadow-lg shadow-black/10 backdrop-blur-sm">
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <BrainCircuit className="animate-pulse" size={16} />
                      <span>Robert Greene is contemplating...</span>
                    </div>
                    <div key={activeQuoteIndex} className="loading-quote-transition">
                      <blockquote className="mt-3 text-sm leading-relaxed text-foreground/75">
                        "{activeQuote.text}"
                      </blockquote>
                      <div className="mt-2 text-[11px] text-muted-foreground/70">
                        {activeQuote.author}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <footer className="surface-glass shrink-0 border-t border-white/10 px-3 py-3 sm:px-5 sm:py-4">
            <div className="mx-auto max-w-3xl">
              {renderComposer('footer')}
            </div>
          </footer>
        </>
      )}
    </div>
  );
}
