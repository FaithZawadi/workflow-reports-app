import ExcelJS from "exceljs";
import { requireUser } from "@/lib/auth";
import { canGenerateReports, rolesOf } from "@/lib/roles";
import { buildManagementReport } from "@/lib/managementReport";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GOLD = "FFF5A800";
const COAL = "FF161310";

const STATUS_LABEL = {
  PENDING_SUPERVISOR: "Supervisor review",
  PENDING_MANAGER: "Manager approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

function headerRow(ws, cells) {
  const row = ws.addRow(cells);
  row.eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COAL } };
    c.alignment = { vertical: "middle" };
  });
  return row;
}

// GET /api/reports/summary/excel?from=&to= — the management report as a workbook.
export async function GET(req) {
  let user;
  try {
    user = await requireUser();
  } catch (res) {
    return res;
  }
  if (!canGenerateReports(user)) return Response.json({ error: "Not allowed." }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const from = (searchParams.get("from") || "").trim();
  const to = (searchParams.get("to") || "").trim();
  const d = await buildManagementReport(user, { from, to });

  const wb = new ExcelJS.Workbook();
  wb.creator = "Qalibrated Systems";
  wb.created = new Date();

  /* ---- Summary sheet ---- */
  const sum = wb.addWorksheet("Summary", { properties: { defaultColWidth: 22 } });
  const title = sum.addRow(["Maintenance Management Report"]);
  title.font = { bold: true, size: 15 };
  sum.mergeCells("A1:B1");
  sum.addRow(["Period", d.range.from || d.range.to ? `${d.range.from || "start"} to ${d.range.to || "today"}` : "All time"]);
  if (d.compareRange) sum.addRow(["Compared to", `${d.compareRange.from} to ${d.compareRange.to}`]);
  sum.addRow(["Generated", new Date(d.generatedAt).toLocaleString("en-GB")]);
  sum.addRow(["By", `${user.name || user.email} · ${(rolesOf(user)[0] || "").replace(/_/g, " ")}`]);
  sum.addRow([]);

  headerRow(sum, ["Metric", "Value", "vs previous"]);
  const metric = (label, value, delta) => {
    const dv = delta ? `${delta.diff > 0 ? "+" : ""}${delta.diff}${delta.unit ? " " + delta.unit : ""}` : "—";
    sum.addRow([label, value, dv]);
  };
  metric("Reports filed", d.total, d.deltas?.total);
  metric("Approved", d.approved, null);
  metric("Approval rate (%)", d.approvalRate, d.deltas?.approvalRate);
  metric("Pending", d.pending, null);
  metric("Rejected", d.rejected, null);
  metric("Rejection rate (%)", d.rejectionRate, d.deltas?.rejectionRate);
  metric("Open findings", d.findingsCount, d.deltas?.findingsCount);
  metric("Findings per report", d.findingsRate, null);
  metric("Avg approval time (h)", d.avgTurnaroundHours ?? "—", d.deltas?.avgTurnaroundHours);
  metric("Checklist pass rate (%)", d.passRate ?? "—", null);
  metric("Checklist items passed", `${d.checklistPassed} / ${d.checklistTotal}`, null);
  sum.getColumn(1).width = 26;

  /* ---- Status + breakdowns ---- */
  const bd = wb.addWorksheet("Breakdowns", { properties: { defaultColWidth: 20 } });
  bd.addRow(["Status distribution"]).font = { bold: true, size: 12 };
  headerRow(bd, ["Status", "Reports", "Share %"]);
  for (const k of ["APPROVED", "PENDING_SUPERVISOR", "PENDING_MANAGER", "REJECTED"]) {
    const v = d.byStatus?.[k] || 0;
    if (v) bd.addRow([STATUS_LABEL[k], v, d.total ? Math.round((v / d.total) * 100) : 0]);
  }
  bd.addRow([]);

  const section = (heading, cols, rows) => {
    bd.addRow([heading]).font = { bold: true, size: 12 };
    headerRow(bd, cols);
    rows.forEach((r) => bd.addRow(r));
    bd.addRow([]);
  };
  section("By weighbridge", ["Weighbridge", "Reports", "Findings", "Share %"], d.byWeighbridge.map((r) => [r.label, r.count, r.findings, d.total ? Math.round((r.count / d.total) * 100) : 0]));
  section("By client & site", ["Client / site", "Reports", "Share %"], d.byClient.map((r) => [r.name, r.count, d.total ? Math.round((r.count / d.total) * 100) : 0]));
  section("By report type", ["Report type", "Code", "Reports", "Share %"], d.byTemplate.map((r) => [r.name, r.code, r.count, d.total ? Math.round((r.count / d.total) * 100) : 0]));
  section("By person (filed)", ["Filed by", "Reports", "Share %"], d.byAuthor.map((r) => [r.name, r.count, d.total ? Math.round((r.count / d.total) * 100) : 0]));
  section("Most common findings", ["Item", "Occurrences"], d.topFindings.map((r) => [r.item, r.count]));
  bd.getColumn(1).width = 32;

  /* ---- Findings detail ---- */
  const fs = wb.addWorksheet("Findings", { properties: { defaultColWidth: 18 } });
  headerRow(fs, ["Serial", "Report type", "Client", "Site", "Weighbridge", "Item", "Result", "Remark", "Date"]);
  d.findings.forEach((f) =>
    fs.addRow([
      f.serial, f.templateName, f.clientName, f.site || "", f.weighbridgeId || "",
      f.item, f.result, f.remark || "", new Date(f.createdAt).toLocaleDateString("en-GB"),
    ])
  );
  fs.getColumn(6).width = 34;
  fs.getColumn(8).width = 34;
  fs.views = [{ state: "frozen", ySplit: 1 }];

  /* ---- Trend ---- */
  const tr = wb.addWorksheet("Trend");
  headerRow(tr, d.compareRange ? ["Date", "This period", "Previous period"] : ["Date", "Submissions"]);
  d.trend.forEach((p) => tr.addRow(d.compareRange ? [p.date, p.count, p.prev ?? 0] : [p.date, p.count]));
  tr.getColumn(1).width = 16;

  const buffer = await wb.xlsx.writeBuffer();
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="QSL-management-report-${stamp}.xlsx"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
