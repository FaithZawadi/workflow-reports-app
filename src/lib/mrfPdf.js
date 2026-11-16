import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { MaterialRequisitionDocument } from "@/pdf/MaterialRequisitionDocument";
import { logoDataUrl } from "@/lib/logo";
import { syncCompany } from "@/lib/settings";

// Render a purchase request as the QSL-A2 Material Requisition Form PDF Buffer.
export async function renderMrfPdf(request) {
  await syncCompany();
  return renderToBuffer(
    React.createElement(MaterialRequisitionDocument, { request, logoSrc: logoDataUrl() })
  );
}
