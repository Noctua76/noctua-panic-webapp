const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");

test("GPS keepalive refreshes independently every sixty seconds", () => {
  assert.match(source, /GUARD_LOCATION_KEEPALIVE_INTERVAL_MS = 60000/);
  assert.match(source, /guardLocationKeepaliveTimer = setInterval\(\s*refreshGuardLocation,\s*GUARD_LOCATION_KEEPALIVE_INTERVAL_MS/);
  assert.match(source, /navigator\.geolocation\.getCurrentPosition\(/);
  assert.match(source, /navigator\.geolocation\.watchPosition\(/);
});

test("location keepalive is separate from the thirty-second guard heartbeat", () => {
  assert.match(source, /guardHeartbeatTimer = setInterval\(\(\) => \{\s*sendGuardHeartbeat\(\);\s*\}, 30000\)/);
  assert.doesNotMatch(source, /sendGuardHeartbeat\([\s\S]{0,120}sendGuardLocation/);
});

test("stopping location tracking clears both watcher and keepalive timer", () => {
  const start = source.indexOf("function stopGuardLocationTracking()");
  const end = source.indexOf("async function sendGuardHeartbeat", start);
  const stopSource = source.slice(start, end);

  assert.match(stopSource, /navigator\.geolocation\.clearWatch\(guardLocationWatchId\)/);
  assert.match(stopSource, /clearInterval\(guardLocationKeepaliveTimer\)/);
  assert.match(stopSource, /guardLocationRefreshPending = false/);
});

test("logout stops heartbeat and location tracking", () => {
  const start = source.indexOf("async function logoutGuard()");
  const end = source.indexOf("let guardHeartbeatTimer", start);
  const logoutSource = source.slice(start, end);

  assert.match(logoutSource, /stopGuardHeartbeat\(\)/);
  assert.match(logoutSource, /stopGuardLocationTracking\(\)/);
});
