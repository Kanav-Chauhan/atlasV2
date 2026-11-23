"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findPerson } from "@/lib/demo-users";
import { COOKIE } from "@/lib/session";

// Demo login: the cookie names a demo person. The API accepts it only for demo companies
// (plan "demo"); real users sign in with Clerk (/sign-in).
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

// "Sign in" for real users: drop any demo login first, so the Clerk session is the one used.
export async function startSignIn() {
  (await cookies()).delete(COOKIE);
  redirect("/sign-in");
}

export async function logout() {
  (await cookies()).delete(COOKIE);
  redirect("/login");
}

// The API signs atlas_super; dropping it here is enough to log the Atlas owner out (it is stateless).
export async function superLogout() {
  (await cookies()).delete("atlas_super");
  redirect("/login");
}
