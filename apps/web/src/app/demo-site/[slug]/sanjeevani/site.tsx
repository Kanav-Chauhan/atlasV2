import { GenericSite } from "../generic";
import type { Site } from "../sites";

// Sanjeevani's own website design goes here (placeholder: the shared one-page layout).
export function SanjeevaniSite({ slug, s }: { slug: string; s: Site }) {
  return <GenericSite slug={slug} s={s} />;
}
