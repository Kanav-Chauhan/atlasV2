import { QueryProvider } from "@/components/query";
import { firstName } from "@/lib/demo-users";
import { getUser } from "@/lib/session";
import { Home, type HomeProps } from "./home";
import "./home.css";

export default async function HomePage() {
  const user = await getUser();
  if (!user) return null; // the layout already redirects
  const { person, company } = user;

  const now = new Date();
  const hour = Number(new Intl.DateTimeFormat("en-IN", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Kolkata" }).format(now));
  const part = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const today = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Kolkata" }).format(now);

  const props: HomeProps = {
    greeting: `${part}, ${firstName(person.name)}`,
    today,
    company: company.name,
    role: person.role,
    title: person.title,
    departments: person.departments,
  };

  return <QueryProvider><Home {...props} /></QueryProvider>;
}
