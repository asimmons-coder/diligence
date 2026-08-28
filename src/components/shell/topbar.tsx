"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PanelRight, Search } from "lucide-react";
import { ROLE_LABELS } from "@/lib/constants";
import { useStore } from "@/lib/store";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function Topbar() {
  const { currentOrg, currentUser, db, search, setAssistantOpen, assistantOpen, switchUser } =
    useStore();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const results = useMemo(() => (query.trim() ? search(query).slice(0, 8) : []), [query, search]);

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b bg-white px-4">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results[0]) {
              router.push(`/deals/${results[0].deal.id}`);
              setQuery("");
              setOpen(false);
            }
          }}
          placeholder="Search deals, firms, owners…"
          className="h-8 max-w-xl pl-8 text-[13px]"
        />
        {open && results.length > 0 && (
          <div className="absolute z-30 mt-1 w-full max-w-xl rounded-md border bg-white py-1 shadow-md">
            {results.map((view) => (
              <button
                key={view.deal.id}
                type="button"
                className="flex w-full items-center justify-between px-3 py-1.5 text-left text-[13px] hover:bg-zinc-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  router.push(`/deals/${view.deal.id}`);
                  setQuery("");
                  setOpen(false);
                }}
              >
                <span className="font-medium">{view.deal.name}</span>
                <span className="text-muted-foreground">
                  {view.deal.location_city} · {view.owner.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 text-[13px]">
        <div className="hidden rounded-md border px-2 py-1 text-zinc-700 sm:block">
          {currentOrg.name}
        </div>
        <Button
          type="button"
          variant={assistantOpen ? "secondary" : "outline"}
          size="sm"
          onClick={() => setAssistantOpen(!assistantOpen)}
        >
          <PanelRight />
          Assistant
        </Button>
        <div className="flex items-center gap-2 pl-1">
          <Avatar className="size-7">
            <AvatarFallback className="bg-zinc-900 text-[10px] text-white">
              {currentUser.initials}
            </AvatarFallback>
          </Avatar>
          <div className="hidden leading-tight lg:block">
            <select
              className="max-w-[160px] bg-transparent text-[13px] font-medium text-zinc-900"
              value={currentUser.id}
              onChange={(e) => switchUser(e.target.value)}
              aria-label="Switch user"
            >
              {db.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
            <div className="text-[11px] text-muted-foreground">
              {ROLE_LABELS[currentUser.role]}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
