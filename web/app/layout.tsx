import "./globals.css";
import type { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";
import Image from "next/image";

export const metadata: Metadata = {
  title: "ClearCut — Free Background Remover",
  description: "Remove image backgrounds in seconds. Free, fast, no watermark.",
  // If you already have app/icon.png working, you don't need to set icons here.
  // Next will pick up app/icon.png automatically.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT?.trim();

  return (
    <html lang="en" className="h-full">
      <head>
        {client ? (
          <Script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${client}`}
            crossOrigin="anonymous"
            strategy="afterInteractive"
          />
        ) : null}
      </head>

      <body className="min-h-screen bg-neutral-950 text-neutral-100 antialiased">
        {/* Background atmosphere */}
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-neutral-950" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.08),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(255,255,255,0.05),transparent_55%)]" />
        </div>

        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-neutral-800/70 bg-neutral-950/70 backdrop-blur">
          <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between px-4 py-3 sm:px-6">
            <Link href="/" className="flex items-center gap-3">
              {/* Put your logo at: web/public/logo.png */}
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-neutral-800 bg-neutral-900/60">
                <Image src="/logo.png" alt="ClearCut" width={26} height={26} priority />
              </div>

              <div className="leading-tight">
                <div className="text-sm font-semibold text-neutral-100">ClearCut</div>
                <div className="text-xs text-neutral-400">Background remover</div>
              </div>
            </Link>

            <nav className="flex items-center gap-4 text-sm text-neutral-300">
              <Link href="/remove-background" className="hover:text-white">
                Tool
              </Link>
              <Link href="/privacy" className="hover:text-white">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-white">
                Terms
              </Link>
              <Link href="/contact" className="hover:text-white">
                Contact
              </Link>
            </nav>
          </div>
        </header>

        {/* Main (wide + responsive; no narrow clamp) */}
        <main
          className={[
            "mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6 sm:py-10",
            // If a page uses Tailwind Typography ("prose"), force it to dark mode.
            "[&_.prose]:prose-invert [&_.prose]:text-neutral-100",
            "[&_.prose_a]:text-neutral-100 [&_.prose_a]:underline [&_.prose_a]:decoration-neutral-600",
            "[&_.prose_h1]:text-neutral-100 [&_.prose_h2]:text-neutral-100 [&_.prose_strong]:text-neutral-100",
            "[&_.prose_code]:text-neutral-100 [&_.prose_hr]:border-neutral-800",
          ].join(" ")}
        >
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-neutral-800/70 bg-neutral-950/50">
          <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-3 px-4 py-8 text-sm text-neutral-400 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>© {new Date().getFullYear()} ClearCut</div>

            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <Link href="/remove-background" className="hover:text-neutral-200">
                Tool
              </Link>
              <Link href="/privacy" className="hover:text-neutral-200">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-neutral-200">
                Terms
              </Link>
              <Link href="/contact" className="hover:text-neutral-200">
                Contact
              </Link>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
