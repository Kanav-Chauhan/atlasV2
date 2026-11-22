// Demo companies and the people a visitor can log in as.
// Source: docs/DEMO_DOCUMENTS.md §1.4, §2.4, §3.4 ("Demo users"). The MCP "Ops Agent" service account is left out.

export type Role = "Admin" | "Manager" | "Member" | "Guest";

export type DemoPerson = {
  name: string;
  title: string;
  role: Role;
  departments: string[];
  email: string;
};

export type DemoCompany = {
  slug: string;
  name: string;
  industry: string;
  description: string;
  /** Brand colours: monogram fill and its bottom edge. */
  color: string;
  accent: string;
  monogram: string;
  people: DemoPerson[];
};

export const DEMO_COMPANIES: DemoCompany[] = [
  {
    slug: "nimbus",
    name: "Nimbus Infotech",
    industry: "IT services",
    description: "Pune-based IT services firm, 4,200 people, and the NimbusOps monitoring product.",
    color: "#1E88E5",
    accent: "#0D2B4E",
    monogram: "N",
    people: [
      { name: "Vikram Kulkarni", title: "Founder & CEO", role: "Admin", departments: ["All"], email: "owner@nimbus.example" },
      { name: "Neha Gupta", title: "Engineering Manager, NimbusOps", role: "Manager", departments: ["Engineering", "Managers"], email: "manager@nimbus.example" },
      { name: "Ritika Menon", title: "Manager, HR Operations", role: "Manager", departments: ["HR", "Managers"], email: "hr@nimbus.example" },
      { name: "Arjun Nair", title: "VP Sales, North America", role: "Manager", departments: ["Sales"], email: "sales@nimbus.example" },
      { name: "Aditya Sharma", title: "Software Engineer", role: "Member", departments: ["Engineering"], email: "employee@nimbus.example" },
      { name: "Ishaan Verma", title: "Product Analyst, NimbusOps", role: "Member", departments: ["Product"], email: "product@nimbus.example" },
      { name: "Riya Saxena", title: "Design Intern", role: "Guest", departments: ["Everyone"], email: "guest@nimbus.example" },
    ],
  },
  {
    slug: "sanjeevani",
    name: "Sanjeevani Pharma",
    industry: "Pharmaceuticals",
    description: "Ahmedabad generics maker with three plants and the SJ‑2041 diabetes trial.",
    color: "#00796B",
    accent: "#F9A825",
    monogram: "S",
    people: [
      { name: "Dr. Harish Patel", title: "Managing Director & CEO", role: "Admin", departments: ["All"], email: "owner@sanjeevani.example" },
      { name: "Dr. Farhan Qureshi", title: "Head, Quality Assurance", role: "Manager", departments: ["Quality & Manufacturing", "Regulatory"], email: "qa@sanjeevani.example" },
      { name: "Nikhil Shah", title: "National Sales Manager", role: "Manager", departments: ["Sales"], email: "salesmanager@sanjeevani.example" },
      { name: "Priya Bhatt", title: "Head, Human Resources", role: "Manager", departments: ["HR"], email: "hr@sanjeevani.example" },
      { name: "Karan Malhotra", title: "Medical Representative, Mumbai", role: "Member", departments: ["Sales"], email: "sales@sanjeevani.example" },
      { name: "Dr. Sneha Rao", title: "Research Scientist", role: "Member", departments: ["R&D"], email: "rnd@sanjeevani.example" },
      { name: "Aman Trivedi", title: "QC Trainee (contract)", role: "Guest", departments: ["Everyone"], email: "guest@sanjeevani.example" },
    ],
  },
  {
    slug: "kaveri",
    name: "Kaveri Capital",
    industry: "Asset management",
    description: "Bengaluru fund house managing ₹18,650 crore across funds, PMS and an AIF.",
    color: "#1A237E",
    accent: "#C9A227",
    monogram: "K",
    people: [
      { name: "Ramesh Iyengar", title: "Managing Director & CEO", role: "Admin", departments: ["All"], email: "owner@kaveri.example" },
      { name: "Shalini Kapoor", title: "Chief Compliance Officer", role: "Manager", departments: ["Compliance & Legal"], email: "compliance@kaveri.example" },
      { name: "Gaurav Agarwal", title: "Chief Financial Officer", role: "Manager", departments: ["Finance", "Leadership"], email: "cfo@kaveri.example" },
      { name: "Mohit Arora", title: "Head of Operations", role: "Manager", departments: ["Operations"], email: "ops@kaveri.example" },
      { name: "Tanvi Joshi", title: "Equity Research Analyst", role: "Member", departments: ["Investments"], email: "analyst@kaveri.example" },
      { name: "Nandini Rao", title: "Relationship Manager, PMS", role: "Member", departments: ["Client Services"], email: "rm@kaveri.example" },
      { name: "Kabir Sethi", title: "Summer Intern, Research", role: "Guest", departments: ["Everyone"], email: "guest@kaveri.example" },
    ],
  },
];

export function findPerson(email: string | undefined) {
  for (const company of DEMO_COMPANIES) {
    const person = company.people.find((p) => p.email === email);
    if (person) return { company, person };
  }
  return null;
}

/** "Dr. Harish Patel" -> ["Harish", "Patel"] */
const nameParts = (name: string) => name.replace(/^Dr\.\s+/, "").split(" ");
export const firstName = (name: string) => nameParts(name)[0];
export const initials = (name: string) => nameParts(name).map((w) => w[0]).slice(0, 2).join("");
