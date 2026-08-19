import "./globals.css";
import RegisterSW from "@/components/RegisterSW";
import Analytics from "@/components/Analytics";

// The public site URL — used for canonical URLs, Open Graph and the sitemap.
const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://reports.qalibrated.com";
const SITE_NAME = "Qalibrated Systems — Weighbridge Maintenance Management";
const DESCRIPTION =
  "Qalibrated Systems (QSL) is a weighbridge and scale maintenance management platform: digital daily/weekly/monthly inspections, calibration & verification records (ISO/IEC 17025), approvals, quotations, scheduling and client service statements.";
const KEYWORDS = [
  "Qalibrated", "Qalibrated Systems", "Qalibrated Reports", "Qalibrated Systems Reports",
  "QSL", "QSL Reports", "qalibrated login", "reports.qalibrated.com",
  "weighbridge maintenance", "weighbridge calibration", "scale calibration Kenya",
  "ISO/IEC 17025", "weighbridge inspection software", "maintenance management system",
  "calibration records", "weighbridge service reports",
];

export const metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Qalibrated Systems Reports — Weighbridge & Scale Maintenance",
    template: "%s · Qalibrated Systems",
  },
  description: DESCRIPTION,
  keywords: KEYWORDS,
  applicationName: "QSL Reports",
  authors: [{ name: "Qalibrated Systems Ltd" }],
  creator: "Qalibrated Systems Ltd",
  publisher: "Qalibrated Systems Ltd",
  manifest: "/manifest.webmanifest",
  alternates: { canonical: "/" },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "QSL Reports" },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: "Qalibrated Systems — Weighbridge Maintenance Management",
    description: DESCRIPTION,
    url: SITE_URL,
    locale: "en_KE",
    images: [{ url: "/icons/icon-512.png", width: 512, height: 512, alt: "Qalibrated Systems" }],
  },
  twitter: {
    card: "summary",
    title: "Qalibrated Systems — Weighbridge Maintenance Management",
    description: DESCRIPTION,
    images: ["/icons/icon-512.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  // Search Console / Bing ownership verification. Set GOOGLE_SITE_VERIFICATION
  // (and optionally BING_SITE_VERIFICATION) to the code your webmaster console
  // gives you — this stamps the <meta name="google-site-verification"> tag so you
  // can verify the site and submit the sitemap to force indexing.
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.BING_SITE_VERIFICATION ? { "msvalidate.01": process.env.BING_SITE_VERIFICATION } : undefined,
  },
  category: "technology",
};

export const viewport = {
  themeColor: "#161310",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Structured data so search engines understand the organisation + product.
const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: "Qalibrated Reports",
      alternateName: ["Qalibrated Systems", "Qalibrated Systems Reports", "QSL Reports"],
      url: SITE_URL,
      description: DESCRIPTION,
      inLanguage: "en",
      publisher: { "@id": `${SITE_URL}/#org` },
      // Sitelinks search box — lets Google offer an in-site search from results.
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/dashboard?q={search_term_string}` },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#org`,
      name: "Qalibrated Systems Ltd",
      alternateName: ["Qalibrated", "Qalibrated Reports", "QSL"],
      url: SITE_URL,
      logo: `${SITE_URL}/icons/icon-512.png`,
      description: DESCRIPTION,
      areaServed: "KE",
    },
    {
      "@type": "SoftwareApplication",
      name: "QSL Maintenance Management System",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web, Android",
      offers: { "@type": "Offer", price: "0", priceCurrency: "KES" },
      description: DESCRIPTION,
      publisher: { "@type": "Organization", name: "Qalibrated Systems Ltd" },
    },
  ],
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        {children}
        <RegisterSW />
        <Analytics />
      </body>
    </html>
  );
}
