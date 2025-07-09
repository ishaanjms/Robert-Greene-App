
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
import { PlusCircle, ChevronsLeft, ChevronsRight, Bot } from "lucide-react"; // Added Bot for potential logo
import { cn } from "@/lib/utils";
import { CONVERSATION_HISTORY_STORAGE_KEY } from '@/components/chatbot/Chatbot';


export default function AppSidebar() {
  const { open, toggleSidebar } = useSidebar();

  const handleNewChat = () => {
    // Clear conversation history from localStorage
    if (typeof window !== 'undefined') {
      localStorage.removeItem(CONVERSATION_HISTORY_STORAGE_KEY);
    }
    // Reload the page to re-initialize the Chatbot component
    window.location.reload();
  };

  return (
    <Sidebar collapsible="icon" variant="sidebar" className="border-r border-sidebar-border">
      <SidebarHeader className="p-2 mt-2">
        {/* Example: Logo/Title area */}
          <div className={cn("flex items-center gap-2 px-2 h-8", !open && "justify-center")}>
            <Bot size={20} className="text-primary shrink-0" />
            {open && <span className="font-serif text-sm font-medium text-sidebar-foreground truncate">Greene's Counsel</span>}
          </div> 
      </SidebarHeader>
      <SidebarContent className="flex-grow p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleNewChat}
              tooltip={{ children: "Start a New Chat", side: "right", align:"center", className:"bg-card text-card-foreground border-border" }}
              className={cn(
                "justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-sidebar-ring",
                 !open && "justify-center"
              )}
              aria-label="Start a New Chat"
            >
              <PlusCircle size={20} />
              {open && <span className="ml-2">New Chat</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
          {/* Future sidebar items like chat history can be added here */}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-2">
        <SidebarMenuButton
          onClick={toggleSidebar}
          tooltip={{ children: open ? "Collapse Sidebar" : "Expand Sidebar", side: "right", align: "center", className:"bg-card text-card-foreground border-border" }}
          className={cn(
            "justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-sidebar-ring",
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
