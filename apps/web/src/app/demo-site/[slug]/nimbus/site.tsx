import { GenericSite } from "../generic";
import type { Site } from "../sites";

// Nimbus's own website design goes here (placeholder: the shared one-page layout).
export function NimbusSite({ slug, s }: { slug: string; s: Site }) {
  return <GenericSite slug={slug} s={s} />;
}
