"use client";

import LegalLayout, { useLegalLanguage } from "@/components/layout/LegalLayout";
import { Mail, Phone, ExternalLink } from "lucide-react";

export default function ImpressumPage() {
  return (
    <LegalLayout>
      <ImpressumContent />
    </LegalLayout>
  );
}

function ImpressumContent() {
  const { lang } = useLegalLanguage();

  if (lang === "de") {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-black text-[#18211f] tracking-tight">Impressum</h1>
          <p className="mt-2 text-sm text-[#5f6f69]">Gesetzliche Anbieterkennzeichnung nach § 5 TMG</p>
        </div>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-lg font-bold text-[#18211f]">Angaben gemäß § 5 TMG</h2>
            <div className="space-y-2 text-sm text-[#5f6f69] leading-relaxed">
              <p className="font-semibold text-[#18211f]">Trippy Travel GbR</p>
              <p>Musterstraße 123</p>
              <p>10115 Berlin</p>
              <p>Deutschland</p>
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-bold text-[#18211f]">Vertreten durch</h2>
            <div className="space-y-2 text-sm text-[#5f6f69] leading-relaxed">
              <p className="font-semibold text-[#18211f]">Pankaj Sain</p>
              <p>(Gesellschafter / Vertretungsberechtigt)</p>
            </div>
          </div>
        </section>

        <hr className="border-[#2a2018]/10" />

        <section className="space-y-4">
          <h2 className="text-lg font-bold text-[#18211f]">Kontakt</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-3 text-sm text-[#5f6f69] bg-white/40 p-3 rounded-xl border border-white/20">
              <Mail className="text-[#b95534] shrink-0" size={18} />
              <div>
                <p className="font-semibold text-[#18211f]">E-Mail</p>
                <a href="mailto:legal@trippy-app.com" className="hover:underline">legal@trippy-app.com</a>
              </div>
            </div>
            <div className="flex items-center gap-3 text-sm text-[#5f6f69] bg-white/40 p-3 rounded-xl border border-white/20">
              <Phone className="text-[#b95534] shrink-0" size={18} />
              <div>
                <p className="font-semibold text-[#18211f]">Telefon</p>
                <a href="tel:+493012345678" className="hover:underline">+49 (0) 30 12345678</a>
              </div>
            </div>
          </div>
        </section>

        <hr className="border-[#2a2018]/10" />

        <section className="space-y-4">
          <h2 className="text-lg font-bold text-[#18211f]">Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV</h2>
          <div className="space-y-1 text-sm text-[#5f6f69] leading-relaxed">
            <p className="font-semibold text-[#18211f]">Pankaj Sain</p>
            <p>Musterstraße 123</p>
            <p>10115 Berlin</p>
          </div>
        </section>

        <hr className="border-[#2a2018]/10" />

        <section className="space-y-4">
          <h2 className="text-lg font-bold text-[#18211f]">EU-Streitschlichtung</h2>
          <p className="text-sm text-[#5f6f69] leading-relaxed">
            Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit:{" "}
            <a
              href="https://ec.europa.eu/consumers/odr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#b95534] hover:underline inline-flex items-center gap-1 font-semibold"
            >
              https://ec.europa.eu/consumers/odr <ExternalLink size={12} />
            </a>
            .<br />
            Unsere E-Mail-Adresse finden Sie oben im Impressum.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-lg font-bold text-[#18211f]">Verbraucherstreitbeilegung/Universalschlichtungsstelle</h2>
          <p className="text-sm text-[#5f6f69] leading-relaxed">
            Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-[#18211f] tracking-tight">Imprint</h1>
        <p className="mt-2 text-sm text-[#5f6f69]">Legal disclosure required under German law (§ 5 TMG)</p>
      </div>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-[#18211f]">Company Details</h2>
          <div className="space-y-2 text-sm text-[#5f6f69] leading-relaxed">
            <p className="font-semibold text-[#18211f]">Trippy Travel GbR</p>
            <p>Musterstrasse 123</p>
            <p>10115 Berlin</p>
            <p>Germany</p>
          </div>
        </div>

        <div className="space-y-4">
          <h2 className="text-lg font-bold text-[#18211f]">Represented by</h2>
          <div className="space-y-2 text-sm text-[#5f6f69] leading-relaxed">
            <p className="font-semibold text-[#18211f]">Pankaj Sain</p>
            <p>(Partner / Authorized Representative)</p>
          </div>
        </div>
      </section>

      <hr className="border-[#2a2018]/10" />

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-[#18211f]">Contact Information</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex items-center gap-3 text-sm text-[#5f6f69] bg-white/40 p-3 rounded-xl border border-white/20">
            <Mail className="text-[#b95534] shrink-0" size={18} />
            <div>
              <p className="font-semibold text-[#18211f]">Email</p>
              <a href="mailto:legal@trippy-app.com" className="hover:underline">legal@trippy-app.com</a>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm text-[#5f6f69] bg-white/40 p-3 rounded-xl border border-white/20">
            <Phone className="text-[#b95534] shrink-0" size={18} />
            <div>
              <p className="font-semibold text-[#18211f]">Phone</p>
              <a href="tel:+493012345678" className="hover:underline">+49 (0) 30 12345678</a>
            </div>
          </div>
        </div>
      </section>

      <hr className="border-[#2a2018]/10" />

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-[#18211f]">Person Responsible for Editorial Content (§ 18 Abs. 2 MStV)</h2>
        <div className="space-y-1 text-sm text-[#5f6f69] leading-relaxed">
          <p className="font-semibold text-[#18211f]">Pankaj Sain</p>
          <p>Musterstrasse 123</p>
          <p>10115 Berlin</p>
        </div>
      </section>

      <hr className="border-[#2a2018]/10" />

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-[#18211f]">EU Dispute Resolution</h2>
        <p className="text-sm text-[#5f6f69] leading-relaxed">
          The European Commission provides a platform for online dispute resolution (ODR):{" "}
          <a
            href="https://ec.europa.eu/consumers/odr"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#b95534] hover:underline inline-flex items-center gap-1 font-semibold"
          >
            https://ec.europa.eu/consumers/odr <ExternalLink size={12} />
          </a>
          .<br />
          Our email address can be found above under contact details.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-[#18211f]">Dispute Resolution Proceedings for Consumers</h2>
        <p className="text-sm text-[#5f6f69] leading-relaxed">
          We are not willing or obliged to participate in dispute resolution proceedings before a consumer arbitration board.
          We prefer to resolve any disputes directly with our users.
        </p>
      </section>
    </div>
  );
}
