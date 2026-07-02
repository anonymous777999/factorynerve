"use client";

import NavBar from "./nav-bar";
import HeroSection from "./hero-section";
import TrustStrip from "./trust-strip";
import ProblemSection from "./problem-section";
import EnginesSection from "./engines-section";
import PersonasSection from "./personas-section";
import ProductPreview from "./product-preview";
import HowItWorksSection from "./how-it-works";
import PricingPreview from "./pricing-preview";
import FAQSection from "./faq-section";
import FinalCTA from "./final-cta";
import Footer from "./footer";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[#0d1218]">
      <NavBar />
      <HeroSection />
      <TrustStrip />
      <ProblemSection />
      <EnginesSection />
      <PersonasSection />
      <ProductPreview />
      <HowItWorksSection />
      <PricingPreview />
      <FAQSection />
      <FinalCTA />
      <Footer />
    </main>
  );
}
