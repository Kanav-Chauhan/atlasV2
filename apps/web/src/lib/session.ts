import { cookies } from "next/headers";
import { findPerson } from "./demo-users";

// TODO(Phase 4/10): real auth. For now the demo cookie just names a demo login email.
export const COOKIE = "atlas_demo_user";

export async function getUser() {
  return findPerson((await cookies()).get(COOKIE)?.value);
}
