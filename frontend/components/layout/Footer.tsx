import Link from "next/link";
import Logo from "@/components/Logo";
import { ROUTES } from "@/lib/routes";

export default function Footer() {
  return (
    <footer className="relative z-10 border-t border-border mt-auto bg-surface/30 backdrop-blur-md">
      <div className="mx-auto max-w-7xl px-4 py-14 lg:px-8">
        <div className="grid grid-cols-2 gap-10 sm:grid-cols-2 lg:grid-cols-12">

          {/* Brand — spans 4 cols on large */}
          <div className="col-span-2 sm:col-span-2 lg:col-span-4 space-y-4">
            <Link href={ROUTES.home} aria-label="Trippy home" className="inline-block">
              <Logo size="sm" />
            </Link>
            <p className="text-caption max-w-[280px] leading-relaxed text-muted">
              Collaborative trip planning powered by AI. Plan together,
              coordinate effortlessly, and travel better.
            </p>
          </div>

          {/* Product */}
          <div className="lg:col-span-2 lg:col-start-7 space-y-4">
            <h6 className="font-bold text-foreground tracking-wider uppercase text-[10px]">
              Product
            </h6>
            <ul className="space-y-3 text-muted text-body-sm">
              <li>
                <Link href={ROUTES.howItWorks} className="hover:text-foreground transition-colors">
                  How It Works
                </Link>
              </li>
              <li>
                <Link href={ROUTES.dashboard} className="hover:text-foreground transition-colors">
                  Explore Trips
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div className="lg:col-span-2 space-y-4">
            <h6 className="font-bold text-foreground tracking-wider uppercase text-[10px]">
              Company
            </h6>
            <ul className="space-y-3 text-muted text-body-sm">
              <li>
                <Link href={ROUTES.about} className="hover:text-foreground transition-colors">
                  About Us
                </Link>
              </li>
              <li>
                <a href="mailto:support@trippy-app.com" className="hover:text-foreground transition-colors">
                  Contact Us
                </a>
              </li>
              <li>
                <a href="mailto:feedback@trippy-app.com" className="hover:text-foreground transition-colors">
                  Feedback
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div className="lg:col-span-2 space-y-4">
            <h6 className="font-bold text-foreground tracking-wider uppercase text-[10px]">
              Legal
            </h6>
            <ul className="space-y-3 text-muted text-body-sm">
              <li>
                <Link href={ROUTES.terms} className="hover:text-foreground transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href={ROUTES.datenschutz} className="hover:text-foreground transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href={ROUTES.impressum} className="hover:text-foreground transition-colors">
                  Imprint
                </Link>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom Bar */}
        <div className="mt-12 border-t border-border/80 pt-6 flex flex-col items-center justify-between gap-3 sm:flex-row text-caption text-muted">
          <span>&copy; {new Date().getFullYear()} Trippy. All rights reserved.</span>
          <span>Made with ❤️ for travelers everywhere</span>
        </div>
      </div>
    </footer>
  );
}
