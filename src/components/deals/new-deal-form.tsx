"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { HALE_MESSY_FILENAMES } from "@/lib/classifier";
import { VERTICAL_LABELS } from "@/lib/constants";
import { useStore } from "@/lib/store";
import { VERTICALS, type Vertical } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function NewDealForm() {
  const router = useRouter();
  const { createDeal, loadHaleMessyFolder, ingestFilenames, db } = useStore();
  const [path, setPath] = useState<"documents" | "manual">("documents");
  const [name, setName] = useState("");
  const [vertical, setVertical] = useState<Vertical>("legal");
  const [ownerId, setOwnerId] = useState(db.users[0]?.id ?? "");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [asking, setAsking] = useState("");
  const [files, setFiles] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);

  function openDeal(id: string, tab: "intake" | "") {
    router.push(tab ? `/deals/${id}/${tab}` : `/deals/${id}`);
  }

  function create(fromDocs: boolean) {
    const deal = createDeal({
      name,
      vertical,
      ownerId,
      city,
      state,
      sourceDetail: fromDocs ? "Document intake" : "Manual create",
    });
    if (asking) {
      // asking is stored after create via hydrate or later edit — keep local only if empty
    }
    return deal;
  }

  function onDrop(list: FileList | null) {
    if (!list) return;
    const names = Array.from(list).map((f) => f.name);
    setFiles((prev) => [...prev, ...names]);
  }

  function startFromDocuments() {
    const deal = create(true);
    if (files.length) ingestFilenames(deal.id, files);
    openDeal(deal.id, "intake");
  }

  function loadHale() {
    const deal = createDeal({
      name: name.trim() || "Hale & Mercer LLP",
      vertical: "legal",
      ownerId,
      city: city || "Chicago",
      state: state || "IL",
      sourceDetail: "Hale messy folder demo",
    });
    loadHaleMessyFolder(deal.id);
    openDeal(deal.id, "intake");
  }

  function createManual() {
    const deal = create(false);
    openDeal(deal.id, "");
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
        New deal
      </div>
      <h1 className="mt-1 text-xl font-semibold tracking-tight">Start from the folder</h1>
      <p className="mt-2 text-[13px] leading-relaxed text-zinc-600">
        Upload whatever you have. Diligence will organize the files, reconstruct the available
        financial picture, identify conflicts, and tell you what remains missing.
      </p>

      <div className="mt-5 flex gap-2">
        <Button
          size="sm"
          variant={path === "documents" ? "default" : "outline"}
          onClick={() => setPath("documents")}
        >
          Start from documents
        </Button>
        <Button
          size="sm"
          variant={path === "manual" ? "default" : "outline"}
          onClick={() => setPath("manual")}
        >
          Create manually
        </Button>
      </div>

      <div className="mt-6 grid gap-4 rounded-md border bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={path === "documents" ? "Target name (optional)" : "Target name"}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Hale & Mercer LLP" />
          </Field>
          <Field label="Vertical">
            <select
              className="h-8 w-full rounded-md border bg-white px-2 text-[13px]"
              value={vertical}
              onChange={(e) => setVertical(e.target.value as Vertical)}
            >
              {VERTICALS.map((v) => (
                <option key={v} value={v}>
                  {VERTICAL_LABELS[v]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Deal owner">
            <select
              className="h-8 w-full rounded-md border bg-white px-2 text-[13px]"
              value={ownerId}
              onChange={(e) => setOwnerId(e.target.value)}
            >
              {db.users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </Field>
          {path === "manual" && (
            <>
              <Field label="City">
                <Input value={city} onChange={(e) => setCity(e.target.value)} />
              </Field>
              <Field label="State">
                <Input value={state} onChange={(e) => setState(e.target.value)} />
              </Field>
              <Field label="Asking price (optional)">
                <Input value={asking} onChange={(e) => setAsking(e.target.value)} placeholder="16800000" />
              </Field>
            </>
          )}
        </div>

        {path === "documents" && (
          <div>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                onDrop(e.dataTransfer.files);
              }}
              className={`rounded-md border border-dashed px-4 py-8 text-center text-[13px] ${
                dragOver ? "border-zinc-900 bg-zinc-50" : "border-zinc-300"
              }`}
            >
              <div className="font-medium">Drop the messy folder here</div>
              <div className="mt-1 text-zinc-500">
                Classification is not required before upload. Ugly filenames are expected.
              </div>
              <label className="mt-3 inline-block cursor-pointer text-[12px] underline">
                Or browse files
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={(e) => onDrop(e.target.files)}
                />
              </label>
            </div>
            {files.length > 0 && (
              <ul className="mt-3 max-h-40 overflow-auto text-[12px] text-zinc-600">
                {files.map((f) => (
                  <li key={f} className="truncate">
                    {f}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {path === "documents" ? (
            <Button onClick={startFromDocuments}>Create deal and process</Button>
          ) : (
            <Button onClick={createManual}>Create deal</Button>
          )}
          <Button variant="outline" onClick={loadHale}>
            Load Hale messy folder
          </Button>
          <Button
            variant="ghost"
            onClick={() => router.push("/deals/hale-mercer/intake")}
          >
            Open Hale flagship intake
          </Button>
        </div>
        <p className="text-[11px] text-zinc-500">
          Demo pack includes {HALE_MESSY_FILENAMES.length} imperfect filenames. Loading it
          produces the full intake story immediately — no live model.
        </p>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] text-zinc-500">{label}</Label>
      {children}
    </div>
  );
}
