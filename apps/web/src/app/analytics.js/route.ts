// Atlas's own tiny analytics script (Phase 10): sends a few events straight to PostHog's
// capture API. No PostHog script from their CDN, no autocapture (typed text is never sent),
// no session recording, no cookies (one random id in localStorage). The website chat panel
// (/embed/*) is never tracked: it runs on customers' websites.
// Use from pages: window.atlasTrack?.("event", {props}) or a [data-track="event"] element
// (props from data-track-props JSON) that is clicked / a form submitted.
export const dynamic = "force-dynamic";

const body = (key: string, host: string) => `(function(){
var K=${JSON.stringify(key)},H=${JSON.stringify(host)};
if(!K||location.pathname.indexOf("/embed/")===0||navigator.doNotTrack==="1")return;
var id;try{id=localStorage.getItem("atlas-aid");if(!id){id=(crypto.randomUUID?crypto.randomUUID():String(Math.random()).slice(2));localStorage.setItem("atlas-aid",id)}}catch(e){id="anon"}
function send(ev,p){try{fetch(H+"/i/v0/e/",{method:"POST",keepalive:true,headers:{"Content-Type":"application/json"},
body:JSON.stringify({api_key:K,event:ev,distinct_id:id,properties:Object.assign({$current_url:location.origin+location.pathname,$pathname:location.pathname,$referrer:document.referrer||undefined,$process_person_profile:false},p||{})})})}catch(e){}}
window.atlasTrack=send;
var last="";function pv(){if(location.pathname!==last){last=location.pathname;send("$pageview")}}
pv();["pushState","replaceState"].forEach(function(m){var o=history[m];history[m]=function(){var r=o.apply(this,arguments);setTimeout(pv,0);return r}});
addEventListener("popstate",pv);
function props(el){try{return JSON.parse(el.getAttribute("data-track-props")||"{}")}catch(e){return{}}}
document.addEventListener("click",function(e){var el=e.target.closest&&e.target.closest("[data-track]");if(el&&el.tagName!=="FORM")send(el.getAttribute("data-track"),props(el))},true);
})();`;

export function GET() {
  const key = process.env.POSTHOG_KEY ?? "";
  const host = (process.env.POSTHOG_HOST ?? "https://us.i.posthog.com").replace(/\/$/, "");
  return new Response(body(key, host), {
    headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "public, max-age=300" },
  });
}
