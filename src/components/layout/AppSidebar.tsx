
// src/components/layout/AppSidebar.tsx
"use client";

import { useEffect, useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Bot,
  ChevronsLeft,
  ChevronsRight,
  PlusCircle,
  Settings,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CHATBOT_MODEL_OPTIONS,
  CONVERSATION_HISTORY_STORAGE_KEY,
  CONVERSATION_TITLE_STORAGE_KEY,
  DEFAULT_CHATBOT_MODEL,
  MODEL_CHANGE_EVENT,
  MODEL_STORAGE_KEY,
  type ChatbotModel,
} from '@/components/chatbot/Chatbot';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


export default function AppSidebar() {
  const { open, toggleSidebar } = useSidebar();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ChatbotModel>(DEFAULT_CHATBOT_MODEL);

  useEffect(() => {
    const storedModel = localStorage.getItem(MODEL_STORAGE_KEY);
    const isKnownModel = CHATBOT_MODEL_OPTIONS.some(option => option.value === storedModel);
    setSelectedModel(isKnownModel ? storedModel as ChatbotModel : DEFAULT_CHATBOT_MODEL);
  }, []);

  const handleNewChat = () => {
    // Clear conversation history from localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CONVERSATION_HISTORY_STORAGE_KEY);
      localStorage.removeItem(CONVERSATION_TITLE_STORAGE_KEY);
    }
    // Reload the page to re-initialize the Chatbot component
    window.location.reload();
  };

  const handleModelChange = (model: ChatbotModel) => {
    setSelectedModel(model);
    localStorage.setItem(MODEL_STORAGE_KEY, model);
    window.dispatchEvent(new CustomEvent(MODEL_CHANGE_EVENT, { detail: model }));
  };

  const selectedModelOption = CHATBOT_MODEL_OPTIONS.find(option => option.value === selectedModel);

  return (
    <>
      <Sidebar collapsible="icon" variant="sidebar" className="border-r border-white/10 bg-sidebar/90">
        <SidebarHeader className="px-2 pb-3 pt-4">
            <div className={cn("flex items-center gap-2 rounded-md px-2 py-2", !open && "justify-center px-0")}>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/10 text-primary shadow-sm">
                <Bot size={18} />
              </div>
              {open && (
                <div className="min-w-0">
                  <span className="block truncate font-serif text-sm font-bold text-sidebar-foreground">Greene's Counsel</span>
                  <span className="block truncate text-[11px] text-sidebar-foreground/55">Strategic advisory</span>
                </div>
              )}
            </div> 
        </SidebarHeader>
        <SidebarContent className="flex-grow p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={handleNewChat}
                tooltip={{ children: "Start a New Chat", side: "right", align:"center", className:"bg-card text-card-foreground border-border" }}
                className={cn(
                  "h-10 justify-start rounded-full text-sidebar-foreground transition-colors hover:bg-white/10 hover:text-sidebar-accent-foreground focus-visible:ring-sidebar-ring",
                   !open && "justify-center"
                )}
                aria-label="Start a New Chat"
              >
                <PlusCircle size={20} />
                {open && <span className="ml-2">New Chat</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
            {open && (
              <SidebarMenuItem>
                <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-3 text-xs leading-relaxed text-sidebar-foreground/65 shadow-sm">
                  <div className="mb-1 flex items-center gap-1.5 font-medium text-sidebar-foreground/85">
                    <Sparkles size={13} className="text-primary" />
                    Counsel mode
                  </div>
                  Ask for strategy, power dynamics, persuasion, or conflict analysis.
                </div>
              </SidebarMenuItem>
            )}
          </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="space-y-1 p-2">
          <SidebarMenuButton
            onClick={() => setIsSettingsOpen(true)}
            tooltip={{ children: "Settings", side: "right", align: "center", className:"bg-card text-card-foreground border-border" }}
            className={cn(
              "h-10 justify-start rounded-full text-sidebar-foreground/75 transition-colors hover:bg-white/10 hover:text-sidebar-accent-foreground focus-visible:ring-sidebar-ring",
              !open && "justify-center"
            )}
            aria-label="Open settings"
          >
            <Settings size={20} />
            {open && <span className="ml-2">Settings</span>}
          </SidebarMenuButton>
          <SidebarMenuButton
            onClick={toggleSidebar}
            tooltip={{ children: open ? "Collapse Sidebar" : "Expand Sidebar", side: "right", align: "center", className:"bg-card text-card-foreground border-border" }}
            className={cn(
              "h-10 justify-start rounded-full text-sidebar-foreground/75 transition-colors hover:bg-white/10 hover:text-sidebar-accent-foreground focus-visible:ring-sidebar-ring",
              !open && "justify-center"
            )}
            aria-label={open ? "Collapse Sidebar" : "Expand Sidebar"}
          >
            {open ? <ChevronsLeft size={20} /> : <ChevronsRight size={20} />}
            {open && <span className="ml-2">{open ? "Collapse" : "Expand"}</span>}
          </SidebarMenuButton>
        </SidebarFooter>
      </Sidebar>

      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="border-white/10 bg-card text-card-foreground shadow-2xl shadow-black/40 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">Settings</DialogTitle>
            <DialogDescription>
              Choose which model powers new responses.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-card-foreground/90" htmlFor="model-select">
                Model
              </label>
              <Select value={selectedModel} onValueChange={(value: ChatbotModel) => handleModelChange(value)}>
                <SelectTrigger id="model-select" className="border-white/10 bg-black/20 text-card-foreground">
                  <SelectValue placeholder="Select model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Available models</SelectLabel>
                    {CHATBOT_MODEL_OPTIONS.map(option => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.provider} / {option.modelId}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {selectedModelOption && (
              <div className="rounded-lg border border-white/10 bg-black/20 p-3 text-xs leading-relaxed text-card-foreground/70">
                <div className="font-medium text-card-foreground/90">{selectedModelOption.label}</div>
                <div className="mt-1">{selectedModelOption.description}</div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
