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
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/icons/apple-touch-icon.png",
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
