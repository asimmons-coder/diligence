"use client";

import { FileSearch } from "lucide-react";
import { CLAIM_KIND_LABELS } from "@/lib/constants";
import type { Provenance } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export function ProvenanceInspect({
  provenance,
  label,
}: {
  provenance: Provenance;
  label?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="text-muted-foreground"
          aria-label={label ?? "Inspect source"}
        >
          <FileSearch className="size-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3 text-[13px]">
        <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Provenance
        </div>
        <dl className="grid grid-cols-[96px_1fr] gap-x-2 gap-y-1.5">
          <dt className="text-muted-foreground">Kind</dt>
          <dd>{CLAIM_KIND_LABELS[provenance.approval_status]}</dd>
          <dt className="text-muted-foreground">Document</dt>
          <dd>{provenance.source_document_name ?? "—"}</dd>
          <dt className="text-muted-foreground">Section</dt>
          <dd>{provenance.section ?? "—"}</dd>
          <dt className="text-muted-foreground">Page</dt>
          <dd>{provenance.page ?? "—"}</dd>
          <dt className="text-muted-foreground">Extracted</dt>
          <dd className="tabular">{provenance.extracted_value ?? "—"}</dd>
          <dt className="text-muted-foreground">Confidence</dt>
          <dd className="tabular">
            {provenance.confidence != null
              ? `${Math.round(provenance.confidence * 100)}%`
              : "—"}
          </dd>
        </dl>
      </PopoverContent>
    </Popover>
  );
}

export function ClaimLabel({ kind }: { kind: Provenance["approval_status"] }) {
  const styles = {
    source_fact: "text-zinc-600",
    approved_assumption: "text-emerald-700",
    ai_inference: "text-amber-800",
  };
  return (
    <span className={`text-[11px] font-medium ${styles[kind]}`}>
      {CLAIM_KIND_LABELS[kind]}
    </span>
  );
}
