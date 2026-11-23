import { CompanyLogo } from "@/components/company-logo";
import type { Site } from "../sites";
import { Dashboard, HeroArt, Icon, Ladder, OfficeArt, Social } from "./art";
import { ContactForm } from "./contact-form";
import { MobileMenu } from "./menu";
import "./nimbus.css";

// Nimbus Infotech's own website. Every fact here comes from Nimbus's public documents
// (welcome_to_nimbus.md, nimbusops_product_faq.md), because the chat bubble answers from those.

const NAV: [string, string][] = [["#about", "About"], ["#services", "Services"], ["#nimbusops", "NimbusOps"], ["#careers", "Careers"], ["#contact", "Contact"]];

const SERVICES = [
  { icon: "cloud", tags: ["Cloud migrations", "Kubernetes platforms", "Landing zones", "DevOps"] },
  { icon: "data", tags: ["Data platforms", "Analytics engineering", "Machine learning", "Generative AI"] },
  { icon: "apps", tags: ["SAP S/4HANA programmes", "Salesforce", "Implementation", "Support"] },
  { icon: "ops", tags: ["24x7 NOC", "24x7 SOC", "Run from Pune", "Run from Hyderabad"] },
];

const CERTS: [string, string][] = [
  ["ISO 27001:2022", "Information security, company-wide"],
  ["ISO 9001:2015", "Quality management"],
  ["SOC 2 Type II", "NimbusOps"],
  ["CMMI Level 3", "Delivery process maturity"],
];

const STATS: [string, string][] = [
  ["2009", "Founded in Pune"],
  ["4,200", "People across four offices"],
  ["~140", "Companies run on NimbusOps"],
  ["~186,000", "Hosts monitored by NimbusOps"],
];

const FEATURES: [string, string, string][] = [
  ["agent", "One lightweight agent", "Runs on your servers, virtual machines and containers, and sends metrics, events and logs to NimbusOps."],
  ["timer", "Alert rules every 30 seconds", "NimbusOps evaluates your alert rules continuously: every 30 seconds on Standard and Enterprise, every 60 on Starter."],
  ["bell", "Reach the on-call team", "Notify by email, SMS, Slack, Microsoft Teams, PagerDuty or webhook, wherever your on-call team works."],
  ["uptime", "Built for 99.9% availability", "A warm standby in a second region, a 15-minute RPO and a 1-hour RTO. Full regional failover is tested every April and October."],
  ["india", "Your data stays in India", "Stored in AWS Mumbai with disaster recovery in Hyderabad. Customer data is never replicated outside India."],
  ["lock", "Encrypted and audited", "TLS 1.2 or higher in transit (TLS 1.3 for agents), AES-256 at rest, a SOC 2 Type II report and external pen tests twice a year."],
];

const INTEGRATIONS: { group: string; items: string[] }[] = [
  { group: "Clouds and platforms", items: ["AWS CloudWatch", "Azure Monitor", "VMware", "Kubernetes", "Linux hosts", "Windows hosts"] },
  { group: "IT service management", items: ["ServiceNow"] },
  { group: "Notifications", items: ["Email", "SMS", "Slack", "Microsoft Teams", "PagerDuty", "Webhook"] },
];

const PLANS = [
  { name: "Starter", lede: "Core monitoring with email and Slack alerts.", cta: "Talk to sales", points: ["Alert rules every 60 seconds", "15 days of metric history", "Email and help-centre support"] },
  { name: "Standard", lede: "Every integration, logs and 13 months of history.", cta: "Start your free trial", featured: true, points: ["Alert rules every 30 seconds", "30 days of log retention", "24x7 support for critical issues"] },
  { name: "Enterprise", lede: "For teams that need SSO, audit and a contractual SLA.", cta: "Talk to sales", points: ["99.9% SLA with service credits", "90 days of log retention", "Named Customer Success Manager"] },
];

type Cell = string | boolean;
const COMPARE: [string, Cell, Cell, Cell][] = [
  ["Alert evaluation interval", "60 seconds", "30 seconds", "30 seconds"],
  ["Metric history", "15 days", "13 months", "13 months"],
  ["Log retention", false, "30 days", "90 days"],
  ["Notifications", "Email and Slack", "All integrations", "All integrations"],
  ["Single sign-on (SAML / OIDC)", false, false, true],
  ["Audit log export", false, false, true],
  ["Availability SLA with service credits", false, false, "99.9%"],
  ["Named Customer Success Manager", false, false, true],
  ["AI alert summaries (from January 2027)", false, true, true],
  ["Support channels", "Email, help centre", "Email, in-app chat", "Email, in-app chat, phone, named CSM"],
  ["Support hours", "Mon–Fri, 9:00 am – 6:00 pm IST", "24x7 for critical issues", "24x7"],
  ["First response, critical issues", "4 business hours", "1 hour", "15 minutes"],
];

const SECTORS: [string, string, string][] = [
  ["Warehouses and logistics", "agent", "Operations that run every hour of the day need systems that keep up, and people who answer at 3 am."],
  ["Hospitals and healthcare", "ops", "When software supports patient care, reliability and security are not features. They are the job."],
  ["Stores and retail", "apps", "From the store floor to head office, the business runs on its applications and the data behind them."],
];

const LEADERS: [string, string][] = [
  ["Vikram Kulkarni", "Founder & CEO"], ["Meera Iyer", "Chief Technology Officer"], ["Anjali Deshpande", "Chief People Officer"],
  ["Rohan Bhatia", "Chief Financial Officer"], ["Sameer Khan", "Chief Information Security Officer"], ["Kavya Reddy", "VP Delivery, Hyderabad"],
  ["Arjun Nair", "VP Sales, North America"], ["Pradeep Joshi", "Head of Infrastructure & SRE"], ["Siddharth Rao", "Principal Architect"],
];

const OFFICES = [
  { city: "Pune", kind: "pune" as const, role: "Headquarters and delivery centre", where: "7th Floor, Tower B, Panchshil Tech Park, Hinjewadi Phase 2, Pune 411057, Maharashtra" },
  { city: "Bengaluru", kind: "blr" as const, role: "Delivery centre", where: "Whitefield" },
  { city: "Hyderabad", kind: "hyd" as const, role: "Delivery centre", where: "HITEC City" },
  { city: "Dubai", kind: "dxb" as const, role: "Sales office", where: "Middle East sales" },
];

const GRADES: [string, string][] = [
  ["L1", "Trainee"], ["L2", "Software Engineer"], ["L3", "Senior Software Engineer"], ["L4", "Tech Lead"],
  ["L5", "Engineering Manager / Architect"], ["L6", "Senior Manager / Principal"], ["L7", "Director"],
];

const initials = (n: string) => n.split(" ").map((w) => w[0]).join("");

function Mark({ v }: { v: Cell }) {
  if (v === true) return <><Icon name="check" className="nb-ico nb-yes" /><span className="nb-sr">Included</span></>;
  if (v === false) return <><Icon name="dash" className="nb-ico nb-no" /><span className="nb-sr">Not included</span></>;
  return <>{v}</>;
}

export function NimbusSite({ slug, s }: { slug: string; s: Site }) {
  const services = s.offer.items.filter((i) => i.name !== "NimbusOps");

  return (
    <div className="nb-site" id="top">
      <a className="nb-skip" href="#main">Skip to content</a>

      <header className="nb-header">
        <div className="nb-wrap nb-header-in">
          <a className="nb-brand" href="#top" aria-label={`${s.name}, home`}>
            <CompanyLogo slug={slug} color={s.brand} second={s.second} className="nb-brand-mark" />
            <span>Nimbus<em>Infotech</em></span>
          </a>
          <nav className="nb-nav" aria-label="Main">
            {NAV.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
          </nav>
          <a className="nb-btn nb-btn-primary nb-header-cta" href="#contact">Talk to us</a>
          <MobileMenu links={NAV} cta={["#plans", "Try NimbusOps free"]} />
        </div>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="nb-hero" aria-labelledby="nb-hero-h">
          <div className="nb-wrap nb-hero-in">
            <div className="nb-hero-copy">
              <p className="nb-kicker">IT services and product engineering</p>
              <h1 id="nb-hero-h">{s.tagline}</h1>
              <p className="nb-hero-lede">
                Cloud, data, enterprise apps and 24x7 managed operations from Pune, Bengaluru and Hyderabad, plus NimbusOps, our own IT monitoring service.
              </p>
              <div className="nb-actions">
                <a className="nb-btn nb-btn-primary nb-btn-lg" href="#services">Explore our services</a>
                <a className="nb-btn nb-btn-ghost nb-btn-lg" href="#plans">Try NimbusOps free</a>
              </div>
              <p className="nb-hero-note">14-day free trial of NimbusOps Standard for up to 50 hosts. No credit card needed.</p>
            </div>
            <div className="nb-hero-visual"><HeroArt /></div>
          </div>
        </section>

        {/* Certifications strip, in place of a client-logo wall */}
        <section className="nb-certs" aria-labelledby="nb-certs-h">
          <div className="nb-wrap nb-certs-in">
            <h2 id="nb-certs-h">Certified and independently audited</h2>
            <ul>
              {CERTS.map(([name, what]) => (
                <li key={name}>
                  <Icon name="seal" className="nb-ico nb-cert-ico" />
                  <span><b>{name}</b><small>{what}</small></span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Stats */}
        <section className="nb-stats" aria-label="Nimbus in numbers">
          <dl className="nb-wrap nb-stats-in">
            {STATS.map(([v, k]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
        </section>

        {/* Services */}
        <section id="services" className="nb-section nb-tint" aria-labelledby="nb-services-h">
          <div className="nb-wrap">
            <div className="nb-head">
              <h2 id="nb-services-h">Four service lines. One accountable team.</h2>
              <p>From the first cloud migration to the night shift in the NOC, we design, build and run the systems our clients depend on.</p>
            </div>
            <ul className="nb-services">
              {services.map((it, i) => (
                <li key={it.name} className="nb-card">
                  <span className="nb-tile"><Icon name={SERVICES[i]?.icon ?? "cloud"} /></span>
                  <h3>{it.name}</h3>
                  <p>{it.text}</p>
                  <ul className="nb-tags">{SERVICES[i]?.tags.map((t) => <li key={t}>{t}</li>)}</ul>
                  <a className="nb-link" href="#contact">Discuss a project<Icon name="arrow" className="nb-ico nb-ico-sm" /></a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* NimbusOps product */}
        <section id="nimbusops" className="nb-product" aria-labelledby="nb-ops-h">
          <div className="nb-wrap">
            <div className="nb-product-head">
              <span className="nb-badge">NimbusOps</span>
              <h2 id="nb-ops-h">See every server, VM and container. Hear about problems first.</h2>
              <p>NimbusOps is our IT operations monitoring service. About 140 companies, from mid-market firms to large enterprises, monitor around 186,000 hosts with it, and our own 24x7 NOC runs on it too.</p>
              <div className="nb-actions">
                <a className="nb-btn nb-btn-light nb-btn-lg" href="#plans">See plans</a>
                <a className="nb-btn nb-btn-outline-light nb-btn-lg" href="#integrations">Integrations</a>
              </div>
            </div>
            <figure className="nb-product-shot">
              <Dashboard />
              <figcaption>NimbusOps overview, drawn for illustration with sample data.</figcaption>
            </figure>
            <ul className="nb-features">
              {FEATURES.map(([icon, title, text]) => (
                <li key={title}>
                  <span className="nb-tile nb-tile-dark"><Icon name={icon} /></span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Integrations */}
        <section id="integrations" className="nb-section" aria-labelledby="nb-int-h">
          <div className="nb-wrap nb-int">
            <div className="nb-head nb-head-left">
              <h2 id="nb-int-h">More than 40 integrations</h2>
              <p>Connect the clouds, hosts and tools you already run. A few of the most used:</p>
              <a className="nb-link" href="#contact">Ask about an integration<Icon name="arrow" className="nb-ico nb-ico-sm" /></a>
            </div>
            <div className="nb-int-groups">
              {INTEGRATIONS.map((g) => (
                <div key={g.group}>
                  <h3>{g.group}</h3>
                  <ul className="nb-chips">
                    {g.items.map((n) => <li key={n}><span className="nb-chip-dot" aria-hidden="true">{n[0]}</span>{n}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Plans */}
        <section id="plans" className="nb-section nb-tint" aria-labelledby="nb-plans-h">
          <div className="nb-wrap">
            <div className="nb-head">
              <h2 id="nb-plans-h">NimbusOps plans</h2>
              <p>Every plan is billed per monitored host per month, on an annual contract. Prices depend on the number of hosts and the contract term, and larger deployments get volume pricing automatically.</p>
            </div>
            <ul className="nb-plans">
              {PLANS.map((p) => (
                <li key={p.name} className="nb-plan" data-featured={p.featured || undefined}>
                  {p.featured && <span className="nb-plan-flag">14-day free trial</span>}
                  <h3>{p.name}</h3>
                  <p className="nb-plan-lede">{p.lede}</p>
                  <p className="nb-plan-price">Priced per host, per month</p>
                  <ul>{p.points.map((pt) => <li key={pt}><Icon name="check" className="nb-ico nb-ico-sm nb-yes" />{pt}</li>)}</ul>
                  <a className={`nb-btn ${p.featured ? "nb-btn-primary" : "nb-btn-ghost"}`} href="#contact">{p.cta}</a>
                </li>
              ))}
            </ul>
            <p className="nb-plans-note">Free trial: Standard plan, up to 50 hosts, 14 days, no credit card. When it ends, your account is paused, not deleted, for another 30 days. Move up a plan any time; moving down takes effect at renewal.</p>

            <div className="nb-table-wrap" role="region" aria-labelledby="nb-compare-cap" tabIndex={0}>
              <table className="nb-table">
                <caption id="nb-compare-cap">Compare plans</caption>
                <thead><tr><th scope="col">Feature</th><th scope="col">Starter</th><th scope="col">Standard</th><th scope="col">Enterprise</th></tr></thead>
                <tbody>
                  {COMPARE.map(([k, a, b, c]) => (
                    <tr key={k}><th scope="row">{k}</th><td><Mark v={a} /></td><td><Mark v={b} /></td><td><Mark v={c} /></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Who we build for */}
        <section className="nb-section" aria-labelledby="nb-clients-h">
          <div className="nb-wrap">
            <blockquote className="nb-quote">
              <p>Our clients run warehouses, hospitals and stores on what we build.</p>
              <footer>From the Nimbus values: earn client trust daily</footer>
            </blockquote>
            <h2 id="nb-clients-h" className="nb-sr">Who we work with</h2>
            <ul className="nb-sectors">
              {SECTORS.map(([t, icon, text]) => (
                <li key={t} className="nb-card">
                  <span className="nb-tile"><Icon name={icon} /></span>
                  <h3>{t}</h3>
                  <p>{text}</p>
                </li>
              ))}
            </ul>
            <p className="nb-regions">We serve clients across North America, India, the Middle East and Europe.</p>
          </div>
        </section>

        {/* About */}
        <section id="about" className="nb-section nb-tint" aria-labelledby="nb-about-h">
          <div className="nb-wrap">
            <div className="nb-about">
              <div>
                <h2 id="nb-about-h">Clear designs, clear communication, clear ownership</h2>
                <p>{s.legal} was founded in Pune in 2009 by Vikram Kulkarni, who still leads the company as Founder & CEO. Today 4,200 people work across Pune, Bengaluru, Hyderabad and Dubai.</p>
                <p>Our tagline, &ldquo;{s.tagline}&rdquo;, is how we want to work: on every project, with every client.</p>
              </div>
              {s.values && (
                <ul className="nb-values">
                  {s.values.items.map(([k, v], i) => (
                    <li key={k}><span className="nb-num" aria-hidden="true">0{i + 1}</span><h3>{k}</h3><p>{v}</p></li>
                  ))}
                </ul>
              )}
            </div>

            <h3 className="nb-subhead">Leadership</h3>
            <ul className="nb-leaders">
              {LEADERS.map(([n, r], i) => (
                <li key={n}>
                  <span className="nb-avatar" data-c={i % 3} aria-hidden="true">{initials(n)}</span>
                  <span><b>{n}</b><small>{r}</small></span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Offices */}
        <section id="offices" className="nb-section" aria-labelledby="nb-offices-h">
          <div className="nb-wrap">
            <div className="nb-head nb-head-left">
              <h2 id="nb-offices-h">Our offices</h2>
              <p>Three delivery centres in India and a sales office in Dubai.</p>
            </div>
            <ul className="nb-offices">
              {OFFICES.map((o) => (
                <li key={o.city} className="nb-card">
                  <OfficeArt kind={o.kind} />
                  <h3>{o.city}</h3>
                  <p className="nb-office-role">{o.role}</p>
                  <address>{o.where}</address>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Careers */}
        <section id="careers" className="nb-careers" aria-labelledby="nb-careers-h">
          <div className="nb-wrap nb-careers-in">
            <div>
              <h2 id="nb-careers-h">Build a career, grade by grade</h2>
              <p>Every role at Nimbus maps to one of seven grades, from Trainee to Director, so you always know where you stand and what comes next. Join us in Pune, Bengaluru or Hyderabad.</p>
              <a className="nb-btn nb-btn-light nb-btn-lg" href="#contact">Get in touch about roles</a>
            </div>
            <Ladder grades={GRADES} />
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="nb-section" aria-labelledby="nb-contact-h">
          <div className="nb-wrap nb-contact">
            <div>
              <h2 id="nb-contact-h">Let&apos;s talk</h2>
              <p>Tell us about your project or ask for a NimbusOps quote. Our sales team will get back to you.</p>
              <dl className="nb-contact-list">
                <div><dt>Registered office</dt><dd>7th Floor, Tower B, Panchshil Tech Park, Hinjewadi Phase 2, Pune 411057, Maharashtra</dd></div>
                <div><dt>NimbusOps support</dt><dd>Through the help centre or in-app chat</dd></div>
                <div><dt>Service status</dt><dd>status.nimbusops.example</dd></div>
                <div><dt>Security questionnaires</dt><dd>Through your account executive; we respond within 10 business days</dd></div>
              </dl>
            </div>
            <ContactForm />
          </div>
        </section>
      </main>

      <footer className="nb-footer">
        <div className="nb-wrap">
          <div className="nb-foot-cta">
            <p>Want to see NimbusOps on your own hosts?</p>
            <a className="nb-btn nb-btn-light" href="#plans">Start a 14-day free trial</a>
          </div>
          <div className="nb-foot-grid">
            <div className="nb-foot-brand">
              <a className="nb-brand nb-brand-light" href="#top" aria-label={`${s.name}, back to top`}>
                <CompanyLogo slug={slug} color={s.brand} second={s.second} className="nb-brand-mark" />
                <span>Nimbus<em>Infotech</em></span>
              </a>
              <p>{s.tagline} IT services and product engineering since 2009.</p>
              <ul className="nb-socials" aria-label="Social media (demo: no real accounts)">
                <li><a href="#top" aria-label="LinkedIn"><Social kind="in" /></a></li>
                <li><a href="#top" aria-label="X"><Social kind="x" /></a></li>
                <li><a href="#top" aria-label="YouTube"><Social kind="yt" /></a></li>
              </ul>
            </div>
            <nav aria-label="Company">
              <h2>Company</h2>
              <a href="#about">About us</a><a href="#about">Leadership</a><a href="#offices">Offices</a><a href="#careers">Careers</a><a href="#contact">Contact</a>
            </nav>
            <nav aria-label="Services">
              <h2>Services</h2>
              {services.map((it) => <a key={it.name} href="#services">{it.name}</a>)}
            </nav>
            <nav aria-label="NimbusOps">
              <h2>NimbusOps</h2>
              <a href="#nimbusops">Features</a><a href="#integrations">Integrations</a><a href="#plans">Plans</a><a href="#plans">Free trial</a>
            </nav>
            <div className="nb-foot-addr">
              <h2>Headquarters</h2>
              <address>{s.legal}<br />7th Floor, Tower B, Panchshil Tech Park<br />Hinjewadi Phase 2, Pune 411057<br />Maharashtra, India</address>
            </div>
          </div>
          <div className="nb-foot-legal">
            <p>&copy; 2026 {s.legal}, a fictional company made for the Atlas demo. Not a real business.</p>
            <p>ISO 27001:2022, ISO 9001:2015, SOC 2 Type II (NimbusOps), CMMI Level 3</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
