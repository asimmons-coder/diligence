"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ReviewReasonDialog({
  action,
  onCancel,
  onConfirm,
}: {
  action: "edited" | "rejected";
  onCancel: () => void;
  onConfirm: (input: { why: string; corrected?: string; source?: string }) => void;
}) {
  const [why, setWhy] = useState("");
  const [corrected, setCorrected] = useState("");
  const [source, setSource] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-md rounded-md border bg-white p-4 shadow-lg">
        <h2 className="text-[14px] font-semibold">
          {action === "edited" ? "Log the correction" : "Why was the original wrong?"}
        </h2>
        <p className="mt-1 text-[12px] text-zinc-600">
          Required on edit or reject. This writes an evaluation event — Alex can see what changed
          without redoing the work.
        </p>
        <div className="mt-3 space-y-2">
          <div className="space-y-1">
            <Label className="text-[11px] text-zinc-500">Why the original was wrong</Label>
            <Textarea value={why} onChange={(e) => setWhy(e.target.value)} rows={3} />
          </div>
          {action === "edited" && (
            <div className="space-y-1">
              <Label className="text-[11px] text-zinc-500">Corrected answer</Label>
              <Input value={corrected} onChange={(e) => setCorrected(e.target.value)} />
            </div>
          )}
          <div className="space-y-1">
            <Label className="text-[11px] text-zinc-500">Which source ultimately controlled</Label>
            <Input
              value={source}
              onChange={(e) => setSource(e.target.value)}
              placeholder="e.g. Financials/P&L 2024 FINAL UPDATED.xlsx"
            />
          </div>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            disabled={!why.trim()}
            onClick={() =>
              onConfirm({
                why: why.trim(),
                corrected: corrected.trim() || undefined,
                source: source.trim() || undefined,
              })
            }
          >
            Save evaluation
          </Button>
        </div>
      </div>
    </div>
  );
}
