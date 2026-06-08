"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";

const CONTACT_EMAIL = "hello@autostudio.cc";

export default function ContactPage() {
  const t = useTranslations("contact");
  const locale = useLocale();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const mailSubject = encodeURIComponent(`[AutoStudio] ${subject || t("defaultSubject")}`);
    const mailBody = encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\n\n${message}`
    );
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${mailSubject}&body=${mailBody}`;
    setSent(true);
  };

  return (
    <main className="min-h-screen bg-warm-cream">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 pt-10 pb-4">
        <Link
          href={`/${locale}`}
          className="inline-flex items-center gap-1.5 text-sm text-charcoal-500 hover:text-charcoal-900 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
          </svg>
          {t("backHome")}
        </Link>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-16 lg:py-20">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-start">
          {/* Left — info */}
          <div>
            <div className="section-label mb-4">{t("eyebrow")}</div>
            <h1 className="text-4xl lg:text-[3rem] font-bold tracking-[-0.03em] text-charcoal-900 leading-[1.1] mb-6">
              {t("headline")}
            </h1>
            <p className="text-lg text-charcoal-500 leading-relaxed mb-10">
              {t("subheadline")}
            </p>

            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-500 flex-shrink-0 mt-0.5">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-charcoal-900 mb-0.5">{t("emailLabel")}</p>
                  <a href={`mailto:${CONTACT_EMAIL}`} className="text-sm text-red-500 hover:text-red-600 transition-colors">
                    {CONTACT_EMAIL}
                  </a>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-500 flex-shrink-0 mt-0.5">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-charcoal-900 mb-0.5">{t("responseTimeLabel")}</p>
                  <p className="text-sm text-charcoal-500">{t("responseTimeValue")}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right — form */}
          <div className="bg-white rounded-2xl lg:rounded-3xl border border-black/[0.07] shadow-card-lg p-8 lg:p-10">
            {sent ? (
              <div className="text-center py-8">
                <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center text-green-500 mx-auto mb-4">
                  <svg className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-charcoal-900 mb-2">{t("successTitle")}</h2>
                <p className="text-charcoal-500 text-sm">{t("successBody")}</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <h2 className="text-xl font-bold text-charcoal-900 mb-1">{t("formTitle")}</h2>
                  <p className="text-sm text-charcoal-500 mb-6">{t("formSubtitle")}</p>
                </div>

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-charcoal-700 mb-1.5">{t("nameLabel")}</label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={t("namePlaceholder")}
                      className="w-full h-11 px-4 bg-warm-cream border border-black/[0.1] rounded-xl text-charcoal-900 text-sm placeholder:text-charcoal-400 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-charcoal-700 mb-1.5">{t("emailLabel")}</label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t("emailPlaceholder")}
                      autoComplete="email"
                      className="w-full h-11 px-4 bg-warm-cream border border-black/[0.1] rounded-xl text-charcoal-900 text-sm placeholder:text-charcoal-400 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-charcoal-700 mb-1.5">{t("subjectLabel")}</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={t("subjectPlaceholder")}
                    className="w-full h-11 px-4 bg-warm-cream border border-black/[0.1] rounded-xl text-charcoal-900 text-sm placeholder:text-charcoal-400 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-charcoal-700 mb-1.5">{t("messageLabel")}</label>
                  <textarea
                    required
                    rows={5}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={t("messagePlaceholder")}
                    className="w-full px-4 py-3 bg-warm-cream border border-black/[0.1] rounded-xl text-charcoal-900 text-sm placeholder:text-charcoal-400 focus:outline-none focus:ring-2 focus:ring-red-500/30 focus:border-red-500 transition resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full btn-primary"
                >
                  {t("submitButton")}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
