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
  // Registration / tax identifiers shown on quotations & invoices.
  pin: process.env.NEXT_PUBLIC_COMPANY_PIN || "",
  // Bank / payment details printed on quotations so clients can pay. Override
  // each via env so the real account can be set without a code change.
  bank: {
    name: process.env.NEXT_PUBLIC_BANK_NAME || "",
    account: process.env.NEXT_PUBLIC_BANK_ACCOUNT_NAME || (process.env.NEXT_PUBLIC_COMPANY_NAME || "Qalibrated Systems Limited"),
    accountNo: process.env.NEXT_PUBLIC_BANK_ACCOUNT_NO || "",
    branch: process.env.NEXT_PUBLIC_BANK_BRANCH || "",
    swift: process.env.NEXT_PUBLIC_BANK_SWIFT || "",
    currency: process.env.NEXT_PUBLIC_BANK_CURRENCY || "KES",
    mpesaPaybill: process.env.NEXT_PUBLIC_MPESA_PAYBILL || "",
    mpesaAccount: process.env.NEXT_PUBLIC_MPESA_ACCOUNT || "",
  },
};

// True when at least one payment detail is configured (so the PDF can hide the
// whole block until the real bank details are provided).
export const HAS_BANK_DETAILS = Boolean(
  COMPANY.bank.name || COMPANY.bank.accountNo || COMPANY.bank.mpesaPaybill
);

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
