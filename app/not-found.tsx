import Link from "next/link";

export default function NotFound() {
  return (
    <section className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-16 text-center">
      <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-brand-600">
        Error 404
      </p>

      <h1 className="mt-4 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
        Page not found
      </h1>

      <p className="mt-4 max-w-md text-base leading-relaxed text-gray-600">
        Looks like this page doesn&apos;t exist or may have moved. Let&apos;s get
        you back to finding your next startup opportunity.
      </p>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/dashboard"
          className="inline-flex items-center justify-center rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          Back to Startups
        </Link>

        <Link
          href="/"
          className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-5 py-3 text-sm font-semibold text-gray-800 transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500"
        >
          Go home
        </Link>
      </div>
    </section>
  );
}