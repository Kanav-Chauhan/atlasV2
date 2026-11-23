import { GenericSite } from "../generic";
import type { Site } from "../sites";

// Kaveri's own website design goes here (placeholder: the shared one-page layout).
export function KaveriSite({ slug, s }: { slug: string; s: Site }) {
  return <GenericSite slug={slug} s={s} />;
}
