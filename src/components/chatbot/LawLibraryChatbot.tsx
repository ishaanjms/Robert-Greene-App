"use client";

import {useEffect, useRef, useState, type FormEvent} from 'react';
import {BookOpen, Menu, Send} from 'lucide-react';
import MessageBubble from './MessageBubble';
import {
  CHATBOT_MODEL_OPTIONS,
  DEFAULT_CHATBOT_MODEL,
  MODEL_CHANGE_EVENT,
  MODEL_STORAGE_KEY,
  type ChatbotModel,
  type Message,
} from './Chatbot';
import {Button} from '@/components/ui/button';
import {ScrollArea} from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {SidebarTrigger} from '@/components/ui/sidebar';
import {Textarea} from '@/components/ui/textarea';
import {useIsMobile} from '@/hooks/use-mobile';
import {useToast} from '@/hooks/use-toast';
import {cn} from '@/lib/utils';

type LawLibraryResponse = {
  answer: string;
  sources: string[];
};

export const GREENE_LIBRARY_HISTORY_STORAGE_KEY = 'greeneCounselGreeneLibraryHistory';
export const LAW_LIBRARY_HISTORY_STORAGE_KEY = GREENE_LIBRARY_HISTORY_STORAGE_KEY;

const GREENE_LIBRARY_OPENING_PROMPTS = [
  'Ask the library',
  'Search the pattern',
  'Read the behavior',
  'Find the strategy at work',
  'Ground this in Greene',
  'Trace the hidden dynamic',
];

const createMessageId = () => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return `law-msg-${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const isChatbotModel = (value: unknown): value is ChatbotModel =>
  CHATBOT_MODEL_OPTIONS.some(option => option.value === value);

const getRandomPrompt = () => GREENE_LIBRARY_OPENING_PROMPTS[Math.floor(Math.random() * GREENE_LIBRARY_OPENING_PROMPTS.length)];

export default function LawLibraryChatbot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentModel, setCurrentModel] = useState<ChatbotModel>(DEFAULT_CHATBOT_MODEL);
  const [isClientInitialized, setIsClientInitialized] = useState(false);
  const [openingPrompt, setOpeningPrompt] = useState(GREENE_LIBRARY_OPENING_PROMPTS[0]);

  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const {toast} = useToast();

  useEffect(() => {
    const storedModel = localStorage.getItem(MODEL_STORAGE_KEY);
    setCurrentModel(isChatbotModel(storedModel) ? storedModel : DEFAULT_CHATBOT_MODEL);

    const storedHistory =
      localStorage.getItem(GREENE_LIBRARY_HISTORY_STORAGE_KEY) ||
      localStorage.getItem('greeneCounselLawLibraryHistory');
    if (storedHistory) {
      try {
        const parsedHistory = JSON.parse(storedHistory);
        if (Array.isArray(parsedHistory) && parsedHistory.every(m => m.id && typeof m.text === 'string' && m.sender)) {
          setMessages(parsedHistory.map(m => ({...m, isTyping: false})));
        }
      } catch (error) {
        console.error('Failed to parse law library history from localStorage', error);
        localStorage.removeItem(GREENE_LIBRARY_HISTORY_STORAGE_KEY);
        localStorage.removeItem('greeneCounselLawLibraryHistory');
      }
    }

    setOpeningPrompt(getRandomPrompt());
    setIsClientInitialized(true);
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isClientInitialized || messages.length === 0) return;
    const savableMessages = messages.map(({fullText, isTyping, ...message}) => message);
    localStorage.setItem(GREENE_LIBRARY_HISTORY_STORAGE_KEY, JSON.stringify(savableMessages));
  }, [messages, isClientInitialized]);

  useEffect(() => {
    const handleModelChange = (event: Event) => {
      const nextModel = (event as CustomEvent<ChatbotModel>).detail;
      if (isChatbotModel(nextModel)) {
        setCurrentModel(nextModel);
      }
    };

    window.addEventListener(MODEL_CHANGE_EVENT, handleModelChange);
    return () => window.removeEventListener(MODEL_CHANGE_EVENT, handleModelChange);
  }, []);

  useEffect(() => {
    const typingMessage = messages.find(message => message.isTyping && message.sender === 'bot');
    if (!typingMessage) return;

    const {id, fullText} = typingMessage;
    if (typeof fullText !== 'string') {
      setMessages(previous =>
        previous.map(message => (message.id === id ? {...message, isTyping: false, text: message.text || 'Response missing.'} : message))
      );
      return;
    }

    const intervalId = window.setInterval(() => {
      setMessages(previous => {
        const index = previous.findIndex(message => message.id === id);
        if (index === -1 || !previous[index].isTyping) {
          window.clearInterval(intervalId);
          return previous;
        }

        const current = previous[index];
        const currentLength = current.text?.length || 0;
        if (currentLength >= fullText.length) {
          window.clearInterval(intervalId);
          return previous.map(message => (message.id === id ? {...message, isTyping: false} : message));
        }

        return previous.map(message =>
          message.id === id ? {...message, text: fullText.substring(0, currentLength + 1)} : message
        );
      });
    }, 2);

    return () => window.clearInterval(intervalId);
  }, [messages]);

  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    const nextHeight = Math.min(textarea.scrollHeight, 180);
    textarea.style.height = `${nextHeight}px`;
    textarea.style.overflowY = textarea.scrollHeight > 180 ? 'auto' : 'hidden';
  }, [inputValue]);

  const handleModelChange = (newModel: ChatbotModel) => {
    setCurrentModel(newModel);
    if (isClientInitialized) {
      localStorage.setItem(MODEL_STORAGE_KEY, newModel);
      window.dispatchEvent(new CustomEvent(MODEL_CHANGE_EVENT, {detail: newModel}));
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!inputValue.trim() || isLoading || messages.some(message => message.isTyping)) return;

    const userMessage: Message = {
      id: createMessageId(),
      text: inputValue,
      sender: 'user',
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInputValue('');
    setIsLoading(true);

    try {
      const conversationHistory = updatedMessages
        .filter(message => !message.isTyping)
        .map(message => ({
          id: message.id,
          text: message.text,
          sender: message.sender,
          isUser: message.sender === 'user',
          isBot: message.sender === 'bot',
        }));

      const apiResponse = await fetch('/api/greene-library', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          question: userMessage.text,
          model: currentModel,
          conversationHistory,
        }),
      });

      const response = (await apiResponse.json()) as LawLibraryResponse;
      if (!apiResponse.ok) {
        throw new Error(response.answer || 'Greene Library API request failed.');
      }

      const sourceLine = response.sources.length
        ? `\n\n---\n\nSources: ${response.sources.join('; ')}`
        : '';

      setMessages(previous => [
        ...previous,
        {
          id: createMessageId(),
          text: '',
          sender: 'bot',
          fullText: `${response.answer}${sourceLine}`,
          isTyping: true,
        },
      ]);
    } catch (error) {
      console.error('Error getting Greene Library guidance:', error);
      const message = error instanceof Error ? error.message : 'I could not reach the Greene Library right now. Try again in a moment.';
      setMessages(previous => [
        ...previous,
        {
          id: createMessageId(),
          text: '',
          sender: 'bot',
          fullText: message,
          isTyping: true,
        },
      ]);
      toast({
        title: 'Library Error',
        description: 'The Greene Library response failed. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const hasTypingMessage = messages.some(message => message.isTyping);
  const isConversationEmpty = messages.length === 0;

  const renderComposer = (placement: 'center' | 'footer') => (
    <form
      onSubmit={handleSubmit}
      className={cn(
        'composer-focus-glow flex w-full flex-col rounded-[1.75rem] border p-1.5 backdrop-blur-md',
        placement === 'center'
          ? 'border-white/10 bg-black/30 shadow-2xl shadow-black/25'
          : 'border-white/[0.08] bg-white/[0.07] shadow-xl shadow-black/20'
      )}
    >
      <Textarea
        ref={inputRef}
        placeholder={placement === 'center' ? 'Ask a situation, pattern, law, or strategy to retrieve from the notes…' : 'Ask the library…'}
        value={inputValue}
        onChange={event => setInputValue(event.target.value)}
        onKeyDown={event => {
          if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;
          event.preventDefault();
          event.currentTarget.form?.requestSubmit();
        }}
        rows={1}
        className="max-h-[180px] min-h-11 resize-none rounded-[1.35rem] border-0 bg-transparent px-3 py-2.5 text-base leading-6 text-foreground shadow-none placeholder:text-muted-foreground/70 focus-visible:ring-0 focus-visible:ring-offset-0"
        disabled={isLoading || hasTypingMessage}
        aria-label="Greene Library input"
      />
      <div className="flex w-full items-center justify-between gap-2 px-1 pb-1">
        <Select value={currentModel} onValueChange={(value: ChatbotModel) => handleModelChange(value)}>
          <SelectTrigger
            className="h-9 w-auto max-w-[13rem] rounded-full border border-white/10 bg-white/[0.06] px-3 text-xs text-muted-foreground shadow-none transition-colors hover:bg-white/[0.09] hover:text-foreground focus:ring-1 focus:ring-ring focus-visible:ring-1 focus-visible:ring-ring sm:max-w-[16rem] sm:text-sm [&_svg]:ml-2"
            aria-label="Select model"
          >
            <SelectValue placeholder="Select model" />
          </SelectTrigger>
          <SelectContent align="start">
            <SelectGroup>
              <SelectLabel className="px-2 py-1 text-xs">Model</SelectLabel>
              {CHATBOT_MODEL_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Button
          type="submit"
          size="icon"
          className="h-10 w-10 shrink-0 rounded-full bg-primary text-primary-foreground shadow-md shadow-black/25 transition-transform hover:bg-primary/90 active:scale-95 disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none sm:h-11 sm:w-11"
          disabled={isLoading || !inputValue.trim() || hasTypingMessage}
          aria-label="Ask Greene Library"
        >
          <Send size={isMobile ? 18 : 20} />
          <span className="sr-only">Send</span>
        </Button>
      </div>
    </form>
  );

  if (!isClientInitialized) {
    return (
      <div className="app-shell-bg flex h-screen w-full flex-col items-center justify-center overflow-hidden text-foreground">
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-white/15 bg-white/10 text-primary shadow-2xl shadow-black/30">
          <BookOpen className="animate-pulse" size={28} />
        </div>
        <p className="mt-4 text-sm text-muted-foreground">Opening the Greene Library...</p>
      </div>
    );
  }

  return (
    <div className="app-shell-bg flex h-screen w-full flex-col overflow-hidden text-foreground">
      <header className="flex shrink-0 items-center justify-between gap-3 bg-transparent px-3 py-4 sm:px-5 sm:py-5">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          {isMobile && (
            <SidebarTrigger
              className="-ml-1 rounded-full p-1.5 text-foreground transition-colors hover:bg-white/10 hover:text-primary"
              aria-label="Open navigation menu"
            >
              <Menu size={isMobile ? 20 : 22} />
            </SidebarTrigger>
          )}
          <h1 className="truncate font-serif text-lg font-bold text-foreground">
            Greene Library
          </h1>
        </div>
        <div className="hidden text-sm text-muted-foreground sm:block">
          Grounded in your Greene markdown notes
        </div>
      </header>

      {isConversationEmpty ? (
        <main className="flex flex-grow items-center justify-center px-4 pb-20">
          <div className="w-full max-w-3xl">
            <div className="mb-7 text-center">
              <h2 className="min-h-[2.5em] text-3xl font-normal leading-tight text-foreground transition-opacity sm:min-h-[1.25em] sm:text-4xl">
                {openingPrompt}
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
                This chat retrieves from your Laws of Human Nature and 33 Strategies of War notes before answering.
              </p>
            </div>
            {renderComposer('center')}
          </div>
        </main>
      ) : (
        <>
          <ScrollArea className="flex-grow px-3 pt-5 sm:px-5 sm:pt-8" ref={scrollAreaRef}>
            <div className="mx-auto w-full max-w-3xl px-1 pb-6 pt-2 sm:px-4 sm:pb-8 sm:pt-4">
              {messages.map(message => (
                <MessageBubble key={message.id} message={message} />
              ))}
              {isLoading && !hasTypingMessage && (
                <div className="flex justify-center py-4">
                  <div className="max-w-xl rounded-3xl border border-white/10 bg-white/[0.07] px-5 py-4 text-center shadow-lg shadow-black/10 backdrop-blur-sm">
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                      <BookOpen className="animate-pulse" size={16} />
                      <span>Searching the Greene Library...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>

          <footer className="shrink-0 bg-transparent px-3 pb-5 pt-2 sm:px-5 sm:pb-6 sm:pt-3">
            <div className="mx-auto max-w-3xl">
              {renderComposer('footer')}
            </div>
          </footer>
        </>
      )}
    </div>
  );
}
