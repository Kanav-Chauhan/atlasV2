// Site keys for the three demo company websites (/demo-site/<slug>), copied from the seeded DB
// (organizations.website_chat->>'site_key'). Site keys are public by nature: every customer's
// HTML carries one. If a key is rotated, update it here. An empty key renders the site without the bubble.
export const DEMO_SITE_KEYS: Record<string, string> = {
  nimbus: "BwGwgOy9EnITTf8rvRfXvQ",
  sanjeevani: "bS50iH8Uf0adAga3pZNB-A",
  kaveri: "z_YP7rLNlEeJ6ydDjLJcow",
};
