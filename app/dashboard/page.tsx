import { Suspense } from "react";
import { Dashboard } from "@/components/Dashboard";

export default function DashboardPage() {
  return (
    <Suspense>
      <Dashboard />
    </Suspense>
  );
}
