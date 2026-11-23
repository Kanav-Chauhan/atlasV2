import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DEMO_SITE_KEYS } from "@/lib/demo-site-keys";
import { SITES } from "./sites";
import { GenericSite } from "./generic";
import { NimbusSite } from "./nimbus/site";
import { SanjeevaniSite } from "./sanjeevani/site";
import { KaveriSite } from "./kaveri/site";
import "./notice.css";

export function generateStaticParams() {
  return Object.keys(SITES).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const site = SITES[(await params).slug];
  return { title: { absolute: site ? `${site.name} (demo website)` : "Demo website" }, robots: { index: false } };
}

// Someone else's website, always light: theme script is overridden like the embed panel.
const light = `document.documentElement.setAttribute("data-theme","light")`;

// Each demo company has its own website design in ./<slug>/site.tsx (own CSS, own look).
// This wrapper adds only what every demo site shares: the "fictional company" notice and the chat bubble.
const DESIGNS: Record<string, (p: { slug: string; s: (typeof SITES)[string] }) => React.ReactNode> = {
  nimbus: NimbusSite,
  sanjeevani: SanjeevaniSite,
  kaveri: KaveriSite,
};

export default async function DemoSite({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const s = SITES[slug];
  if (!s) notFound();
  const key = DEMO_SITE_KEYS[slug];
  const Design = DESIGNS[slug] ?? GenericSite;

  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: light }} />
      <p className="ds-notice">
        Fictional company for the Atlas demo. Try the chat bubble: it answers from this company&apos;s public documents only. <a href="/">About Atlas</a>
      </p>
      <Design slug={slug} s={s} />
      {key && <script src="/widget.js" data-atlas-key={key} async />}
    </>
  );
}
