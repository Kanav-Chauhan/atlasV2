import { initials } from "@/lib/demo-users";
import "./avatar.css";

// A person's picture (uploaded in Settings, served by the API to the same company) or their
// initials. Keeps the caller's .avatar class so the size and shape stay the page's own.
export function Avatar({ name, url, className = "avatar" }: { name: string; url?: string | null; className?: string }) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element -- private, same-origin API image (cookies), already 256 px
    return <img src={url} alt="" aria-hidden="true" width={32} height={32} className={`${className} avatar-img`} />;
  }
  return <span className={className} aria-hidden="true">{initials(name)}</span>;
}
