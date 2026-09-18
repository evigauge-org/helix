"use client";

import * as React from "react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { UserMenu } from "./user-menu";
import { Plus, Settings, User, BarChart3, Plug, MessageSquare, FileSearch, Eye, Bot, ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useChatStore } from "@/stores/chat-store";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const navItems = [
  { title: "Settings", href: "/settings", icon: Settings },
  { title: "Profile", href: "/profile", icon: User },
  { title: "Analytics", href: "/analytics", icon: BarChart3 },
  // { title: "RAG", href: "/rag", icon: FileSearch },
  { title: "Agents", href: "/agents", icon: Bot },
  { title: "Reviews", href: "/reviews", icon: ClipboardCheck },
  // { title: "Store Builder", href: "/store-builder", icon: Store },
  { title: "Integrations", href: "/integrations", icon: Plug },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const sessions = useChatStore((s) => s.sessions);
  const activeSessionId = useChatStore((s) => s.activeSessionId);
  const switchSession = useChatStore((s) => s.switchSession);
  const newChat = useChatStore((s) => s.newChat);
  const loadSessions = useChatStore((s) => s.loadSessions);
  const sessionsLoaded = useChatStore((s) => s.sessionsLoaded);

  // Load sessions from DB on mount
  React.useEffect(() => {
    if (!sessionsLoaded) loadSessions();
  }, [sessionsLoaded, loadSessions]);

  const handleNewChat = () => {
    newChat();
    router.push("/");
  };

  return (
    <Sidebar collapsible="icon" variant="floating" className="border-r border-[#0085CF]/10 bg-white">
      <SidebarHeader className="p-3 flex flex-row items-center justify-between">
        <span className="text-lg font-semibold text-[#0085CF] group-data-[collapsible=icon]:hidden">
          HELIX
        </span>
        <SidebarTrigger className="cursor-pointer text-gray-500 hover:text-[#0085CF] hover:bg-[#0085CF]/5 rounded-md transition-colors" />
      </SidebarHeader>

      <SidebarContent>
        {/* New Chat — dedicated button */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="New Chat"
                  onClick={handleNewChat}
                  className="cursor-pointer text-[#0085CF] hover:bg-[#0085CF]/10 font-medium transition-colors"
                >
                  <Plus className="size-4" />
                  <span>New Chat</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Navigation */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-gray-400 text-xs uppercase tracking-wider">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.href}
                    tooltip={item.title}
                    className="cursor-pointer text-gray-600 hover:text-[#0085CF] hover:bg-[#0085CF]/5 data-[active=true]:bg-[#0085CF]/10 data-[active=true]:text-[#0085CF] transition-colors"
                  >
                    <Link href={item.href}>
                      <item.icon className="size-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          {/* Expanded state — full chat history list */}
          <div className="group-data-[collapsible=icon]:hidden">
            <SidebarGroupLabel className="text-gray-400 text-xs uppercase tracking-wider">
              Chat History
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {sessions.length === 0 ? (
                  <SidebarMenuItem>
                    <SidebarMenuButton className="cursor-default text-gray-400">
                      <MessageSquare className="size-4" />
                      <span className="text-sm">No chats yet</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ) : (
                  sessions.map((session) => (
                    <SidebarMenuItem key={session.id}>
                      <SidebarMenuButton
                        isActive={session.id === activeSessionId}
                        tooltip={session.title}
                        onClick={() => { switchSession(session.id); router.push("/"); }}
                        className="cursor-pointer text-gray-600 hover:text-[#0085CF] hover:bg-[#0085CF]/5 data-[active=true]:bg-[#0085CF]/10 data-[active=true]:text-[#0085CF] transition-colors"
                      >
                        <MessageSquare className="size-4 shrink-0" />
                        <span className="truncate text-sm">{session.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </div>

          {/* Collapsed state — single Eye icon with popover */}
          <div className="hidden group-data-[collapsible=icon]:block">
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <Popover>
                    <PopoverTrigger asChild>
                      <SidebarMenuButton
                        tooltip="Chat History"
                        className="cursor-pointer text-gray-500 hover:text-[#0085CF] hover:bg-[#0085CF]/5 transition-colors"
                      >
                        <Eye className="size-4" />
                        <span>Chats</span>
                      </SidebarMenuButton>
                    </PopoverTrigger>
              <PopoverContent side="right" align="start" className="w-64 p-2 bg-white border border-[#0085CF]/15 shadow-lg">
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 py-1">
                  Chat History
                </p>
                {sessions.length === 0 ? (
                  <p className="text-xs text-gray-400 px-2 py-2">No chats yet</p>
                ) : (
                  <div className="max-h-75 overflow-y-auto space-y-0.5">
                    {sessions.map((session) => (
                      <button
                        key={session.id}
                        onClick={() => { switchSession(session.id); router.push("/"); }}
                        className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors cursor-pointer ${
                          session.id === activeSessionId
                            ? "bg-[#0085CF]/10 text-[#0085CF]"
                            : "text-gray-700 hover:bg-[#0085CF]/5 hover:text-[#0085CF]"
                        }`}
                      >
                        <MessageSquare className="size-3 shrink-0" />
                        <span className="text-xs truncate">{session.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </PopoverContent>
                  </Popover>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </div>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 border-t border-[#0085CF]/10">
        <UserMenu />
      </SidebarFooter>
    </Sidebar>
  );
}
