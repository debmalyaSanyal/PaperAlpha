import type { Metadata } from "next";
import Link from "next/link";
// @ts-ignore: side-effect CSS import has no type declarations
import "./globals.css";

export const metadata: Metadata = {
  title: "ResearchPaper Agent",
  description: "Autonomous multi-agent research paper generation system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
        <header className="border-b border-slate-200 bg-white/90 backdrop-blur sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Link href="/dashboard" className="flex items-center space-x-2 font-bold text-xl tracking-tight text-slate-900">
                <span className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-extrabold text-lg shadow-sm">
                  R
                </span>
                <span>ResearchPaper <span className="text-indigo-600 font-semibold">Agent</span></span>
              </Link>
            </div>
            <nav className="flex items-center space-x-4">
              <Link
                href="/dashboard"
                className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
              >
                Dashboard
              </Link>
              <Link
                href="/projects/create"
                className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md shadow-sm transition-colors"
              >
                + New Paper
              </Link>
            </nav>
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>

        <footer className="border-t border-slate-200 bg-white py-6 mt-12 text-center text-xs text-slate-500">
          <p>ResearchPaper Agent &copy; {new Date().getFullYear()} &mdash; Publication-ready academic draft engineering.</p>
        </footer>
      </body>
    </html>
  );
}
