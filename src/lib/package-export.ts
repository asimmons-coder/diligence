import { formatMoneyExact, formatMultiple } from "./format";
import type { PackageModel } from "./package-model";
import { packageHeadline } from "./package-model";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadPackageJson(model: PackageModel) {
  const blob = new Blob([JSON.stringify(model, null, 2)], { type: "application/json" });
  downloadBlob(blob, `${slug(model.dealName)}-underwriting-package.json`);
}

export async function downloadPackageExcel(model: PackageModel) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Diligence";
  wb.created = new Date();

  const brief = wb.addWorksheet("Executive brief");
  addPairs(brief, [
    ["Deal", model.dealName],
    ["Owner", model.owner],
    ["Stage", model.stage],
    ["Vertical", model.vertical],
    ["Reported EBITDA", model.executiveBrief.reportedEbitda],
    ["Normalized EBITDA", model.executiveBrief.normalizedEbitda],
    ["Pro forma EBITDA (proposed)", model.executiveBrief.proFormaEbitda],
    ["Asking price", model.executiveBrief.asking],
    ["Implied multiple (PF)", model.executiveBrief.headerMultiple],
    ["Diligence complete", `${model.executiveBrief.diligencePct}%`],
    ["Summary", model.executiveBrief.summary],
    ["Assessment", model.executiveBrief.assessment],
    ["Readiness", model.executiveBrief.readiness],
    ["External system", model.external.system],
    ["External deal id", model.external.dealId],
  ]);

  const hist = wb.addWorksheet("Historical financials");
  hist.addRow(["Period", "Revenue", "Reported EBITDA", "Margin"]);
  model.historicalFinancials.forEach((p) =>
    hist.addRow([p.period, p.revenue, p.ebitda, p.margin])
  );

  const bridge = wb.addWorksheet("EBITDA bridge");
  bridge.addRow(["Line", "Amount", "Status"]);
  bridge.addRow(["Reported EBITDA", model.ebitdaBridge.reported, "source fact"]);
  model.ebitdaBridge.accepted.forEach((a) => bridge.addRow([a.description, a.amount, a.status]));
  bridge.addRow(["Normalized EBITDA", model.ebitdaBridge.normalized, "accepted"]);
  model.ebitdaBridge.proposed.forEach((a) => bridge.addRow([a.description, a.amount, a.status]));
  bridge.addRow(["Pro forma EBITDA", model.ebitdaBridge.proForma, "includes proposed"]);
  bridge.addRow(["Note", model.ebitdaBridge.note]);

  const adj = wb.addWorksheet("Adjustment support");
  adj.addRow(["Description", "Amount", "Category", "Status", "Source", "Evidence", "Approval"]);
  model.adjustmentSupport.forEach((a) =>
    adj.addRow([a.description, a.amount, a.category, a.status, a.source, a.evidence, a.approval])
  );

  const rec = wb.addWorksheet("Reconciliation");
  rec.addRow(["Issue", "Source A", "Source B", "Difference", "Status", "Interpretation"]);
  model.reconciliation.forEach((r) =>
    rec.addRow([r.description, r.sourceA, r.sourceB, r.difference, r.status, r.interpretation])
  );

  const risks = wb.addWorksheet("Key risks");
  risks.addRow(["Title", "Detail", "Severity"]);
  model.keyRisks.forEach((r) => risks.addRow([r.title, r.detail, r.severity]));

  const dil = wb.addWorksheet("Open diligence");
  dil.addRow(["Question", "Status", "Priority"]);
  model.openDiligence.forEach((d) => dil.addRow([d.question, d.status, d.priority]));

  const val = wb.addWorksheet("Valuation scenarios");
  val.addRow(["Scenario", "EBITDA", "Multiple", "Enterprise value", "Gap to seller", "Label"]);
  model.valuationScenarios.forEach((s) =>
    val.addRow([s.name, s.ebitda, s.multiple, s.ev, s.gapToSeller, s.label])
  );

  const evd = wb.addWorksheet("Evidence appendix");
  evd.addRow(["Path", "Type", "Period", "Review"]);
  model.evidenceAppendix.forEach((e) => evd.addRow([e.path, e.type, e.period, e.status]));

  const histDec = wb.addWorksheet("Decision history");
  histDec.addRow(["When", "Actor", "Entity", "Action", "Resolution"]);
  model.decisionHistory.forEach((d) =>
    histDec.addRow([d.occurredAt, d.actor, d.entity, d.action, d.resolution])
  );

  if (model.baseline) {
    const base = wb.addWorksheet("Post-close baseline");
    addPairs(base, [
      ["Underwritten revenue", model.baseline.underwrittenRevenue],
      ["Underwritten EBITDA", model.baseline.underwrittenEbitda],
      ["Accepted adjustments", model.baseline.acceptedAdjustments],
      ["Expected synergies", model.baseline.expectedSynergies],
      ["NWC assumption", model.baseline.nwc],
      ["Purchase price", model.baseline.purchasePrice],
      ["Structure", model.baseline.structure],
      ["Retention", model.baseline.retention],
      ["Expected first year", model.baseline.firstYear],
      ["Note", "Actuals will be compared later."],
    ]);
  }

  const buf = await wb.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `${slug(model.dealName)}-underwriting-package.xlsx`
  );
}

export async function downloadPackagePdf(model: PackageModel) {
  const { jsPDF } = await import("jspdf");
  const autoTable = (await import("jspdf-autotable")).default;
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 48;
  let y = 56;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text(`${model.dealName} — underwriting package`, margin, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const head = doc.splitTextToSize(packageHeadline(model), 514);
  doc.text(head, margin, y);
  y += head.length * 12 + 8;
  doc.setFontSize(8);
  doc.text("Scenario outputs are labeled scenario analysis. AI does not silently edit accepted financials.", margin, y);
  y += 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Executive deal brief", margin, y);
  y += 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const brief = doc.splitTextToSize(model.executiveBrief.summary, 514);
  doc.text(brief, margin, y);
  y += Math.min(brief.length, 8) * 12 + 6;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Metric", "Amount"]],
    body: [
      ["Reported EBITDA", formatMoneyExact(model.executiveBrief.reportedEbitda)],
      ["Normalized EBITDA (accepted)", formatMoneyExact(model.executiveBrief.normalizedEbitda)],
      ["Pro forma (includes proposed)", formatMoneyExact(model.executiveBrief.proFormaEbitda)],
      ["Asking price", formatMoneyExact(model.executiveBrief.asking)],
      ["Implied multiple on PF", formatMultiple(model.executiveBrief.headerMultiple)],
    ],
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [24, 24, 27], textColor: 255 },
  });

  const afterBrief = lastY(doc, y + 80);

  autoTable(doc, {
    startY: afterBrief + 16,
    margin: { left: margin, right: margin },
    head: [["EBITDA bridge", "Amount", "Status"]],
    body: [
      ["Reported", formatMoneyExact(model.ebitdaBridge.reported), "source fact"],
      ...model.ebitdaBridge.accepted.map((a) => [a.description, formatMoneyExact(a.amount), a.status]),
      ["Normalized", formatMoneyExact(model.ebitdaBridge.normalized), "accepted"],
      ...model.ebitdaBridge.proposed.map((a) => [a.description, formatMoneyExact(a.amount), a.status]),
      ["Pro forma", formatMoneyExact(model.ebitdaBridge.proForma), "includes proposed"],
    ],
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [24, 24, 27], textColor: 255 },
  });

  const afterBridge = lastY(doc, afterBrief + 80);

  autoTable(doc, {
    startY: afterBridge + 16,
    margin: { left: margin, right: margin },
    head: [["Adjustment", "Amount", "Status", "Source"]],
    body: model.adjustmentSupport.map((a) => [
      a.description,
      formatMoneyExact(a.amount),
      a.status,
      a.source,
    ]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [24, 24, 27], textColor: 255 },
  });

  doc.addPage();
  autoTable(doc, {
    startY: 56,
    margin: { left: margin, right: margin },
    head: [["Reconciliation", "Difference", "Status"]],
    body: model.reconciliation.map((r) => [
      r.description,
      formatMoneyExact(r.difference),
      r.status,
    ]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [24, 24, 27], textColor: 255 },
  });

  const afterRec = lastY(doc, 120);
  autoTable(doc, {
    startY: afterRec + 16,
    margin: { left: margin, right: margin },
    head: [["Scenario analysis", "EBITDA", "Multiple", "EV", "Gap vs seller"]],
    body: model.valuationScenarios.map((s) => [
      s.name,
      formatMoneyExact(s.ebitda),
      formatMultiple(s.multiple),
      formatMoneyExact(s.ev),
      formatMoneyExact(s.gapToSeller),
    ]),
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [24, 24, 27], textColor: 255 },
  });

  const afterVal = lastY(doc, 200);
  autoTable(doc, {
    startY: afterVal + 16,
    margin: { left: margin, right: margin },
    head: [["Open diligence", "Status", "Priority"]],
    body: model.openDiligence.slice(0, 18).map((d) => [d.question, d.status, d.priority]),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [24, 24, 27], textColor: 255 },
  });

  doc.addPage();
  autoTable(doc, {
    startY: 56,
    margin: { left: margin, right: margin },
    head: [["Evidence path", "Type", "Period"]],
    body: model.evidenceAppendix.map((e) => [e.path, e.type, e.period ?? "—"]),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [24, 24, 27], textColor: 255 },
  });

  const afterEv = lastY(doc, 200);
  autoTable(doc, {
    startY: afterEv + 16,
    margin: { left: margin, right: margin },
    head: [["Decision", "Actor", "Action", "Resolution"]],
    body: model.decisionHistory.slice(0, 16).map((d) => [d.entity, d.actor, d.action, d.resolution]),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: [24, 24, 27], textColor: 255 },
  });

  if (model.baseline) {
    doc.addPage();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Post-close baseline", margin, 56);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const lines = [
      `Underwritten revenue ${formatMoneyExact(model.baseline.underwrittenRevenue)}`,
      `Underwritten EBITDA ${formatMoneyExact(model.baseline.underwrittenEbitda)}`,
      `Accepted adjustments ${formatMoneyExact(model.baseline.acceptedAdjustments)}`,
      `Expected synergies ${formatMoneyExact(model.baseline.expectedSynergies)} (not in cash earnings)`,
      `NWC ${formatMoneyExact(model.baseline.nwc)}`,
      `Purchase price ${formatMoneyExact(model.baseline.purchasePrice)}`,
      model.baseline.structure,
      model.baseline.retention,
      model.baseline.firstYear,
      "Actuals will be compared later.",
    ];
    doc.text(doc.splitTextToSize(lines.join("\n"), 514), margin, 76);
  }

  doc.save(`${slug(model.dealName)}-underwriting-package.pdf`);
}

function lastY(doc: object, fallback: number) {
  return (doc as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? fallback;
}

function addPairs(
  sheet: { addRow: (row: unknown[]) => void },
  rows: Array<[string, unknown]>
) {
  rows.forEach((row) => sheet.addRow(row));
}

function slug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "deal";
}
