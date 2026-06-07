"use client";

import Link from "next/link";
import { useLocale } from "next-intl";

export default function TermsPage() {
  const locale = useLocale();

  return (
    <main className="min-h-screen bg-gray-50 py-16 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Link href={`/${locale}`} className="text-indigo-600 hover:underline text-sm">
            ← Back to AutoStudio AI
          </Link>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-10">
          <div className="mb-6 px-4 py-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
            <strong>Draft — not final legal copy.</strong> These terms are placeholders and have not been reviewed by legal counsel. Do not rely on this page.
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
          <p className="text-gray-500 text-sm mb-8">Last updated: [DATE PENDING LEGAL REVIEW]</p>

          <section className="prose prose-gray max-w-none text-gray-700 space-y-6">
            <p>These Terms of Service govern your use of AutoStudio AI (&quot;Service&quot;), provided by [COMPANY NAME] (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;).</p>
            <p>By creating an account or using the Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.</p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8">1. Use of the Service</h2>
            <p>You may use the Service only for lawful purposes and in accordance with these Terms. You are responsible for all content you upload and generate.</p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8">2. Subscriptions and Billing</h2>
            <p>Paid subscriptions are billed in advance on a monthly or annual basis. All fees are non-refundable except as required by applicable law. See our Refund Policy for details.</p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8">3. Intellectual Property</h2>
            <p>You retain ownership of images you upload. You grant us a limited license to process your images to deliver the Service. We do not claim ownership of your content.</p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8">4. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, we are not liable for any indirect, incidental, or consequential damages arising from your use of the Service.</p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8">5. Governing Law</h2>
            <p>These Terms are governed by the laws of Sweden, without regard to conflict-of-law principles.</p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8">6. Contact</h2>
            <p>Questions about these Terms? Contact us at: <a href="mailto:legal@autostudio.ai" className="text-indigo-600 hover:underline">legal@autostudio.ai</a></p>
          </section>
        </div>
      </div>
    </main>
  );
}
