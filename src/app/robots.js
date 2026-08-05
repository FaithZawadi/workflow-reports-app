const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "https://reports.qalibrated.com";

// Allow indexing of the public marketing/login surface; keep the authenticated
// app, API and share links out of search results.
export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login"],
        disallow: ["/api/", "/dashboard", "/reports", "/reports-summary", "/schedule", "/tasks", "/quotations", "/calibration-requests", "/projects", "/contracts", "/customer-feedback", "/training-feedback", "/users", "/weighbridges", "/clients", "/sites", "/feedback", "/audit", "/account", "/overview", "/analytics", "/d/"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
