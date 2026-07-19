import LegalLayout from "@/components/layout/LegalLayout";

export default function TermsPage() {
  return (
    <LegalLayout>
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
              Trippy provides a web-based collaborative trip planning platform. Users can build itineraries, invite friends, and coordinate logistics. While we strive to maintain high availability, we do not guarantee uninterrupted access to the platform.
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
              Trippy is provided &quot;as is&quot; and &quot;as available&quot;. We exclude all liability for damages unless they result from intentional misconduct or gross negligence. For simple negligence, we are only liable for breaches of essential contractual obligations.
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
    </LegalLayout>
  );
}
