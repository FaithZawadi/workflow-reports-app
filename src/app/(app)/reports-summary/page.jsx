import { redirect } from "next/navigation";

// The management report is now the detailed Dashboard at /overview — there is a
// single dashboard. Keep this route as a redirect so old links/bookmarks land
// on it rather than 404.
export default function ReportsSummaryPage() {
  redirect("/overview");
}
