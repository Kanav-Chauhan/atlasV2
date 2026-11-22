import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Atlas", template: "%s · Atlas" },
  description: "Answers from your company's own documents, with the source.",
};

// Applies the saved theme before first paint, so dark mode never flashes light.
const themeScript = `try{var t=localStorage.getItem("atlas-theme");if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
