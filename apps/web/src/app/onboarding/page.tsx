import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { AuthFrame } from "@/components/auth-frame";
import { MaybeClerk } from "@/components/clerk-provider";
import { CLERK_ON } from "@/lib/clerk";
import { OnboardingForm } from "./form";

export const metadata: Metadata = { title: "Set up your company" };
export const dynamic = "force-dynamic";

const API = process.env.API_URL || "http://localhost:8000";
type State = { linked: boolean; email: string | null; name: string | null };

// A signed-in Clerk user with no Atlas person: name the company, become its Admin.
// Invited people and existing admins never stay here (the API links them; → /app).
export default async function OnboardingPage() {
  if (!CLERK_ON) notFound();
  if (!(await auth()).userId) redirect("/login?tab=signin");
  const res = await fetch(`${API}/onboarding`, {
    headers: { cookie: (await headers()).get("cookie") ?? "" },
    cache: "no-store",
  }).catch(() => null);
  if (res?.status === 401) redirect("/login?tab=signin");
  const state: State | null = res?.ok ? await res.json() : null;
  if (state?.linked) redirect("/app");

  return (
    <AuthFrame title="Set up your company" sub={state?.email ? `Signed in as ${state.email}` : "One step left"} back={false}>
      <MaybeClerk>
        {state ? (
          <OnboardingForm name={state.name ?? ""} />
        ) : (
          <p className="rounded-card border border-rule bg-paper p-4 text-sm" role="alert">
            {res?.status === 403 ? "Verify your email address first, then reload this page." : "Atlas isn't answering right now. Reload the page in a minute."}
          </p>
        )}
      </MaybeClerk>
    </AuthFrame>
  );
}
