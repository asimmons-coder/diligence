"use client";

import { useStore } from "@/lib/store";
import { AssistantDrawer } from "@/components/assistant/assistant-drawer";
import { Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";
import { TooltipProvider } from "@/components/ui/tooltip";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { ready } = useStore();

  return (
    <TooltipProvider>
      <div className="flex h-svh overflow-hidden bg-background">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="min-h-0 flex-1 overflow-auto">
            {ready ? children : <div className="p-6 text-sm text-muted-foreground">Loading book…</div>}
          </main>
        </div>
        <AssistantDrawer />
      </div>
    </TooltipProvider>
  );
}
