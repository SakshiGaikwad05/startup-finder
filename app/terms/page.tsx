import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms and Conditions",
  description: "Terms and conditions for using Daily Startup Finder.",
};

export default function TermsPage() {
  return (
    <article className="mx-auto max-w-3xl space-y-8 py-4 sm:py-8">
      <div className="border-b border-gray-200 pb-5">
        <Link href="/dashboard" className="mb-3 inline-block text-sm text-indigo-600 hover:text-indigo-800">
          ← Back to Dashboard
        </Link>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl">Terms and Conditions</h1>
        <p className="mt-2 text-sm text-gray-500">Last updated: October 2026</p>
      </div>

      <div className="space-y-6 text-sm leading-relaxed text-gray-700">
        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">1. Acceptance of Terms</h2>
          <p>
            By accessing or using Daily Startup Finder (&quot;the Service&quot;), you agree to be bound by these Terms and Conditions.
            If you do not agree to these terms, please do not use the service.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">2. Nature of the Service</h2>
          <p>
            Daily Startup Finder is an information and matching platform that aggregates publicly available job postings, funding announcements,
            and company directory information from sources such as Y Combinator, ATS job boards, and RSS feeds.
          </p>
          <p>
            We do not act as an employer, recruiter, or employment agency. Any job application submitted via external links is conducted
            strictly between you and the respective employer.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">3. User Responsibilities & Acceptable Use</h2>
          <p>When using Daily Startup Finder, you agree to:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Provide accurate information in your candidate profile.</li>
            <li>Use the platform exclusively for lawful, personal job-seeking or hiring research purposes.</li>
            <li>Not engage in automated scraping, denial-of-service attempts, or unauthorized access to our APIs or infrastructure.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">4. Third-Party Content & Listings Accuracy</h2>
          <p>
            Job openings, salaries, remote eligibility, and funding statuses are retrieved from third-party public resources and can change
            without notice. While we strive to maintain fresh and accurate data through automated discovery, we make no representations or
            warranties regarding the accuracy, completeness, or continued availability of any job listing.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">5. Disclaimer of Warranties</h2>
          <p>
            The Service is provided on an &quot;AS IS&quot; and &quot;AS AVAILABLE&quot; basis, without any warranties of any kind, either express or implied,
            including but not limited to fitness for a particular purpose or non-infringement. We do not guarantee that using the platform will result in
            job interviews, offers, or employment.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">6. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by applicable law, Daily Startup Finder and its creators shall not be liable for any indirect,
            incidental, consequential, or punitive damages arising out of your access to or use of the Service.
          </p>
        </section>

        <section className="space-y-2">
          <h2 className="text-lg font-semibold text-gray-900">7. Changes to Terms</h2>
          <p>
            We reserve the right to revise or update these Terms at any time. Continued use of the platform after modifications indicates your
            acceptance of the revised Terms.
          </p>
        </section>
      </div>
    </article>
  );
}
