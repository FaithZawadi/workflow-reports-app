import "./globals.css";
import RegisterSW from "@/components/RegisterSW";

export const metadata = {
  title: "QSL Maintenance Management System",
  description: "Weighbridge maintenance reporting, approvals and calibration records — Qalibrated Systems Ltd.",
  manifest: "/manifest.webmanifest",
  applicationName: "QSL Reports",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "QSL Reports" },
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-64.png", sizes: "64x64", type: "image/png" },
      { url: "/brand/qsl-mark.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport = {
  themeColor: "#161310",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
