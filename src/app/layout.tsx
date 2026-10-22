import type { Metadata, Viewport } from "next";
import { AppProvider } from "@/components/provider";
import { AppShell } from "@/components/shell";
import { financialOperationsEnabled } from "@/lib/deployment";
import "./globals.css";
export const metadata: Metadata = {
  title: "Spendense — Make every day count.",
  description:
    "Spendense brings a little clarity to your everyday. Plan your income, make room for commitments, and understand what you can spend today.",
  applicationName: "Spendense",
  robots: financialOperationsEnabled()
    ? undefined
    : { index: false, follow: false },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#f7f8fa" />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('daywise-theme')||'light';document.documentElement.dataset.theme=t==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>
        <AppProvider>
          <AppShell>{children}</AppShell>
        </AppProvider>
      </body>
    </html>
  );
}
