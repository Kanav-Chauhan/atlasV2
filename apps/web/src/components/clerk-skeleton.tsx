import { ClerkLoading } from "@clerk/nextjs";

// Clerk draws its card only after its scripts, settings and component files have loaded (~1–2 s).
// Until then this card stands in its place: same size, same title and text, so nothing jumps.
// <ClerkLoading> shows it only while Clerk is loading; Clerk's own card then replaces it.
export function ClerkCardSkeleton({ title, sub, fields, button, footer, social }: {
  title: string;
  sub: string;
  fields: string[];
  button: string;
  footer: string;
  social?: boolean;
}) {
  return (
    <ClerkLoading>
      <div aria-busy="true" aria-label="Loading" className="w-full max-w-[400px] overflow-hidden rounded-[16px] bg-paper shadow-[0_5px_15px_rgba(0,0,0,0.08),0_15px_35px_-5px_rgba(25,28,33,0.2)]">
        <div className="px-10 pt-[34px] pb-8 text-center">
          <p className="text-[17px] leading-6 font-bold">{title}</p>
          <p className="mx-auto mt-0.5 max-w-xs text-[13px] leading-[18px] text-muted">{sub}</p>
          {social && (
            <>
              <div className="mt-8 h-[34px] animate-pulse rounded-input border border-rule bg-paper-2 motion-reduce:animate-none" />
              <p className="my-5 text-[13px] text-muted">or</p>
            </>
          )}
          {fields.map((f) => (
            <div key={f} className="mt-[23px] text-left">
              <p className="text-[13px] leading-[18px] font-medium">{f}</p>
              <div className="mt-[7px] h-[34px] animate-pulse rounded-input border border-rule bg-paper-2 motion-reduce:animate-none" />
            </div>
          ))}
          <div className="mt-[31px] grid h-[34px] place-items-center rounded-input bg-accent/70 text-[13px] font-medium text-accent-ink">{button}</div>
        </div>
        <div className="border-t border-rule bg-paper-2 px-6 py-[15px] text-center text-[13px] text-muted">{footer}</div>
        <div className="border-t border-rule bg-paper-2 py-[15px] text-center text-xs font-medium text-muted">Secured by clerk</div>
      </div>
    </ClerkLoading>
  );
}
