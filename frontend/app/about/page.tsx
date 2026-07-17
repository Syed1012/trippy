"use client";

import LegalLayout, { useLegalLanguage } from "@/components/layout/LegalLayout";
import { Sparkles, Users, Compass, ShieldCheck } from "lucide-react";

export default function AboutPage() {
  return (
    <LegalLayout>
      <AboutContent />
    </LegalLayout>
  );
}

function AboutContent() {
  const { lang } = useLegalLanguage();

  if (lang === "de") {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-black text-[#18211f] tracking-tight">Über Trippy</h1>
          <p className="mt-2 text-lg text-[#b95534] font-medium">Gemeinsam planen, besser reisen.</p>
        </div>

        <div className="space-y-6 text-sm text-[#5f6f69] leading-relaxed">
          <p>
            Trippy ist eine moderne Plattform zur gemeinschaftlichen Reiseplanung, die Gruppen dabei unterstützt, Reiserouten abzustimmen, Logistik zu koordinieren und Reiseziele mit intelligenter KI-Unterstützung zu entdecken.
          </p>
          <p>
            Egal, ob es sich um einen Wochenendausflug mit Freunden oder ein mehrwöchiges Abenteuer im Ausland handelt: Mit Trippy planen Sie Schritt für Schritt, laden Ihre Reisebegleiter ein und sorgen dafür, dass alle von der ersten Idee bis zur Abreise bestens aufeinander abgestimmt sind.
          </p>
        </div>

        <hr className="border-[#2a2018]/10" />

        <h2 className="text-xl font-bold text-[#18211f]">Warum Trippy?</h2>

        <div className="grid gap-6 sm:grid-cols-2">
          <div className="bg-white/40 p-5 rounded-2xl border border-white/20 space-y-3">
            <div className="p-2.5 bg-[#b95534]/10 rounded-xl w-fit text-[#b95534]">
              <Sparkles size={20} />
            </div>
            <h3 className="font-bold text-[#18211f]">Intelligente KI-Vorschläge</h3>
            <p className="text-xs text-[#5f6f69] leading-relaxed">
              Erhalten Sie maßgeschneiderte Empfehlungen für Routen, Sehenswürdigkeiten und kulinarische Highlights, basierend auf den Vorlieben Ihrer Gruppe.
            </p>
          </div>

          <div className="bg-white/40 p-5 rounded-2xl border border-white/20 space-y-3">
            <div className="p-2.5 bg-[#b95534]/10 rounded-xl w-fit text-[#b95534]">
              <Users size={20} />
            </div>
            <h3 className="font-bold text-[#18211f]">Gemeinsame Planung</h3>
            <p className="text-xs text-[#5f6f69] leading-relaxed">
              Planen Sie in Echtzeit mit Ihren Freunden. Tauschen Sie Ideen im integrierten Chat aus und treffen Sie Entscheidungen gemeinsam.
            </p>
          </div>

          <div className="bg-white/40 p-5 rounded-2xl border border-white/20 space-y-3">
            <div className="p-2.5 bg-[#b95534]/10 rounded-xl w-fit text-[#b95534]">
              <Compass size={20} />
            </div>
            <h3 className="font-bold text-[#18211f]">Alles an einem Ort</h3>
            <p className="text-xs text-[#5f6f69] leading-relaxed">
              Verwalten Sie Unterkünfte, Flüge, Ausgaben und tägliche Aktivitäten in einer übersichtlichen, zentralen Zeitleiste.
            </p>
          </div>

          <div className="bg-white/40 p-5 rounded-2xl border border-white/20 space-y-3">
            <div className="p-2.5 bg-[#b95534]/10 rounded-xl w-fit text-[#b95534]">
              <ShieldCheck size={20} />
            </div>
            <h3 className="font-bold text-[#18211f]">Sicher & Zuverlässig</h3>
            <p className="text-xs text-[#5f6f69] leading-relaxed">
              Ihre Reisedaten werden verschlüsselt übertragen und sicher gespeichert, damit Sie sich ganz auf Ihr nächstes Abenteuer konzentrieren können.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-[#18211f] tracking-tight">About Trippy</h1>
        <p className="mt-2 text-lg text-[#b95534] font-medium">Plan together, travel better.</p>
      </div>

      <div className="space-y-6 text-sm text-[#5f6f69] leading-relaxed">
        <p>
          Trippy is a modern collaborative trip planning platform that helps groups design itineraries, coordinate travel logistics, and discover local gems with the power of AI-assisted recommendations.
        </p>
        <p>
          Whether it’s a quick weekend getaway or a multi-week adventure abroad, Trippy lets you build your trip step-by-step, invite companions to contribute, and keep everyone aligned from ideation to departure.
        </p>
      </div>

      <hr className="border-[#2a2018]/10" />

      <h2 className="text-xl font-bold text-[#18211f]">Why Trippy?</h2>

      <div className="grid gap-6 sm:grid-cols-2">
        <div className="bg-white/40 p-5 rounded-2xl border border-white/20 space-y-3">
          <div className="p-2.5 bg-[#b95534]/10 rounded-xl w-fit text-[#b95534]">
            <Sparkles size={20} />
          </div>
          <h3 className="font-bold text-[#18211f]">AI-Powered Insights</h3>
          <p className="text-xs text-[#5f6f69] leading-relaxed">
            Get personalized suggestions for routes, activities, and dining spots tailored to your travel preferences.
          </p>
        </div>

        <div className="bg-white/40 p-5 rounded-2xl border border-white/20 space-y-3">
          <div className="p-2.5 bg-[#b95534]/10 rounded-xl w-fit text-[#b95534]">
            <Users size={20} />
          </div>
          <h3 className="font-bold text-[#18211f]">Group Collaboration</h3>
          <p className="text-xs text-[#5f6f69] leading-relaxed">
            Plan in real time with your companions. Share ideas in our chat and reach agreements effortlessly.
          </p>
        </div>

        <div className="bg-white/40 p-5 rounded-2xl border border-white/20 space-y-3">
          <div className="p-2.5 bg-[#b95534]/10 rounded-xl w-fit text-[#b95534]">
            <Compass size={20} />
          </div>
          <h3 className="font-bold text-[#18211f]">All-in-One Dashboard</h3>
          <p className="text-xs text-[#5f6f69] leading-relaxed">
            Keep track of lodging, flights, shared costs, and daily itineraries in one clean, unified layout.
          </p>
        </div>

        <div className="bg-white/40 p-5 rounded-2xl border border-white/20 space-y-3">
          <div className="p-2.5 bg-[#b95534]/10 rounded-xl w-fit text-[#b95534]">
            <ShieldCheck size={20} />
          </div>
          <h3 className="font-bold text-[#18211f]">Safe & Secure</h3>
          <p className="text-xs text-[#5f6f69] leading-relaxed">
            Your personal account and trip details are securely stored and encrypted, keeping your planning worry-free.
          </p>
        </div>
      </div>
    </div>
  );
}
