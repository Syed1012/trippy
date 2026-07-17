"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Info, Shield, Scale, FileText } from "lucide-react";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import AmbientBackground from "@/components/layout/AmbientBackground";
import { ROUTES } from "@/lib/routes";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

type Language = "de" | "en";

interface LegalLanguageContextProps {
  lang: Language;
  setLang: (lang: Language) => void;
}

const LegalLanguageContext = createContext<LegalLanguageContextProps>({
  lang: "de",
  setLang: () => {},
});

export function useLegalLanguage() {
  return useContext(LegalLanguageContext);
}

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [lang, setLangState] = useState<Language>("de");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("trippy-legal-lang") as Language;
    if (saved === "de" || saved === "en") {
      setLangState(saved);
    } else {
      const browserLang = navigator.language.slice(0, 2);
      if (browserLang === "en") {
        setLangState("en");
      }
    }
  }, []);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem("trippy-legal-lang", newLang);
  };

  const navItems = [
    { href: ROUTES.about, label: { de: "Über uns", en: "About Us" }, icon: Info },
    { href: ROUTES.impressum, label: { de: "Impressum", en: "Imprint" }, icon: FileText },
    { href: ROUTES.datenschutz, label: { de: "Datenschutz", en: "Privacy Policy" }, icon: Shield },
    { href: ROUTES.terms, label: { de: "AGB / Nutzungsbedingungen", en: "Terms of Service" }, icon: Scale },
  ];

  return (
    <LegalLanguageContext.Provider value={{ lang, setLang }}>
      <div className="relative isolate min-h-screen overflow-x-hidden bg-[#f8efe1] text-[#18211f] flex flex-col">
        <AmbientBackground />
        
        <Navbar variant="landing" />

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-8 lg:py-12 lg:px-8 z-10">
          <div className="flex flex-col lg:flex-row gap-8 lg:items-start">
            
            {/* Sidebar navigation */}
            <aside className="w-full lg:w-64 shrink-0 lg:sticky lg:top-24 z-20">
              <div className="glass-strong rounded-2xl p-4 border border-white/30 space-y-4 shadow-[0_8px_32px_0_rgba(20,47,43,0.02)]">
                <div className="flex items-center justify-between px-2 pb-2 border-b border-[#2a2018]/10">
                  <span className="font-black text-[11px] uppercase tracking-wider text-[#7b827d]">
                    {mounted && lang === "en" ? "Legal & Info" : "Rechtliches"}
                  </span>
                  
                  {/* Language Toggle */}
                  <div className="flex items-center gap-1 bg-[#2a2018]/5 rounded-lg p-0.5 border border-[#2a2018]/10 text-xs">
                    <button
                      onClick={() => setLang("de")}
                      className={cn(
                        "px-2 py-1 rounded-md font-bold transition-all duration-200 cursor-pointer",
                        lang === "de"
                          ? "bg-[#2a2018] text-[#f8efe1] shadow-sm"
                          : "text-[#5f6f69] hover:text-[#18211f]"
                      )}
                    >
                      DE
                    </button>
                    <button
                      onClick={() => setLang("en")}
                      className={cn(
                        "px-2 py-1 rounded-md font-bold transition-all duration-200 cursor-pointer",
                        lang === "en"
                          ? "bg-[#2a2018] text-[#f8efe1] shadow-sm"
                          : "text-[#5f6f69] hover:text-[#18211f]"
                      )}
                    >
                      EN
                    </button>
                  </div>
                </div>

                <nav className="flex flex-row lg:flex-col overflow-x-auto lg:overflow-x-visible gap-1 pb-2 lg:pb-0 scrollbar-none">
                  {navItems.map((item) => {
                    const isActive = pathname === item.href || 
                      (item.href === ROUTES.datenschutz && pathname === ROUTES.privacy);
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all shrink-0 duration-200",
                          isActive
                            ? "bg-[#2a2018] text-[#f8efe1] shadow-[0_4px_12px_-3px_rgba(42,32,24,0.2)]"
                            : "text-[#5f6f69] hover:text-[#18211f] hover:bg-white/40"
                        )}
                      >
                        <Icon size={16} />
                        <span>{mounted ? item.label[lang] : item.label.de}</span>
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </aside>

            {/* Content pane */}
            <div className="flex-1 min-w-0 z-10">
              <div className="glass-strong rounded-3xl p-6 lg:p-10 border border-white/30 min-h-[50vh] shadow-[0_8px_32px_0_rgba(20,47,43,0.03)]">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={pathname + (mounted ? lang : "de")}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    {children}
                  </motion.div>
                </AnimatePresence>
              </div>
            </div>

          </div>
        </main>

        <Footer />
      </div>
    </LegalLanguageContext.Provider>
  );
}
