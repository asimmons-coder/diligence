"use client";

import { useState } from "react";
import { DOCUMENT_FOLDER_LABELS, DOCUMENT_STATUS_LABELS } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { useStore } from "@/lib/store";
import type { DocumentFolder, DocumentStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";

const FOLDERS: DocumentFolder[] = [
  "financials",
  "tax",
  "payroll",
  "attorney_production",
  "client_matter",
  "legal",
  "real_estate",
  "corporate",
  "other",
];

export function DealDocuments({ dealId }: { dealId: string }) {
  const { dealView, db, uploadDocument } = useStore();
  const view = dealView(dealId);
  const [folder, setFolder] = useState<DocumentFolder>("financials");
  const [dragging, setDragging] = useState(false);
  if (!view) return null;

  function ingest(files: FileList | null) {
    if (!files) return;
    for (const file of Array.from(files)) {
      uploadDocument({
        dealId,
        filename: file.name,
        folder,
        sizeBytes: file.size,
      });
    }
  }

  return (
    <div className="px-5 py-4">
      <div
        className={`mb-4 rounded-md border border-dashed px-4 py-5 text-center text-[13px] ${
          dragging ? "border-amber-500 bg-amber-50/50" : "bg-white"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          ingest(e.dataTransfer.files);
        }}
      >
        <div className="font-medium">Drop files into the data room</div>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Files stay in client state. Status stages Uploading → Processing → Analyzed. No
          silent write-back to financials.
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <select
            value={folder}
            onChange={(e) => setFolder(e.target.value as DocumentFolder)}
            className="h-8 rounded-md border bg-white px-2 text-[12px]"
          >
            {FOLDERS.map((f) => (
              <option key={f} value={f}>
                {DOCUMENT_FOLDER_LABELS[f]}
              </option>
            ))}
          </select>
          <label className="inline-flex h-8 cursor-pointer items-center rounded-md border bg-white px-3 text-[12px] font-medium">
            Browse
            <input
              type="file"
              className="hidden"
              multiple
              onChange={(e) => ingest(e.target.files)}
            />
          </label>
        </div>
      </div>

      <div className="space-y-4">
        {FOLDERS.map((f) => {
          const docs = view.documents.filter((d) => d.folder === f);
          if (docs.length === 0) return null;
          return (
            <section key={f}>
              <h2 className="mb-1.5 text-[12px] font-semibold text-zinc-500">
                {DOCUMENT_FOLDER_LABELS[f]}
              </h2>
              <div className="overflow-hidden rounded-md border bg-white">
                <table className="w-full text-left text-[13px]">
                  <thead className="border-b bg-zinc-50 text-[11px] text-muted-foreground uppercase">
                    <tr>
                      <th className="px-3 py-1.5">File</th>
                      <th className="px-3 py-1.5">Uploaded</th>
                      <th className="px-3 py-1.5">By</th>
                      <th className="px-3 py-1.5">Status</th>
                      <th className="px-3 py-1.5">Classification</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docs.map((doc) => {
                      const user = db.users.find((u) => u.id === doc.uploaded_by);
                      return (
                        <tr key={doc.id} className="border-b last:border-0">
                          <td className="px-3 py-1.5 font-medium">{doc.filename}</td>
                          <td className="px-3 py-1.5">{formatDate(doc.uploaded_at)}</td>
                          <td className="px-3 py-1.5">{user?.name ?? "—"}</td>
                          <td className="px-3 py-1.5">
                            <StatusBadge status={doc.processing_status} />
                          </td>
                          <td className="px-3 py-1.5 text-zinc-500">
                            {doc.classification ?? "—"}
                            {doc.confidence != null && (
                              <span className="tabular text-[11px]">
                                {" "}
                                · {Math.round(doc.confidence * 100)}%
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: DocumentStatus }) {
  const tone =
    status === "analyzed"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : status === "needs_review" || status === "processing" || status === "uploading"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : status === "failed"
          ? "border-red-200 bg-red-50 text-red-800"
          : "";
  return (
    <Badge variant="outline" className={`rounded-sm ${tone}`}>
      {DOCUMENT_STATUS_LABELS[status]}
    </Badge>
  );
}
