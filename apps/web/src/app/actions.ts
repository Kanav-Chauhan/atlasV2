"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findPerson } from "@/lib/demo-users";
import { COOKIE } from "@/lib/session";

// TODO(Phase 4/10): replace the demo cookie with real auth (API session, then Clerk).
export async function loginAs(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  if (!findPerson(email)) redirect("/login");
  (await cookies()).set(COOKIE, email, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  redirect("/app");
}

export async function logout() {
  (await cookies()).delete(COOKIE);
  redirect("/login");
}
