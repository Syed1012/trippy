import Link from "next/link";
import { ROUTES } from "@/lib/routes";

export default function PrivacyPage() {
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-16">
      <h1 className="text-3xl font-black text-foreground">Privacy Policy</h1>
      <p className="mt-4 text-muted leading-7">
        We collect the minimum account and trip information needed to provide the Trippy
        experience. Data is used to support authentication, trip collaboration, and
        platform reliability.
      </p>
      <p className="mt-4 text-muted leading-7">
        By using Trippy, you agree that your data may be processed to deliver app features,
        including notifications and itinerary generation.
      </p>
      <div className="mt-8">
        <Link href={ROUTES.home} className="text-trippy-500 hover:text-trippy-600 font-medium">
          Back to home
        </Link>
      </div>
    </main>
  );
}
