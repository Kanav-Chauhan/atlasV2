// The Atlas mark (public/brand/atlas-mark.svg: the owner's "A", traced from the original PNG).
// Full-detail version for large sizes: /brand/atlas-logo.svg (+ 512/1024 PNG exports).
export function Logo({ className = "size-7" }: { className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- tiny static SVG, no optimisation needed
  return <img src="/brand/atlas-mark.svg" alt="" aria-hidden="true" width={32} height={32} className={`shrink-0 ${className}`} />;
}
