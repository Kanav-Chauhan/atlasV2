"use client";

import { useState } from "react";
import { FUNDS, type Fund } from "./data";
import { AdviceArt, Icon, Riskometer } from "./art";

const TABS = ["All funds", "Equity", "Debt", "Hybrid"] as const;

function FundCard({ f }: { f: Fund }) {
  return (
    <article className="kv-fund" aria-labelledby={`kv-f-${f.id}`}>
      <header className="kv-fund-top">
        <span className={`kv-chip kv-chip-${f.group.toLowerCase()}`}>{f.group}</span>
        <span className="kv-fund-cat">{f.category}</span>
      </header>
      <h3 id={`kv-f-${f.id}`}>{f.name}</h3>
      <p className="kv-fund-blurb">{f.blurb}</p>

      <div className="kv-fund-stats">
        <div>
          <span className="kv-k">NAV · Direct, Growth</span>
          <strong className="kv-v">₹{f.navDirect}</strong>
        </div>
        <div>
          <span className="kv-k">Fund size</span>
          <strong className="kv-v">₹{f.aum} cr</strong>
        </div>
        <div className="kv-fund-risk">
          <Riskometer level={f.risk} size={74} />
          <span className="kv-risk-label">{f.risk}</span>
        </div>
      </div>

      <table className="kv-rtable">
        <caption className="kv-sr">Returns of {f.name}, Direct Plan Growth, CAGR, as of 31 March 2026</caption>
        <thead>
          <tr><th scope="col">Period</th><th scope="col">Fund</th><th scope="col">Benchmark</th></tr>
        </thead>
        <tbody>
          {f.returns.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              <td className={r.fund >= r.bench ? "kv-up" : "kv-dn"}>{r.fund.toFixed(1)}%</td>
              <td>{r.bench.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      <dl className="kv-fund-dl">
        <div><dt>Benchmark</dt><dd>{f.benchmark}</dd></div>
        <div><dt>Fund manager</dt><dd>{f.manager}{f.experience.startsWith("since") ? ` (${f.experience})` : ` · ${f.experience}`}</dd></div>
        <div><dt>Minimum</dt><dd>{f.minLump} lump sum · {f.minSip}/month SIP</dd></div>
        <div><dt>Exit load</dt><dd>{f.exitLoad}</dd></div>
        <div><dt>Expense ratio</dt><dd>Direct {f.terDirect} · Regular {f.terRegular}</dd></div>
      </dl>
      {f.note && <p className="kv-fund-note">{f.note}</p>}

      <footer className="kv-fund-cta">
        <a className="kv-btn kv-btn-primary" href="#contact">Invest now</a>
        <a className="kv-link" href="#downloads">Factsheet <Icon name="arrow" size={16} /></a>
      </footer>
    </article>
  );
}

export function FundExplorer() {
  const [tab, setTab] = useState<(typeof TABS)[number]>("All funds");
  const shown = tab === "All funds" ? FUNDS : FUNDS.filter((f) => f.group === tab);
  return (
    <>
      <div className="kv-tabs" role="group" aria-label="Filter funds by type">
        {TABS.map((t) => (
          <button key={t} type="button" aria-pressed={tab === t} onClick={() => setTab(t)}>
            {t}
            <span className="kv-tab-n">{t === "All funds" ? FUNDS.length : FUNDS.filter((f) => f.group === t).length}</span>
          </button>
        ))}
      </div>
      <div className="kv-fund-grid">
        {shown.map((f) => <FundCard key={f.id} f={f} />)}
        <aside className="kv-advice" aria-label="Help choosing a fund">
          <AdviceArt />
          <h3>Not sure which fund fits you?</h3>
          <p>Our investor service team can walk you through each scheme&apos;s riskometer, horizon and exit load before you invest.</p>
          <ul className="kv-ticks">
            <li>Direct plans carry a lower expense ratio than regular plans.</li>
            <li>SIPs start at ₹500 a month in Bluechip and Flexi Cap.</li>
            <li>We never accept cash; pay from a bank account in your own name.</li>
          </ul>
          <p className="kv-advice-tel"><Icon name="phone" size={18} /> 1800-425-0112 <span>9:00 am – 7:00 pm, Mon–Sat</span></p>
          <a className="kv-btn kv-btn-gold" href="#contact">Talk to us</a>
        </aside>
      </div>
    </>
  );
}
