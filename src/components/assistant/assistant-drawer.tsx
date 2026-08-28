"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { answerAssistant, type AssistantAnswer } from "@/lib/assistant";
import { CLAIM_KIND_LABELS, VISUAL_CLAIM_LABELS } from "@/lib/constants";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const EXAMPLES = [
  "Which deals need my attention today?",
  "Why did Hale & Mercer's adjusted EBITDA change?",
  "Compare the economics of our deals currently in diligence.",
  "What are we still waiting on from Miller Law?",
  "Show me every EBITDA adjustment above $100k.",
  "What diligence questions should we ask Hale & Mercer?",
  "Summarize everything that's changed on this deal since Monday.",
  "Which targets have the highest revenue concentration risk?",
  "What have we received for Hale & Mercer?",
  "Which files appear to be duplicates or superseded?",
  "Reconstruct revenue and reported EBITDA for the last three years.",
  "Which values do not reconcile?",
  "What information is still missing?",
  "What is preventing us from issuing an LOI?",
  "Which EBITDA adjustments are least defensible?",
  "What did the seller say about professional-services expenses?",
  "Did the latest meeting change our view of occupancy expense?",
  "What is the evidence behind the owner compensation adjustment?",
  "Compare conservative, base, and upside valuation cases.",
  "What assumptions create the valuation gap?",
  "Which negotiation points have the strongest factual support?",
  "Draft the next seller diligence request.",
  "What would the purchase price be at 5.5x accepted normalized EBITDA?",
  "What structure could bridge the valuation gap without paying for unsupported EBITDA at close?",
];

export function AssistantDrawer() {
  const { db, assistantOpen, setAssistantOpen } = useStore();
  const params = useParams<{ id?: string }>();
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<AssistantAnswer | null>(null);

  function run(next: string) {
    setQuery(next);
    setAnswer(answerAssistant(db, next, params.id));
  }

  return (
    <Sheet open={assistantOpen} onOpenChange={setAssistantOpen}>
      <SheetContent
        side="right"
        className="w-[440px] sm:max-w-[440px] gap-0 p-0"
        showCloseButton
      >
        <SheetHeader className="border-b">
          <SheetTitle>Assistant</SheetTitle>
          <SheetDescription>
            Deterministic query layer over the Northline book. Distinguishes facts,
            approved assumptions, and inference. No live model.
          </SheetDescription>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-b p-3">
            <Textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  run(query);
                }
              }}
              placeholder="Ask about the book…"
              className="min-h-16 resize-none text-[13px]"
            />
            <div className="mt-2 flex justify-end">
              <Button size="sm" onClick={() => run(query)}>
                Run
              </Button>
            </div>
          </div>
          <ScrollArea className="flex-1">
            <div className="space-y-4 p-4">
              {!answer && (
                <div className="space-y-1.5">
                  <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Playbook
                  </div>
                  {EXAMPLES.map((example) => (
                    <button
                      key={example}
                      type="button"
                      className="block w-full rounded-md border px-2.5 py-1.5 text-left text-[12px] leading-snug hover:bg-zinc-50"
                      onClick={() => run(example)}
                    >
                      {example}
                    </button>
                  ))}
                </div>
              )}
              {answer && (
                <div className="space-y-3">
                  <div>
                    <div className="text-[15px] font-semibold">{answer.title}</div>
                    <p className="mt-1 text-[13px] leading-relaxed text-zinc-600">
                      {answer.summary}
                    </p>
                  </div>
                  <ul className="space-y-1.5">
                    {answer.bullets.map((b) => (
                      <li
                        key={b}
                        className="border-l-2 border-zinc-200 pl-2 text-[13px] leading-snug"
                      >
                        {b}
                      </li>
                    ))}
                  </ul>
                  {answer.citations.length > 0 && (
                    <div>
                      <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Sources
                      </div>
                      <ul className="space-y-1">
                        {answer.citations.map((c) => (
                          <li key={`${c.label}-${c.detail}`} className="text-[12px]">
                            <span
                              className={
                                c.kind === "ai_inference"
                                  ? "text-amber-800"
                                  : c.kind === "approved_assumption"
                                    ? "text-emerald-700"
                                    : "text-zinc-600"
                              }
                            >
                              {CLAIM_KIND_LABELS[c.kind] ?? VISUAL_CLAIM_LABELS[c.kind] ?? c.kind}
                            </span>
                            <span className="text-zinc-400"> · </span>
                            <span className="font-medium">{c.label}</span>
                            <span className="text-muted-foreground"> — {c.detail}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <Button variant="outline" size="sm" onClick={() => setAnswer(null)}>
                    Clear
                  </Button>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </SheetContent>
    </Sheet>
  );
}
