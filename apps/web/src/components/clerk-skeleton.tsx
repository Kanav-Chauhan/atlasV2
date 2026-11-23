import { ClerkLoading } from "@clerk/nextjs";

// Clerk draws its card only after its scripts, settings and component files have loaded (~1–2 s).
// Until then a YouTube-style skeleton stands in its place: grey bars with a light sweep, laid out
// like Clerk's card and the same size, so the real card replaces it without a jump.
// <ClerkLoading> shows it only while Clerk is loading. Bars are sized to Clerk's line heights.
const Bar = ({ className = "" }: { className?: string }) => <span aria-hidden="true" className={`skeleton-bar block ${className}`} />;

export function ClerkCardSkeleton({ fields, social }: {
  // Kept for the callers' readability: what the real card will say (screen readers get "Loading").
  title?: string;
  sub?: string;
  button?: string;
  footer?: string;
  fields: string[];
  social?: boolean;
}) {
  return (
    <ClerkLoading>
      <div role="status" aria-label="Loading" className="w-full max-w-[400px] overflow-hidden rounded-[16px] bg-paper shadow-[0_5px_15px_rgba(0,0,0,0.08),0_15px_35px_-5px_rgba(25,28,33,0.2)]">
        <div className="px-10 pt-[34px] pb-8">
          {/* title (24 px line) + subtitle (two lines on the waitlist card, one on sign-in) */}
          <div className="flex h-6 items-center justify-center"><Bar className="h-[18px] w-40" /></div>
          <div className="mt-0.5 flex h-[18px] items-center justify-center"><Bar className="h-3 w-60" /></div>
          {!social && <div className="flex h-[18px] items-center justify-center"><Bar className="h-3 w-36" /></div>}
          {social && (
            <>
              <Bar className="mt-8 h-[34px] w-full" />
              <div className="my-5 flex h-[18px] items-center justify-center"><Bar className="h-3 w-5" /></div>
            </>
          )}
          {fields.map((f) => (
            <div key={f} className="mt-[23px]">
              <div className="flex h-[18px] items-center"><Bar className="h-3 w-24" /></div>
              <Bar className="mt-[7px] h-[34px] w-full" />
            </div>
          ))}
          <Bar className="mt-[31px] h-[34px] w-full" />
        </div>
        <div className="flex justify-center border-t border-rule bg-paper-2 py-[15px]"><Bar className="h-[18px] w-48" /></div>
        <div className="flex justify-center border-t border-rule bg-paper-2 py-[15px]"><Bar className="h-4 w-28" /></div>
      </div>
    </ClerkLoading>
  );
}
