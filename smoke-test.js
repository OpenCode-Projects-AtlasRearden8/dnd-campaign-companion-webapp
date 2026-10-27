"use strict";
/* Smoke test: boots the app's UI in a crude DOM shim. Catches runtime errors in
   load/seed/render/search paths without any dependencies. Run: node smoke-test.js */
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const script = html.match(/<script>([\s\S]*)<\/script>/)[1];

function makeEl(tag) {
  const el = {
    tagName: (tag || "div").toUpperCase(),
    children: [],
    style: {},
    dataset: {},
    id: "",
    textContent: "",
    value: "",
    hidden: false,
    files: null,
    attachShadow: null,
    setAttribute(k, v) { this.attrs = this.attrs || {}; this.attrs[k] = v; if (k === "id") this.id = v; },
    getAttribute(k) { return (this.attrs || {})[k]; },
    removeAttribute(k) { if (this.attrs) delete this.attrs[k]; },
    addEventListener(type, fn) { this.H = this.H || {}; (this.H[type] = this.H[type] || []).push(fn); },
    removeEventListener() {},
    appendChild(c) { this.children.push(c); return c; },
    insertBefore(c) { this.children.unshift(c); return c; },
    remove() {},
    click() {},
    showModal() {},
    close() {},
    focus() {},
    scrollIntoView() {},
    querySelector(sel) { return makeEl("fake"); },
    querySelectorAll() { return []; },
    closest() { return null; }
  };
  Object.defineProperty(el, "innerHTML", {
    get() { return this._html || ""; },
    set(v) { this._html = String(v); }
  });
  Object.defineProperty(el, "readyState", { value: "complete" });
  return el;
}

const registry = {};
["main", "tabs", "campSelect", "searchBox", "searchResults", "newCampBtn", "delCampBtn", "exportBtn", "importBtn"]
  .forEach(id => registry[id] = makeEl("found-" + id));

const navButtons = ["sessions", "people", "items", "quests", "ties", "zero"].map(t => {
  const b = makeEl("button");
  b.dataset.tab = t;
  return b;
});

const store = {};
const sandboxWindow = {
  console: console,
  prompt: () => "",
  confirm: () => true,
  alert: () => {},
  navigator: { clipboard: { writeText: () => Promise.resolve() } },
  Blob: function () {},
  URL: { createObjectURL: () => "blob:x", revokeObjectURL: () => {} },
  FileReader: function () { this.readAsText = () => {}; },
  requestAnimationFrame: fn => setTimeout(fn, 0)
};
sandboxWindow.window = sandboxWindow;

const document = {
  readyState: "complete",
  body: makeEl("body"),
  getElementById(id) { return registry[id] || (registry[id] = makeEl(id)); },
  createElement(tag) { const e = makeEl(tag); if (e.id) registry[e.id] = e; return e; },
  querySelectorAll(sel) {
    if (sel === "nav button") return navButtons.slice();
    return [];
  },
  addEventListener(type, fn) { if (type === "keydown" && registry.searchBox) registry.searchBox.addEventListener(type, fn); },
  insertBefore(c) { this.body.children.push(c); }
};
const localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); },
  removeItem: k => { delete store[k]; }
};

let failed = 0;
function step(name, fn) {
  try {
    fn();
    console.log("  ok  " + name);
  } catch (e) {
    failed++;
    console.log("FAIL  " + name + "\n      " + (e && e.stack ? e.stack.split("\n").slice(0, 3).join(" | ") : e));
  }
}

let UI = null;

step("full script evaluates and boots without DOM errors", () => {
  new Function("window", "document", "localStorage", "navigator", "alert", "confirm", "prompt",
    "Blob", "URL", "FileReader", script)(sandboxWindow, document, localStorage, sandboxWindow.navigator,
    sandboxWindow.alert, sandboxWindow.confirm, sandboxWindow.prompt, sandboxWindow.Blob, sandboxWindow.URL,
    sandboxWindow.FileReader);
  UI = sandboxWindow.UI;
  if (!UI) throw new Error("UI not exported");
  if (!store["dnd-campaign-companion-v1"]) throw new Error("nothing saved to localStorage on boot");
  const saved = JSON.parse(store["dnd-campaign-companion-v1"]);
  if (!saved.campaigns || !saved.campaigns.length) throw new Error("seed campaign missing");
});

step("seeded campaign carries the sample one-shot", () => {
  const saved = JSON.parse(store["dnd-campaign-companion-v1"]);
  const c = saved.campaigns[0];
  if (!/Deepmoor/i.test(c.name)) throw new Error("unexpected seed name: " + c.name);
  if (!c.description) throw new Error("seed description missing");
});

step("every tab renders without template errors", () => {
  ["sessions", "people", "items", "quests", "ties", "zero"].forEach(t => {
    UI.jumpTab(t);
    const out = registry.main._html || "";
    if (out.length < 200) throw new Error("tab " + t + " rendered suspiciously little (" + out.length + " chars)");
  });
});

step("global search renders for a variety of queries", () => {
  ["cantor", "LANTERN", "incense", "jory", "zzz-not-there", ""].forEach(q => {
    registry.searchBox.value = q;
    fire(registry.searchBox, "input", { target: registry.searchBox, key: "" });
    const out = registry.searchResults._html || "";
    if (q && out.length < 60) throw new Error("search for '" + q + "' produced nothing");
  });
});

function fire(el, type, ev) {
  (el.H && el.H[type] || []).forEach(fn => fn.call(el, ev));
}

step("dialog helpers build forms without throwing", () => {
  UI.addSession();
  UI.addChar("party");
  UI.addChar("npcs");
  UI.addItem("pc-wick");
  UI.addLoot();
  UI.addQuest();
  UI.addTie();
  UI.newCampaign();
  sandboxWindow.__dialogs = document.body.children;
});

step("campaign switching works", () => {
  UI.switchCampaign("camp-deepmoor-sample");
  if (!JSON.parse(store["dnd-campaign-companion-v1"]).selected) throw new Error("selection not saved");
});

console.log(failed ? "\nsmoke test FAILED" : "\nsmoke test passed");
process.exit(failed ? 1 : 0);
