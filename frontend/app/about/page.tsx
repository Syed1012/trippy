import LegalLayout from "@/components/layout/LegalLayout";
import { Sparkles, Users, Compass, ShieldCheck } from "lucide-react";

export default function AboutPage() {
  return (
    <LegalLayout>
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
            Whether it&apos;s a quick weekend getaway or a multi-week adventure abroad, Trippy lets you build your trip step-by-step, invite companions to contribute, and keep everyone aligned from ideation to departure.
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
            <h3 className="font-bold text-[#18211f]">Safe &amp; Secure</h3>
            <p className="text-xs text-[#5f6f69] leading-relaxed">
              Your personal account and trip details are securely stored and encrypted, keeping your planning worry-free.
            </p>
          </div>
        </div>
      </div>
    </LegalLayout>
  );
}
