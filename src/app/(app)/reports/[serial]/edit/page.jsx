import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canEdit } from "@/lib/rbac";
import ReportForm from "@/components/ReportForm";

export const metadata = { title: "Edit report · QSL Reports" };

export default async function EditReportPage({ params }) {
  const claims = await getCurrentUser();
  if (!claims) redirect("/login");

  const report = await prisma.report.findUnique({
    where: { serial: params.serial },
    include: { photos: { orderBy: { order: "asc" } } },
  });
  if (!report) redirect("/dashboard");
  if (!canEdit(report, claims)) redirect(`/reports/${params.serial}`);

  let clientName = null;
  if (claims.clientId) {
    const c = await prisma.client.findUnique({ where: { id: claims.clientId } });
    clientName = c?.name || null;
  }

  const profile = {
    role: claims.role,
    roles: claims.roles,
    name: claims.name,
    clientId: claims.clientId,
    clientName,
    site: claims.site,
  };

  const edit = {
    serial: report.serial,
    template: report.template,
    status: report.status,
    authorId: report.authorId,
    clientName: report.clientName,
    site: report.site,
    weighbridgeId: report.weighbridgeId,
    supervisorEmail: report.supervisorEmail,
    managerEmail: report.managerEmail,
    data: report.data,
    photos: report.photos.map((p) => ({
      dataUrl: p.dataUrl,
      caption: p.caption,
      takenAt: p.takenAt ? p.takenAt.toISOString() : null,
      gpsLat: p.gpsLat,
      gpsLng: p.gpsLng,
      gpsAcc: p.gpsAcc,
    })),
  };

  return <ReportForm profile={profile} edit={edit} />;
}
