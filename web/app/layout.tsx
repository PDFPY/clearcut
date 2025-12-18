import "./globals.css";
import type { Metadata } from "next";
import Script from "next/script";
import Link from "next/link";

export const metadata = {
  metadataBase: new URL("https://clearcuttools.com"),
  title: "ClearCut – Free Background Remover",
  description:
    "Remove image backgrounds instantly for free. No signup, no watermark. Fast AI background remover.",
  openGraph: {
    title: "ClearCut – Free Background Remover",
    description: "Remove image backgrounds instantly for free. No signup, no watermark.",
    url: "https://clearcuttools.com",
    siteName: "ClearCut",
    images: ["/icon.png"],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ClearCut – Free Background Remover",
    description: "Remove image backgrounds instantly for free.",
    images: ["/icon.png"],
  },
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

        {/* Extra SEO basics */}
        <meta name="theme-color" content="#0B0D10" />
        <meta name="color-scheme" content="dark" />
      </head>

      <body className="min-h-screen bg-[#0B0D10] text-neutral-100 antialiased">
        {/* Subtle vignette / premium background */}
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.06),rgba(0,0,0,0)_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.05),rgba(0,0,0,0)_60%)]" />
        </div>

        {/* Header (single nav only) */}
        <header className="border-b border-white/5">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4">
            {/* Brand */}
            <Link href="/" className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/5">
                {/* Uses /public/icon.png (yours) */}
                {/* Avoid next/image to keep it dead simple */}
                <img
                  src="/icon.png"
                  alt="ClearCut"
                  className="h-6 w-6 object-contain opacity-95"
                />
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold tracking-tight">ClearCut</div>
                <div className="text-xs text-neutral-400">Background remover</div>
              </div>
            </Link>

            {/* Nav */}
            <nav className="hidden items-center gap-6 text-sm text-neutral-300 md:flex">
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

            {/* Mobile minimal nav */}
            <div className="flex items-center gap-2 md:hidden">
              <Link
                href="/remove-background"
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm text-neutral-200"
              >
                Tool
              </Link>
            </div>
          </div>
        </header>

        {/* Main */}
        <main className="mx-auto w-full max-w-7xl px-4 py-8">{children}</main>

        {/* Footer (single) */}
        <footer className="border-t border-white/5">
          <div className="mx-auto flex w-full max-w-7xl flex-col items-start justify-between gap-4 px-4 py-8 text-sm text-neutral-400 md:flex-row md:items-center">
            <div>© {new Date().getFullYear()} ClearCut</div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
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
