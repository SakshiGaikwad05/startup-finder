import { redirect } from "next/navigation";
import { currentUser } from "@/lib/users";

export const dynamic = "force-dynamic";

export default async function Home() {
  redirect((await currentUser()) ? "/dashboard" : "/onboarding");
}
