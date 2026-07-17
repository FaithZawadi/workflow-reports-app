import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { isClient, canPrepareQuotes, rolesOf } from "@/lib/roles";
import QuotationNew from "@/components/QuotationNew";

export const metadata = { title: "New quotation · QSL" };

export default async function NewQuotationPage({ searchParams }) {
  const claims = await getCurrentUser();
  if (!claims) redirect("/login");
  const allowed = isClient(claims) || canPrepareQuotes(claims) || rolesOf(claims).includes("ADMIN");
  if (!allowed) redirect("/dashboard");
  return (
    <QuotationNew
      profile={{ name: claims.name, email: claims.email, roles: claims.roles, clientId: claims.clientId }}
      calibrationRequestId={searchParams?.calibrationRequestId || null}
    />
  );
}
