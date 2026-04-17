/**
 * app.js — main entry point
 * Wires together Firebase, Gemini, Maps, Routes, and Proactive modules
 */
import { initFirebase, getLiveContext } from "./firebase.js";
import { askGemini }                    from "./gemini.js";
import { classifyIntent }               from "./intent.js";
import { computeRoute }                 from "./routes.js";
import { startProactiveLoop }           from "./proactive.js";
import { updateGateOverlay, focusLocation } from "./maps.js";

window.STADIUM = await fetch("data/stadium.json").then(r => r.json());
initFirebase();

window.addEventListener("DOMContentLoaded", () => {
  appendMessage("Hi! I'm StadiumIQ, your MetroArena concierge. "
    + "Ask me anything or tap a quick action below.", "bot");
  startProactiveLoop(msg => appendMessage(msg, "bot", true));
});

window.addEventListener("gamestate-update", e => {
  const gs = e.detail;
  const el = document.getElementById("game-status");
  if (el) el.textContent =
    `Q${gs.quarter} · ${gs.minutesLeft} min left · Live`;
  updateGateOverlay(getLiveContext().gates);
});

window.addEventListener("stadium-alert", e => {
  document.getElementById("alert-text").textContent = e.detail.message;
  document.getElementById("alert-banner").hidden = false;
  setTimeout(() => {
    document.getElementById("alert-banner").hidden = true;
  }, 10_000);
});

export async function handleSubmit(e) {
  e.preventDefault();
  const input = document.getElementById("user-input");
  const raw   = input.value.trim();
  if (!raw) return;
  input.value = "";
  const text = sanitise(raw);
  appendMessage(text, "user");
  const thinking = appendMessage("...", "bot");
  try {
    const intent = classifyIntent(text);
    const ctx    = getLiveContext();
    if (intent === "navigation" || intent === "exit") {
      const destSection = _extractSection(text, ctx);
      if (destSection) {
        const route = await computeRoute(
          { lat: 12.9716, lng: 77.5946 },
          { lat: destSection.lat, lng: destSection.lng }
        );
        ctx.routeInfo = route.summary;
        focusLocation(destSection.lat, destSection.lng);
      }
    }
    const reply = await askGemini(text, ctx);
    thinking.textContent = reply;
  } catch {
    thinking.textContent = "Sorry, I couldn't get that. Please try again.";
  }
}

window.quickAsk = function(q) {
  document.getElementById("user-input").value = q;
  handleSubmit({ preventDefault: () => {} });
};

window.dismissAlert = function() {
  document.getElementById("alert-banner").hidden = true;
};

window.onMapsLoaded = async function() {
  const { initMap } = await import("./maps.js");
  initMap();
};

window.handleSubmit = handleSubmit;

function appendMessage(text, role, isProactive = false) {
  const log = document.getElementById("messages");
  const div = document.createElement("div");
  div.className = `msg msg--${role}${isProactive ? " msg--proactive" : ""}`;
  div.textContent = text;
  if (role === "bot") div.setAttribute("role", "status");
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
  return div;
}

function sanitise(t) {
  return t.replace(/[<>&"'`]/g, "").substring(0, 300).trim();
}

function _extractSection(text, ctx) {
  const m = text.match(/section\s*(\w+)/i);
  if (m) return window.STADIUM?.sections?.find(s => s.id === m[1].toUpperCase()) || null;
  return null;
}
