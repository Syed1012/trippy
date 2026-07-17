import Link from "next/link";
import Logo from "@/components/Logo";
import { LANDING_ANCHORS, ROUTES } from "@/lib/routes";

export default function Footer() {
  return (
    <footer className="relative z-10 border-t border-border mt-auto">
      <div className="mx-auto max-w-7xl px-4 py-10 lg:px-8">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="space-y-3">
            <Link href={ROUTES.home} aria-label="Trippy home" className="inline-block">
              <Logo size="sm" />
            </Link>
            <p className="text-caption max-w-xs">
              Collaborative trip planning powered by AI. Plan together, travel
              better.
            </p>
          </div>

          <div className="flex gap-12 text-body-sm">
            <div className="space-y-2">
              <h6 className="font-semibold">Product</h6>
              <ul className="space-y-1 text-muted">
                <li><Link href={ROUTES.dashboard} className="hover:text-foreground transition-colors">Dashboard</Link></li>
                <li><Link href={LANDING_ANCHORS.features} className="hover:text-foreground transition-colors">Features</Link></li>
                <li><Link href={LANDING_ANCHORS.howItWorks} className="hover:text-foreground transition-colors">How it works</Link></li>
              </ul>
            </div>
            <div className="space-y-2">
              <h6 className="font-semibold">Company</h6>
              <ul className="space-y-1 text-muted">
                <li><Link href={ROUTES.about} className="hover:text-foreground transition-colors">About</Link></li>
                <li><Link href={ROUTES.impressum} className="hover:text-foreground transition-colors">Impressum</Link></li>
                <li><Link href={ROUTES.datenschutz} className="hover:text-foreground transition-colors">Datenschutz</Link></li>
                <li><Link href={ROUTES.terms} className="hover:text-foreground transition-colors">Terms</Link></li>
                <li><Link href={ROUTES.privacy} className="hover:text-foreground transition-colors">Privacy Policy</Link></li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-6 text-caption text-center">
          &copy; {new Date().getFullYear()} Trippy. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
