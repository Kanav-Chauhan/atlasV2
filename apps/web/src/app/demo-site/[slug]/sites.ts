// Content for the three fictional demo company websites. Every fact comes from that company's
// public documents in demo_corpus/source/<slug>/ (public: yes) or its bible (brand colours, tagline).

export type Site = {
  name: string; legal: string; tagline: string; intro: string;
  brand: string; brandInk: string; second: string; serif?: boolean;
  facts: [string, string][];
  offer: { id: string; title: string; lede: string; items: { name: string; text: string; meta?: string }[] };
  more: { id: string; title: string; lede?: string; rows: [string, string][] };
  values?: { title: string; items: [string, string][] };
  contact: [string, string][];
  note?: string;
};

export const SITES: Record<string, Site> = {
  nimbus: {
    name: "Nimbus Infotech", legal: "Nimbus Infotech Pvt. Ltd.", tagline: "Engineering clarity.",
    intro: "IT services and product engineering from Pune since 2009: clear designs, clear communication, clear ownership.",
    brand: "#1E88E5", brandInk: "#ffffff", second: "#0D2B4E",
    facts: [["Founded", "2009, Pune"], ["People", "4,200"], ["Delivery centres", "Pune, Bengaluru, Hyderabad"], ["Sales office", "Dubai"]],
    offer: {
      id: "services", title: "What we do", lede: "Four service lines and one product team.",
      items: [
        { name: "Cloud & Platform Engineering", text: "Cloud migrations, Kubernetes platforms, landing zones and DevOps." },
        { name: "Data & AI", text: "Data platforms, analytics engineering, ML and generative-AI solutions." },
        { name: "Enterprise Apps", text: "SAP (including S/4HANA programmes) and Salesforce implementation and support." },
        { name: "Managed Services", text: "A 24x7 NOC and SOC, run from Pune and Hyderabad." },
        { name: "NimbusOps", text: "Our IT operations monitoring service: an agent sends metrics, events and logs, NimbusOps evaluates your alert rules and notifies your on-call team.", meta: "SaaS" },
      ],
    },
    more: {
      id: "nimbusops", title: "NimbusOps at a glance", lede: "About 140 companies monitor around 186,000 hosts with NimbusOps.",
      rows: [
        ["Plans", "Starter, Standard and Enterprise, billed per monitored host per month on an annual contract"],
        ["Availability", "Designed for 99.9% monthly availability; a contractual SLA on Enterprise"],
        ["Integrations", "More than 40, including AWS CloudWatch, Azure Monitor, VMware and ServiceNow"],
        ["Where your data lives", "In India: AWS Mumbai, with disaster recovery in Hyderabad"],
        ["Security", "SOC 2 Type II report; Nimbus Infotech is ISO 27001:2022 certified"],
        ["Status page", "status.nimbusops.example"],
      ],
    },
    values: {
      title: "How we work",
      items: [
        ["Clarity over cleverness", "Write things down. Prefer the simple design."],
        ["Own the outcome", "If you see a problem, you own it until someone else explicitly does."],
        ["Earn client trust daily", "Our clients run warehouses, hospitals and stores on what we build."],
        ["Respect, always", "Zero tolerance for harassment and discrimination."],
      ],
    },
    contact: [
      ["Registered office", "7th Floor, Tower B, Panchshil Tech Park, Hinjewadi Phase 2, Pune 411057, Maharashtra"],
      ["Certifications", "ISO 27001:2022, ISO 9001:2015, SOC 2 Type II (NimbusOps), CMMI Level 3"],
      ["NimbusOps pricing", "Talk to our sales team: prices depend on monitored hosts and contract term"],
    ],
  },

  sanjeevani: {
    name: "Sanjeevani Pharma", legal: "Sanjeevani Pharma Ltd.", tagline: "Healing, made dependable.",
    intro: "Medicines for diabetes, cardiac care, hypertension, gastro-intestinal, respiratory and dermatology patients, made in India since 1994 and supplied to more than 30 export markets.",
    brand: "#00796B", brandInk: "#ffffff", second: "#F9A825",
    facts: [["Founded", "1994, Ahmedabad"], ["People", "2,850"], ["Plants", "Ahmedabad, Baddi, Vizag SEZ"], ["R&D", "Genome Valley, Hyderabad"]],
    offer: {
      id: "products", title: "Our medicines", lede: "Branded formulations made at our own plants.",
      items: [
        { name: "Glucosan-M 500", text: "Metformin 500 mg SR tablet", meta: "Diabetes" },
        { name: "Cardivas 10", text: "Rosuvastatin 10 mg tablet", meta: "Cardiac" },
        { name: "Amlosan 5", text: "Amlodipine 5 mg tablet", meta: "Hypertension" },
        { name: "Pantosan 40", text: "Pantoprazole 40 mg tablet", meta: "Gastro" },
        { name: "Sanjeevani Cough Relief Syrup", text: "Dextromethorphan + chlorpheniramine", meta: "Respiratory" },
        { name: "Dermacalm Cream", text: "Mometasone 0.1%", meta: "Dermatology" },
      ],
    },
    more: {
      id: "sites", title: "Where we make them",
      rows: [
        ["Unit I, Ahmedabad (Changodar)", "Tablets and capsules; WHO-GMP certified and Schedule M compliant"],
        ["Unit II, Baddi, Himachal Pradesh", "Oral liquids, ointments and creams"],
        ["Unit III, Visakhapatnam SEZ", "Our export unit, inspected by the US FDA; the 2026 re-inspection closed with no observations"],
        ["R&D Centre, Genome Valley, Hyderabad", "Formulation development, analytical research and clinical development"],
      ],
    },
    values: {
      title: "What we stand by",
      items: [
        ["Quality first", "No shipment target is worth a compromised batch."],
        ["Integrity", "We follow the law and the UCPMP 2024 code with every healthcare professional."],
        ["Patient focus", "Patients with chronic conditions depend on us month after month."],
        ["Safety", "Our people go home safe every day."],
      ],
    },
    contact: [
      ["Medicine questions", "1800-233-4100, option 2, or medinfo@sanjeevani.example (Monday to Saturday, 09:00 to 18:00)"],
      ["Report a side effect", "1800-233-4100, option 1 (24 hours), or drugsafety@sanjeevani.example"],
      ["Careers", "careers@sanjeevani.example"],
      ["Registered office", "Sanjeevani House, Plot 41, Sarkhej–Gandhinagar Highway, Ahmedabad 380054, Gujarat"],
    ],
  },

  kaveri: {
    name: "Kaveri Capital", legal: "Kaveri Capital Advisors Pvt. Ltd.", tagline: "Patient capital, clear thinking.",
    intro: "A SEBI-registered asset manager and wealth advisory firm from Bengaluru. Research-led and deliberately unhurried: we would rather own fewer businesses we understand well.",
    brand: "#1A237E", brandInk: "#ffffff", second: "#C9A227", serif: true,
    facts: [["Founded", "2012, Bengaluru"], ["Assets managed", "₹18,650 crore"], ["Retail investors", "41,000"], ["Branches", "Mumbai, New Delhi, Chennai, Pune"]],
    offer: {
      id: "funds", title: "Our funds", lede: "Schemes, a portfolio management service and a long-short fund.",
      items: [
        { name: "Kaveri Bluechip Fund", text: "Large cap. Fund manager Ashok Venkataraman.", meta: "Equity" },
        { name: "Kaveri Flexi Cap Fund", text: "Flexi cap. Fund manager Divya Menon.", meta: "Equity" },
        { name: "Kaveri Small Cap Opportunities", text: "Small cap. Fund manager Rahul Saxena.", meta: "Equity" },
        { name: "Kaveri Short Duration Fund", text: "Debt. Fund manager Farida Sheikh.", meta: "Debt" },
        { name: "Kaveri Arbitrage Fund", text: "Hybrid. Fund manager Farida Sheikh.", meta: "Hybrid" },
        { name: "Kaveri Focused Equity PMS", text: "Portfolio management service. Minimum investment ₹50 lakh.", meta: "PMS" },
      ],
    },
    more: {
      id: "service", title: "Investor service",
      rows: [
        ["Same-day NAV", "Requests received before 3:00 pm on business days get that day's NAV"],
        ["Exit load, equity funds", "1% on units redeemed within 365 days of allotment; none after"],
        ["Toll-free", "1800-425-0112, 9:00 am to 7:00 pm, Monday to Saturday"],
        ["Email", "service@kaveri.example"],
      ],
    },
    contact: [
      ["Registered office", "12th Floor, Prestige Meridian II, MG Road, Bengaluru 560001, Karnataka"],
      ["Branches", "Mumbai (BKC), New Delhi (Connaught Place), Chennai, Pune"],
      ["Careers", "careers@kaveri.example"],
    ],
    note: "Mutual fund investments are subject to market risks, read all scheme related documents carefully.",
  },
};
