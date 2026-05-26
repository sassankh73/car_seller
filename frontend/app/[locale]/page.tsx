import { Metadata } from "next";
import {
  Navbar,
  HeroSection,
  HowItWorksSection,
  BeforeAfterSection,
  FeaturesSection,
  StudioShowcaseSection,
  PricingSection,
  TestimonialsSection,
  FAQSection,
  CTASection,
  Footer,
} from "@/components/landing";

export const metadata: Metadata = {
  title: "AutoStudio AI - Professional AI Car Photography Platform",
  description:
    "Turn mobile car photos into professional studio images with AI. Perfect for car dealerships and sellers. Features AI background removal, virtual studios, HD/4K export, and logo branding.",
  keywords: [
    "AI car photography",
    "car dealership photo editor",
    "virtual car studio",
    "automotive AI platform",
    "car photo background removal",
    "professional car photos",
    "AI studio shots",
    "car image enhancement",
  ],
  authors: [{ name: "AutoStudio AI" }],
  openGraph: {
    title: "AutoStudio AI - Professional AI Car Photography Platform",
    description:
      "Transform mobile car photos into professional studio images instantly with AI.",
    type: "website",
  },
};

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main>
        <HeroSection />
        <div id="how-it-works">
          <HowItWorksSection />
        </div>
        <BeforeAfterSection />
        <div id="features">
          <FeaturesSection />
        </div>
        <div id="studios">
          <StudioShowcaseSection />
        </div>
        <div id="pricing">
          <PricingSection />
        </div>
        <TestimonialsSection />
        <div id="faq">
          <FAQSection />
        </div>
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
