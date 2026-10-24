const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const guidance = require("../demo-guidance.js");
const source = fs.readFileSync(path.join(root, "demo-guidance.js"), "utf8");
const css = fs.readFileSync(path.join(root, "demo-guidance.css"), "utf8");
const pages = Object.fromEntries(
  ["index.html", "patrol.html", "reports.html"].map((file) => [
    file,
    fs.readFileSync(path.join(root, file), "utf8"),
  ])
);

test("Guard guidance is enabled only by trusted Preview session state", () => {
  assert.equal(guidance.isPreviewSession({ guard: { access_mode: "read_only" } }), true);
  assert.equal(guidance.isPreviewSession({ guard: { access_mode: "standard" } }), false);
  assert.equal(guidance.isPreviewSession({ guard: { role: "guard" } }), false);
  assert.equal(guidance.isPreviewSession(null), false);
  assert.doesNotMatch(source, /[?&]demo=true/);
  assert.doesNotMatch(source, /localStorage/);
});

test("all Guard surfaces have distinct bilingual operational guidance", () => {
  for (const id of ["guardHome", "patrolBoard", "shiftReport"]) {
    const guide = guidance.guides[id];
    assert.ok(guide, `missing guide ${id}`);
    for (const language of ["en", "gr"]) {
      assert.ok(guide.title[language]);
      assert.ok(guide.intro[language]);
      assert.ok(guide.seeing[language].length);
      assert.ok(guide.howItWorks[language].length);
      assert.ok(guide.value[language].length);
      assert.match(guide.demoLimitations[language].body, /read-only|μόνο για ανάγνωση/i);
    }
  }
  assert.equal(guidance.resolveLanguage("el-GR"), "gr");
  assert.equal(guidance.resolveLanguage("en-US"), "en");
});

test("each Guard page loads the shared layer and its correct guide", () => {
  const expected = {
    "index.html": "guardHome",
    "patrol.html": "patrolBoard",
    "reports.html": "shiftReport",
  };
  for (const [file, guideId] of Object.entries(expected)) {
    assert.match(pages[file], /demo-guidance\.css/);
    assert.match(pages[file], /demo-guidance\.js/);
    assert.match(pages[file], new RegExp(`guideId:\\s*["']${guideId}["']`));
  }
});

test("welcome is once per preview session and repeated mounts are idempotent", () => {
  assert.match(source, /sessionStorage\.getItem\(welcomeKey\)/);
  assert.match(source, /sessionStorage\.setItem\(welcomeKey, "dismissed"\)/);
  assert.match(source, /mounted\?\.key === mountKey/);
  assert.match(source, /sessionIdentity \|\| "active"/);
});

test("drawer and mobile sheet provide keyboard, focus and scroll safeguards", () => {
  assert.match(source, /role", "dialog"/);
  assert.match(source, /aria-modal", "true"/);
  assert.match(source, /event\.key === "Escape"/);
  assert.match(source, /event\.key !== "Tab"/);
  assert.match(source, /document\.body\.style\.overflow = "hidden"/);
  assert.match(source, /returnFocus\?\.focus\(\)/);
  assert.match(css, /min-height:44px/);
  assert.match(css, /@media \(max-width:390px\)/);
  assert.match(css, /@media \(min-width:769px\)/);
  assert.match(css, /overflow-y:auto/);
  assert.doesNotMatch(css, /overflow-x:(scroll|auto)/);
});

test("the guidance remains presentation-only and existing read-only gates remain", () => {
  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.match(pages["index.html"], /alertButtonEl\.disabled = readOnly/);
  assert.match(pages["patrol.html"], /scanPanel\.style\.display =\s*readOnly \? "none" : ""/);
  assert.match(pages["reports.html"], /if\(readOnly\)return/);
});

test("Greek section headings are deterministic across viewports and preserve English text", () => {
  assert.equal(guidance.displayDemoHeading(undefined, "gr"), undefined);
  const examples = [
    ["Τι βλέπετε", "ΤΙ ΒΛΕΠΕΤΕ"],
    ["Πώς λειτουργεί", "ΠΩΣ ΛΕΙΤΟΥΡΓΕΙ"],
    ["Επιχειρησιακή αξία", "ΕΠΙΧΕΙΡΗΣΙΑΚΗ ΑΞΙΑ"],
    ["Λειτουργία επίδειξης", "ΛΕΙΤΟΥΡΓΙΑ ΕΠΙΔΕΙΞΗΣ"],
  ];
  for (const [original, expected] of examples) {
    assert.equal(guidance.displayDemoHeading(original, "gr"), expected);
    assert.equal(guidance.displayDemoHeading(original.normalize("NFD"), "gr"), expected);
    assert.equal(guidance.displayDemoHeading(original, "en"), original);
  }
  assert.equal(guidance.displayDemoHeading("What you're seeing", "en"), "What you're seeing");
  assert.equal(guidance.displayDemoHeading("How it works", "en"), "How it works");
  assert.equal(guidance.displayDemoHeading("Operational value", "en"), "Operational value");
  assert.match(source, /heading\.textContent = displayDemoHeading\(title, language\)/);
  assert.doesNotMatch(source, /demo-heading-(desktop|mobile)/);
  assert.doesNotMatch(css, /demo-heading-(desktop|mobile)/);
  assert.match(source, /element\("h2", "", guide\.title\[language\]\)/);
  assert.match(source, /element\("p", "demo-guidance-intro", guide\.intro\[language\]\)/);
});
