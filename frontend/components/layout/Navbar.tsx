"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Map,
  MessageSquare,
  Settings,
  LogOut,
  Menu,
  X,
  CreditCard,
  UserCircle,
  Shield,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import Logo from "@/components/Logo";
import { Avatar } from "@/components/ui";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth-context";
import NotificationBell from "@/components/notifications/NotificationBell";
import { ROUTES } from "@/lib/routes";

/** Primary nav links shown as labelled buttons in the center area. */
const navLinks = [
  { href: ROUTES.dashboard, label: "My Trips", icon: Map },
];

const adminLinks = [
  { href: ROUTES.dashboardAdminModeration, label: "Moderation", icon: Shield },
];

/**
 * Shared navbar used on both the dashboard and the landing page (for
 * authenticated users). The `variant` prop controls the visual glass style
 * so the nav blends with the page's background aesthetic.
 *
 * - `"dashboard"` (default) — uses the existing `glass-strong` token.
 * - `"landing"` — warm translucent surface matching the hero section.
 */
export default function Navbar({
  variant = "dashboard",
  className: outerClassName,
}: {
  variant?: "dashboard" | "landing";
  className?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  const isLanding = variant === "landing";

  const chatActive =
    pathname === ROUTES.dashboardChat ||
    pathname.startsWith(ROUTES.dashboardChat + "/");

  async function handleLogout() {
    await logout();
    router.push(ROUTES.login);
  }

  // Close profile dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    if (profileOpen) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [profileOpen]);

  /* ---- style tokens that differ per variant ---- */
  const navOuter = isLanding
    ? "border-b border-white/30 bg-white/18 shadow-[0_1px_0_rgba(20,47,43,0.04)] backdrop-blur-2xl"
    : "glass-strong";

  const linkIdle = isLanding
    ? "text-[#5f6f69] hover:text-[#17211f] hover:bg-white/40"
    : "text-muted hover:text-foreground hover:bg-surface";

  const linkActive = isLanding
    ? "bg-white/50 text-[#17211f] shadow-[0_2px_8px_-4px_rgba(20,47,43,0.18)]"
    : "bg-trippy-500/15 text-trippy-400";

  const iconBtnBase = cn(
    "relative flex items-center justify-center rounded-lg p-2 transition-all duration-150",
  );

  const iconBtnIdle = isLanding
    ? "text-[#5f6f69] hover:text-[#17211f] hover:bg-white/40"
    : "text-muted hover:text-foreground hover:bg-surface";

  const iconBtnActive = isLanding
    ? "bg-white/50 text-[#17211f]"
    : "bg-trippy-500/15 text-trippy-400";

  const mobileDrawerBg = isLanding
    ? "border-t border-white/30 bg-white/30 backdrop-blur-xl"
    : "border-t border-border";

  const mobileLinkIdle = isLanding
    ? "text-[#5f6f69] hover:text-[#17211f] hover:bg-white/40"
    : "text-muted hover:text-foreground hover:bg-surface";

  const mobileLinkActive = isLanding
    ? "bg-white/50 text-[#17211f]"
    : "bg-trippy-500/15 text-trippy-400";

  const dropdownBg = isLanding
    ? "border-white/60 bg-white/92 backdrop-blur-xl shadow-[0_28px_72px_-42px_rgba(20,47,43,0.9)]"
    : "border-border bg-white shadow-xl";

  const dropdownItemHover = isLanding ? "hover:bg-[#fbf7ee]" : "hover:bg-shore-50";

  const dividerClass = isLanding ? "border-t border-white/40" : "border-t border-border";

  return (
    <nav className={cn("sticky top-0 z-50 px-4 lg:px-8", navOuter, outerClassName)}>
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6">
        {/* Logo */}
        <Link href={ROUTES.home} className="shrink-0">
          <Logo size="sm" />
        </Link>

        {/* Primary nav — only the most important labelled links */}
        <div className="hidden md:flex items-center gap-0.5">
          {[...navLinks, ...(user?.role === "ADMIN" ? adminLinks : [])].map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-semibold transition-all duration-150",
                  active ? linkActive : linkIdle,
                )}
              >
                <Icon size={15} />
                {label}
              </Link>
            );
          })}
        </div>

        {/* Spacer pushes the right cluster to the end */}
        <div className="flex-1" />

        {/* Right icon cluster — compact, icon-only actions + profile */}
        <div className="flex items-center gap-0.5">
          {/* Chat — icon only */}
          <Link
            href={ROUTES.dashboardChat}
            className={cn(iconBtnBase, chatActive ? iconBtnActive : iconBtnIdle)}
            aria-label="Chat"
          >
            <MessageSquare size={18} />
          </Link>

          {/* Notifications — icon only */}
          <NotificationBell className={cn(iconBtnBase, iconBtnIdle)} />

          {/* Thin separator between icons and avatar */}
          <div className={cn("mx-1.5 hidden md:block h-6 w-px", isLanding ? "bg-[#17211f]/10" : "bg-border")} />

          {/* Profile dropdown */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => setProfileOpen(!profileOpen)}
              className="cursor-pointer rounded-full transition-all duration-150"
              aria-label="User menu"
            >
              <Avatar
                name={user?.displayName ?? "User"}
                src={user?.avatarUrl}
                size="sm"
                className={cn(
                  "rounded-full transition-all",
                  isLanding
                    ? "hover:ring-2 hover:ring-[#d5653e]/40"
                    : "hover:ring-2 hover:ring-trippy-400/50",
                )}
              />
            </button>

            {profileOpen && (
              <div className={cn("absolute right-0 top-full mt-2 w-52 rounded-xl border z-50 py-1 overflow-hidden", dropdownBg)}>
                {/* User info header */}
                {user?.displayName && (
                  <>
                    <div className="px-4 py-2.5">
                      <p className="text-sm font-semibold text-foreground truncate">{user.displayName}</p>
                      {user.email && (
                        <p className="text-xs text-muted truncate mt-0.5">{user.email}</p>
                      )}
                    </div>
                    <div className={cn("my-0.5", dividerClass)} />
                  </>
                )}

                <Link
                  href={ROUTES.dashboardProfile}
                  onClick={() => setProfileOpen(false)}
                  className={cn("flex items-center gap-2.5 px-4 py-2 text-sm font-medium text-foreground transition-colors", dropdownItemHover)}
                >
                  <UserCircle size={15} className="text-muted" />
                  Profile
                </Link>
                <Link
                  href={ROUTES.dashboardPayments}
                  onClick={() => setProfileOpen(false)}
                  className={cn("flex items-center gap-2.5 px-4 py-2 text-sm font-medium text-foreground transition-colors", dropdownItemHover)}
                >
                  <CreditCard size={15} className="text-muted" />
                  Billing
                </Link>
                <Link
                  href={ROUTES.dashboardSettings}
                  onClick={() => setProfileOpen(false)}
                  className={cn("flex items-center gap-2.5 px-4 py-2 text-sm font-medium text-foreground transition-colors", dropdownItemHover)}
                >
                  <Settings size={15} className="text-muted" />
                  Settings
                </Link>
                <div className={cn("my-0.5", dividerClass)} />
                <button
                  onClick={() => { setProfileOpen(false); handleLogout(); }}
                  className="flex items-center gap-2.5 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 w-full transition-colors"
                >
                  <LogOut size={15} />
                  Log out
                </button>
              </div>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            className={cn(
              "md:hidden ml-1 rounded-lg p-1.5 transition-colors",
              isLanding ? "text-[#5f6f69] hover:text-[#17211f] hover:bg-white/40" : "text-muted hover:text-foreground hover:bg-surface",
            )}
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle navigation"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className={cn("md:hidden pb-3 pt-1.5", mobileDrawerBg)}>
          {[...navLinks, ...(user?.role === "ADMIN" ? adminLinks : [])].map(({ href, label, icon: Icon }) => {
            const active = pathname === href || pathname.startsWith(href + "/");
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
                  active ? mobileLinkActive : mobileLinkIdle,
                )}
              >
                <Icon size={16} />
                {label}
              </Link>
            );
          })}
          <Link
            href={ROUTES.dashboardChat}
            onClick={() => setMobileOpen(false)}
            className={cn(
              "flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all",
              chatActive ? mobileLinkActive : mobileLinkIdle,
            )}
          >
            <MessageSquare size={16} />
            Chat
          </Link>
          <div className={cn("my-1 mx-4", dividerClass)} />
          <Link
            href={ROUTES.dashboardProfile}
            onClick={() => setMobileOpen(false)}
            className={cn("flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all", mobileLinkIdle)}
          >
            <UserCircle size={16} />
            Profile
          </Link>
          <Link
            href={ROUTES.dashboardPayments}
            onClick={() => setMobileOpen(false)}
            className={cn("flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all", mobileLinkIdle)}
          >
            <CreditCard size={16} />
            Billing
          </Link>
          <Link
            href={ROUTES.dashboardSettings}
            onClick={() => setMobileOpen(false)}
            className={cn("flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all", mobileLinkIdle)}
          >
            <Settings size={16} />
            Settings
          </Link>
          <div className={cn("my-1 mx-4", dividerClass)} />
          <button
            onClick={() => { setMobileOpen(false); handleLogout(); }}
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-danger hover:bg-danger/10 w-full transition-all"
          >
            <LogOut size={16} />
            Log out
          </button>
        </div>
      )}
    </nav>
  );
}

