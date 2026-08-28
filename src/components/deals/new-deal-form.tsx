"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { HALE_MESSY_FILENAMES, HALE_MESSY_PATHS } from "@/lib/classifier";
import { ELENA_USER_ID, VERTICAL_LABELS } from "@/lib/constants";
import { fileBasename, ingestFromPath } from "@/lib/paths";
import { useStore } from "@/lib/store";
import { VERTICALS, type IngestFile, type Vertical } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function NewDealForm() {
  const router = useRouter();
  const { createDeal, loadHaleMessyFolder, ingestFilenames, db } = useStore();
  const [path, setPath] = useState<"documents" | "manual">("documents");
  const [name, setName] = useState("");
  const [vertical, setVertical] = useState<Vertical>("legal");
  const [ownerId, setOwnerId] = useState(
    db.users.find((u) => u.id === ELENA_USER_ID)?.id ?? db.users[0]?.id ?? ""
  );
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [asking, setAsking] = useState("");
  const [files, setFiles] = useState<IngestFile[]>([]);
  const [dragOver, setDragOver] = useState(false);

  function openDeal(id: string, tab: "intake" | "") {
    router.push(tab ? `/deals/${id}/${tab}` : `/deals/${id}`);
  }

  function create(fromDocs: boolean) {
    return createDeal({
      name,
      vertical,
      ownerId,
      city,
      state,
      sourceDetail: fromDocs ? "Document intake" : "Manual create",
      askingPrice: asking ? Number(asking.replace(/[^0-9.]/g, "")) || null : null,
    });
  }

  async function onDropList(list: FileList | null) {
    if (!list) return;
    const next = Array.from(list).map((f) => {
      const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name;
      return ingestFromPath(rel, f.size, f.lastModified);
    });
    setFiles((prev) => [...prev, ...next]);
  }

  async function onDropTransfer(dt: DataTransfer) {
    const items = Array.from(dt.items ?? []);
    const walked: IngestFile[] = [];
    for (const item of items) {
      const entry = item.webkitGetAsEntry?.();
      if (entry) await walkEntry(entry, "", walked);
    }
    if (walked.length) {
      setFiles((prev) => [...prev, ...walked]);
      return;
    }
    await onDropList(dt.files);
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
      askingPrice: 16_800_000,
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
        Drop an entire directory. Diligence keeps nested paths and original filenames, classifies
        from the basename, and never auto-accepts reported or normalized EBITDA.
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
                void onDropTransfer(e.dataTransfer);
              }}
              className={`rounded-md border border-dashed px-4 py-8 text-center text-[13px] ${
                dragOver ? "border-zinc-900 bg-zinc-50" : "border-zinc-300"
              }`}
            >
              <div className="font-medium">Drop the messy folder here</div>
              <div className="mt-1 text-zinc-500">
                Directory drop preserves Financials/, Tax/, Emails/, Meetings/ and the original
                basename. Duplicates and FINAL vs FINAL UPDATED are flagged.
              </div>
              <div className="mt-3 flex justify-center gap-3">
                <label className="cursor-pointer text-[12px] underline">
                  Browse files
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={(e) => void onDropList(e.target.files)}
                  />
                </label>
                <label className="cursor-pointer text-[12px] underline">
                  Browse folder
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    // @ts-expect-error non-standard directory upload
                    webkitdirectory=""
                    directory=""
                    onChange={(e) => void onDropList(e.target.files)}
                  />
                </label>
              </div>
            </div>
            {files.length > 0 && (
              <ul className="mt-3 max-h-40 overflow-auto text-[12px] text-zinc-600">
                {files.map((f) => (
                  <li key={f.path} className="truncate">
                    {f.path}{" "}
                    <span className="text-zinc-400">({fileBasename(f.path)})</span>
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
          <Button variant="ghost" onClick={() => router.push("/deals/hale-mercer/intake")}>
            Open Hale flagship intake
          </Button>
        </div>
        <p className="text-[11px] text-zinc-500">
          Demo pack includes {HALE_MESSY_FILENAMES.length} files under nested paths such as{" "}
          {HALE_MESSY_PATHS[4]}. Loading it produces the full intake story immediately — no live
          model.
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

async function walkEntry(entry: FileSystemEntry, prefix: string, out: IngestFile[]) {
  if (entry.isFile) {
    const file = await new Promise<File | null>((resolve) => {
      (entry as FileSystemFileEntry).file(resolve, () => resolve(null));
    });
    if (file) {
      const path = prefix ? `${prefix}/${file.name}` : file.name;
      out.push(ingestFromPath(path, file.size, file.lastModified));
    }
    return;
  }
  if (entry.isDirectory) {
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    const children = await readAll(reader);
    const nextPrefix = prefix ? `${prefix}/${entry.name}` : entry.name;
    for (const child of children) {
      await walkEntry(child, nextPrefix, out);
    }
  }
}

function readAll(reader: FileSystemDirectoryReader): Promise<FileSystemEntry[]> {
  return new Promise((resolve) => {
    const all: FileSystemEntry[] = [];
    const pump = () => {
      reader.readEntries((batch) => {
        if (!batch.length) {
          resolve(all);
          return;
        }
        all.push(...batch);
        pump();
      }, () => resolve(all));
    };
    pump();
  });
}
