import ApproveClient from "@/components/ApproveClient";

// Public one-click approval landing page. No session required — the token in the
// URL authenticates the routed reviewer. Rendered outside the app shell.
export const dynamic = "force-dynamic";

export default function ApprovePage({ params, searchParams }) {
  return <ApproveClient token={params.token} initialAction={searchParams?.action === "reject" ? "reject" : searchParams?.action === "approve" ? "approve" : null} />;
}
