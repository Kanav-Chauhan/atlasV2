import { CompanyLogo } from "@/components/company-logo";
import type { Site } from "./sites";
import "./demo-site.css";

// The original one-page layout, shared by any demo site that has no design of its own.
export function GenericSite({ slug, s }: { slug: string; s: Site }) {
  const style = { "--ds-brand": s.brand, "--ds-brand-ink": s.brandInk, "--ds-second": s.second } as React.CSSProperties;

  return (
    <div className="ds" data-serif={s.serif || undefined} style={style}>
      <header className="ds-nav ds-wrap">
        <a className="ds-logo" href="#top"><CompanyLogo slug={slug} color={s.brand} second={s.second} className="ds-logo-mark" />{s.name}</a>
        <nav aria-label="Sections">
          <a href={`#${s.offer.id}`}>{s.offer.title}</a>
          <a href={`#${s.more.id}`}>{s.more.title}</a>
          <a href="#contact">Contact</a>
        </nav>
      </header>

      <main id="top">
        <section className="ds-hero">
          <div className="ds-wrap">
            <h1>{s.tagline}</h1>
            <p>{s.intro}</p>
            <a className="ds-btn" href={`#${s.offer.id}`}>{s.offer.title}</a>
          </div>
        </section>

        <dl className="ds-facts ds-wrap">
          {s.facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
        </dl>

        <section id={s.offer.id} className="ds-section ds-wrap" aria-labelledby={`${s.offer.id}-h`}>
          <h2 id={`${s.offer.id}-h`}>{s.offer.title}</h2>
          <p className="ds-lede">{s.offer.lede}</p>
          <ul className="ds-cards">
            {s.offer.items.map((i) => (
              <li key={i.name}>
                {i.meta && <span className="ds-tag">{i.meta}</span>}
                <h3>{i.name}</h3>
                <p>{i.text}</p>
              </li>
            ))}
          </ul>
        </section>

        <section id={s.more.id} className="ds-band" aria-labelledby={`${s.more.id}-h`}>
          <div className="ds-wrap ds-split">
            <div>
              <h2 id={`${s.more.id}-h`}>{s.more.title}</h2>
              {s.more.lede && <p className="ds-lede">{s.more.lede}</p>}
            </div>
            <dl className="ds-rows">
              {s.more.rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
            </dl>
          </div>
        </section>

        {s.values && (
          <section className="ds-section ds-wrap" aria-labelledby="values-h">
            <h2 id="values-h">{s.values.title}</h2>
            <ul className="ds-values">
              {s.values.items.map(([k, v]) => <li key={k}><strong>{k}</strong><p>{v}</p></li>)}
            </ul>
          </section>
        )}

        <section id="contact" className="ds-section ds-wrap" aria-labelledby="contact-h">
          <h2 id="contact-h">Contact</h2>
          <dl className="ds-rows">
            {s.contact.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
          </dl>
        </section>
      </main>

      <footer className="ds-foot">
        <div className="ds-wrap">
          {s.note && <p>{s.note}</p>}
          <p>{s.legal} is a fictional company made for the Atlas demo.</p>
        </div>
      </footer>
    </div>
  );
}
