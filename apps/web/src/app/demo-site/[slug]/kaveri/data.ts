// Kaveri Capital website facts. Every number here is copied from Kaveri's PUBLIC documents in
// demo_corpus/source/kaveri/ (public: yes): the March 2026 factsheets, the PMS presentation summary,
// About Kaveri Capital, NAV Computation and Cut-off Timings, the Investor Service FAQ and Careers.
// The Atlas chat bubble answers from those same documents, so do not change a number here without them.

export type Risk = "Low" | "Low to Moderate" | "Moderate" | "Moderately High" | "High" | "Very High";
export const RISK_LEVELS: Risk[] = ["Low", "Low to Moderate", "Moderate", "Moderately High", "High", "Very High"];

export type Period = { label: string; fund: number; bench: number; fundVal: number; benchVal: number };

export type Fund = {
  id: string;
  name: string;
  group: "Equity" | "Debt" | "Hybrid";
  category: string;
  blurb: string; // scheme description line from the factsheet
  inception: string;
  manager: string;
  experience: string;
  benchmark: string;
  aum: string; // ₹ crore, 31 March 2026
  navDirect: string;
  navRegular: string;
  terDirect: string;
  terRegular: string;
  minLump: string;
  minSip: string;
  exitLoad: string;
  note?: string;
  risk: Risk;
  benchRisk: Risk;
  returns: Period[];
  regular1y: string;
};

export const FUNDS: Fund[] = [
  {
    id: "bluechip", name: "Kaveri Bluechip Fund", group: "Equity", category: "Large cap fund",
    blurb: "An open-ended equity scheme predominantly investing in large cap stocks.",
    inception: "2 January 2017", manager: "Ashok Venkataraman", experience: "24 years", benchmark: "Nifty 100 TRI",
    aum: "6,420", navDirect: "36.42", navRegular: "33.18", terDirect: "0.82%", terRegular: "1.74%",
    minLump: "₹1,000", minSip: "₹500", exitLoad: "1% if redeemed within 365 days from allotment; nil thereafter",
    risk: "Very High", benchRisk: "Very High", regular1y: "13.2%",
    returns: [
      { label: "1 year", fund: 14.2, bench: 12.9, fundVal: 11420, benchVal: 11290 },
      { label: "3 years", fund: 15.8, bench: 14.1, fundVal: 15529, benchVal: 14803 },
      { label: "5 years", fund: 17.9, bench: 17.2, fundVal: 22762, benchVal: 22123 },
      { label: "Since inception", fund: 15.0, bench: 13.6, fundVal: 36420, benchVal: 32494 },
    ],
  },
  {
    id: "flexicap", name: "Kaveri Flexi Cap Fund", group: "Equity", category: "Flexi cap fund",
    blurb: "An open-ended dynamic equity scheme investing across large cap, mid cap and small cap stocks.",
    inception: "15 July 2019", manager: "Divya Menon", experience: "16 years", benchmark: "Nifty 500 TRI",
    aum: "4,980", navDirect: "30.65", navRegular: "28.21", terDirect: "0.91%", terRegular: "1.86%",
    minLump: "₹1,000", minSip: "₹500", exitLoad: "1% if redeemed within 365 days from allotment; nil thereafter",
    risk: "Very High", benchRisk: "Very High", regular1y: "16.5%",
    returns: [
      { label: "1 year", fund: 17.6, bench: 15.1, fundVal: 11760, benchVal: 11510 },
      { label: "3 years", fund: 18.9, bench: 16.0, fundVal: 16810, benchVal: 15609 },
      { label: "5 years", fund: 21.3, bench: 19.4, fundVal: 26262, benchVal: 24286 },
      { label: "Since inception", fund: 18.2, bench: 15.9, fundVal: 30650, benchVal: 26890 },
    ],
  },
  {
    id: "smallcap", name: "Kaveri Small Cap Opportunities", group: "Equity", category: "Small cap fund",
    blurb: "An open-ended equity scheme predominantly investing in small cap stocks.",
    inception: "5 March 2018", manager: "Rahul Saxena", experience: "15 years", benchmark: "Nifty Smallcap 250 TRI",
    aum: "2,310", navDirect: "41.87", navRegular: "37.95", terDirect: "1.12%", terRegular: "1.84%",
    minLump: "₹5,000", minSip: "₹1,000", exitLoad: "1% if redeemed within 365 days from allotment; nil thereafter",
    note: "Lump-sum subscriptions capped at ₹2 lakh per PAN per day since 1 October 2025; SIPs unaffected.",
    risk: "Very High", benchRisk: "Very High", regular1y: "21.3%",
    returns: [
      { label: "1 year", fund: 22.4, bench: 24.8, fundVal: 12240, benchVal: 12480 },
      { label: "3 years", fund: 24.1, bench: 22.6, fundVal: 19113, benchVal: 18422 },
      { label: "5 years", fund: 27.5, bench: 26.1, fundVal: 33710, benchVal: 31898 },
      { label: "Since inception", fund: 19.6, bench: 16.4, fundVal: 41870, benchVal: 33690 },
    ],
  },
  {
    id: "shortduration", name: "Kaveri Short Duration Fund", group: "Debt", category: "Short duration fund",
    blurb: "An open-ended short-term debt scheme with a portfolio Macaulay duration between 1 and 3 years. A relatively high interest rate risk and moderate credit risk scheme.",
    inception: "10 October 2014", manager: "Farida Sheikh", experience: "21 years", benchmark: "CRISIL Short Duration Index",
    aum: "2,140", navDirect: "24.63", navRegular: "23.12", terDirect: "0.38%", terRegular: "0.92%",
    minLump: "₹5,000", minSip: "₹1,000", exitLoad: "Nil",
    note: "Portfolio YTM 6.94%, Macaulay duration 2.48 years. Potential Risk Class B-III.",
    risk: "Moderate", benchRisk: "Low to Moderate", regular1y: "7.0%",
    returns: [
      { label: "1 year", fund: 7.6, bench: 7.4, fundVal: 10760, benchVal: 10740 },
      { label: "3 years", fund: 7.1, bench: 6.9, fundVal: 12286, benchVal: 12218 },
      { label: "5 years", fund: 6.4, bench: 6.3, fundVal: 13636, benchVal: 13572 },
      { label: "Since inception", fund: 8.0, bench: 7.8, fundVal: 24630, benchVal: 24140 },
    ],
  },
  {
    id: "arbitrage", name: "Kaveri Arbitrage Fund", group: "Hybrid", category: "Arbitrage fund (hybrid)",
    blurb: "An open-ended scheme investing in arbitrage opportunities. Treated as an equity-oriented fund for tax purposes.",
    inception: "20 August 2020", manager: "Farida Sheikh", experience: "since inception", benchmark: "Nifty 50 Arbitrage",
    aum: "1,100", navDirect: "13.58", navRegular: "13.04", terDirect: "0.35%", terRegular: "1.02%",
    minLump: "₹5,000", minSip: "₹1,000", exitLoad: "0.25% if redeemed within 15 days from allotment; nil thereafter",
    risk: "Low", benchRisk: "Low", regular1y: "6.6%",
    returns: [
      { label: "1 year", fund: 7.3, bench: 7.5, fundVal: 10730, benchVal: 10750 },
      { label: "3 years", fund: 7.0, bench: 7.1, fundVal: 12250, benchVal: 12284 },
      { label: "5 years", fund: 5.8, bench: 5.6, fundVal: 13257, benchVal: 13131 },
      { label: "Since inception", fund: 5.9, bench: 5.7, fundVal: 13580, benchVal: 13450 },
    ],
  },
];

export const PMS = {
  name: "Kaveri Focused Equity PMS",
  manager: "Ashok Venkataraman, Chief Investment Officer (Equity)",
  inception: "1 February 2016",
  aum: "₹1,350 crore",
  clients: "1,150",
  benchmark: "Nifty 500 TRI",
  stocks: "20–25 (currently 22)",
  min: "₹50 lakh (SEBI minimum), in cash or eligible securities",
  reg: "INP000006120",
  returns: [
    ["1 year", "16.8%", "15.1%", "+1.7%"],
    ["3 years (CAGR)", "18.2%", "16.0%", "+2.2%"],
    ["5 years (CAGR)", "20.6%", "19.4%", "+1.2%"],
    ["Since inception (CAGR)", "16.9%", "14.2%", "+2.7%"],
  ],
  filters: [
    ["Quality of business", "Return on capital employed above 15% through a cycle; low or no debt; free-cash-flow positive."],
    ["Quality of management", "Clean governance, sensible capital allocation, no history of related-party abuse."],
    ["Valuation discipline", "Entry only when the expected 5-year IRR exceeds 15%."],
  ],
  fees: [
    ["Option A – Fixed", "2.0% per annum", "None"],
    ["Option B – Hybrid", "1.0% per annum", "20% of returns above a 10% hurdle, subject to a high-water mark"],
  ],
  exit: [["Year 1", "3%"], ["Year 2", "2%"], ["Year 3", "1%"], ["After 3 years", "Nil"]],
};

export const AIF = {
  name: "Kaveri Long-Short AIF III",
  type: "AIF Category III, long-short",
  aum: "₹350 crore",
  manager: "Rahul Saxena",
  min: "₹1 crore",
  lockIn: "12 months from each contribution",
  exit: "1% in months 13–24; nil after that",
  nav: "Computed monthly (last business day) and sent to investors within 7 working days",
  redemptions: "Monthly, with 30 days' notice",
};
