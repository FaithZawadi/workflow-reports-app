// Single source of truth for company identity shown across the app and PDFs.
// Every value can be overridden with an environment variable so the details can
// be corrected without a code change (NEXT_PUBLIC_* so the browser bundle can
// read them too). Update COMPANY.address once the exact postal address is known.
export const COMPANY = {
  name: process.env.NEXT_PUBLIC_COMPANY_NAME || "Qalibrated Systems Limited",
  address: process.env.NEXT_PUBLIC_COMPANY_ADDRESS || "Nairobi, Kenya",
  website: process.env.NEXT_PUBLIC_COMPANY_WEBSITE || "www.qalibrated.co.ke",
  email: process.env.NEXT_PUBLIC_COMPANY_EMAIL || "info@qalibrated.co.ke",
  phone: process.env.NEXT_PUBLIC_COMPANY_PHONE || "+254 714 999 996",
  accreditation: "KENAS · ISO/IEC 17025 + 17020 · ILAC-MRA",
};

// Convenience one-line contact string (name · address · website · email · phone).
export const COMPANY_LINE = [
  COMPANY.name,
  COMPANY.address,
  COMPANY.website,
  COMPANY.email,
  COMPANY.phone,
]
  .filter(Boolean)
  .join(" · ");
