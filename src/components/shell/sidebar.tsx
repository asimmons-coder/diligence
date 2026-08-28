"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardCheck, GitCompare, Inbox, LayoutDashboard, Plus, Rows3 } from "lucide-react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/queue", label: "Queue", icon: Inbox },
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/pipeline", label: "Pipeline", icon: Rows3 },
  { href: "/compare", label: "Compare", icon: GitCompare },
  { href: "/evals", label: "Corrections", icon: ClipboardCheck },
];

export function Sidebar() {
  const pathname = usePathname();
  const { resetSeed } = useStore();

  return (
    <aside className="flex w-[220px] shrink-0 flex-col bg-zinc-950 text-zinc-400">
      <div className="px-4 py-4">
        <div className="text-[15px] font-semibold tracking-tight text-zinc-50">
          Diligence
        </div>
        <div className="mt-0.5 text-[11px] text-zinc-500">Deal operating system</div>
      </div>
      <div className="px-2 pb-2">
        <Link
          href="/deals/new"
          className="flex items-center justify-center gap-1.5 rounded-md bg-zinc-100 px-2.5 py-1.5 text-[13px] font-medium text-zinc-950 hover:bg-white"
        >
          <Plus className="size-3.5" />
          New deal
        </Link>
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 px-2">
        {NAV.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] font-medium transition-colors",
                active
                  ? "bg-zinc-800 text-zinc-50"
                  : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
              )}
            >
              <Icon className="size-3.5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/5 px-4 py-3 text-[11px] leading-relaxed text-zinc-600">
        AI never silently edits financials. Proposed items stay dashed until accepted.
        <button
          type="button"
          onClick={resetSeed}
          className="mt-2 block text-[11px] text-zinc-500 underline-offset-2 hover:text-zinc-300 hover:underline"
        >
          Reset seed book
        </button>
      </div>
    </aside>
  );
}
