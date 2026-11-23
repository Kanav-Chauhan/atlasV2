/*! Atlas website chat. Paste before </body>:
 *  <script src="https://p1.kanav.space/widget.js" data-atlas-key="SITE_KEY" async></script>
 * Draws a chat bubble; it opens the Atlas panel (/embed/SITE_KEY) in an iframe. No dependencies. */
(function () {
  var me = document.currentScript || document.querySelector("script[data-atlas-key]");
  var key = me && me.getAttribute("data-atlas-key");
  if (!key || !/^[A-Za-z0-9_-]{1,64}$/.test(key) || window.__atlasChat) return;
  window.__atlasChat = 1;
  var base = new URL(me.src, location.href).origin;
  var chat = '<path d="M4 5h16v11H9l-5 4z"/>', x = '<path d="M6 6l12 12M18 6L6 18"/>';
  var svg = function (d) { return '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + "</svg>"; };

  fetch(base + "/api/public/" + key + "/config", { credentials: "omit" })
    .then(function (r) { if (!r.ok) throw r; return r.json(); })
    .then(function (c) {
      var accent = /^#[0-9a-fA-F]{6}$/.test(c.accent) ? c.accent : "#2f5bd3";
      var n = parseInt(accent.slice(1), 16);
      var ink = ((n >> 16) * 0.299 + ((n >> 8) & 255) * 0.587 + (n & 255) * 0.114) > 150 ? "#111" : "#fff";
      var side = c.position === "left" ? "left" : "right";
      var host = document.createElement("div");
      var root = host.attachShadow({ mode: "open" });
      root.innerHTML = "<style>" +
        ":host{all:initial}" +
        ".b{position:fixed;" + side + ":20px;bottom:20px;z-index:2147483646;width:56px;height:56px;border:0;border-radius:50%;cursor:pointer;display:grid;place-items:center;background:" + accent + ";color:" + ink + ";box-shadow:0 6px 20px rgba(0,0,0,.25);transition:transform .15s}" +
        ".b:hover{transform:scale(1.06)}" +
        ".b:focus-visible{outline:3px solid " + accent + ";outline-offset:3px}" +
        ".p{position:fixed;" + side + ":20px;bottom:88px;z-index:2147483647;width:380px;height:min(600px,calc(100vh - 110px));border:0;border-radius:16px;background:#fff;box-shadow:0 12px 40px rgba(0,0,0,.28);display:none}" +
        ".p.o{display:block}" +
        "@media (max-width:480px){.p{left:0;right:0;bottom:0;width:100%;height:100%;border-radius:0}.p.o+.b{display:none}}" +
        "@media (prefers-reduced-motion:reduce){.b{transition:none}}" +
        "</style>";
      var frame = document.createElement("iframe");
      frame.className = "p";
      frame.title = "Chat with " + String(c.company || "us").slice(0, 60);
      var btn = document.createElement("button");
      btn.className = "b";
      btn.type = "button";
      btn.setAttribute("aria-haspopup", "dialog");
      var open = false;
      function set(next) {
        open = next;
        if (open && !frame.src) frame.src = base + "/embed/" + key;
        frame.classList.toggle("o", open);
        btn.setAttribute("aria-expanded", String(open));
        btn.setAttribute("aria-label", open ? "Close chat" : "Open chat");
        btn.innerHTML = svg(open ? x : chat);
        if (open) frame.focus(); else btn.focus();
      }
      set(false);
      btn.onclick = function () { set(!open); };
      document.addEventListener("keydown", function (e) { if (open && e.key === "Escape") set(false); });
      // The panel's close button and its Escape key post "atlas:close".
      addEventListener("message", function (e) { if (open && e.origin === base && e.data === "atlas:close") set(false); });
      root.appendChild(frame);
      root.appendChild(btn);
      if (document.body) document.body.appendChild(host);
      else addEventListener("DOMContentLoaded", function () { document.body.appendChild(host); });
    })
    .catch(function () {}); // unknown key, chat switched off or this site not allowed: show nothing
})();
