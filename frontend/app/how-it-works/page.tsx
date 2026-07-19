import LegalLayout from "@/components/layout/LegalLayout";
import { Sparkles, Users, MessageSquare, ArrowRight, Route } from "lucide-react";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";

export default function HowItWorksPage() {
  const steps = [
    {
      number: "01",
      title: "Generate with AI",
      description: "Start by entering your destination, trip dates, budget, group size, and dietary restrictions. Our advanced AI constructs a customized day-by-day itinerary in seconds, tailored to your style.",
      icon: Sparkles,
      color: "text-amber-600 bg-amber-500/10 border-amber-200/50",
    },
    {
      number: "02",
      title: "Customize & Refine",
      description: "Every generated trip is fully editable. Drag and drop to reorder activities, edit details, add custom notes, or open sights directly on Google Maps to craft the perfect schedule.",
      icon: Route,
      color: "text-teal-600 bg-teal-500/10 border-teal-200/50",
    },
    {
      number: "03",
      title: "Invite Co-planners",
      description: "Don't plan alone! Share a secure invite link to add your family or friends to the trip. Everyone can contribute, add activities, and coordinate schedules in real-time.",
      icon: Users,
      color: "text-indigo-600 bg-indigo-500/10 border-indigo-200/50",
    },
    {
      number: "04",
      title: "Group Chat Rooms",
      description: "Communicate directly inside Trippy with our integrated trip chat. Discuss daily activities, share flight updates, or coordinate meeting points with your crew without leaving the app.",
      icon: MessageSquare,
      color: "text-rose-600 bg-rose-500/10 border-rose-200/50",
    },
  ];

  return (
    <LegalLayout>
      <div className="space-y-10">
        <div className="text-center max-w-2xl mx-auto space-y-4">
          <span className="text-xs font-black uppercase tracking-widest text-[#b95534]">Walkthrough</span>
          <h1 className="text-4xl font-black text-[#18211f] tracking-tight sm:text-5xl">
            How Trippy Works
          </h1>
          <p className="text-muted text-base leading-relaxed">
            Planning trips with friends used to be messy. Trippy brings AI generation, real-time sync, and group chat into one beautiful, unified workspace.
          </p>
        </div>

        <hr className="border-[#2a2018]/10" />

        {/* Process Timeline */}
        <div className="relative space-y-12">
          {/* Vertical indicator line for large displays */}
          <div className="absolute left-[39px] top-6 bottom-6 w-0.5 bg-gradient-to-b from-amber-500/20 via-teal-500/20 to-[#b95534]/20 hidden lg:block" />

          {steps.map((step, idx) => {
            const Icon = step.icon;
            return (
              <div key={idx} className="relative flex flex-col lg:flex-row gap-6 lg:gap-10 items-start">
                {/* Step indicator circle */}
                <div className="flex items-center gap-4 shrink-0">
                  <div className={`w-20 h-20 rounded-3xl border flex items-center justify-center relative ${step.color} shadow-sm z-10 bg-[#f8efe1]`}>
                    <Icon size={32} />
                    <span className="absolute -top-2 -right-2 text-[10px] font-extrabold px-1.5 py-0.5 rounded-full bg-[#2a2018] text-[#f8efe1] leading-none">
                      {step.number}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="space-y-2 flex-1">
                  <h3 className="text-xl font-bold text-[#18211f]">
                    {step.title}
                  </h3>
                  <p className="text-sm text-[#5f6f69] leading-relaxed max-w-3xl">
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        <hr className="border-[#2a2018]/10" />

        {/* Call to action section */}
        <div className="bg-[#b95534]/5 border border-[#b95534]/15 rounded-3xl p-6 lg:p-8 text-center space-y-6">
          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-[#18211f]">Ready to start your next adventure?</h3>
            <p className="text-sm text-[#5f6f69] max-w-lg mx-auto">
              Build your first AI-generated trip now. No credit card required.
            </p>
          </div>
          <div className="flex justify-center">
            <Link
              href={ROUTES.home}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-[#2a2018] text-[#f8efe1] font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 shadow-md"
            >
              Start Planning
              <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </div>
    </LegalLayout>
  );
}
