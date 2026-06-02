import { Metadata } from "next";
import {
  Navbar,
  HeroSection,
  ValuePropositionSection,
  BeforeAfterSection,
  StudioShowcaseSection,
  TestimonialsSection,
  CTASection,
  Footer,
} from "@/components/landing";

export const metadata: Metadata = {
  title: "AutoStudio - Professional Car Photography for Dealerships",
  description:
    "Transform ordinary car photos into professional showroom images in seconds. Perfect for car dealerships and sellers. Features background removal, virtual studios, HD/4K export, and logo branding.",
  keywords: [
    "car photography",
    "car dealership photo editor",
    "virtual car studio",
    "automotive showroom",
    "car photo background removal",
    "professional car photos",
    "showroom images",
    "car image enhancement",
  ],
  authors: [{ name: "AutoStudio" }],
  openGraph: {
    title: "AutoStudio - Professional Car Photography for Dealerships",
    description:
      "Transform ordinary car photos into professional showroom images in seconds.",
    type: "website",
  },
};

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main>
        {/* Section 1: Full-screen Hero */}
        <HeroSection />

        {/* Section 2: Value Proposition */}
        <div id="value-proposition">
          <ValuePropositionSection />
        </div>

        {/* Section 3: Before / After Comparison */}
        <div id="comparison">
          <BeforeAfterSection />
        </div>

        {/* Section 4: Studio Collection */}
        <div id="studios">
          <StudioShowcaseSection />
        </div>

        {/* Section 5: Trust Metrics & Testimonials */}
        <div id="testimonials">
          <TestimonialsSection />
        </div>

        {/* Section 6: Final CTA */}
        <CTASection />
      </main>
      <Footer />
    </>
  );
}