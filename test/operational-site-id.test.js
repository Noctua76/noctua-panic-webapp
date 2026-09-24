const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");
const start = source.indexOf("function formatGuardSiteLabel(guard)");
const end = source.indexOf("function showMainApp(sessionData)", start);
const format = vm.runInNewContext(`${source.slice(start, end)}\nformatGuardSiteLabel`);

test("guard sees stored operational site code and current location, never internal id", () => {
  assert.equal(format({ site_id: 4, site_code: "DEF-001", site_location: "Athens", company_status: "pilot" }),
    "DEF-001 · Athens");
  assert.equal(format({ site_id: 4, site_code: "DEF-001", site_location: "Athens North" }),
    "DEF-001 · Athens North");
  assert.equal(format({ site_id: 4, site_code: "DEF-001" }), "DEF-001");
  assert.equal(format({ site_id: 4 }), "-");
  assert.match(source, /guardSiteEl\.textContent = formatGuardSiteLabel\(sessionData\.guard\)/);
});
