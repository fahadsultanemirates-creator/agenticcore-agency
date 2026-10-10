import { useEffect } from "react";
import { ChatLauncher } from "../components/ChatLauncher";
import { AiShowcase } from "../components/landing/AiShowcase";
import { Capabilities } from "../components/landing/Capabilities";
import { CtaBanner } from "../components/landing/CtaBanner";
import { FamilySection } from "../components/landing/FamilySection";
import { Faq } from "../components/landing/Faq";
import { FeaturedServices } from "../components/landing/FeaturedServices";
import { Footer } from "../components/landing/Footer";
import { ForgeSection } from "../components/landing/ForgeSection";
import { Hero } from "../components/landing/Hero";
import { HowItWorks } from "../components/landing/HowItWorks";
import { Nav } from "../components/landing/Nav";
import { PackageSection } from "../components/landing/PackageSection";

/**
 * Sections A–J, in the order the brief sets out.
 *
 * Gone with the repositioning: StatsBand, which counted 54 services and
 * six disciplines that no longer exist, and TermsSummary, whose terms
 * described the old general-business offer. The FAQ covers what
 * TermsSummary was actually for, with answers that match what Agency now
 * sells.
 */
export function Landing() {
  useEffect(() => {
    document.title = "AgenticCore.agency | Websites, AI Agents & Custom Business Automation";
  }, []);

  return (
    <div>
      <Nav />
      {/* Clears the floating Forge button so the last section is reachable. */}
      <main className="pb-24 sm:pb-28">
        <Hero />
        <Capabilities />
        <FeaturedServices />
        <AiShowcase />
        <PackageSection />
        <HowItWorks />
        <ForgeSection />
        <FamilySection />
        <Faq />
        <CtaBanner />
      </main>
      <Footer />
      <ChatLauncher />
    </div>
  );
}
