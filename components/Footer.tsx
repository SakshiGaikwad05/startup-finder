import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-gray-200 bg-white py-5 pb-20 sm:pb-5 text-xs text-gray-500">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 sm:flex-row sm:px-6">
        <p className="text-center sm:text-left">
          © {new Date().getFullYear()} Daily Startup Finder · Startups hiring for your skills
        </p>
        <div className="flex items-center gap-4">
          <Link href="/privacy" className="text-gray-600 hover:text-indigo-600 transition underline underline-offset-2">
            Privacy Policy
          </Link>
          <span className="text-gray-300">·</span>
          <Link href="/terms" className="text-gray-600 hover:text-indigo-600 transition underline underline-offset-2">
            Terms & Conditions
          </Link>
        </div>
      </div>
    </footer>
  );
}
