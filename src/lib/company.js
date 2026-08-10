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
  accreditation: "KENAS · ISO/IEC 17025:2017 · ISO 9001:2015 · ILAC-MRA",
  // Registration / tax identifier shown on quotations & invoices.
  pin: process.env.NEXT_PUBLIC_COMPANY_PIN || "P051889248C",
  // Postal / physical address block for the quotation footer.
  postal: process.env.NEXT_PUBLIC_COMPANY_POSTAL || "Birdi Singh Complex, P.O Box 34463 - 00100, Nairobi",
  tagline: process.env.NEXT_PUBLIC_COMPANY_TAGLINE || "…Inventing and Making it Happen…",
  // Bank / payment details printed on quotations so clients can pay. Every value
  // is env-overridable so the account can be corrected without a code change.
  bank: {
    accountName: process.env.NEXT_PUBLIC_BANK_ACCOUNT_NAME || "QALIBRATED SYSTEMS LIMITED",
    name: process.env.NEXT_PUBLIC_BANK_NAME || "SIDIAN BANK LIMITED",
    branch: process.env.NEXT_PUBLIC_BANK_BRANCH || "KENYATTA MARKET",
    accountNo: process.env.NEXT_PUBLIC_BANK_ACCOUNT_NO || "01014020006131",
    paybill: process.env.NEXT_PUBLIC_MPESA_PAYBILL || "111999",
    swift: process.env.NEXT_PUBLIC_BANK_SWIFT || "SIDNKENA",
    bankCode: process.env.NEXT_PUBLIC_BANK_CODE || "66",
    branchCode: process.env.NEXT_PUBLIC_BANK_BRANCH_CODE || "014",
  },
};

// The default payment-details block used on quotations (a quote may override it
// with its own text). Multi-line "LABEL: value" so it prints exactly as entered.
export const DEFAULT_PAYMENT_DETAILS = [
  `NAME: ${COMPANY.bank.accountName}`,
  `BANK: ${COMPANY.bank.name}`,
  `BRANCH: ${COMPANY.bank.branch}`,
  `A/C No: ${COMPANY.bank.accountNo}`,
  COMPANY.bank.paybill ? `PAYBILL: ${COMPANY.bank.paybill}` : "",
  COMPANY.bank.swift ? `SWIFT CODE: ${COMPANY.bank.swift}` : "",
  COMPANY.bank.bankCode ? `BANK CODE: ${COMPANY.bank.bankCode}` : "",
  COMPANY.bank.branchCode ? `BRANCH CODE: ${COMPANY.bank.branchCode}` : "",
  COMPANY.pin ? `PIN NO: ${COMPANY.pin}` : "",
].filter(Boolean).join("\n");

// The default terms-of-sale note at the foot of a quotation (editable per quote).
export const DEFAULT_QUOTE_TERMS =
  "Prices quoted are exclusive of applicable taxes unless otherwise stated. Delivery timelines commence once the quotation has been accepted and the initial payment has been received.";

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
