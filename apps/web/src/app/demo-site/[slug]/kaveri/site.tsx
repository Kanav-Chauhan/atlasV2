import { CompanyLogo } from "@/components/company-logo";
import type { Site } from "../sites";
import { AIF, FUNDS, PMS } from "./data";
import { CityRiverArt, CutoffTimeline, GrowthChart, Icon, NotebookArt, Riskometer, RiverLines, SocialIcon, type IconName } from "./art";
import { FundExplorer } from "./fund-explorer";
import "./kaveri.css";

// Kaveri Capital's own website: a fund-house style one-pager. Facts come from ./data.ts and the
// site content object `s` (both sourced from Kaveri's public documents only).

const NAV: [string, string][] = [
  ["About", "#about"],
  ["Funds", "#funds"],
  ["PMS & AIF", "#pms"],
  ["Investor services", "#services"],
  ["Careers", "#careers"],
  ["Contact", "#contact"],
];

const FIGURES: [string, string, string][] = [
  ["₹18,650", "crore", "Assets under management"],
  ["41,000", "", "Retail investors"],
  ["1,150", "", "PMS clients"],
  ["85", "", "Institutional & family-office mandates"],
  ["142", "stocks", "Under research coverage by 34 analysts"],
];

const QUICK: [IconName, string, string, string][] = [
  ["clock", "NAV & cut-off", "3:00 pm cut-off for same-day NAV", "#nav"],
  ["swap", "Redemptions", "Paid within 3 working days", "#redeem"],
  ["doc", "Statements", "CAS, confirmations, capital gains", "#statements"],
  ["shield", "Complaints", "Acknowledged within 1 working day", "#complaints"],
];

const INSIGHTS = [
  {
    tag: "Equity", fund: "Kaveri Bluechip Fund", by: "Ashok Venkataraman",
    title: "Why we still prefer domestic cyclicals",
    text: "Banks and capital goods drove FY2025-26's outperformance of 1.3 points over the Nifty 100 TRI. We continue to favour banks, capital goods and select automobiles over export-oriented sectors, across 48 stocks with 3.8% in cash.",
  },
  {
    tag: "Fixed income", fund: "Kaveri Short Duration Fund", by: "Farida Sheikh",
    title: "After 75 basis points of rate cuts, accrual takes over",
    text: "With the repo rate at 5.50% and the cycle close to its low point, we expect returns to come mainly from accrual. We plan to hold Macaulay duration between 2.2 and 2.6 years, with over 87% in sovereign and AAA paper.",
  },
  {
    tag: "Equity", fund: "Kaveri Small Cap Opportunities", by: "Rahul Saxena",
    title: "Why we trailed the index this year, and what we did about it",
    text: "The fund returned 22.4% against 24.8% for its benchmark, mostly because we stayed underweight richly valued defence and PSU stocks. We raised cash to 7.1% and kept the ₹2 lakh daily lump-sum cap to protect existing investors.",
  },
];

const DOWNLOADS: [string, string][] = [
  ["Kaveri Bluechip Fund Factsheet – March 2026", "PDF"],
  ["Kaveri Flexi Cap Fund Factsheet – March 2026", "PDF"],
  ["Kaveri Small Cap Opportunities Factsheet – March 2026", "PDF"],
  ["Kaveri Short Duration Fund Factsheet – March 2026", "PDF"],
  ["Kaveri Arbitrage Fund Factsheet – March 2026", "PDF"],
  ["Kaveri Focused Equity PMS – Presentation Summary", "DOCX"],
  ["Investor Service FAQ – Redemptions, Exit Loads and Statements", "Page"],
  ["NAV Computation and Cut-off Timings", "Page"],
];

const LEADERS: [string, string][] = [
  ["Ramesh Iyengar", "Managing Director & CEO"],
  ["Ashok Venkataraman", "Chief Investment Officer (Equity)"],
  ["Farida Sheikh", "Head of Fixed Income"],
  ["Ishita Banerjee", "Head of Research"],
  ["Shalini Kapoor", "Chief Compliance Officer"],
  ["Varun Pillai", "Chief Risk Officer"],
];

const VALUES: [string, string][] = [
  ["Client first", "Every decision is tested against “would the client agree if they saw this?”"],
  ["Intellectual honesty", "Write down the thesis, the risks and what would make us wrong."],
  ["Patience", "We measure ourselves over three to five years, not three months."],
  ["Discipline", "Limits, pre-clearance and documentation are not optional."],
  ["Respect", "For colleagues, clients and the regulator."],
];

const OFFICES: [string, string, string][] = [
  ["Bengaluru", "Head office", "12th Floor, Prestige Meridian II, MG Road, Bengaluru 560001"],
  ["Mumbai", "Bandra Kurla Complex", "Dealing desk, institutional sales, PMS relationship managers"],
  ["New Delhi", "Connaught Place", "North India distribution and PMS sales"],
  ["Chennai", "Anna Salai", "South India distribution, investor service centre"],
  ["Pune", "Baner", "Retail distribution"],
];

const initials = (n: string) => n.split(" ").map((w) => w[0]).join("");

export function KaveriSite({ s }: { slug: string; s: Site }) {
  return (
    <div className="kv-site" id="top">
      <a className="kv-skip" href="#main">Skip to content</a>

      <div className="kv-util">
        <div className="kv-wrap kv-util-row">
          <span className="kv-util-tags">Mutual fund-style schemes <i aria-hidden="true">·</i> PMS <i aria-hidden="true">·</i> AIF</span>
          <span className="kv-util-links">
            <a href="tel:18004250112"><Icon name="phone" size={15} /> 1800-425-0112</a>
            <a href="mailto:service@kaveri.example"><Icon name="mail" size={15} /> service@kaveri.example</a>
            <a href="#services" className="kv-util-login"><Icon name="user" size={15} /> Investor login</a>
          </span>
        </div>
      </div>

      <header className="kv-header">
        <div className="kv-wrap kv-header-row">
          <a href="#top" className="kv-brand" aria-label={`${s.name} home`}>
            <CompanyLogo slug="kaveri" color={s.brand} second={s.second} className="kv-logo" />
            <span>
              <strong>{s.name}</strong>
              <small>{s.legal.replace("Kaveri Capital ", "")}</small>
            </span>
          </a>
          <nav aria-label="Main" className="kv-nav">
            <ul>{NAV.map(([l, h]) => <li key={h}><a href={h}>{l}</a></li>)}</ul>
          </nav>
          <a href="#funds" className="kv-btn kv-btn-gold kv-header-cta">Invest now</a>
          <details className="kv-menu">
            <summary aria-label="Menu"><span aria-hidden="true" /></summary>
            <nav aria-label="Mobile">
              <ul>{NAV.map(([l, h]) => <li key={h}><a href={h}>{l}</a></li>)}</ul>
              <a href="#funds" className="kv-btn kv-btn-gold">Invest now</a>
            </nav>
          </details>
        </div>
      </header>

      <main id="main">
        {/* Hero */}
        <section className="kv-hero" aria-labelledby="kv-hero-h">
          <RiverLines />
          <div className="kv-wrap kv-hero-grid">
            <div className="kv-hero-copy">
              <p className="kv-eyebrow kv-eyebrow-gold">Bengaluru · Since 2012</p>
              <h1 id="kv-hero-h">Patient capital,<br /><em>clear thinking.</em></h1>
              <p className="kv-lede">
                A SEBI-registered asset manager and wealth advisory firm. We would rather own fewer businesses we understand well than chase every quarter, and we measure ourselves over three to five years, not three months.
              </p>
              <div className="kv-hero-cta">
                <a className="kv-btn kv-btn-gold kv-btn-lg" href="#funds">Explore our funds</a>
                <a className="kv-btn kv-btn-ghost kv-btn-lg" href="#contact">Talk to us</a>
              </div>
              <ul className="kv-hero-points">
                <li>5 mutual fund-style schemes</li>
                <li>Focused Equity PMS</li>
                <li>Long-Short AIF Category III</li>
              </ul>
            </div>
            <figure className="kv-hero-card">
              <figcaption>
                <span className="kv-eyebrow">Growth of ₹10,000 · Kaveri Bluechip Fund</span>
                <span className="kv-hero-val"><strong>₹36,420</strong> <span>vs ₹32,494 for the Nifty 100 TRI</span></span>
              </figcaption>
              <GrowthChart />
              <div className="kv-legend" aria-hidden="true">
                <span><i className="kv-sw kv-sw-fund" /> Fund (Direct, Growth)</span>
                <span><i className="kv-sw kv-sw-bench" /> Benchmark</span>
              </div>
              <p className="kv-fine">Invested at inception, 2 January 2017, valued on 31 March 2026. Since-inception CAGR 15.0% vs 13.6%. Past performance may or may not be sustained in future.</p>
            </figure>
          </div>
        </section>

        {/* Key figures */}
        <section className="kv-figures" aria-label="Kaveri Capital in numbers">
          <div className="kv-wrap">
            <ul className="kv-fig-row">
              {FIGURES.map(([n, u, l]) => (
                <li key={l}><strong>{n}{u && <small> {u}</small>}</strong><span>{l}</span></li>
              ))}
            </ul>
            <p className="kv-fine kv-fig-note">As of 31 March 2026.</p>
          </div>
        </section>

        {/* Funds */}
        <section id="funds" className="kv-section" aria-labelledby="kv-funds-h">
          <div className="kv-wrap">
            <div className="kv-head">
              <div>
                <p className="kv-eyebrow">Fund explorer</p>
                <h2 id="kv-funds-h">Five schemes, one research desk</h2>
              </div>
              <p>Returns are compounded annual growth rates for the Direct Plan, Growth option, <strong>as of 31 March 2026</strong>, from each scheme&apos;s March 2026 factsheet.</p>
            </div>
            <FundExplorer />

            <div className="kv-compare" id="compare">
              <h3>Compare returns at a glance</h3>
              <div className="kv-scroll" tabIndex={0} role="region" aria-label="Returns comparison table, scrolls sideways on small screens">
                <table className="kv-table">
                  <caption className="kv-sr">Fund and benchmark returns (CAGR), Direct Plan Growth, as of 31 March 2026</caption>
                  <thead>
                    <tr>
                      <th scope="col">Scheme</th>
                      <th scope="col">1 year</th><th scope="col">3 years</th><th scope="col">5 years</th><th scope="col">Since inception</th>
                      <th scope="col">Riskometer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {FUNDS.map((f) => (
                      <tr key={f.id}>
                        <th scope="row"><span className="kv-tname">{f.name}</span><span className="kv-tsub">vs {f.benchmark}</span></th>
                        {f.returns.map((r) => (
                          <td key={r.label}><span className="kv-tfund">{r.fund.toFixed(1)}%</span><span className="kv-tsub">{r.bench.toFixed(1)}%</span></td>
                        ))}
                        <td><span className="kv-trisk"><Riskometer level={f.risk} size={44} /> {f.risk}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="kv-fine">Regular Plan 1-year returns: Bluechip 13.2%, Flexi Cap 16.5%, Small Cap Opportunities 21.3%, Short Duration 7.0%, Arbitrage 6.6%. Past performance may or may not be sustained in future. Investors should consult their financial advisers if in doubt about whether a product is suitable for them.</p>
            </div>
          </div>
        </section>

        {/* PMS & AIF */}
        <section id="pms" className="kv-section kv-dark" aria-labelledby="kv-pms-h">
          <div className="kv-wrap">
            <div className="kv-head">
              <div>
                <p className="kv-eyebrow kv-eyebrow-gold">For high-net-worth investors</p>
                <h2 id="kv-pms-h">Portfolio management &amp; alternatives</h2>
              </div>
              <p>A concentrated, CIO-managed portfolio held in your own demat account, and a long-short fund for sophisticated investors.</p>
            </div>

            <div className="kv-pms-grid">
              <article className="kv-pms-card" aria-labelledby="kv-pms-name">
                <p className="kv-chip kv-chip-gold">PMS · Discretionary</p>
                <h3 id="kv-pms-name">{PMS.name}</h3>
                <dl className="kv-pms-facts">
                  <div><dt>Portfolio manager</dt><dd>{PMS.manager}</dd></div>
                  <div><dt>Strategy inception</dt><dd>{PMS.inception}</dd></div>
                  <div><dt>Strategy AUM</dt><dd>{PMS.aum} · {PMS.clients} clients</dd></div>
                  <div><dt>Portfolio</dt><dd>{PMS.stocks} stocks</dd></div>
                  <div><dt>Benchmark</dt><dd>{PMS.benchmark}</dd></div>
                  <div><dt>Minimum investment</dt><dd>{PMS.min}</dd></div>
                </dl>

                <h4>Three filters for every stock</h4>
                <ol className="kv-filters">
                  {PMS.filters.map(([t, d], k) => <li key={t}><span aria-hidden="true">{k + 1}</span><div><strong>{t}</strong><p>{d}</p></div></li>)}
                </ol>

                <h4>Performance (TWRR, net of fees and expenses)</h4>
                <div className="kv-scroll" tabIndex={0} role="region" aria-label="PMS performance table">
                  <table className="kv-table kv-table-dark">
                    <caption className="kv-sr">Kaveri Focused Equity PMS model portfolio performance vs Nifty 500 TRI, as of 31 March 2026</caption>
                    <thead><tr><th scope="col">Period</th><th scope="col">Strategy</th><th scope="col">Nifty 500 TRI</th><th scope="col">Excess</th></tr></thead>
                    <tbody>{PMS.returns.map(([p, a, b, c]) => <tr key={p}><th scope="row">{p}</th><td><strong>{a}</strong></td><td>{b}</td><td className="kv-gold">{c}</td></tr>)}</tbody>
                  </table>
                </div>
                <p className="kv-fine">Model portfolio, as reported to SEBI. Individual client returns may differ depending on the timing of investment and withdrawals.</p>
              </article>

              <div className="kv-pms-side">
                <article className="kv-mini" aria-labelledby="kv-fees-h">
                  <h3 id="kv-fees-h">Choose your fee structure</h3>
                  <ul className="kv-fee">
                    {PMS.fees.map(([o, m, p]) => <li key={o}><strong>{o}</strong><span>Management fee {m}</span><span>Performance fee: {p}</span></li>)}
                  </ul>
                  <p className="kv-fine">Fees charged quarterly on daily average AUM; GST applies. Fee structure can be changed once a year, on the account anniversary.</p>
                  <h4>Exit load (from each contribution)</h4>
                  <ul className="kv-steps">{PMS.exit.map(([y, l]) => <li key={y}><span>{y}</span><strong>{l}</strong></li>)}</ul>
                </article>

                <article className="kv-mini kv-aif" aria-labelledby="kv-aif-h">
                  <p className="kv-chip kv-chip-gold">{AIF.type}</p>
                  <h3 id="kv-aif-h">{AIF.name}</h3>
                  <dl className="kv-pms-facts kv-pms-facts-1">
                    <div><dt>Fund size</dt><dd>{AIF.aum}</dd></div>
                    <div><dt>Fund manager</dt><dd>{AIF.manager}</dd></div>
                    <div><dt>Minimum investment</dt><dd>{AIF.min}</dd></div>
                    <div><dt>Lock-in</dt><dd>{AIF.lockIn}</dd></div>
                    <div><dt>Exit load</dt><dd>{AIF.exit}</dd></div>
                    <div><dt>NAV</dt><dd>{AIF.nav}</dd></div>
                    <div><dt>Redemptions</dt><dd>{AIF.redemptions}</dd></div>
                  </dl>
                  <a className="kv-btn kv-btn-gold" href="#contact">Speak to a relationship manager</a>
                </article>
              </div>
            </div>
            <p className="kv-fine kv-fine-dark">Portfolio management services are not mutual funds and are not guaranteed by Kaveri Capital Advisors Pvt. Ltd. Investments in securities are subject to market risks. Please read the Disclosure Document and the PMS Client Agreement carefully before investing. SEBI PMS Reg. No. {PMS.reg}.</p>
          </div>
        </section>

        {/* Investor services */}
        <section id="services" className="kv-section" aria-labelledby="kv-svc-h">
          <div className="kv-wrap">
            <div className="kv-head">
              <div>
                <p className="kv-eyebrow">Investor services</p>
                <h2 id="kv-svc-h">Help with your investments</h2>
              </div>
              <p>Cut-off timings, redemptions, exit loads and statements, straight from our investor service FAQ.</p>
            </div>

            <ul className="kv-quick">
              {QUICK.map(([ic, t, d, h]) => (
                <li key={t}><a href={h}><span className="kv-quick-ic"><Icon name={ic} /></span><strong>{t}</strong><span>{d}</span></a></li>
              ))}
            </ul>

            <div className="kv-svc-grid">
              <article id="nav" className="kv-panel kv-panel-wide">
                <h3>Which NAV will I get?</h3>
                <p>The cut-off is <strong>3:00 pm on business days</strong>, for both equity and debt schemes. For purchases, the money must also be credited to the scheme&apos;s bank account before 3:00 pm. Requests on a Saturday get the next business day&apos;s NAV.</p>
                <div className="kv-tl-wrap" tabIndex={0} role="region" aria-label="Cut-off timeline, scrolls sideways on small screens"><CutoffTimeline /></div>
                <div className="kv-scroll" tabIndex={0} role="region" aria-label="Cut-off rules table">
                  <table className="kv-table">
                    <caption className="kv-sr">Applicable NAV by time of request</caption>
                    <thead><tr><th scope="col">Transaction</th><th scope="col">Received before 3:00 pm</th><th scope="col">At or after 3:00 pm</th></tr></thead>
                    <tbody>
                      <tr><th scope="row">Purchase, SIP, switch-in</th><td>Same day&apos;s NAV, if funds are realised before 3:00 pm</td><td>Next business day&apos;s NAV</td></tr>
                      <tr><th scope="row">Redemption, switch-out</th><td>Same day&apos;s NAV</td><td>Next business day&apos;s NAV</td></tr>
                    </tbody>
                  </table>
                </div>
              </article>

              <article id="redeem" className="kv-panel">
                <h3>Redemptions</h3>
                <ul className="kv-ticks">
                  <li>Paid within <strong>3 working days</strong> of the redemption date; usually 2 for the Arbitrage and Short Duration funds.</li>
                  <li>Paid only to the bank account registered in your folio.</li>
                  <li>If we are late beyond the regulatory timeline, we pay <strong>15% p.a.</strong> interest for each day of delay.</li>
                  <li>We do not accept cash for any investment. Pay by cheque, NEFT, RTGS, UPI or mandate from your own account.</li>
                </ul>
              </article>

              <article id="exit" className="kv-panel">
                <h3>Exit loads</h3>
                <table className="kv-table kv-table-tight">
                  <caption className="kv-sr">Exit loads by scheme</caption>
                  <thead><tr><th scope="col">Scheme</th><th scope="col">Exit load</th></tr></thead>
                  <tbody>
                    <tr><th scope="row">Bluechip, Flexi Cap, Small Cap Opportunities</th><td>1% within 365 days of allotment</td></tr>
                    <tr><th scope="row">Short Duration</th><td>Nil</td></tr>
                    <tr><th scope="row">Arbitrage</th><td>0.25% within 15 days</td></tr>
                  </tbody>
                </table>
                <p className="kv-fine">SIP instalments are treated first-in, first-out. A switch between Kaveri funds counts as a redemption; dividend reinvestment units carry no exit load.</p>
              </article>

              <article id="statements" className="kv-panel">
                <h3>Statements</h3>
                <dl className="kv-rows">
                  <div><dt>Transaction confirmation</dt><dd>Within 5 working days, by email and SMS</dd></div>
                  <div><dt>Consolidated account statement</dt><dd>Monthly if you transacted, otherwise every 6 months</dd></div>
                  <div><dt>Capital gains statement</dt><dd>On request any time; automatically each April</dd></div>
                  <div><dt>PMS monthly statement</dt><dd>By the 10th of the following month</dd></div>
                </dl>
                <p className="kv-fine">Missing a statement? Email service@kaveri.example from your registered address; we resend within 2 working days.</p>
              </article>

              <article className="kv-panel">
                <h3>Changing your details</h3>
                <p>Submit the change request form with proof through the website, the app or any Kaveri branch. Bank account changes need a cancelled cheque or bank statement in your name and take up to 10 working days.</p>
                <h4>KYC on hold?</h4>
                <p>If periodic re-KYC isn&apos;t completed within 90 days of the due date, new purchases and SIPs are paused until it is. Redemptions continue to your registered bank account.</p>
              </article>
            </div>

            <div id="downloads" className="kv-nav-dl">
              <div className="kv-navtable">
                <h3>Latest NAV <span>as of 31 March 2026</span></h3>
                <div className="kv-scroll" tabIndex={0} role="region" aria-label="NAV table">
                  <table className="kv-table">
                    <caption className="kv-sr">NAV per unit, Growth option, 31 March 2026</caption>
                    <thead><tr><th scope="col">Scheme</th><th scope="col">Direct</th><th scope="col">Regular</th></tr></thead>
                    <tbody>{FUNDS.map((f) => <tr key={f.id}><th scope="row">{f.name}</th><td>₹{f.navDirect}</td><td>₹{f.navRegular}</td></tr>)}</tbody>
                  </table>
                </div>
                <p className="kv-fine">NAV is published daily on our website by 11:00 pm, and on the AMFI website.</p>
              </div>
              <div className="kv-downloads">
                <h3>Downloads</h3>
                <ul>
                  {DOWNLOADS.map(([n, t]) => (
                    <li key={n}><Icon name="doc" size={20} /><span>{n}</span><em>{t}</em></li>
                  ))}
                </ul>
                <p className="kv-fine">Have a question about any of these documents? Ask our assistant using the chat button at the bottom right.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Insights */}
        <section id="insights" className="kv-section kv-tint" aria-labelledby="kv-ins-h">
          <div className="kv-wrap">
            <div className="kv-head">
              <div>
                <p className="kv-eyebrow">Insights</p>
                <h2 id="kv-ins-h">From our fund managers&apos; desk</h2>
              </div>
              <p>Highlights from the commentary in our March 2026 factsheets.</p>
            </div>
            <ul className="kv-insights">
              {INSIGHTS.map((n) => (
                <li key={n.title}>
                  <article>
                    <p className="kv-ins-meta"><span className="kv-chip kv-chip-line">{n.tag}</span> {n.fund}</p>
                    <h3>{n.title}</h3>
                    <p>{n.text}</p>
                    <p className="kv-ins-by"><span className="kv-avatar" aria-hidden="true">{initials(n.by)}</span>{n.by}<span>· March 2026</span></p>
                  </article>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* About */}
        <section id="about" className="kv-section" aria-labelledby="kv-about-h">
          <div className="kv-wrap kv-about">
            <div className="kv-about-copy">
              <p className="kv-eyebrow">About Kaveri Capital</p>
              <h2 id="kv-about-h">Research-led, benchmark-aware, deliberately unhurried</h2>
              <p>Kaveri Capital Advisors Pvt. Ltd. was founded in 2012 in Bengaluru. We run mutual fund-style schemes, a portfolio management service and an AIF Category III long-short fund. Our 310 people include 34 research analysts covering 142 stocks across 18 sectors.</p>
              <ol className="kv-values">
                {VALUES.map(([t, d], k) => <li key={t}><span aria-hidden="true">0{k + 1}</span><div><strong>{t}</strong><p>{d}</p></div></li>)}
              </ol>
            </div>
            <div className="kv-about-side">
              <CityRiverArt />
              <h3>Leadership</h3>
              <ul className="kv-leaders">
                {LEADERS.map(([n, r]) => <li key={n}><span className="kv-avatar" aria-hidden="true">{initials(n)}</span><div><strong>{n}</strong><span>{r}</span></div></li>)}
              </ul>
            </div>
          </div>
        </section>

        {/* Careers */}
        <section id="careers" className="kv-section kv-tint" aria-labelledby="kv-car-h">
          <div className="kv-wrap kv-careers">
            <div>
              <p className="kv-eyebrow">Careers</p>
              <h2 id="kv-car-h">Learn to invest with patience</h2>
              <p>We hire across research, investments, PMS and wealth, distribution, operations, risk and compliance, technology and our new GIFT City team. From application to offer usually takes 4 to 6 weeks, and everyone who reaches the panel stage gets written feedback.</p>
              <div className="kv-intern">
                <div>
                  <strong>Summer internship</strong>
                  <span>8 weeks, May to June, Bengaluru · 12 places</span>
                  <span>Applications 1 December – 31 January</span>
                </div>
                <div>
                  <strong>Winter research internship</strong>
                  <span>6 weeks, mid-December to end of January · 4 places</span>
                  <span>Mainly first-year MBA candidates</span>
                </div>
              </div>
              <p className="kv-hero-cta">
                <a className="kv-btn kv-btn-primary" href="mailto:careers@kaveri.example">Apply: careers@kaveri.example</a>
              </p>
              <p className="kv-fine"><strong>Fraud warning:</strong> we never ask candidates for money at any stage. Report any request for a &ldquo;registration&rdquo; or &ldquo;training&rdquo; fee to careers@kaveri.example.</p>
            </div>
            <NotebookArt />
          </div>
        </section>

        {/* Contact */}
        <section id="contact" className="kv-section" aria-labelledby="kv-con-h">
          <div className="kv-wrap">
            <div className="kv-head">
              <div>
                <p className="kv-eyebrow">Contact</p>
                <h2 id="kv-con-h">Talk to us</h2>
              </div>
              <p>Office hours are 9:00 am to 6:00 pm, Monday to Friday. Our toll-free line is open 9:00 am to 7:00 pm, Monday to Saturday.</p>
            </div>
            <div className="kv-contact">
              <div className="kv-contact-cards">
                <a href="tel:18004250112" className="kv-ccard"><Icon name="phone" /><span>Toll-free</span><strong>1800-425-0112</strong></a>
                <a href="mailto:service@kaveri.example" className="kv-ccard"><Icon name="mail" /><span>Investor service</span><strong>service@kaveri.example</strong></a>
                <div className="kv-ccard"><Icon name="pin" /><span>Registered office</span><strong>12th Floor, Prestige Meridian II, MG Road, Bengaluru 560001, Karnataka</strong></div>
              </div>
              <ul className="kv-offices">
                {OFFICES.map(([c, a, d]) => <li key={c}><strong>{c}</strong><span>{a}</span><p>{d}</p></li>)}
              </ul>
            </div>
            <div id="complaints" className="kv-complaints">
              <h3>Raising a complaint</h3>
              <ol>
                <li>Email service@kaveri.example, call 1800-425-0112 or visit any branch.</li>
                <li>We acknowledge within <strong>1 working day</strong> with a complaint ID and resolve within <strong>21 calendar days</strong>.</li>
                <li>Not satisfied? Write to our Grievance Redressal Officer (Head – Client Services).</li>
                <li>You can also lodge a complaint on SEBI SCORES, and then use the SMART ODR portal for conciliation and arbitration.</li>
              </ol>
              <p className="kv-fine">Distributors and partners: our retail distribution teams work from Pune and Chennai, and North India distribution from New Delhi.</p>
            </div>
          </div>
        </section>
      </main>

      <footer className="kv-footer">
        <div className="kv-wrap">
          <div className="kv-foot-top">
            <div className="kv-foot-brand">
              <a href="#top" className="kv-brand kv-brand-light" aria-label={`${s.name}, back to top`}>
                <CompanyLogo slug="kaveri" color="#ffffff22" second={s.second} className="kv-logo" />
                <span><strong>{s.name}</strong><small>{s.tagline}</small></span>
              </a>
              <p>12th Floor, Prestige Meridian II, MG Road, Bengaluru 560001, Karnataka</p>
              <ul className="kv-social" aria-label="Social media">
                {([["in", "LinkedIn"], ["x", "X"], ["yt", "YouTube"], ["ig", "Instagram"]] as const).map(([k, l]) => (
                  <li key={k}><a href="#top" aria-label={`${l} (demo link)`}><SocialIcon kind={k} /></a></li>
                ))}
              </ul>
            </div>
            <nav className="kv-foot-cols" aria-label="Footer">
              <div><h3>Funds</h3><ul>{FUNDS.map((f) => <li key={f.id}><a href="#funds">{f.name.replace("Kaveri ", "")}</a></li>)}</ul></div>
              <div><h3>PMS &amp; AIF</h3><ul><li><a href="#pms">Focused Equity PMS</a></li><li><a href="#pms">Long-Short AIF III</a></li><li><a href="#pms">Fee options</a></li></ul></div>
              <div><h3>Investors</h3><ul><li><a href="#nav">NAV &amp; cut-off</a></li><li><a href="#redeem">Redemptions</a></li><li><a href="#statements">Statements</a></li><li><a href="#downloads">Downloads</a></li><li><a href="#complaints">Complaints</a></li></ul></div>
              <div><h3>Company</h3><ul><li><a href="#about">About us</a></li><li><a href="#insights">Insights</a></li><li><a href="#careers">Careers</a></li><li><a href="#contact">Contact</a></li></ul></div>
            </nav>
          </div>
          <div className="kv-disclaimer">
            <p><strong>{s.note}</strong></p>
            <p>Past performance may or may not be sustained in future. Portfolio management services and AIFs are not mutual funds. Stocks and sectors mentioned in factsheets are illustrative and are not recommendations.</p>
          </div>
          <div className="kv-legal">
            <p>{s.legal} · CIN U67190KA2012PTC065309 · SEBI PMS Reg. No. INP000006120</p>
            <p>© 2026 {s.legal} — a fictional company created for the Atlas demo; all names, numbers and registrations are illustrative.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
