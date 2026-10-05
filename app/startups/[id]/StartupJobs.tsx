"use client";
import { useRouter } from "next/navigation";
import type { StartupView } from "@/lib/types";
import { JobCard } from "@/components/JobCard";

export function StartupJobs({ s }: { s: StartupView }) {
  const router = useRouter();
  if (!s.jobs.length) return <p className="text-sm text-gray-500">No open jobs found from our sources.</p>;
  return (
    <div>
      {s.jobs.map((j) => (
        <JobCard key={j.id} job={j} application={s.applications.find((a) => a.job_id === j.id)} onChanged={() => router.refresh()} />
      ))}
    </div>
  );
}
