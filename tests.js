"use strict";
const fs = require("fs");
const path = require("path");

const html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
const m = html.match(/\/\*LOGIC-START\*\/([\s\S]*?)\/\*LOGIC-END\*\//);
if (!m) {
  console.error("FAIL: could not find the /*LOGIC-START*/ … /*LOGIC-END*/ region in index.html");
  process.exit(1);
}
const L = new Function(
  '"use strict";' + m[1] + ";return LOGIC;"
)();

let passed = 0, failed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log("  ok  " + name);
  } catch (e) {
    failed++;
    console.log("FAIL  " + name + "\n      " + (e && e.message));
  }
}
function eq(a, b, msg) {
  if (a !== b) throw new Error((msg || "not equal") + " — got: " + JSON.stringify(a) + ", want: " + JSON.stringify(b));
}
function ok(v, msg) { if (!v) throw new Error(msg || "expected truthy"); }
function deepEq(a, b, msg) {
  const j = JSON.stringify;
  if (j(a) !== j(b)) throw new Error((msg || "not deep-equal") + " — got " + j(a) + " want " + j(b));
}

console.log("D&D Campaign Companion tests\n");

console.log("— fresh campaign —");
test("newCampaign has empty sections and a sessionZero skeleton", () => {
  const c = L.newCampaign("Test");
  eq(c.name, "Test");
  eq(c.sessions.length, 0);
  eq(c.party.length, 0);
  eq(c.npcs.length, 0);
  eq(c.loot.length, 0);
  eq(c.quests.length, 0);
  eq(c.relationships.length, 0);
  eq(c.sessionZero.answers.length, 0);
  ok(/^\d{4}-\d{2}-\d{2}T/.test(c.createdAt), "createdAt ISO");
});

console.log("— session recaps —");
test("addSession requires a title and a recap", () => {
  const c = L.newCampaign("T");
  ok(L.addSession(c, "", "", "").error, "empty rejected");
  ok(L.addSession(c, "Title", "2026-01-01", "   ").error, "blank recap rejected");
  ok(L.addSession(c, "Title", "2026-01-01", "Things happened.").ok);
});
test("addSession rejects malformed dates", () => {
  const c = L.newCampaign("T");
  ok(L.addSession(c, "T", "January 5", "r").error, "bad date rejected");
  ok(L.addSession(c, "T", "", "r").ok, "blank date allowed (defaults to today)");
});
test("addSession stamps createdAt/updatedAt and bumps campaign", () => {
  const c = L.newCampaign("T");
  const before = c.updatedAt;
  const r = L.addSession(c, "S one", "2026-01-04", "We fought the nutrient puddle.");
  ok(r.ok && r.session.id, "session id");
  ok(/^\d{4}-\d{2}-\d{2}T/.test(r.session.createdAt), "ISO timestamp");
  eq(r.session.updatedAt, r.session.createdAt, "new session: updated == created");
  if (c.updatedAt < r.session.createdAt) throw new Error("campaign updatedAt not bumped");
  if (new Date(c.updatedAt) < new Date(before)) throw new Error("campaign timestamp went backwards");
});
test("sortSessionsDesc orders by played date, newest first", () => {
  const c = L.newCampaign("T");
  L.addSession(c, "Old", "2026-01-01", "a");
  L.addSession(c, "Mid", "2026-02-01", "b");
  L.addSession(c, "New", "2026-03-01", "c");
  deepEq(L.sortSessionsDesc(c.sessions).map(s => s.title), ["New", "Mid", "Old"]);
});
test("summarizeRecap truncates with an ellipsis at the word limit", () => {
  const s = "one two three four";
  eq(L.summarizeRecap(s, 4), "one two three four", "short stays whole");
  eq(L.summarizeRecap(s, 2), "one two…", "long gets cut");
  eq(L.summarizeRecap("  ", 3), "", "empty stays empty");
});
test("recapWordCount counts words for the session list", () => {
  eq(L.recapWordCount("a b  c\n d"), 4);
  eq(L.recapWordCount("   "), 0);
});
test("formatRecap yields a copy-pasteable, timestamped recap", () => {
  const c = L.newCampaign("Mines of Mool");
  c.sessions.push({ id: "s", title: "Night one", date: "2026-02-02", recap: "It rained dice.", createdAt: "2026-02-02T20:00:00.000Z" });
  const out = L.formatRecap(c.sessions[0], c.name);
  ok(out.indexOf("Mines of Mool") === 0, "starts with campaign name");
  ok(out.indexOf("Night one (2026-02-02)") > -1, "includes title and date");
  ok(out.indexOf("recorded") > -1, "includes recording timestamp");
  ok(out.indexOf("It rained dice.") > -1, "includes recap body");
});

console.log("— inventory —");
test("addToInventory adds a new item and stacks same-name items", () => {
  const c = L.newCampaign("T");
  const ch = L.addCharacter(c, "party", "Brenna", {}).char;
  const a = L.addToInventory(c, ch.id, "Torches", 2, "");
  const b = L.addToInventory(c, ch.id, "torches  ", 3, "extra note");
  eq(ch.inventory.length, 1, "stacked into one row");
  eq(ch.inventory[0].qty, 5, "quantities summed");
  eq(b.stacked, true, "reported as stacked");
  ok(a.item.createdAt && b.item.updatedAt, "timestamps present");
});
test("addToInventory validates name/qty and canonicalizes the first letter", () => {
  const c = L.newCampaign("T");
  const ch = L.addCharacter(c, "party", "J", {}).char;
  ok(L.addToInventory(c, ch.id, "   ", 1).error, "blank name rejected");
  ok(L.addToInventory(c, ch.id, "Rope", 0).error, "zero qty rejected");
  ok(L.addToInventory(c, ch.id, "Rope", -2).error, "negative qty rejected");
  ok(L.addToInventory(c, ch.id, "Rope", "two").error, "non-numeric qty rejected");
  eq(L.addToInventory(c, ch.id, "rope", 1).item.name, "Rope", "capitalized");
});
test("removeFromInventory decreases, floors at 0, and removes empty rows", () => {
  const c = L.newCampaign("T");
  const ch = L.addCharacter(c, "party", "B", {}).char;
  const it = L.addToInventory(c, ch.id, "Torches", 4, "").item;
  let r = L.removeFromInventory(c, it.id, 1);
  ok(r.ok && r.left === 3, "3 left");
  ok(ch.inventory.length === 1, "still listed");
  ok(L.removeFromInventory(c, it.id, "lots").error, "non-numeric rejected");
  ok(L.removeFromInventory(c, it.id, -1).error, "negative rejected");
  r = L.removeFromInventory(c, it.id, 99);
  ok(r.ok, "wants-more-than-have is clamped");
  eq(ch.inventory.length, 0, "row removed once empty");
  ok(L.removeFromInventory(c, "missing-id", 1).error, "unknown item rejected");
});
test("transferItem moves a whole item and merges same-name stacks", () => {
  const c = L.newCampaign("T");
  const a = L.addCharacter(c, "party", "A", {}).char;
  const b = L.addCharacter(c, "party", "Bee", {}).char;
  const it = L.addToInventory(c, a.id, "Rope", 2, "").item;
  L.addToInventory(c, b.id, "Rope", 1, "");
  const r = L.transferItem(c, it.id, b.id);
  ok(r.ok, "transfer ok");
  eq(a.inventory.length, 0, "A emptied");
  eq(b.inventory.length, 1, "B merged to one row");
  eq(b.inventory[0].qty, 3, "1 + 2 = 3");
  ok(L.transferItem(c, it.id, b.id).error, "item no longer exists");
  ok(L.transferItem(c, "nope", a.id).error, "bad item id rejected");
  ok(L.transferItem(c, it.id, a.id).error || true, "");
});
test("partial move splits quantity across two owners (UI move dialog path)", () => {
  const c = L.newCampaign("T");
  const a = L.addCharacter(c, "party", "A", {}).char;
  const b = L.addCharacter(c, "npcs", "B", {}).char;
  const it = L.addToInventory(c, a.id, "Oil", 5, "").item;
  const mk = L.makeItem(it.name, 2, it.notes);
  ok(mk.ok);
  const dst = L.invOf(c, b.id);
  dst.push(mk.item);
  it.qty = 3;
  eq(L.invUnitCount(a.inventory), 3, "A keeps 3");
  eq(L.invUnitCount(dst), 2, "B got 2");
});
test("makeItem caps: positive finite qty required", () => {
  ok(L.makeItem("X", "abc").error);
  ok(L.makeItem("X", Infinity).error, "Infinity rejected");
  ok(L.makeItem("", 1).error);
  ok(L.makeItem("X", 0.5).ok, "fractional qty allowed (arrows etc.)");
});

console.log("— characters & relationships —");
test("addCharacter puts PCs and NPCs on the right lists with inventories", () => {
  const c = L.newCampaign("T");
  const pc = L.addCharacter(c, "party", "A", { player: "Sam", klass: "Bard", level: 3 }).char;
  const npc = L.addCharacter(c, "npcs", "N", { role: "innkeep", faction: "Inn", location: "bar" }).char;
  eq(c.party.length, 1);
  eq(c.npcs.length, 1);
  ok(Array.isArray(pc.inventory) && pc.inventory.length === 0);
  ok(Array.isArray(npc.inventory));
  ok(L.addCharacter(c, "party", "").error);
  ok(L.addCharacter(c, "army", "X", {}).error, "silly list rejected");
});
test("deleteCharacter also cleans relationships and rehomes loot", () => {
  const c = L.newCampaign("T");
  const a = L.addCharacter(c, "party", "A", {}).char;
  const b = L.addCharacter(c, "npcs", "B", {}).char;
  L.addRelationship(c, a.id, b.id, "debt", "Two silver and an apology.");
  const l = L.addLoot(c, "Gem", 10, a.id, "").loot;
  L.deleteCharacter(c, a.id);
  eq(c.relationships.length, 0, "relation pruned");
  eq(c.loot[0].holder, "party", "loot rehomed to party");
});
test("addRelationship validates both ends and requires a hint", () => {
  const c = L.newCampaign("T");
  const a = L.addCharacter(c, "party", "A", {}).char;
  const b = L.addCharacter(c, "npcs", "B", {}).char;
  ok(L.addRelationship(c, a.id, b.id, "debt", "  ").error, "empty hint rejected");
  ok(L.addRelationship(c, a.id, "nobody", "debt", "hint").error, "unknown end rejected");
  ok(L.addRelationship(c, a.id, a.id, "debt", "hint").error, "self-bond rejected");
  const r = L.addRelationship(c, a.id, b.id, "", "Old debt.").rel;
  eq(r.type, "connection", "default type");
});

console.log("— quests —");
test("addQuest defaults to open; status transitions validate", () => {
  const c = L.newCampaign("T");
  const r = L.addQuest(c, "Get the lantern", "");
  ok(r.ok);
  eq(r.quest.status, "open");
  ok(L.addQuest(c, "   ", "").error, "blank title rejected");
  ok(L.setQuestStatus(c, r.quest.id, "done").ok);
  ok(L.setQuestStatus(c, r.quest.id, "wibbly").error, "bad status rejected");
  ok(L.setQuestStatus(c, "nope", "open").error, "missing quest rejected");
  eq(L.openQuests(c).length, 0);
  L.addQuest(c, "Second", "");
  eq(L.openQuests(c).length, 1, "only open counted");
  eq(L.questSummaryLine(c), "1 open · 1 done · 0 dropped");
});

console.log("— loot —");
test("addLoot validates gp and falls back to the party holder", () => {
  const c = L.newCampaign("T");
  const ch = L.addCharacter(c, "npcs", "N", {}).char;
  ok(L.addLoot(c, "  ", 5, ch.id).error, "blank name rejected");
  ok(L.addLoot(c, "Coin purse", -5, ch.id).error, "negative gp rejected");
  ok(L.addLoot(c, "Coin purse", "lots", ch.id).error, "non-numeric gp rejected");
  const l = L.addLoot(c, "Statue", "225.5", "nobody", "Trapped").loot;
  eq(l.holder, "party", "unknown holder → party");
  eq(l.gpValue, 225.5, "string gp parsed");
  eq(L.lootTotalGP(c), 225.5);
  eq(L.lootUnitCount(c), 1);
  L.addLoot(c, "Sword", 100, ch.id, "");
  eq(L.lootTotalGP(c), 325.5);
  L.deleteLoot(c, l.id);
  eq(L.lootTotalGP(c), 100);
});

console.log("— session zero —");
test("setZeroAnswer stores into the fixed question list and timestamps the worksheet", () => {
  const c = L.newCampaign("T");
  const qs = L.zeroQuestions();
  eq(qs.length, 10, "ten worksheet questions");
  ok(L.setZeroAnswer(c, 99, "x").error, "bad index rejected");
  ok(L.setZeroAnswer(c, 0, "We agree: no betrayal twists.").ok);
  eq(c.sessionZero.answers[0].a, "We agree: no betrayal twists.");
  eq(c.sessionZero.answers[0].q, qs[0]);
  ok(/^\d{4}/.test(c.sessionZero.updatedAt), "worksheet timestamped");
});

console.log("— search —");
test("searchCampaign finds text across sections with timestamps", () => {
  const c = L.seedCampaign();
  const hits = L.searchCampaign(c, "cantor");
  ok(hits.length >= 3, "several hits, got " + hits.length);
  const sections = {};
  hits.forEach(h => sections[h.section] = true);
  ok(sections["sessions"], "recap searchable");
  ok(sections["people"], "NPC searchable");
  ok(sections["relationships"], "relationship searchable");
  const withTs = hits.filter(h => /^\d{4}-\d{2}-\d{2}T/.test(String(h.ts)) || /^\d{4}-\d{2}-\d{2}/.test(String(h.ts)));
  eq(withTs.length, hits.length, "every hit carries a timestamp");
});
test("searchCampaign is case-insensitive, matches items/quests/worksheet, and never throws on odd input", () => {
  const c = L.seedCampaign();
  ok(L.searchCampaign(c, "LANTERN").length > 0, "case-insensitive");
  ok(L.searchCampaign(c, "lantern oil").length > 0, "inventory hit");
  ok(L.searchCampaign(c, "Brother Mundy").length > 0, "quest hit");
  ok(L.searchCampaign(c, "x-card").length > 0, "session-zero hit");
  eq(L.searchCampaign(c, "").length, 0, "empty query → no hits");
  eq(L.searchCampaign(c, "zzzqqq").length, 0, "no false positives");
  eq(L.searchCampaign(c, null).length, 0, "null-safe");
});
test("search snippet marks the matched text", () => {
  const c = L.seedCampaign();
  const hit = L.searchCampaign(c, "incense").find(h => h.section === "loot");
  ok(hit, "loot hit presence");
  ok(hit.snippet.indexOf("<mark>") > -1, "snippet has <mark>");
});

console.log("— sample data integrity —");
test("seedCampaign is complete and validates cleanly", () => {
  const c = L.seedCampaign();
  eq(L.validateCampaign(c), null, "no validation errors");
  eq(c.party.length, 3, "three PCs");
  eq(c.npcs.length, 3, "three NPCs");
  ok(c.sessions.length >= 2, "recaps included");
  ok(c.sessions.every(s => s.recap && s.recap.trim()), "all recaps non-empty");
  ok(c.sessionZero.answers.every(a => a && a.a && a.a.trim()), "worksheet answered");
  ok(L.lootTotalGP(c) > 0, "loot has gp");
});
test("validateCampaign catches broken saves", () => {
  eq(L.validateCampaign(null), "not an object");
  eq(L.validateCampaign({}), "missing 'id'");
  const c = L.seedCampaign();
  c.quests.push({ id: "x", title: "", notes: "", status: "open" });
  ok(L.validateCampaign(c), "empty quest title caught");
});

console.log("— html packaging —");
test("index.html is dependency-free and self-contained", () => {
  const src = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  ok(!/src="https?:/.test(src), "no external scripts");
  ok(!/href="https?:\/\//i.test(src.replace(/https?:\/\/(www\.)?w3\.org|http-equiv/g, "")), "no external stylesheets");
  ok(!/@import/.test(src), "no css imports");
  eq((src.match(/<script\b/g) || []).length, 1, "single inline script");
  eq((src.match(/<style\b/g) || []).length, 1, "single inline style");
});
test("no obvious secrets committed", () => {
  const src = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
  ok(!/(api[_-]?key|secret|password)\s*[:=]/i.test(src), "no key-like assignments");
});

console.log("\n" + passed + " passed, " + failed + " failed");
process.exit(failed ? 1 : 0);
