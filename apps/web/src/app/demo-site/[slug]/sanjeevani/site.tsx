import { CompanyLogo } from "@/components/company-logo";
import type { Site } from "../sites";
import { HeroArt, Icon, PackArt, SiteArt, Social, TherapyIcon } from "./art";
import { MobileMenu } from "./menu";
import "./sanjeevani.css";

// Sanjeevani Pharma's corporate website (fictional demo company).
// Every fact below comes from Sanjeevani's public documents in demo_corpus/source/sanjeevani/
// (public: yes): About Sanjeevani, the six product monographs/sheets, the Medicine Information
// and Side-Effect Reporting FAQ, the Returns and Expiry Replacement Policy and the Careers FAQ.

const NAV: [string, string][] = [
  ["#about", "About"],
  ["#medicines", "Our medicines"],
  ["#manufacturing", "Manufacturing"],
  ["#safety", "Patients & safety"],
  ["#careers", "Careers"],
  ["#contact", "Contact"],
];

type Product = {
  id: string; brand: string; generic: string; area: string; form: string; strength: string;
  pack: string; storage: string; shelf: string; unit: string; rx: string;
  art: { kind: "strip" | "bottle" | "tube"; pill?: string; shape?: "round" | "oval" | "caplet"; band: string };
};

const PRODUCTS: Product[] = [
  {
    id: "glucosan-m-500", brand: "Glucosan-M 500", generic: "Metformin Hydrochloride Sustained-Release Tablets IP", area: "Diabetes",
    form: "Sustained-release tablet", strength: "500 mg", pack: "Alu-Alu strip of 10 tablets",
    storage: "Below 30°C, protect from moisture", shelf: "36 months", unit: "Unit I, Ahmedabad", rx: "For type 2 diabetes in adults, with diet and exercise",
    art: { kind: "strip", pill: "var(--sj-white)", shape: "caplet", band: "var(--sj-teal)" },
  },
  {
    id: "cardivas-10", brand: "Cardivas 10", generic: "Rosuvastatin Calcium Tablets IP", area: "Cardiac",
    form: "Film-coated tablet", strength: "10 mg", pack: "Alu-Alu strip of 10 tablets",
    storage: "Below 30°C, protect from light and moisture", shelf: "36 months", unit: "Unit I, Ahmedabad", rx: "For high cholesterol and mixed dyslipidaemia, with diet",
    art: { kind: "strip", pill: "var(--sj-pill-pink)", shape: "round", band: "var(--sj-teal-deep)" },
  },
  {
    id: "amlosan-5", brand: "Amlosan 5", generic: "Amlodipine Besilate Tablets IP", area: "Hypertension",
    form: "Uncoated tablet, scored", strength: "5 mg", pack: "Strip of 15 tablets",
    storage: "Below 30°C, protect from light", shelf: "36 months", unit: "Unit I, Ahmedabad", rx: "For hypertension and chronic stable or vasospastic angina",
    art: { kind: "strip", pill: "var(--sj-white)", shape: "round", band: "var(--sj-saffron)" },
  },
  {
    id: "pantosan-40", brand: "Pantosan 40", generic: "Pantoprazole Gastro-resistant Tablets IP", area: "Gastro",
    form: "Enteric-coated tablet", strength: "40 mg", pack: "Alu-Alu strip of 15 tablets",
    storage: "Below 30°C, protect from moisture", shelf: "24 months", unit: "Unit I, Ahmedabad", rx: "For GERD, reflux oesophagitis and peptic ulcer",
    art: { kind: "strip", pill: "var(--sj-pill-yellow)", shape: "oval", band: "var(--sj-teal)" },
  },
  {
    id: "cough-relief-syrup", brand: "Sanjeevani Cough Relief Syrup", generic: "Dextromethorphan Hydrobromide and Chlorpheniramine Maleate Syrup", area: "Respiratory",
    form: "Oral syrup, alcohol-free", strength: "10 mg + 2 mg per 5 mL", pack: "100 mL amber bottle with measuring cup",
    storage: "Below 30°C, do not refrigerate", shelf: "24 months (use within 30 days of opening)", unit: "Unit II, Baddi", rx: "For dry cough with cold or allergic rhinitis. Not for children below 4 years",
    art: { kind: "bottle", band: "var(--sj-saffron)" },
  },
  {
    id: "dermacalm-cream", brand: "Dermacalm Cream", generic: "Mometasone Furoate Cream IP", area: "Dermatology",
    form: "Topical cream", strength: "0.1% w/w", pack: "15 g and 30 g tubes",
    storage: "Below 25°C, do not freeze", shelf: "30 months (use within 3 months of opening)", unit: "Unit II, Baddi", rx: "For steroid-responsive dermatoses such as eczema. Not for cosmetic use",
    art: { kind: "tube", band: "var(--sj-teal)" },
  },
];

const AREAS: { name: string; line: string; product: string }[] = [
  { name: "Diabetes", line: "Once-daily metformin for type 2 diabetes", product: "glucosan-m-500" },
  { name: "Cardiac", line: "A statin for cholesterol and cardiovascular risk", product: "cardivas-10" },
  { name: "Hypertension", line: "Amlodipine for blood pressure and angina", product: "amlosan-5" },
  { name: "Gastro", line: "A proton pump inhibitor for acid disorders", product: "pantosan-40" },
  { name: "Respiratory", line: "Relief for dry cough with a cold or allergy", product: "cough-relief-syrup" },
  { name: "Dermatology", line: "A topical steroid for inflamed, itchy skin", product: "dermacalm-cream" },
];

const MILESTONES: [string, string][] = [
  ["1994", "Founded in Ahmedabad with a single tablet line"],
  ["2001", "Unit I Changodar commissioned"],
  ["2009", "Unit II Baddi commissioned for liquids and ointments"],
  ["2014", "Hyderabad R&D centre opened in Genome Valley"],
  ["2017", "Unit III Vizag SEZ commissioned for exports"],
  ["2024", "First US FDA inspection of Unit III"],
  ["2026", "US FDA re-inspection of Unit III closed with no observations"],
];

export function SanjeevaniSite({ slug, s }: { slug: string; s: Site }) {
  return (
    <div className="sj-site" id="top">
      <a className="sj-skip" href="#sj-main">Skip to content</a>

      {/* utility strip */}
      <div className="sj-util">
        <div className="sj-wrap sj-util-row">
          <p className="sj-util-note">Information on this site is meant for residents of India.</p>
          <ul className="sj-util-links">
            <li><a href="#safety"><span className="sj-util-strong">Safety hotline</span> 1800-233-4100</a></li>
            <li><a href="#medinfo">Medicine information</a></li>
            <li><a href="#trade">For pharmacists</a></li>
          </ul>
        </div>
      </div>

      <header className="sj-header">
        <div className="sj-wrap sj-header-row">
          <a className="sj-brand" href="#top" aria-label={`${s.name}, back to top`}>
            <CompanyLogo slug={slug} color={s.brand} second={s.second} className="sj-logo" />
            <span className="sj-brand-text">
              <span className="sj-brand-name">Sanjeevani</span>
              <span className="sj-brand-sub">Pharma Ltd.</span>
            </span>
          </a>
          <nav className="sj-nav" aria-label="Main">
            <ul>{NAV.map(([href, label]) => <li key={href}><a href={href}>{label}</a></li>)}</ul>
          </nav>
          <a className="sj-btn sj-btn-alert sj-header-cta" href="#safety">Report a side effect</a>
          <MobileMenu links={NAV} />
        </div>
      </header>

      <main id="sj-main">
        {/* hero */}
        <section className="sj-hero" aria-labelledby="sj-hero-h">
          <div className="sj-wrap sj-hero-grid">
            <div className="sj-hero-copy">
              <p className="sj-hero-kicker">Since 1994, from Ahmedabad</p>
              <h1 id="sj-hero-h">{s.tagline}</h1>
              <p className="sj-hero-lede">
                Medicines for diabetes, heart, blood pressure, stomach, cough and skin, made the same careful way every time,
                for patients in India and in more than 30 export markets.
              </p>
              <div className="sj-hero-actions">
                <a className="sj-btn sj-btn-primary" href="#medicines">Explore our medicines</a>
                <a className="sj-btn sj-btn-ghost" href="#manufacturing">How we make them</a>
              </div>
            </div>
            <div className="sj-hero-visual"><HeroArt /></div>
          </div>
          <div className="sj-wrap">
            <dl className="sj-figures">
              <div><dt>Founded</dt><dd>1994</dd></div>
              <div><dt>People</dt><dd>2,850</dd></div>
              <div><dt>Plants, plus an R&amp;D centre</dt><dd>3</dd></div>
              <div><dt>Export markets</dt><dd>30+</dd></div>
            </dl>
          </div>
        </section>

        {/* therapy areas */}
        <section className="sj-section" id="therapy" aria-labelledby="sj-therapy-h">
          <div className="sj-wrap">
            <div className="sj-head">
              <h2 id="sj-therapy-h">Therapy areas</h2>
              <p>Six areas of care, each served by a brand made at our own plants.</p>
            </div>
            <ul className="sj-areas">
              {AREAS.map((a) => (
                <li key={a.name}>
                  <a className="sj-area" href={`#${a.product}`}>
                    <span className="sj-area-icon">{TherapyIcon[a.name]}</span>
                    <span className="sj-area-name">{a.name}</span>
                    <span className="sj-area-line">{a.line}</span>
                    <span className="sj-area-brand">{PRODUCTS.find((p) => p.id === a.product)?.brand}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* products */}
        <section className="sj-section sj-tint" id="medicines" aria-labelledby="sj-med-h">
          <div className="sj-wrap">
            <div className="sj-head sj-head-split">
              <div>
                <h2 id="sj-med-h">Our medicines</h2>
                <p>Branded generics, each with a full monograph for doctors and pharmacists.</p>
              </div>
              <p className="sj-hcp">
                {Icon.info}
                <span>Product information is for registered medical practitioners and pharmacists. Patients: please consult your doctor before starting, stopping or changing any medicine.</span>
              </p>
            </div>
            <ul className="sj-products">
              {PRODUCTS.map((p) => (
                <li key={p.id} id={p.id} className="sj-product">
                  <div className="sj-product-art"><PackArt {...p.art} /></div>
                  <div className="sj-product-body">
                    <p className="sj-tag">{p.area}</p>
                    <h3>{p.brand}</h3>
                    <p className="sj-generic">{p.generic}</p>
                    <p className="sj-use">{p.rx}</p>
                    <dl className="sj-spec">
                      <div><dt>Strength</dt><dd>{p.strength}</dd></div>
                      <div><dt>Form</dt><dd>{p.form}</dd></div>
                      <div><dt>Pack</dt><dd>{p.pack}</dd></div>
                      <div><dt>Storage</dt><dd>{p.storage}</dd></div>
                      <div><dt>Shelf life</dt><dd>{p.shelf}</dd></div>
                      <div><dt>Made at</dt><dd>{p.unit}</dd></div>
                    </dl>
                  </div>
                </li>
              ))}
            </ul>
            <aside className="sj-pipeline" aria-label="Pipeline">
              <p className="sj-pipeline-code">SJ-2041</p>
              <p>
                Our most important pipeline programme: a DPP-4 inhibitor and metformin fixed-dose combination for type 2 diabetes,
                now in Phase III. It is an investigational medicine and is <strong>not available for sale or on prescription</strong>.
                Please do not buy any product claiming to be SJ-2041.
              </p>
            </aside>
          </div>
        </section>

        {/* manufacturing */}
        <section className="sj-section" id="manufacturing" aria-labelledby="sj-mfg-h">
          <div className="sj-wrap">
            <div className="sj-head">
              <h2 id="sj-mfg-h">Manufacturing and quality</h2>
              <p>Three plants and one research campus, each with one clear job.</p>
            </div>
            <ul className="sj-sites">
              <li className="sj-sitecard">
                <SiteArt kind="solids" />
                <p className="sj-site-year">Since 2001</p>
                <h3>Unit I, Ahmedabad (Changodar)</h3>
                <p>Our oldest and largest plant, making tablets and capsules: Glucosan-M 500, Cardivas 10, Amlosan 5 and Pantosan 40.</p>
                <ul className="sj-badges"><li>WHO-GMP certified</li><li>Schedule M compliant</li></ul>
              </li>
              <li className="sj-sitecard">
                <SiteArt kind="hills" />
                <p className="sj-site-year">Since 2009</p>
                <h3>Unit II, Baddi, Himachal Pradesh</h3>
                <p>Oral liquids, ointments and creams, including Sanjeevani Cough Relief Syrup and Dermacalm Cream.</p>
              </li>
              <li className="sj-sitecard">
                <SiteArt kind="port" />
                <p className="sj-site-year">Since 2017</p>
                <h3>Unit III, Visakhapatnam SEZ</h3>
                <p>Our export unit, supplying regulated markets. The 2026 US FDA re-inspection closed with no observations.</p>
                <ul className="sj-badges"><li>US FDA inspected</li></ul>
              </li>
              <li className="sj-sitecard">
                <SiteArt kind="lab" />
                <p className="sj-site-year">Since 2014</p>
                <h3>R&amp;D Centre, Genome Valley, Hyderabad</h3>
                <p>Formulation development, analytical research, bioequivalence planning and clinical development.</p>
              </li>
            </ul>
            <div className="sj-quality">
              <div className="sj-quality-lead">
                <span className="sj-quality-icon">{Icon.shield}</span>
                <p><strong>Quality first.</strong> No shipment target is worth a compromised batch. Anyone at Sanjeevani may stop a line if they believe product quality is at risk.</p>
              </div>
              <ul className="sj-checks">
                <li>{Icon.check}<span>Every lot of glycerin and sorbitol for our syrup is tested for diethylene and ethylene glycol before use, and so is every finished batch.</span></li>
                <li>{Icon.check}<span>Bioequivalence of Cardivas 10 against the innovator product has been demonstrated.</span></li>
                <li>{Icon.check}<span>Every GMP role needs documented qualification before independent work.</span></li>
              </ul>
            </div>
          </div>
        </section>

        {/* patients & safety */}
        <section className="sj-section sj-tint" id="safety" aria-labelledby="sj-safety-h">
          <div className="sj-wrap">
            <div className="sj-alertbox">
              <div className="sj-alert-main">
                <h2 id="sj-safety-h">Report a side effect</h2>
                <p>
                  Noticed an unwanted or unexpected effect you think may be linked to a Sanjeevani medicine? Tell us, even if you are not sure the medicine caused it.
                </p>
                <div className="sj-alert-channels">
                  <a className="sj-channel" href="tel:18002334100">
                    {Icon.phone}
                    <span><span className="sj-channel-big">1800-233-4100</span><span className="sj-channel-small">Toll-free, option 1. Open 24 hours, 7 days a week</span></span>
                  </a>
                  <a className="sj-channel" href="mailto:drugsafety@sanjeevani.example">
                    {Icon.mail}
                    <span><span className="sj-channel-big sj-channel-mail">drugsafety@sanjeevani.example</span><span className="sj-channel-small">Any time</span></span>
                  </a>
                </div>
                <p className="sj-alert-urgent">
                  {Icon.alert}
                  <span>If the reaction is severe (difficulty breathing, swelling of the face, fainting, very low blood sugar), stop and seek medical help immediately, then report.</span>
                </p>
              </div>
              <div className="sj-alert-side">
                <h3>What to tell us</h3>
                <ol>
                  <li>The medicine name, batch number and expiry date on the pack</li>
                  <li>What happened, when it started and whether it has stopped</li>
                  <li>Age and sex of the person, and other medicines they take</li>
                  <li>A contact number so our safety doctor can follow up</li>
                </ol>
                <p className="sj-small">We acknowledge every report within 2 working days and a safety physician reviews each one. Your details stay confidential. You may also report through your doctor or pharmacist, or directly to the Pharmacovigilance Programme of India (PvPI).</p>
              </div>
            </div>

            <div className="sj-info-grid" id="medinfo">
              <div className="sj-info">
                <h3>Questions about a medicine</h3>
                <p>Patients and caregivers: 1800-233-4100, option 2, Monday to Saturday, 09:00 to 18:00.</p>
                <p>Doctors and pharmacists: <a href="mailto:medinfo@sanjeevani.example">medinfo@sanjeevani.example</a>, answered by a medical information pharmacist within 3 working days.</p>
              </div>
              <div className="sj-info">
                <h3>Quality complaint</h3>
                <p>Damaged pack, unusual colour or smell? Email <a href="mailto:qa.helpdesk@sanjeevani.example">qa.helpdesk@sanjeevani.example</a>, with a photograph of the pack. We reply within 3 working days.</p>
              </div>
              <div className="sj-info">
                <h3>Is my pack genuine?</h3>
                <p>Every pack shows the brand name, batch number, manufacturing and expiry dates, licence number and our Ahmedabad address. Spelling mistakes or a damaged seal: do not use it.</p>
              </div>
            </div>

            <div className="sj-notices" id="notices">
              <h3>Product notices</h3>
              <div className="sj-table-scroll" tabIndex={0} role="region" aria-label="Product notices table">
                <table>
                  <thead><tr><th scope="col">Product</th><th scope="col">Batch</th><th scope="col">Date</th><th scope="col">Reason</th><th scope="col">What to do</th></tr></thead>
                  <tbody>
                    <tr>
                      <td>Sanjeevani Cough Relief Syrup, 100 mL</td><td>CR-2309</td><td>August 2025</td>
                      <td>Label misprint (wrong manufacturing licence number). No safety impact.</td>
                      <td>Return the bottle to your pharmacy for a free replacement. Recall closed October 2025.</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="sj-small">If your pack&apos;s batch number is not listed here, it is not affected by any recall.</p>
            </div>
          </div>
        </section>

        {/* pharmacists & stockists */}
        <section className="sj-section" id="trade" aria-labelledby="sj-trade-h">
          <div className="sj-wrap sj-trade">
            <div className="sj-trade-intro">
              <h2 id="sj-trade-h">For pharmacists and stockists</h2>
              <p>Our returns and expiry replacement policy, in short. Expiry is printed as &ldquo;EXP MM/YYYY&rdquo; and a product may be used until the last day of that month.</p>
              <a className="sj-btn sj-btn-primary" href="mailto:returns@sanjeevani.example">Email returns@sanjeevani.example</a>
              <p className="sj-small">Returns go through your stockist to our C&amp;F agent. Credit notes are issued within 30 days of acceptance. Returned goods are never resold.</p>
            </div>
            <div className="sj-returns">
              <div className="sj-return sj-return-yes">
                <h3>{Icon.check} We accept</h3>
                <ul>
                  <li><strong>Near-expiry stock</strong>, sealed, 3 months or less left: replaced with fresh stock</li>
                  <li><strong>Expired stock</strong>, within 6 months after the expiry month: 100% credit note at price to stockist</li>
                  <li><strong>Transit damage</strong>, reported within 48 hours with photographs: replaced</li>
                  <li><strong>Recalled batches</strong>, opened or not: full credit at invoice price plus return freight</li>
                </ul>
              </div>
              <div className="sj-return sj-return-no">
                <h3>{Icon.cross} We cannot accept</h3>
                <ul>
                  <li>Expired stock more than 6 months after expiry</li>
                  <li>Opened or part-used packs (except recalls)</li>
                  <li>Physician samples, which must never be sold</li>
                  <li>Stock damaged by improper storage, and free goods from trade schemes</li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* about */}
        <section className="sj-section sj-dark" id="about" aria-labelledby="sj-about-h">
          <div className="sj-wrap sj-about">
            <div className="sj-about-copy">
              <h2 id="sj-about-h">About Sanjeevani</h2>
              <p className="sj-about-lede">A mid-size Indian generics and branded-formulations company. We make medicines for chronic conditions, so patients depend on us month after month.</p>
              <ul className="sj-values">
                {(s.values?.items ?? []).map(([t, d]) => (
                  <li key={t}><h3>{t}</h3><p>{d}</p></li>
                ))}
              </ul>
              <p className="sj-leader">Led by Dr. Harish Patel, Managing Director &amp; CEO.</p>
            </div>
            <ol className="sj-timeline" aria-label="Milestones">
              {MILESTONES.map(([y, t]) => (
                <li key={y}><span className="sj-tl-year">{y}</span><span className="sj-tl-text">{t}</span></li>
              ))}
            </ol>
          </div>
        </section>

        {/* careers */}
        <section className="sj-section" id="careers" aria-labelledby="sj-careers-h">
          <div className="sj-wrap sj-careers">
            <div className="sj-careers-main">
              <h2 id="sj-careers-h">Careers</h2>
              <p>We hire freshers and experienced people at all three plants, at the Hyderabad R&amp;D centre, at our Ahmedabad head office and in field sales across India.</p>
              <div className="sj-programme">
                <span className="sj-programme-icon">{Icon.cap}</span>
                <div>
                  <h3>Sanjeevani Graduate Trainee Programme</h3>
                  <p>Our main entry route for fresh B.Pharm, M.Pharm, M.Sc and B.Tech graduates: 12 months of rotations after a two-week induction in Ahmedabad.</p>
                  <dl className="sj-prog-facts">
                    <div><dt>Trainees, FY2026-27</dt><dd>120</dd></div>
                    <div><dt>Campus season</dt><dd>Aug to Dec</dd></div>
                    <div><dt>Joining</dt><dd>Jun to Jul</dd></div>
                  </dl>
                </div>
              </div>
              <p>Summer internships: 8 weeks at the R&amp;D centre for M.Pharm and M.Sc students. Applications open 15 January and close 28 February.</p>
              <a className="sj-btn sj-btn-primary" href="mailto:careers@sanjeevani.example">Send your CV to careers@sanjeevani.example</a>
            </div>
            <aside className="sj-fraud" aria-labelledby="sj-fraud-h">
              {Icon.alert}
              <h3 id="sj-fraud-h">We never charge a fee</h3>
              <p>Not for applications, tests, interviews, training, uniforms, medical checks or deposits. Offer letters only come from an @sanjeevani.example address. If anyone asks you for money in our name, it is fraud: report it to careers@sanjeevani.example.</p>
            </aside>
          </div>
        </section>

        {/* contact */}
        <section className="sj-section sj-tint" id="contact" aria-labelledby="sj-contact-h">
          <div className="sj-wrap">
            <div className="sj-head"><h2 id="sj-contact-h">Contact us</h2></div>
            <ul className="sj-contacts">
              <li>
                {Icon.pin}
                <h3>Registered office</h3>
                <address>Sanjeevani House, Plot 41,<br />Sarkhej–Gandhinagar Highway,<br />Ahmedabad 380054, Gujarat</address>
              </li>
              <li>
                {Icon.phone}
                <h3>Toll-free</h3>
                <p><a href="tel:18002334100">1800-233-4100</a></p>
                <p className="sj-small">Option 1: side effects, 24×7<br />Option 2: medicine questions, Mon to Sat, 09:00 to 18:00</p>
              </li>
              <li>
                {Icon.mail}
                <h3>Email</h3>
                <p className="sj-mails">
                  <a href="mailto:medinfo@sanjeevani.example">medinfo@sanjeevani.example</a>
                  <a href="mailto:drugsafety@sanjeevani.example">drugsafety@sanjeevani.example</a>
                  <a href="mailto:returns@sanjeevani.example">returns@sanjeevani.example</a>
                  <a href="mailto:careers@sanjeevani.example">careers@sanjeevani.example</a>
                </p>
              </li>
            </ul>
          </div>
        </section>
      </main>

      <footer className="sj-footer">
        <div className="sj-wrap">
          <div className="sj-footer-top">
            <div className="sj-footer-brand">
              <a className="sj-brand sj-brand-light" href="#top" aria-label={`${s.name}, back to top`}>
                <CompanyLogo slug={slug} color={s.brand} second={s.second} className="sj-logo" />
                <span className="sj-brand-text"><span className="sj-brand-name">Sanjeevani</span><span className="sj-brand-sub">Pharma Ltd.</span></span>
              </a>
              <p>{s.tagline}</p>
              <ul className="sj-social" aria-label="Social media (demo links)">
                <li><a href="#top" aria-label="LinkedIn"><Social name="linkedin" /></a></li>
                <li><a href="#top" aria-label="X"><Social name="x" /></a></li>
                <li><a href="#top" aria-label="YouTube"><Social name="youtube" /></a></li>
                <li><a href="#top" aria-label="Instagram"><Social name="instagram" /></a></li>
              </ul>
            </div>
            <nav className="sj-footer-cols" aria-label="Footer">
              <div>
                <h2>Company</h2>
                <ul>
                  <li><a href="#about">About us</a></li>
                  <li><a href="#manufacturing">Manufacturing</a></li>
                  <li><a href="#manufacturing">Quality</a></li>
                  <li><a href="#careers">Careers</a></li>
                </ul>
              </div>
              <div>
                <h2>Medicines</h2>
                <ul>{PRODUCTS.map((p) => <li key={p.id}><a href={`#${p.id}`}>{p.brand}</a></li>)}</ul>
              </div>
              <div>
                <h2>Patients and partners</h2>
                <ul>
                  <li><a href="#safety">Report a side effect</a></li>
                  <li><a href="#medinfo">Medicine information</a></li>
                  <li><a href="#notices">Product notices</a></li>
                  <li><a href="#trade">Returns and expiry</a></li>
                </ul>
              </div>
              <div>
                <h2>Our sites</h2>
                <ul className="sj-footer-sites">
                  <li>Head office, Ahmedabad</li>
                  <li>Unit I, Changodar</li>
                  <li>Unit II, Baddi</li>
                  <li>Unit III, Visakhapatnam SEZ</li>
                  <li>R&amp;D, Genome Valley, Hyderabad</li>
                </ul>
              </div>
            </nav>
          </div>
          <div className="sj-footer-legal">
            <p>
              The information on this website is for general awareness and for healthcare professionals. It is not a substitute for medical advice.
              Always consult your doctor or pharmacist before starting, stopping or changing any medicine.
            </p>
            <p>
              {s.legal} CIN L24230GJ1994PLC022817. Sanjeevani House, Plot 41, Sarkhej–Gandhinagar Highway, Ahmedabad 380054, Gujarat.
            </p>
            <p className="sj-footer-copy">
              © 2026 {s.legal} Sanjeevani Pharma is a fictional company created for the Atlas demo; its products, people and numbers are not real.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
