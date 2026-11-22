// window.atlasTrack comes from /analytics.js (src/app/analytics.js/route.ts); absent when off.
declare global {
  interface Window {
    atlasTrack?: (event: string, props?: Record<string, unknown>) => void;
  }
}
export {};
