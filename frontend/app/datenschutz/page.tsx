"use client";

import LegalLayout, { useLegalLanguage } from "@/components/layout/LegalLayout";

export default function DatenschutzPage() {
  return (
    <LegalLayout>
      <DatenschutzContent />
    </LegalLayout>
  );
}

function DatenschutzContent() {
  const { lang } = useLegalLanguage();

  if (lang === "de") {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-black text-[#18211f] tracking-tight">Datenschutzerklärung</h1>
          <p className="mt-2 text-sm text-[#5f6f69]">Zuletzt aktualisiert: 12. Juli 2026</p>
        </div>

        <p className="text-sm text-[#5f6f69] leading-relaxed">
          Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO) und anderer nationaler Datenschutzgesetze ist die Trippy Travel GbR. Wir freuen uns über Ihr Interesse an unserer Plattform. Der Schutz Ihrer persönlichen Daten ist uns ein wichtiges Anliegen.
        </p>

        <hr className="border-[#2a2018]/10" />

        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-[#18211f]">1. Verantwortlicher</h2>
            <div className="text-sm text-[#5f6f69] leading-relaxed space-y-1">
              <p className="font-semibold text-[#18211f]">Trippy Travel GbR</p>
              <p>Musterstraße 123</p>
              <p>10115 Berlin</p>
              <p>Deutschland</p>
              <p>E-Mail: <a href="mailto:legal@trippy-app.com" className="text-[#b95534] hover:underline">legal@trippy-app.com</a></p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-[#18211f]">2. Datenerfassung auf unserer Website</h2>
            <div className="space-y-4 text-sm text-[#5f6f69] leading-relaxed">
              <div>
                <h3 className="font-semibold text-[#18211f]">a) Server-Log-Dateien</h3>
                <p>
                  Bei jedem Aufruf unserer Website erfasst unser System automatisiert Daten und Informationen vom Computersystem des aufrufenden Rechners. Folgende Daten werden hierbei erhoben:
                </p>
                <ul className="list-disc list-inside mt-2 pl-2 space-y-1">
                  <li>Browsertyp und -version</li>
                  <li>Verwendetes Betriebssystem</li>
                  <li>IP-Adresse des Nutzers</li>
                  <li>Datum und Uhrzeit des Zugriffs</li>
                  <li>Website, von der der Zugriff erfolgt (Referrer)</li>
                </ul>
                <p className="mt-2">
                  Die Rechtsgrundlage für die vorübergehende Speicherung der Daten und der Server-Logfiles ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der Sicherheit und Stabilität der Webseite).
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-[#18211f]">b) Registrierung und Kontodaten</h3>
                <p>
                  Wenn Sie sich auf unserer Plattform registrieren, erheben wir Ihren Namen, Ihre E-Mail-Adresse und Ihr Passwort. Diese Daten sind für die Bereitstellung des Nutzkontos und zur Identifikation im Rahmen des gemeinschaftlichen Reiseplaners erforderlich.
                </p>
                <p className="mt-1">
                  Die Rechtsgrundlage für die Verarbeitung der Daten ist Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung).
                </p>
              </div>

              <div>
                <h3 className="font-semibold text-[#18211f]">c) Reiseplanungsdaten und Gruppeninteraktion</h3>
                <p>
                  Wir speichern die von Ihnen erstellten Routen, Termine, Notizen, Aktivitäten und Ausgaben. Wenn Sie andere Nutzer einladen, teilen Sie diese Daten mit Ihren Reisepartnern.
                </p>
                <p className="mt-1">
                  Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung im Rahmen unseres Dienstes).
                </p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-[#18211f]">3. Datenverarbeitung durch künstliche Intelligenz (AI-Service)</h2>
            <p className="text-sm text-[#5f6f69] leading-relaxed">
              Unsere Plattform bietet AI-gestützte Reisevorschläge an. Zur Generierung dieser Vorschläge werden Ihre eingegebenen Präferenzen (z. B. Reiseziel, Dauer, Interessen) an KI-Modelle (wie Google Gemini API oder ähnliche) übertragen. Es werden dabei keine persönlichen Registrierungsdaten wie Passwörter übertragen. Die Übertragung erfolgt verschlüsselt und dient ausschließlich der Erstellung Ihres Reiseplans.
            </p>
            <p className="text-sm text-[#5f6f69] leading-relaxed">
              Rechtsgrundlage hierfür ist Art. 6 Abs. 1 lit. b DSGVO (Vertragserfüllung auf Ihren Wunsch hin) sowie Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an der Bereitstellung innovativer Features).
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-[#18211f]">4. Ihre Rechte als betroffene Person</h2>
            <div className="space-y-2 text-sm text-[#5f6f69] leading-relaxed">
              <p>Sie haben als betroffene Person das Recht auf:</p>
              <ul className="list-disc list-inside pl-2 space-y-1">
                <li><span className="font-semibold text-[#18211f]">Auskunft</span> über Ihre bei uns gespeicherten personenbezogenen Daten (Art. 15 DSGVO).</li>
                <li><span className="font-semibold text-[#18211f]">Berichtigung</span> unrichtiger Daten (Art. 16 DSGVO).</li>
                <li><span className="font-semibold text-[#18211f]">Löschung</span> Ihrer Daten ("Recht auf Vergessenwerden") (Art. 17 DSGVO).</li>
                <li><span className="font-semibold text-[#18211f]">Einschränkung</span> der Datenverarbeitung (Art. 18 DSGVO).</li>
                <li><span className="font-semibold text-[#18211f]">Datenübertragbarkeit</span> (Art. 20 DSGVO).</li>
                <li><span className="font-semibold text-[#18211f]">Widerspruch</span> gegen die Verarbeitung (Art. 21 DSGVO).</li>
              </ul>
              <p className="mt-2">
                Zur Ausübung dieser Rechte wenden Sie sich bitte an uns unter <a href="mailto:legal@trippy-app.com" className="text-[#b95534] hover:underline">legal@trippy-app.com</a>. Sie haben zudem das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren.
              </p>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-bold text-[#18211f]">5. Datensicherheit</h2>
            <p className="text-sm text-[#5f6f69] leading-relaxed">
              Diese Seite nutzt aus Sicherheitsgründen und zum Schutz der Übertragung vertraulicher Inhalte eine SSL- bzw. TLS-Verschlüsselung. Sie erkennen eine verschlüsselte Verbindung an der Adresszeile des Browsers ("https://"). Wir setzen technische und organisatorische Sicherheitsmaßnahmen ein, um Ihre Daten gegen Manipulationen, Verlust oder unberechtigte Zugriffe zu schützen.
            </p>
          </section>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-[#18211f] tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-[#5f6f69]">Last updated: July 12, 2026</p>
      </div>

      <p className="text-sm text-[#5f6f69] leading-relaxed">
        The controller responsible for data processing on this platform in accordance with the General Data Protection Regulation (GDPR) and other national data protection laws is Trippy Travel GbR. We protect your personal data and treat it confidentially.
      </p>

      <hr className="border-[#2a2018]/10" />

      <div className="space-y-6">
        <section className="space-y-3">
          <h2 className="text-xl font-bold text-[#18211f]">1. Controller</h2>
          <div className="text-sm text-[#5f6f69] leading-relaxed space-y-1">
            <p className="font-semibold text-[#18211f]">Trippy Travel GbR</p>
            <p>Musterstrasse 123</p>
            <p>10115 Berlin</p>
            <p>Germany</p>
            <p>Email: <a href="mailto:legal@trippy-app.com" className="text-[#b95534] hover:underline">legal@trippy-app.com</a></p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-[#18211f]">2. Data Collection on Our Website</h2>
          <div className="space-y-4 text-sm text-[#5f6f69] leading-relaxed">
            <div>
              <h3 className="font-semibold text-[#18211f]">a) Server Log Files</h3>
              <p>
                Each time our website is accessed, our system automatically collects data and information from the computer system of the accessing device. The following data is collected:
              </p>
              <ul className="list-disc list-inside mt-2 pl-2 space-y-1">
                <li>Browser type and version</li>
                <li>Operating system used</li>
                <li>IP address of the user</li>
                <li>Date and time of access</li>
                <li>Website from which access originated (Referrer)</li>
              </ul>
              <p className="mt-2">
                The legal basis for the temporary storage of server logs is Art. 6(1)(f) GDPR (legitimate interest in security and stability of the platform).
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-[#18211f]">b) Registration and Account Data</h3>
              <p>
                When you register on our platform, we collect your name, email address, and password. This data is necessary to provide the user account and to identify you in the collaborative trip planner.
              </p>
              <p className="mt-1">
                The legal basis for this processing is Art. 6(1)(b) GDPR (performance of a contract).
              </p>
            </div>

            <div>
              <h3 className="font-semibold text-[#18211f]">c) Trip Planning and Group Interaction</h3>
              <p>
                We store the routes, dates, notes, activities, and expenses you create. When you invite travel companions, you share this planning data with them.
              </p>
              <p className="mt-1">
                The legal basis is Art. 6(1)(b) GDPR (contract performance).
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-[#18211f]">3. Data Processing via Artificial Intelligence (AI Service)</h2>
          <p className="text-sm text-[#5f6f69] leading-relaxed">
            Our platform offers AI-assisted trip recommendations. To generate these recommendations, your input preferences (destination, duration, interests) are sent to AI models (such as Google Gemini API). No personal registration details like passwords or emails are shared. The data transfer is encrypted and serves solely the purpose of generating your travel itinerary.
          </p>
          <p className="text-sm text-[#5f6f69] leading-relaxed">
            The legal basis for this processing is Art. 6(1)(b) GDPR (performance of a contract at your request) and Art. 6(1)(f) GDPR (legitimate interest in providing innovative platform features).
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-[#18211f]">4. Your Rights as a Data Subject</h2>
          <div className="space-y-2 text-sm text-[#5f6f69] leading-relaxed">
            <p>You have the following rights under GDPR:</p>
            <ul className="list-disc list-inside pl-2 space-y-1">
              <li><span className="font-semibold text-[#18211f]">Right of access</span> to your stored personal data (Art. 15 GDPR).</li>
              <li><span className="font-semibold text-[#18211f]">Right to rectification</span> of inaccurate data (Art. 16 GDPR).</li>
              <li><span className="font-semibold text-[#18211f]">Right to erasure</span> ("right to be forgotten") (Art. 17 GDPR).</li>
              <li><span className="font-semibold text-[#18211f]">Right to restriction of processing</span> (Art. 18 GDPR).</li>
              <li><span className="font-semibold text-[#18211f]">Right to data portability</span> (Art. 20 GDPR).</li>
              <li><span className="font-semibold text-[#18211f]">Right to object</span> to processing (Art. 21 GDPR).</li>
            </ul>
            <p className="mt-2">
              To exercise these rights, please contact us at <a href="mailto:legal@trippy-app.com" className="text-[#b95534] hover:underline">legal@trippy-app.com</a>. You also have the right to lodge a complaint with a data protection supervisory authority.
            </p>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold text-[#18211f]">5. Data Security</h2>
          <p className="text-sm text-[#5f6f69] leading-relaxed">
            This site uses SSL or TLS encryption for security reasons and to protect the transmission of confidential content. You can detect an encrypted connection by the "https://" browser address line. We maintain technical and organizational measures to secure your data against manipulation, loss, or unauthorized access.
          </p>
        </section>
      </div>
    </div>
  );
}
