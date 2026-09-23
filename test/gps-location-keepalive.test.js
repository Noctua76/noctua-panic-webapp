const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "../index.html"), "utf8");

test("GPS keepalive refreshes independently every sixty seconds", () => {
  assert.match(source, /GUARD_LOCATION_KEEPALIVE_INTERVAL_MS = 60000/);
  assert.match(source, /guardLocationKeepaliveTimer = setInterval\(\s*refreshGuardLocationNow,\s*GUARD_LOCATION_KEEPALIVE_INTERVAL_MS/);
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
  assert.match(stopSource, /clearGuardLocationPendingState\(\)/);
  assert.match(stopSource, /clearTimeout\(guardLocationResumeTimer\)/);
});

function createLifecycleHarness() {
  const start = source.indexOf("let guardHeartbeatTimer = null");
  const end = source.indexOf("async function sendGuardHeartbeat", start);
  const lifecycleSource = source.slice(start, end);
  const calls = {
    clearWatch: [],
    fetch: 0,
    getCurrentPosition: [],
    intervals: [],
    timeouts: [],
    watchPosition: [],
  };
  let nextTimerId = 1;
  let nextWatchId = 10;
  const context = vm.createContext({
    BACKEND_BASE: "https://example.test",
    Date,
    Math,
    Promise,
    console: { log() {}, warn() {}, error() {} },
    currentGuardSession: {
      guard: { id: "guard-1" },
      session: { id: "session-1" },
    },
    expireGuardSession() {},
    expireTemporaryAccess() {},
    fetch: async () => {
      calls.fetch += 1;
      return { ok: true, status: 200, json: async () => ({ status: "ok" }) };
    },
    getGuardAuthHeaders: () => ({}),
    gpsStatusEl: { textContent: "" },
    isReadOnlyGuardSession: () => false,
    navigator: {
      geolocation: {
        clearWatch(id) { calls.clearWatch.push(id); },
        getCurrentPosition(success, error, options) {
          calls.getCurrentPosition.push({ success, error, options });
        },
        watchPosition(success, error, options) {
          const id = nextWatchId++;
          calls.watchPosition.push({ id, success, error, options });
          return id;
        },
      },
    },
    clearInterval() {},
    clearTimeout() {},
    setInterval(callback, delay) {
      const id = nextTimerId++;
      calls.intervals.push({ id, callback, delay });
      return id;
    },
    setTimeout(callback, delay) {
      const id = nextTimerId++;
      calls.timeouts.push({ id, callback, delay });
      return id;
    },
  });
  vm.runInContext(lifecycleSource, context);
  return { calls, context, run: (code) => vm.runInContext(code, context) };
}

test("resume events debounce into one recovery and restart watcher and keepalive", () => {
  const harness = createLifecycleHarness();
  harness.run("startGuardLocationTracking()");
  assert.equal(harness.calls.watchPosition.length, 1);
  assert.equal(harness.calls.intervals.length, 1);

  harness.run("resumeGuardLocationTracking(); resumeGuardLocationTracking(); resumeGuardLocationTracking()");
  assert.equal(harness.calls.timeouts.length, 1);
  assert.equal(harness.calls.timeouts[0].delay, 1500);
  harness.calls.timeouts[0].callback();

  assert.equal(harness.calls.watchPosition.length, 2);
  assert.equal(harness.calls.intervals.length, 2);
  assert.equal(harness.calls.clearWatch.length, 1);
});

test("stale pending request permits recovery without an old callback clearing the new request", () => {
  const harness = createLifecycleHarness();
  harness.run("refreshGuardLocationNow()");
  assert.equal(harness.calls.getCurrentPosition.length, 1);
  harness.run("guardLocationRefreshStartedAt = Date.now() - GUARD_LOCATION_REFRESH_STALE_MS - 1; refreshGuardLocationNow()");
  assert.equal(harness.calls.getCurrentPosition.length, 2);

  harness.calls.getCurrentPosition[0].error({ code: 3, message: "old timeout" });
  assert.equal(harness.run("guardLocationRefreshPending"), true);
  harness.calls.getCurrentPosition[1].error({ code: 3, message: "new timeout" });
  assert.equal(harness.run("guardLocationRefreshPending"), false);
  assert.equal(harness.context.gpsStatusEl.textContent, "Timed out");
});

test("GPS errors are visible and a successful send reports live accuracy", async () => {
  const harness = createLifecycleHarness();
  harness.run("refreshGuardLocationNow()");
  harness.calls.getCurrentPosition[0].error({ code: 1, message: "denied" });
  assert.equal(harness.context.gpsStatusEl.textContent, "Permission denied");

  harness.run("refreshGuardLocationNow()");
  harness.calls.getCurrentPosition[1].success({
    coords: { latitude: 38, longitude: 23, accuracy: 17, speed: null },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(harness.calls.fetch, 1);
  assert.equal(harness.context.gpsStatusEl.textContent, "Live · 17m");
});

test("logout cleanup invalidates late position callbacks", async () => {
  const harness = createLifecycleHarness();
  harness.run("startGuardLocationTracking(); resumeGuardLocationTracking(); stopGuardLocationTracking(); currentGuardSession = null");
  harness.calls.getCurrentPosition[0].success({
    coords: { latitude: 38, longitude: 23, accuracy: 20, speed: null },
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(harness.calls.fetch, 0);
  assert.equal(harness.run("guardLocationWatchId"), null);
  assert.equal(harness.run("guardLocationKeepaliveTimer"), null);
  assert.equal(harness.run("guardLocationResumeTimer"), null);
  assert.equal(harness.run("guardLocationRefreshPending"), false);
});

test("callbacks from an old session cannot send after a new login", async () => {
  const harness = createLifecycleHarness();
  harness.run("startGuardLocationTracking()");
  const oldRefresh = harness.calls.getCurrentPosition[0];
  const oldWatcher = harness.calls.watchPosition[0];

  harness.run(`
    stopGuardLocationTracking();
    currentGuardSession = { guard: { id: "guard-2" }, session: { id: "session-2" } };
    startGuardLocationTracking();
  `);
  oldRefresh.success({ coords: { latitude: 38, longitude: 23, accuracy: 20, speed: null } });
  oldWatcher.success({ coords: { latitude: 38, longitude: 23, accuracy: 20, speed: null } });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(harness.calls.fetch, 0);
});

test("logout stops heartbeat and location tracking", () => {
  const start = source.indexOf("async function logoutGuard()");
  const end = source.indexOf("let guardHeartbeatTimer", start);
  const logoutSource = source.slice(start, end);

  assert.match(logoutSource, /stopGuardHeartbeat\(\)/);
  assert.match(logoutSource, /stopGuardLocationTracking\(\)/);
});

test("foreground lifecycle events are wired to GPS recovery", () => {
  assert.match(source, /visibilitychange[\s\S]{0,500}resumeGuardLocationTracking\(\)/);
  assert.match(source, /addEventListener\("focus"[\s\S]{0,200}resumeGuardLocationTracking\(\)/);
  assert.match(source, /addEventListener\("pageshow"[\s\S]{0,350}resumeGuardLocationTracking\(\)/);
  assert.match(source, /addEventListener\("online"[\s\S]{0,200}resumeGuardLocationTracking\(\)/);
});
