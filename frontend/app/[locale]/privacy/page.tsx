"use client";

import Link from "next/link";
import { useLocale } from "next-intl";

export default function PrivacyPage() {
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
            <strong>Draft — not final legal copy.</strong> This policy is a placeholder and has not been reviewed by legal counsel or a GDPR specialist. Do not rely on this page.
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-gray-500 text-sm mb-8">Last updated: [DATE PENDING LEGAL REVIEW]</p>

          <section className="prose prose-gray max-w-none text-gray-700 space-y-6">
            <p>This Privacy Policy describes how [COMPANY NAME] (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) collects, uses, and protects your personal data when you use AutoStudio AI (&quot;Service&quot;).</p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8">1. Data We Collect</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Account information: email address, name, password (hashed)</li>
              <li>Images you upload for processing</li>
              <li>Usage data: number of generations, subscription status</li>
              <li>Payment information (handled by Stripe — we do not store card details)</li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900 mt-8">2. How We Use Your Data</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>To provide and improve the Service</li>
              <li>To process payments and manage your subscription</li>
              <li>To send transactional emails (e.g., password reset, billing receipts)</li>
            </ul>

            <h2 className="text-xl font-semibold text-gray-900 mt-8">3. Legal Basis (GDPR)</h2>
            <p>We process your data based on: (a) contract performance — to deliver the Service you subscribed to; (b) legitimate interests — to operate and improve our platform; (c) consent — for marketing communications, where applicable.</p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8">4. Data Retention</h2>
            <p>[RETENTION PERIODS TO BE DEFINED]. You may request deletion of your account and associated data at any time by contacting us.</p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8">5. Your Rights (GDPR)</h2>
            <p>You have the right to access, rectify, erase, restrict, or port your personal data, and to object to processing. Contact us to exercise these rights.</p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8">6. Data Transfers</h2>
            <p>Your data may be processed outside the EU/EEA by sub-processors (e.g., Stripe, cloud hosting). We ensure appropriate safeguards are in place.</p>

            <h2 className="text-xl font-semibold text-gray-900 mt-8">7. Contact</h2>
            <p>Data protection questions: <a href="mailto:privacy@autostudio.ai" className="text-indigo-600 hover:underline">privacy@autostudio.ai</a></p>
          </section>
        </div>
      </div>
    </main>
  );
}
