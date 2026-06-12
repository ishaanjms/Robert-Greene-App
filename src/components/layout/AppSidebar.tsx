
// src/components/layout/AppSidebar.tsx
"use client";

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
import { PlusCircle, ChevronsLeft, ChevronsRight, Bot, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CONVERSATION_HISTORY_STORAGE_KEY,
  CONVERSATION_TITLE_STORAGE_KEY,
} from '@/components/chatbot/Chatbot';


export default function AppSidebar() {
  const { open, toggleSidebar } = useSidebar();

  const handleNewChat = () => {
    // Clear conversation history from localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CONVERSATION_HISTORY_STORAGE_KEY);
      localStorage.removeItem(CONVERSATION_TITLE_STORAGE_KEY);
    }
    // Reload the page to re-initialize the Chatbot component
    window.location.reload();
  };

  return (
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
      <SidebarFooter className="p-2">
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
  );
}
