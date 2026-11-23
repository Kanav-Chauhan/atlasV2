// Logos for the three fictional demo companies: white mark on the brand colour tile.
// Nimbus = cloud + code (IT services), Sanjeevani = leaf + cross (pharma), Kaveri = rising bars + river (finance).

const MARKS: Record<string, React.ReactNode> = {
  nimbus: (
    <>
      <path d="M10 22.5h12.5a4.5 4.5 0 0 0 .6-8.96A6.5 6.5 0 0 0 10.6 12 5.25 5.25 0 0 0 10 22.5Z" />
      <path d="m14.5 15.5-2 2 2 2M17.5 15.5l2 2-2 2" strokeWidth="1.6" />
    </>
  ),
  sanjeevani: (
    <>
      <path d="M9 23c0-8 5-13 14-14 0 9-5 14-14 14Z" />
      <path d="M9 23 16 16" />
      <path d="M11 7.5v5M8.5 10h5" stroke="var(--logo-second, currentColor)" strokeWidth="2.2" />
    </>
  ),
  kaveri: (
    <>
      <path d="M10 20v-3M14.5 20v-6M19 20v-9M23.5 20V8" strokeWidth="2.6" />
      <path d="M8 24.5c2-1.3 4-1.3 6 0s4 1.3 6 0 4-1.3 4-1.3" stroke="var(--logo-second, currentColor)" />
    </>
  ),
};

export function CompanyLogo({ slug, color, second, className }: { slug: string; color: string; second?: string; className?: string }) {
  const mark = MARKS[slug];
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={className} style={{ ["--logo-second" as string]: second }}>
      <rect width="32" height="32" rx="8" fill={color} />
      <g fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{mark}</g>
    </svg>
  );
}

export const HAS_LOGO = (slug: string) => slug in MARKS;
