"use client";

import LegalLayout, { useLegalLanguage } from "@/components/layout/LegalLayout";

export default function TermsPage() {
  return (
    <LegalLayout>
      <TermsContent />
    </LegalLayout>
  );
}

function TermsContent() {
  const { lang } = useLegalLanguage();

  if (lang === "de") {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-black text-[#18211f] tracking-tight">Nutzungsbedingungen (AGB)</h1>
          <p className="mt-2 text-sm text-[#5f6f69]">Zuletzt aktualisiert: 12. Juli 2026</p>
        </div>

        <p className="text-sm text-[#5f6f69] leading-relaxed">
          Willkommen bei Trippy. Bitte lesen Sie diese Nutzungsbedingungen sorgfältig durch, bevor Sie unsere Plattform nutzen. Durch den Zugriff auf Trippy oder die Nutzung unseres Dienstes erklären Sie sich mit diesen Bedingungen einverstanden.
        </p>

        <hr className="border-[#2a2018]/10" />

        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-[#18211f]">1. Geltungsbereich und Dienstleistung</h2>
            <p className="text-sm text-[#5f6f69] leading-relaxed">
              Die Trippy Travel GbR stellt eine webbasierte Plattform zur kollaborativen Reiseplanung zur Verfügung. Nutzer können Reiserouten erstellen, Freunde einladen und Details gemeinsam planen. Wir bemühen uns um eine hohe Verfügbarkeit der Plattform, übernehmen jedoch keine Garantie für die ständige, ununterbrochene Erreichbarkeit.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-[#18211f]">2. Registrierung und Kontosicherheit</h2>
            <p className="text-sm text-[#5f6f69] leading-relaxed">
              Für die Nutzung bestimmter Funktionen ist eine Registrierung erforderlich. Sie verpflichten sich, korrekte und vollständige Angaben zu machen und Ihre Zugangsdaten geheim zu halten. Sie sind für alle Aktivitäten verantwortlich, die unter Ihrem Konto stattfinden.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-[#18211f]">3. Nutzerverhalten und Inhalte</h2>
            <p className="text-sm text-[#5f6f69] leading-relaxed">
              Sie behalten alle Rechte an den Inhalten (Texte, Bilder, Routen), die Sie auf der Plattform veröffentlichen. Sie gewähren uns jedoch ein einfaches, zeitlich und räumlich unbeschränktes Recht, diese Inhalte zur Erbringung unseres Dienstes zu nutzen und anzuzeigen. Es ist untersagt, rechtswidrige, beleidigende oder schädliche Inhalte zu teilen. Wir behalten uns das Recht vor, Verstöße zu löschen und Konten vorübergehend oder dauerhaft zu sperren.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-[#18211f]">4. Haftungsausschluss</h2>
            <p className="text-sm text-[#5f6f69] leading-relaxed">
              Trippy wird in der vorliegenden Form ("as is") bereitgestellt. Wir haften nur für Schäden, die auf einer vorsätzlichen oder grob fahrlässigen Pflichtverletzung unsererseits beruhen. Für einfache Fahrlässigkeit haften wir nur bei Verletzung von Kardinalpflichten (wesentlichen Vertragspflichten).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-[#18211f]">5. Änderungen der Bedingungen</h2>
            <p className="text-sm text-[#5f6f69] leading-relaxed">
              Wir behalten uns das Recht vor, diese Nutzungsbedingungen jederzeit zu ändern. Über wesentliche Änderungen werden wir Sie per E-Mail oder durch eine Mitteilung auf der Plattform informieren. Die weitere Nutzung nach Inkrafttreten der Änderungen gilt als Zustimmung.
            </p>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-[#18211f] tracking-tight">Terms of Service</h1>
        <p className="mt-2 text-sm text-[#5f6f69]">Last updated: July 12, 2026</p>
      </div>

      <p className="text-sm text-[#5f6f69] leading-relaxed">
        Welcome to Trippy. Please read these Terms of Service carefully before using our platform. By accessing or using Trippy, you agree to be bound by these terms.
      </p>

      <hr className="border-[#2a2018]/10" />

      <div className="space-y-6">
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-[#18211f]">1. Scope of Service</h2>
          <p className="text-sm text-[#5f6f69] leading-relaxed">
            Trippy Travel GbR provides a web-based collaborative trip planning platform. Users can build itineraries, invite friends, and coordinate logistics. While we strive to maintain high availability, we do not guarantee uninterrupted access to the platform.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-[#18211f]">2. Registration and Account Security</h2>
          <p className="text-sm text-[#5f6f69] leading-relaxed">
            To access key features, you must register. You agree to provide accurate registration info and to keep your credentials confidential. You are fully responsible for all activities occurring under your account.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-[#18211f]">3. User Content and Conduct</h2>
          <p className="text-sm text-[#5f6f69] leading-relaxed">
            You retain ownership of all content you post to Trippy (routes, text, images). You grant us a non-exclusive, worldwide, royalty-free license to use and display this content to deliver our services. You agree not to post illegal, abusive, or malicious content. We reserve the right to remove non-compliant content and suspend accounts violating these rules.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-[#18211f]">4. Disclaimer of Warranties</h2>
          <p className="text-sm text-[#5f6f69] leading-relaxed">
            Trippy is provided "as is" and "as available". We exclude all liability for damages unless they result from intentional misconduct or gross negligence. For simple negligence, we are only liable for breaches of essential contractual obligations.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-[#18211f]">5. Changes to These Terms</h2>
          <p className="text-sm text-[#5f6f69] leading-relaxed">
            We reserve the right to update these terms at any time. We will notify you of material changes via email or a notification on the platform. Continued use of the platform after updates are posted constitutes acceptance of the new terms.
          </p>
        </section>
      </div>
    </div>
  );
}
