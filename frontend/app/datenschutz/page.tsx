import LegalLayout from "@/components/layout/LegalLayout";

export default function DatenschutzPage() {
  return (
    <LegalLayout>
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
                <p>Each time our website is accessed, our system automatically collects data and information from the computer system of the accessing device. The following data is collected:</p>
                <ul className="list-disc list-inside mt-2 pl-2 space-y-1">
                  <li>Browser type and version</li>
                  <li>Operating system used</li>
                  <li>IP address of the user</li>
                  <li>Date and time of access</li>
                  <li>Website from which access originated (Referrer)</li>
                </ul>
                <p className="mt-2">The legal basis for the temporary storage of server logs is Art. 6(1)(f) GDPR (legitimate interest in security and stability of the platform).</p>
              </div>
              <div>
                <h3 className="font-semibold text-[#18211f]">b) Registration and Account Data</h3>
                <p>When you register on our platform, we collect your name, email address, and password. This data is necessary to provide the user account and to identify you in the collaborative trip planner.</p>
                <p className="mt-1">The legal basis for this processing is Art. 6(1)(b) GDPR (performance of a contract).</p>
              </div>
              <div>
                <h3 className="font-semibold text-[#18211f]">c) Trip Planning and Group Interaction</h3>
                <p>We store the routes, dates, notes, activities, and expenses you create. When you invite travel companions, you share this planning data with them.</p>
                <p className="mt-1">The legal basis is Art. 6(1)(b) GDPR (contract performance).</p>
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
                <li><span className="font-semibold text-[#18211f]">Right to erasure</span> (&quot;right to be forgotten&quot;) (Art. 17 GDPR).</li>
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
              This site uses SSL or TLS encryption for security reasons and to protect the transmission of confidential content. You can detect an encrypted connection by the &quot;https://&quot; browser address line. We maintain technical and organizational measures to secure your data against manipulation, loss, or unauthorized access.
            </p>
          </section>
        </div>
      </div>
    </LegalLayout>
  );
}
