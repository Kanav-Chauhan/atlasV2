import { cache } from "react";
import { headers } from "next/headers";
import { type DemoCompany, type DemoPerson, findPerson, type Role } from "./demo-users";

export const COOKIE = "atlas_demo_user";
const API = process.env.API_URL || "http://localhost:8000";

type Me = {
  email: string; name: string; title: string; role: string; departments: string[];
  org: { slug: string; name: string }; plan: string; auth: "demo" | "clerk";
};

export type SessionUser = {
  person: DemoPerson;
  company: Pick<DemoCompany, "slug" | "name" | "people">;
  auth: Me["auth"];
};

const ROLE = (r: string) => (r[0].toUpperCase() + r.slice(1)) as Role;

/** Who is logged in, according to the API (GET /me with this request's cookies: the demo cookie
 * or Clerk's __session). The API decides; the web only displays. Once per request. */
export const getMe = cache(async (): Promise<Me | null> => {
  const cookie = (await headers()).get("cookie");
  if (!cookie) return null;
  try {
    const res = await fetch(`${API}/me`, { headers: { cookie }, cache: "no-store" });
    return res.ok ? ((await res.json()) as Me) : null;
  } catch {
    return null;
  }
});

export async function getUser(): Promise<SessionUser | null> {
  const me = await getMe();
  if (!me) return null;
  // Demo people keep the login page's details (company colours, the people for "try as").
  const demo = me.auth === "demo" ? findPerson(me.email) : null;
  if (demo) return { ...demo, auth: "demo" };
  return {
    person: { name: me.name, title: me.title, role: ROLE(me.role), departments: me.departments, email: me.email },
    company: { slug: me.org.slug, name: me.org.name, people: [] },
    auth: me.auth,
  };
}
