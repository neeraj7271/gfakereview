import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  FileText,
  Gauge,
  Import,
  ListChecks,
  PlusCircle,
  Settings,
  ShieldCheck
} from "lucide-react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Google Fake Review Detector",
  description: "Detect suspicious review patterns and prepare reputation defense packets."
};

const navItems = [
  { href: "/", label: "Dashboard", icon: Gauge },
  { href: "/reviews", label: "Reviews", icon: ListChecks },
  { href: "/add-review", label: "Add Review", icon: PlusCircle },
  { href: "/import", label: "Import", icon: Import },
  { href: "/alerts", label: "Alerts", icon: AlertTriangle },
  { href: "/evidence", label: "Evidence", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings }
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="shell">
          <aside className="sidebar" aria-label="Primary navigation">
            <Link className="brand" href="/">
              <span className="brand-mark">
                <ShieldCheck size={22} aria-hidden="true" />
              </span>
              <span className="brand-text">
                ReviewShield
                <span>Fake review detector</span>
              </span>
            </Link>
            <nav className="nav">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link className="nav-link" href={item.href} key={item.href}>
                    <Icon size={18} aria-hidden="true" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </aside>
          <main className="content">{children}</main>
        </div>
      </body>
    </html>
  );
}
