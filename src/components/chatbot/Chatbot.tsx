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
  fullText?: string; // For typing effect
  isTyping?: boolean; // For typing effect
}

export type ChatbotTone = 'classic' | 'modern';
export type ChatbotDepthMode = 'surface' | 'philosophical' | 'tactical';

const TONE_STORAGE_KEY = 'greeneCounselTonePreference';
const DEPTH_MODE_STORAGE_KEY = 'greeneCounselDepthPreference';
export const CONVERSATION_HISTORY_STORAGE_KEY = 'greeneCounselConversationHistory';
const TYPING_SPEED_MS = 2; // Milliseconds per character

export default function Chatbot() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentTone, setCurrentTone] = useState<ChatbotTone>('classic');
  const [currentDepthMode, setCurrentDepthMode] = useState<ChatbotDepthMode>('philosophical');
  const [isClientInitialized, setIsClientInitialized] = useState(false);
  const [conversationContext, setConversationContext] = useState<string>('Awaiting topic');

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const isMobile = useIsMobile();

  const getInitialMessageText = (tone: ChatbotTone, depth: ChatbotDepthMode) => {
    const toneText = tone === 'classic' ? 'Classic Greene' : 'Modern Clarity';
    let depthText = '';
    switch (depth) {
      case 'surface': depthText = 'Surface Strategy'; break;
      case 'philosophical': depthText = 'Philosophical Depth'; break;
      case 'tactical': depthText = 'Tactical Combat Plan'; break;
    }
    return `Greetings. I am a reflection of Robert Greene's strategic mind. My current advisory style is ${toneText} with ${depthText}. You can adjust these settings using the icons in the header. How may I assist you?`;
  };

  useEffect(() => {
    let initialTone = 'classic' as ChatbotTone;
    const storedTone = localStorage.getItem(TONE_STORAGE_KEY) as ChatbotTone | null;
    if (storedTone && (storedTone === 'classic' || storedTone === 'modern')) {
      initialTone = storedTone;
    }
    setCurrentTone(initialTone);

    let initialDepthMode = 'philosophical' as ChatbotDepthMode;
    const storedDepthMode = localStorage.getItem(DEPTH_MODE_STORAGE_KEY) as ChatbotDepthMode | null;
    if (storedDepthMode && (storedDepthMode === 'surface' || storedDepthMode === 'philosophical' || storedDepthMode === 'tactical')) {
      initialDepthMode = storedDepthMode;
    }
    setCurrentDepthMode(initialDepthMode);

    const storedHistory = localStorage.getItem(CONVERSATION_HISTORY_STORAGE_KEY);
    let historyMessages: Message[] = [];
    if (storedHistory) {
      try {
        const parsedHistory = JSON.parse(storedHistory);
        if (Array.isArray(parsedHistory) && parsedHistory.every(m => m.id && typeof m.text === 'string' && m.sender)) {
          historyMessages = parsedHistory.map(m => ({...m, isTyping: false}));
        }
      } catch (e) {
        console.error("Failed to parse conversation history from localStorage", e);
        localStorage.removeItem(CONVERSATION_HISTORY_STORAGE_KEY);
      }
    }

    if (historyMessages.length > 0) {
      setMessages(historyMessages);
    } else {
      const initialBotMessageId = crypto.randomUUID();
      const welcomeText = getInitialMessageText(initialTone, initialDepthMode);
      setMessages([
        {
          id: initialBotMessageId,
          text: welcomeText,
          sender: 'bot',
          fullText: welcomeText,
          isTyping: false, // Display the initial message without typing.
        },
      ]);
    }

    setIsClientInitialized(true);
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isClientInitialized) return;

    // This effect updates the welcome message if tone/depth is changed before the conversation starts.
    if (messages.length === 1 && messages[0].sender === 'bot' && messages[0].text.startsWith("Greetings. I am a reflection")) {
      const updatedWelcomeText = getInitialMessageText(currentTone, currentDepthMode);
      if (messages[0].text !== updatedWelcomeText) {
         setMessages([
          {
            id: messages[0].id,
            text: updatedWelcomeText,
            sender: 'bot',
            fullText: updatedWelcomeText,
            isTyping: false, // Update instantly without typing
          },
        ]);
      }
    }
  }, [currentTone, currentDepthMode, isClientInitialized, messages]);


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
      id: crypto.randomUUID(),
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
      
      const botMessageId = crypto.randomUUID();
      setMessages((prevMessages) => [...prevMessages, {
        id: botMessageId,
        text: '', 
        sender: 'bot',
        fullText: response.advice,
        isTyping: true,
      }]);

    } catch (error) {
      console.error('Error getting guidance:', error);
      const errorBotMessageId = crypto.randomUUID();
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

  const capitalizeFirstWord = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return trimmed;
    return trimmed.replace(/^(\p{L})(.*)$/u, (_, first, rest) => `${first.toUpperCase()}${rest}`);
  };

  const formatContextText = (text: string) => {
    const words = text.split(/\s+/).filter(Boolean);
    const maxWords = 4; // keep between 2-4 words
    const base = words.length <= maxWords ? text : `${words.slice(0, maxWords).join(' ')}...`;
    return capitalizeFirstWord(base);
  };

  // Lock the conversation context to the first meaningful (>=3 words) user message.
  useEffect(() => {
    if (conversationContext !== 'Awaiting topic') return; // already set, do not change
    const firstMeaningfulUser = messages.find(
      (msg) => msg.sender === 'user' && typeof msg.text === 'string' && msg.text.trim().split(/\s+/).filter(Boolean).length >= 3
    );
    if (firstMeaningfulUser?.text) {
      setConversationContext(formatContextText(firstMeaningfulUser.text.trim()));
    }
  }, [messages, conversationContext]);

  if (!isClientInitialized) {
    return (
      <div className="flex flex-col h-screen w-full bg-background text-foreground overflow-hidden items-center justify-center">
        <BrainCircuit className="animate-pulse text-primary" size={48} />
        <p className="mt-4 text-muted-foreground">Initializing Counsel...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-full bg-background text-foreground overflow-hidden">
      <header className="p-3 sm:p-4 border-b border-border flex items-center justify-between shrink-0 bg-background">
        <div className="flex items-center space-x-2 sm:space-x-3">
          {isMobile && (
            <SidebarTrigger
              className="text-foreground hover:text-primary p-1.5 rounded-md hover:bg-muted -ml-1"
              aria-label="Open navigation menu"
            >
              <Menu size={isMobile ? 20 : 22} />
            </SidebarTrigger>
          )}
          <h1
            className={cn(
              "font-serif text-muted-foreground",
              isMobile ? "text-base" : "text-lg",
              "font-['Merriweather_Bold']",
              "font-bold",
              "truncate",
            )}
            title={conversationContext}
          >
            {conversationContext}
          </h1>
        </div>
        <div className="flex items-center space-x-1 sm:space-x-2">
          <Select value={currentTone} onValueChange={(value: ChatbotTone) => handleToneChange(value)}>
            <SelectTrigger
              className="w-auto h-9 px-2 sm:px-2.5 py-1.5 border-0 hover:bg-muted focus:ring-1 focus:ring-primary focus-visible:ring-1 focus-visible:ring-primary text-xs sm:text-sm text-muted-foreground hover:text-foreground [&_svg]:ml-1 [&_svg]:sm:ml-1.5"
              aria-label="Select response tone"
            >
              <SlidersHorizontal size={isMobile ? 14 : 16} className="mr-1 sm:mr-1.5 text-muted-foreground group-hover:text-foreground" />
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
              className="w-auto h-9 px-2 sm:px-2.5 py-1.5 border-0 hover:bg-muted focus:ring-1 focus:ring-primary focus-visible:ring-1 focus-visible:ring-primary text-xs sm:text-sm text-muted-foreground hover:text-foreground [&_svg]:ml-1 [&_svg]:sm:ml-1.5"
              aria-label="Select knowledge depth"
            >
              <Layers size={isMobile ? 14 : 16} className="mr-1 sm:mr-1.5 text-muted-foreground group-hover:text-foreground" />
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

      <ScrollArea className="flex-grow p-3 sm:p-4" ref={scrollAreaRef}>
        <div className="max-w-3xl mx-auto w-full">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}
          {isLoading && !messages.some(msg => msg.isTyping && msg.sender === 'bot') && ( 
            <div className="flex justify-center py-4">
              <div className="flex items-center space-x-2 p-2 text-sm text-muted-foreground bg-muted rounded-lg">
                <BrainCircuit className="animate-pulse" size={16} />
                <span>Robert Greene is contemplating...</span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <footer className="p-2 sm:p-3 border-t border-border bg-background shrink-0">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSubmit} className="flex w-full items-center space-x-2">
            <Input
              ref={inputRef}
              type="text"
              placeholder="Describe your situation..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="flex-grow h-12 bg-muted text-foreground placeholder:text-muted-foreground/80 focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0 border-0 shadow-sm rounded-full px-4 text-base"
              disabled={isLoading || messages.some(msg => msg.isTyping)} 
              aria-label="Chat input"
            />
            <Button
              type="submit"
              size="icon"
              className="bg-primary text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground rounded-full w-10 h-10 sm:w-12 sm:h-12 shrink-0"
              disabled={isLoading || !inputValue.trim() || messages.some(msg => msg.isTyping)} 
              aria-label="Send message"
            >
              <Send size={isMobile ? 18 : 20} />
              <span className="sr-only">Send</span>
            </Button>
          </form>
        </div>
      </footer>
    </div>
  );
}
