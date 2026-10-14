import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Learn how Daily Startup Finder protects your privacy, processes resumes in-memory, and manages cookies.",
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-8 py-4 sm:py-8">
      <div className="border-b border-gray-200 pb-5">
        <Link href="/dashboard" className="mb-3 inline-block text-sm text-indigo-600 hover:text-indigo-800">
          ← Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Privacy Policy</h1>
        <p className="mt-2 text-sm text-gray-500">Last updated: October 2026</p>
      </div>

      <div className="space-y-6 text-sm leading-relaxed text-gray-700">
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">1. Overview</h2>
          <p>
            Daily Startup Finder is dedicated to helping software engineers and tech talent discover startup opportunities matched
            to their specific skills. We believe in privacy by design: we collect only what is necessary to score startup matches,
            and we do not sell or monetize your personal information.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">2. Resume Parsing & Data Handling</h2>
          <p>
            When you upload a resume PDF during onboarding:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>The resume is parsed <strong>entirely in-memory</strong> to extract technical skills, estimated years of experience, and potential role titles.</li>
            <li>Your original PDF file is <strong>never stored on our servers, database, or cloud disks</strong>. Once text parsing completes, the file is immediately discarded.</li>
            <li>You can review, modify, or remove any extracted skills before saving your profile.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">3. Profile Information</h2>
          <p>
            We store the criteria you specify to match you with startup opportunities:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Technical skills, frameworks, and tools.</li>
            <li>Target roles and professional experience level.</li>
            <li>Preferred job locations and startup categories.</li>
            <li>Your optional display name and job application notes.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">4. Cookies and Local Storage</h2>
          <p>
            We use minimal cookies and browser storage strictly required for platform operation:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <strong>Authentication & Profile (<code className="rounded bg-gray-100 px-1 py-0.5 text-xs">sf_uid</code> cookie):</strong> An
              encrypted, HTTP-only session cookie that identifies your profile link across visits without requiring third-party logins.
            </li>
            <li>
              <strong>User Preferences (<code className="rounded bg-gray-100 px-1 py-0.5 text-xs">localStorage</code>):</strong> Remembers your light/dark
              theme mode, dashboard filter states, and cookie banner consent.
            </li>
            <li>
              <strong>Zero Advertising Trackers:</strong> We do not include third-party advertising cookies, cross-site tracking pixels, or marketing trackers.
            </li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">5. External Job Boards and Links</h2>
          <p>
            Daily Startup Finder aggregates open jobs from publicly accessible sources (including Y Combinator, Ashby, Lever, Greenhouse, and company career pages).
            When you click an application link to apply, you are directed to the employer&apos;s or Applicant Tracking System&apos;s external website, which is
            governed by their own privacy practices and terms.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">6. Data Retention & Your Rights</h2>
          <p>
            You can modify your profile at any time in the <strong>My Profile / Settings</strong> page. You can clear your profile and application history by resetting
            your profile or removing browser cookies. If you wish to delete your stored profile records from our database, you can do so directly from your settings.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">7. Contact Us</h2>
          <p>
            If you have questions regarding this Privacy Policy or how your information is handled, feel free to reach out via GitHub or your project administrator.
          </p>
        </section>
      </div>
    </article>
  );
}
