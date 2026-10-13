"use client";
import { useRouter } from "next/navigation";
import type { StartupView } from "@/lib/types";
import { JobCard } from "@/components/JobCard";

export function StartupJobs({ s }: { s: StartupView }) {
  const router = useRouter();
  if (!s.jobs.length) return null;
  // Best matches first.
  const jobs = [...s.jobs].sort((a, b) => b.match.match_score - a.match.match_score);
  return (
    <>
      {jobs.map((j) => (
        <JobCard key={j.id} job={j} funding={s} application={s.applications.find((a) => a.job_id === j.id)} onChanged={() => router.refresh()} />
      ))}
    </>
  );
}
