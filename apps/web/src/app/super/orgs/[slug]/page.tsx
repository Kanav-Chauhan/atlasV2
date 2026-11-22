import { OrgView } from "./org-view";

export default async function SuperOrgPage({ params }: { params: Promise<{ slug: string }> }) {
  return <OrgView slug={(await params).slug} />;
}
