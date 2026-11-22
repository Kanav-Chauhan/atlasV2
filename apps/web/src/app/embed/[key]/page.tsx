import type { Metadata } from "next";
import { publicConfig } from "@/lib/website";
import { EmbedChat } from "./embed-chat";
import "../../app/controls.css";
import "../../app/ask/ask.css";
import "./embed.css";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Chat", robots: { index: false, follow: false } };

// The panel always sits on someone else's (light) page, so it ignores the Atlas theme.
const light = `document.documentElement.setAttribute("data-theme","light")`;

export default async function EmbedPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ preview?: string }> }) {
  const { key } = await params;
  const { preview } = await searchParams;
  const config = await publicConfig(key);
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: light }} />
      {config ? <EmbedChat siteKey={key} config={config} preview={preview === "1"} /> : (
        <main className="embed embed-off">
          <p>This chat isn&apos;t available right now.</p>
        </main>
      )}
    </>
  );
}
