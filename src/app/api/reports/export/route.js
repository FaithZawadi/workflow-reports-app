import ExcelJS from "exceljs";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { dueStatus, STATUS_META } from "@/lib/schedule";

// Excel export is an admin-only capability.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GOLD = "FFF5A800";
const COAL = "FF161310";

function fmt(d) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return String(d);
  }
}

function styleHeader(row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  row.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COAL } };
    cell.alignment = { vertical: "middle" };
    cell.border = { bottom: { style: "thin", color: { argb: GOLD } } };
  });
}

// GET /api/reports/export — full register + schedule as a formatted .xlsx (ADMIN only).
export async function GET() {
  let user;
  try {
    user = await requireUser(["ADMIN"]);
  } catch (res) {
    return res;
  }

  const [reports, schedules] = await Promise.all([
    prisma.report.findMany({
      orderBy: { createdAt: "desc" },
      take: 10000,
      select: {
        serial: true,
        template: true,
        templateName: true,
        clientName: true,
        site: true,
        weighbridgeId: true,
        authorName: true,
        supervisorEmail: true,
        managerEmail: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.schedule.findMany({ orderBy: { nextDueAt: "asc" }, take: 10000 }),
  ]);

  const wb = new ExcelJS.Workbook();
  wb.creator = "QSL Maintenance Management System";
  wb.created = new Date();

  // --- Reports sheet ---
  const rs = wb.addWorksheet("Reports", { views: [{ state: "frozen", ySplit: 1 }] });
  rs.columns = [
    { header: "Serial", key: "serial", width: 22 },
    { header: "Form", key: "template", width: 8 },
    { header: "Report type", key: "templateName", width: 26 },
    { header: "Client", key: "clientName", width: 24 },
    { header: "Site", key: "site", width: 18 },
    { header: "Weighbridge", key: "weighbridgeId", width: 18 },
    { header: "Completed by", key: "authorName", width: 20 },
    { header: "Supervisor", key: "supervisorEmail", width: 24 },
    { header: "Manager", key: "managerEmail", width: 24 },
    { header: "Status", key: "status", width: 20 },
    { header: "Created", key: "createdAt", width: 22 },
  ];
  reports.forEach((r) => rs.addRow({ ...r, status: r.status.replace(/_/g, " "), createdAt: fmt(r.createdAt) }));
  styleHeader(rs.getRow(1));

  // --- Schedules sheet ---
  const ss = wb.addWorksheet("Maintenance schedule", { views: [{ state: "frozen", ySplit: 1 }] });
  ss.columns = [
    { header: "Form", key: "template", width: 8 },
    { header: "Task", key: "templateName", width: 26 },
    { header: "Client", key: "clientName", width: 24 },
    { header: "Site", key: "site", width: 18 },
    { header: "Weighbridge", key: "weighbridgeId", width: 20 },
    { header: "Frequency", key: "frequency", width: 14 },
    { header: "Status", key: "state", width: 12 },
    { header: "Next due", key: "nextDueAt", width: 20 },
    { header: "Last done", key: "lastDoneAt", width: 20 },
    { header: "Assignee", key: "assignedName", width: 20 },
    { header: "Last report", key: "lastReportSerial", width: 22 },
    { header: "Active", key: "active", width: 8 },
  ];
  schedules.forEach((s) => {
    const { status } = dueStatus(s.nextDueAt, s.frequency);
    ss.addRow({
      template: s.template,
      templateName: s.templateName,
      clientName: s.clientName,
      site: s.site || "",
      weighbridgeId: s.weighbridgeId || "",
      frequency: s.frequency,
      state: (STATUS_META[status] || {}).label || status,
      nextDueAt: fmt(s.nextDueAt),
      lastDoneAt: fmt(s.lastDoneAt),
      assignedName: s.assignedName || "",
      lastReportSerial: s.lastReportSerial || "",
      active: s.active ? "Yes" : "No",
    });
  });
  styleHeader(ss.getRow(1));

  const buffer = await wb.xlsx.writeBuffer();
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="qsl_reports_${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
