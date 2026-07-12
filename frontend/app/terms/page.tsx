import Link from "next/link";
import { ROUTES } from "@/lib/routes";

export default function TermsPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-black text-foreground">Terms of Service</h1>
      <p className="mt-4 text-muted leading-7">
        Trippy is provided on an as-is basis. You are responsible for the content you create,
        share, and manage within trips.
      </p>
      <p className="mt-4 text-muted leading-7">
        Use the service lawfully and do not attempt to abuse, disrupt, or compromise platform
        security. We may suspend accounts that violate these terms.
      </p>
      <div className="mt-8">
        <Link href={ROUTES.home} className="text-trippy-500 hover:text-trippy-600 font-medium">
          Back to home
        </Link>
      </div>
    </main>
  );
}
