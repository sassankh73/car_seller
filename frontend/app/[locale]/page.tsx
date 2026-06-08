import { Metadata } from "next";
import {
  Navbar,
  HeroSection,
  FeaturesBentoSection,
  StudioShowcaseSection,
  HowItWorksSection,
  TrustSection,
  PricingSection,
  CTASection,
  Footer,
} from "@/components/landing";

export const metadata: Metadata = {
  title: "AutoStudio — Professional Vehicle Photography for Modern Dealerships",
  description:
    "Transform ordinary vehicle photos into professional dealership-ready images in minutes. Premium virtual studios, HD/4K export, and batch processing for car dealers.",
  keywords: [
    "vehicle photography",
    "car dealership photography",
    "virtual car showroom",
    "automotive studio",
    "car photo background replacement",
    "professional vehicle images",
    "dealership photography platform",
    "car image enhancement",
  ],
  authors: [{ name: "AutoStudio" }],
  openGraph: {
    title: "AutoStudio — Professional Vehicle Photography",
    description:
      "Transform ordinary vehicle photos into professional dealership-ready images in minutes.",
    type: "website",
  },
};

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main className="bg-white">
        <HeroSection />
        <FeaturesBentoSection />
        <StudioShowcaseSection />
        <HowItWorksSection />
        <TrustSection />
        <PricingSection />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}