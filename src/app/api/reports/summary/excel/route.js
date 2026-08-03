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
  const client = (searchParams.get("client") || "").trim() || null;
  const site = (searchParams.get("site") || "").trim() || null;
  const d = await buildManagementReport(user, { from, to, client, site });

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

  /* ---- Service register (itemised log of every report) ---- */
  if (d.register?.length) {
    const reg = wb.addWorksheet("Service register", { properties: { defaultColWidth: 16 } });
    headerRow(reg, ["Date", "Serial", "Service", "Weighbridge", "Client", "Site", "Filed by", "Approved by", "Turnaround (h)", "Findings", "Photos", "Status", "Outcome"]);
    d.register.forEach((r) =>
      reg.addRow([
        new Date(r.createdAt).toLocaleDateString("en-GB"),
        r.serial, r.templateName, r.weighbridgeId || "", r.clientName, r.site || "",
        r.authorName, r.approverName || "", r.turnaroundHours ?? "", r.findings || 0, r.photos || 0,
        STATUS_LABEL[r.status] || r.status, r.outcome || "",
      ])
    );
    reg.getColumn(3).width = 26;
    reg.getColumn(13).width = 26;
    reg.views = [{ state: "frozen", ySplit: 1 }];
  }

  /* ---- Operations (system-wide) ---- */
  const ops = d.operations;
  if (ops) {
    const os = wb.addWorksheet("Operations", { properties: { defaultColWidth: 22 } });
    os.addRow(["Across the business"]).font = { bold: true, size: 13 };
    os.addRow([]);
    if (ops.crf) {
      os.addRow(["Calibration requests"]).font = { bold: true, size: 11 };
      headerRow(os, ["Metric", "Value"]);
      os.addRow(["Total", ops.crf.total]);
      os.addRow(["Submitted", ops.crf.submitted]);
      os.addRow(["Accepted", ops.crf.accepted]);
      os.addRow(["Rejected", ops.crf.rejected]);
      os.addRow(["In-situ", ops.crf.inSitu]);
      os.addRow(["Laboratory", ops.crf.lab]);
      os.addRow([]);
    }
    if (ops.tasks) {
      os.addRow(["Task workload"]).font = { bold: true, size: 11 };
      headerRow(os, ["Metric", "Value"]);
      os.addRow(["Total", ops.tasks.total]);
      os.addRow(["Open", ops.tasks.openNew]);
      os.addRow(["In progress", ops.tasks.inProgress]);
      os.addRow(["Blocked", ops.tasks.blocked]);
      os.addRow(["Done", ops.tasks.done]);
      os.addRow(["Overdue", ops.tasks.overdue]);
      os.addRow(["High priority open", ops.tasks.highPriorityOpen]);
      os.addRow([]);
    }
    if (ops.satisfaction || ops.training) {
      os.addRow(["Satisfaction"]).font = { bold: true, size: 11 };
      headerRow(os, ["Source", "Avg / 5", "Responses", "Recommend %"]);
      if (ops.satisfaction) os.addRow(["Customer (CSSF)", ops.satisfaction.avg ?? "—", ops.satisfaction.count, ops.satisfaction.recommendRate ?? "—"]);
      if (ops.training) os.addRow(["Training", ops.training.avg ?? "—", ops.training.count, "—"]);
      os.addRow([]);
    }
    if (ops.schedules?.overdueList?.length) {
      os.addRow(["Overdue maintenance"]).font = { bold: true, size: 11 };
      headerRow(os, ["Obligation", "Weighbridge", "Due"]);
      ops.schedules.overdueList.forEach((r) => os.addRow([r.label, r.weighbridgeId, new Date(r.dueAt).toLocaleDateString("en-GB")]));
      os.addRow([]);
    }
    if (ops.contracts?.upcomingList?.length) {
      os.addRow(["Service contracts — upcoming"]).font = { bold: true, size: 11 };
      headerRow(os, ["Contract", "Due", "Overdue"]);
      ops.contracts.upcomingList.forEach((r) => os.addRow([r.label, new Date(r.dueAt).toLocaleDateString("en-GB"), r.overdue ? "YES" : ""]));
    }
    os.getColumn(1).width = 34;
  }

  /* ---- Trend ---- */
  const tr = wb.addWorksheet("Trend");
  headerRow(tr, d.compareRange ? ["Date", "This period", "Previous period"] : ["Date", "Submissions"]);
  d.trend.forEach((p) => tr.addRow(d.compareRange ? [p.date, p.count, p.prev ?? 0] : [p.date, p.count]));
  tr.getColumn(1).width = 16;

  /* ---- Staff productivity ---- */
  if (d.staff?.length) {
    const st = wb.addWorksheet("Staff", { properties: { defaultColWidth: 16 } });
    headerRow(st, ["Person", "Reports filed", "Approvals given", "Rejections", "Findings raised", "Photos", "Avg approval (h)"]);
    d.staff.forEach((s) => st.addRow([s.name, s.filed, s.approvals, s.rejections, s.findings, s.photos, s.avgTurnaround ?? ""]));
    st.getColumn(1).width = 26;
    st.views = [{ state: "frozen", ySplit: 1 }];
  }

  /* ---- Weighbridge history ---- */
  if (d.weighbridgeHistory?.length) {
    const wh = wb.addWorksheet("Weighbridge history", { properties: { defaultColWidth: 16 } });
    headerRow(wh, ["Weighbridge", "Client", "Site", "Reports", "Approved", "Pending", "Rejected", "Findings", "Photos", "Last service", "Services (type × count)"]);
    d.weighbridgeHistory.forEach((w) =>
      wh.addRow([
        w.id, w.clientName, w.site || "", w.reports, w.approved, w.pending, w.rejected, w.findings, w.photos,
        w.lastDate ? new Date(w.lastDate).toLocaleDateString("en-GB") : "",
        w.services.map((s) => `${s.name} ×${s.count}`).join("; "),
      ])
    );
    wh.getColumn(11).width = 40;
    wh.views = [{ state: "frozen", ySplit: 1 }];
  }

  /* ---- Client statements ---- */
  if (d.clients?.length) {
    const cl = wb.addWorksheet("Clients", { properties: { defaultColWidth: 16 } });
    headerRow(cl, ["Client", "Reports", "Service types", "Sites", "Weighbridges", "Findings", "Approved", "Pending", "Rejected", "Photos", "Last activity"]);
    d.clients.forEach((c) =>
      cl.addRow([
        c.name, c.reports, c.services.length, c.sites, c.weighbridges, c.findings, c.approved, c.pending, c.rejected, c.photos,
        c.lastDate ? new Date(c.lastDate).toLocaleDateString("en-GB") : "",
      ])
    );
    cl.getColumn(1).width = 30;
    cl.views = [{ state: "frozen", ySplit: 1 }];
  }

  /* ---- Compliance ---- */
  if (d.compliance) {
    const c = d.compliance;
    const co = wb.addWorksheet("Compliance", { properties: { defaultColWidth: 26 } });
    headerRow(co, ["Metric", "Value"]);
    const rowsC = [
      ["Checklist pass rate (%)", c.checklistPassRate ?? "—"],
      ["Checklist items passed", `${c.checklistPassed ?? 0} / ${c.checklistItems ?? 0}`],
      ["Schedule adherence (%)", c.scheduleAdherence ?? "—"],
      ["Schedules active", c.schedulesActive ?? "—"],
      ["Schedules overdue", c.schedulesOverdue ?? "—"],
      ["Schedules due this week", c.schedulesDueSoon ?? "—"],
      ["Contracts overdue", c.contractsOverdue ?? "—"],
      ["Contracts due within 30 days", c.contractsDueSoon ?? "—"],
      ["Approval rate (%)", c.approvalRate],
      ["Rejection rate (%)", c.rejectionRate],
      ["Avg approval time (h)", c.avgTurnaroundHours ?? "—"],
      ["Reports approved", c.reportsApproved],
      ["Reports pending", c.reportsPending],
      ["Reports rejected", c.reportsRejected],
      ["Open findings", c.findingsOpen],
    ];
    rowsC.forEach((r) => co.addRow(r));
    co.getColumn(1).width = 30;
  }

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
