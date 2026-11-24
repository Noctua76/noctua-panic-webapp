const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
function slice(start, end) {
  const a = source.indexOf(start), b = source.indexOf(end, a);
  assert.ok(a >= 0 && b > a);
  return source.slice(a, b);
}
const stateSource = slice('  // Questionnaire state must exist', 'let passwordSetupToken');
const sessionUISource = slice('function showMainApp(', 'let guardHeartbeatTimer');
const expirySource = slice('function expireGuardSession(', 'function expireTemporaryAccess');
const flowSource = slice('  const INCIDENT_DRAFT_PREFIX =', '  function renderPendingAlertNotifications');
const alertSource = slice('  async function triggerAlert()', '  // ===== Incident log');
const sendSource = slice('  async function sendIncidentToBackend(', '  // ===== LIVE CLOCK');
const resetSource = slice('  function resetWebAppUI()', '  /* =====================================================');
const timerSource = slice('  function startActiveTimer()', '  // ===== ALERT');
const questionsSource = slice('  const incidentQuestions =', '  </script>');
const tick = () => new Promise(resolve => setImmediate(resolve));

function setup({ ai = 'ok', submission = 'ok', preview = false, panicFails = false, storage = new Map(), now = 1795500100000 } = {}) {
  const elements = Object.fromEntries(['incident-assistant','assistant-question','assistant-progress','assistant-answer','assistant-next-btn','mainApp','loginScreen','passwordSetupScreen','guardName','guardSite','gpsStatus','guardPassword','passwordSetupGuard','passwordSetupError','newGuardPassword','confirmGuardPassword','statusCard','statusBadge','timeFromStart','callStatusList','smsStatusList'].map(id => {
    const classes = new Set(['hidden']);
    return [id, { value: '', textContent: '', disabled: false, classList: { add: x => classes.add(x), remove: x => classes.delete(x), contains: x => classes.has(x) }, addEventListener: (event, fn) => { elements[id][event] = fn; } }];
  }));
  const calls = [], timers = [], alerts = [], pending = [], microtasks = [];
  const renders = [], windowListeners = {}, intervals = new Map(), intervalHistory = [];
  let nextInterval = 1;
  let clock = now, nextIncident = 40;
  class ClockDate extends Date { static now() { return clock; } }
  const localStorage = { get length() { return storage.size; }, key: index => [...storage.keys()][index], getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  let resets = 0;
  const context = vm.createContext({
    document: { getElementById: id => elements[id] }, Date: ClockDate, localStorage,
    BACKEND_BASE: 'https://backend.test', SESSION_KEY: 'aegis_guard_session',
    currentGuardSession: { guard: { id: 1 }, session: { id: 253 } },
    latestGuardLocation: { latitude: 38, longitude: 23, accuracy: 10, battery: 90, timestamp: 'now' },
    isReadOnlyGuardSession: session => preview || (session ?? context.currentGuardSession)?.guard?.access_mode === 'read_only',
    loginScreen: elements.loginScreen, passwordSetupScreen: elements.passwordSetupScreen, mainApp: elements.mainApp,
    guardNameEl: elements.guardName, guardSiteEl: elements.guardSite, gpsStatusEl: elements.gpsStatus,
    guardPassword: elements.guardPassword, passwordSetupGuard: elements.passwordSetupGuard,
    passwordSetupError: elements.passwordSetupError, newGuardPassword: elements.newGuardPassword,
    confirmGuardPassword: elements.confirmGuardPassword, loginError: { textContent: '' },
    applyTemporaryAccessState: () => true, formatGuardSiteLabel: () => '-',
    startGuardHeartbeat() {}, stopGuardHeartbeat() {}, startGuardLocationTracking() {}, stopGuardLocationTracking() {},
    stopTemporaryAccessExpiryTimer() {}, clearGuardSessionStorage() {},
    window: { history: { replaceState() {} }, addEventListener: (name, fn) => { windowListeners[name] = fn; } },
    queueMicrotask: fn => microtasks.push(fn),
    getGuardAuthHeaders: () => ({ Authorization: 'Bearer test-token', 'Content-Type': 'application/json' }),
    statusCard: elements.statusCard, statusBadge: elements.statusBadge, startTimestamp: null, activeTimer: null,
    timeFromStartEl: elements.timeFromStart, callStatusList: elements.callStatusList, smsStatusList: elements.smsStatusList,
    recordReset: () => { resets++; },
    setInterval: (fn, delay) => { const id = nextInterval++; intervals.set(id, fn); intervalHistory.push({ id, fn, delay }); return id; },
    clearInterval: id => intervals.delete(id), renderPendingAlertNotifications() {}, renderAlertNotifications() { renders.push('success'); }, renderAlertFailure() { renders.push('failure'); },
    setTimeout: (fn, delay) => { timers.push({ fn, delay, dueAt: clock + delay }); },
    alert: text => alerts.push(text), console: { log() {}, error() {} },
    fetch: async (url, options) => {
      const body = JSON.parse(options.body);
      calls.push({ url, body, headers: options.headers });
      if (url.endsWith('/alert')) return { ok: !panicFails, json: async () => ({ incident: { id: String(nextIncident++) }, dispatch: {} }) };
      if (!body.incidentAnswers) {
        if (ai === 'timeout') return new Promise(() => {});
        return { ok: ai !== '429', status: ai === '429' ? 429 : 200, json: async () => ({ assistantLog: ai === 'quota-fallback' ? 'Assistant failed to process log' : 'Optional summary' }) };
      }
      if (submission === 'deferred') return new Promise((resolve, reject) => pending.push({ resolve, reject, body }));
      if (submission === 'network') throw new TypeError('Failed to fetch');
      return { ok: !['401','404','500'].includes(submission), status: Number(submission) || 200,
        json: async () => submission === 'bad-receipt' ? { status: 'ok', assistantLog: 'old response' }
          : { status: 'ok', incidentId: body.incidentId, responsesSaved: true, responseCount: 3 } };
    },
  });
  vm.runInContext(stateSource + sessionUISource + expirySource + resetSource + timerSource + 'showMainApp(currentGuardSession);' + flowSource + alertSource + sendSource + questionsSource + 'const actualReset = resetWebAppUI; resetWebAppUI = () => { recordReset(); actualReset(); };', context);
  return { elements, calls, timers, alerts, context, storage, pending, renders,
    intervalCount: () => intervals.size, oldInterval: index => intervalHistory[index].fn(),
    advance: ms => { clock += ms; for (const fn of intervals.values()) fn(); },
    storageEvent: key => windowListeners.storage({ key, storageArea: localStorage }),
    show: session => { context.nextSession = session; vm.runInContext('showMainApp(nextSession)', context); },
    logout: () => vm.runInContext('logoutGuard()', context),
    expire: () => vm.runInContext('expireGuardSession("expired")', context),
    flushRestore: () => { while (microtasks.length) microtasks.shift()(); }, now: () => clock, setSubmission: mode => { submission = mode; },
    timer: index => { clock = Math.max(clock, timers[index].dueAt); timers[index].fn(); },
    restore: () => vm.runInContext('restoreIncidentQuestionnaires()', context),
    enter: (text, advance = true) => { elements['assistant-answer'].value = text; elements['assistant-answer'].input({ target: elements['assistant-answer'] }); if (advance) elements['assistant-next-btn'].click(); },
    resets: () => resets,
    panic: () => vm.runInContext('handleAlertConfirmed()', context),
    start: () => { assert.equal(timers[0].delay, 15000); clock = timers[0].dueAt; timers[0].fn(); },
    answerAll: async () => { for (const answer of ['Test incident', 'Main entrance', 'Contacted supervisor']) { elements['assistant-answer'].value = answer; elements['assistant-next-btn'].click(); } await tick(); },
  };
}

for (const ai of ['ok', '429', 'quota-fallback', 'timeout']) {
  test(`panic/questionnaire/exact-incident submission does not depend on AI=${ai}`, async () => {
    const h = setup({ ai });
    await h.panic();
    assert.equal(h.calls[0].url, 'https://backend.test/alert');
    assert.equal(h.calls[0].body.latitude, 38);
    assert.equal(h.calls[0].body.sessionId, 253);
    assert.equal(h.alerts.length, 0, 'AI must never open a blocking alert');
    h.start();
    assert.equal(h.elements['incident-assistant'].classList.contains('hidden'), false);
    await h.answerAll();
    const submission = h.calls.find(call => call.body.incidentAnswers);
    assert.equal(submission.body.incidentId, 40);
    assert.equal(submission.body.sessionId, 253);
    assert.deepEqual(Object.keys(submission.body.incidentAnswers).sort(), ['actions_taken','incident_type','location']);
    assert.equal(h.resets(), 1);
    assert.equal(h.elements['incident-assistant'].classList.contains('hidden'), true);
    assert.equal(h.alerts.length, 1);
    assert.doesNotMatch(h.context.statusBadge.textContent, /Σφάλμα/);
  });
}

for (const submission of ['network','401','500','bad-receipt']) {
  test(`${submission}: failed/unconfirmed save cannot report success or discard answers`, async () => {
    const h = setup({ submission });
    await h.panic(); h.start(); await h.answerAll();
    assert.equal(h.alerts.length, 0);
    assert.equal(h.resets(), 0);
    assert.equal(h.elements['incident-assistant'].classList.contains('hidden'), false);
    assert.equal(h.elements['assistant-next-btn'].disabled, false);
    assert.equal(vm.runInContext('currentQuestionIndex', h.context), 2);
    assert.equal(vm.runInContext('incidentAnswers.incident_type', h.context), 'Test incident');
    h.elements['assistant-next-btn'].click(); await tick();
    const attempts = h.calls.filter(call => call.body.incidentAnswers);
    assert.equal(attempts.length, 2);
    assert.deepEqual(attempts[1].body, { ...attempts[0].body, timestamp: attempts[1].body.timestamp });
  });
}

test('Preview cannot activate panic or submit operational evidence', async () => {
  const h = setup({ preview: true });
  await h.panic();
  await assert.rejects(vm.runInContext('sendIncidentDetailsToBackend({})', h.context), /μόνο για προβολή/);
  assert.equal(h.calls.length, 0);
  assert.equal(h.timers.length, 0);
});

test('a different authenticated session cannot submit an old questionnaire', async () => {
  const h = setup(); await h.panic(); h.start();
  h.context.currentGuardSession = { guard: { id: 1 }, session: { id: 254 } };
  await h.answerAll();
  assert.equal(h.calls.filter(call => call.body.incidentAnswers).length, 0);
  assert.equal(h.resets(), 0);
});

test('a stale timer cannot show a questionnaire after session change', async () => {
  const h = setup(); await h.panic();
  h.context.currentGuardSession = null;
  h.start();
  assert.equal(h.elements['incident-assistant'].classList.contains('hidden'), true);
});

test('failed panic cannot create an unassociated questionnaire', async () => {
  const h = setup({ panicFails: true }); await h.panic();
  assert.equal(h.timers.length, 0);
});

test('a failed submission can be retried successfully without re-entering the answers', async () => {
  const h = setup({ submission: 'network' });
  await h.panic(); h.start(); await h.answerAll();
  assert.equal(h.resets(), 0);
  h.context.fetch = async (_url, options) => {
    const payload = JSON.parse(options.body);
    assert.equal(payload.incidentId, 40);
    assert.equal(payload.incidentAnswers.incident_type, 'Test incident');
    assert.equal(payload.incidentAnswers.location, 'Main entrance');
    assert.equal(payload.incidentAnswers.actions_taken, 'Contacted supervisor');
    return { ok: true, json: async () => ({ status: 'ok', incidentId: 40, responsesSaved: true, responseCount: 3 }) };
  };
  h.elements['assistant-next-btn'].click(); await tick();
  assert.equal(h.resets(), 1);
  assert.equal(h.alerts.length, 1);
  assert.equal(h.elements['incident-assistant'].classList.contains('hidden'), true);
});

for (const reverseTimers of [false, true]) {
  test(`consecutive panic activations retain both questionnaires (reverse callbacks=${reverseTimers})`, async () => {
    const h = setup();
    await h.panic(); await h.panic();
    h.timer(reverseTimers ? 1 : 0);
    h.enter('First type'); h.enter('Unfinished location', false);
    h.timer(reverseTimers ? 0 : 1);
    assert.equal(vm.runInContext('questionnaireFlow.incidentId', h.context), 40);
    assert.equal(h.elements['assistant-answer'].value, 'Unfinished location');
    h.enter('First location'); h.enter('First actions'); await tick();
    assert.equal(vm.runInContext('questionnaireFlow.incidentId', h.context), 41);
    await h.answerAll();
    const attempts = h.calls.filter(call => call.body.incidentAnswers);
    assert.deepEqual(attempts.map(call => call.body.incidentId), [40, 41]);
    assert.equal(attempts[0].body.incidentAnswers.incident_type, 'First type');
    assert.equal(h.storage.size, 0);
  });
}

test('second panic and both callbacks cannot replace pending or failed first submission', async () => {
  const h = setup({ submission: 'deferred' });
  await h.panic(); h.start(); await h.answerAll();
  await h.panic(); h.timer(1); h.timer(0);
  assert.equal(h.calls.filter(call => call.url.endsWith('/alert')).length, 2);
  assert.equal(vm.runInContext('questionnaireFlow.incidentId', h.context), 40);
  assert.equal(h.elements['assistant-next-btn'].disabled, true);
  h.pending[0].reject(new Error('Receipt lost')); await tick();
  assert.equal(h.alerts.length, 0);
  assert.equal(vm.runInContext('incidentAnswers.location', h.context), 'Main entrance');
  h.setSubmission('ok'); h.elements['assistant-next-btn'].click(); await tick();
  assert.equal(vm.runInContext('questionnaireFlow.incidentId', h.context), 41);
  await h.answerAll();
  assert.deepEqual(h.calls.filter(call => call.body.incidentAnswers).map(call => call.body.incidentId), [40, 40, 41]);
});

test('reload restores typed draft and each queued incident under the same session', async () => {
  const h = setup(); await h.panic(); h.start();
  h.enter('Saved type'); h.enter('Typed location', false);
  await h.panic(); h.timer(1);
  const restored = setup({ storage: h.storage, now: h.now() }); restored.restore(); restored.restore();
  assert.equal(vm.runInContext('incidentFlowQueue.length', restored.context), 2);
  assert.equal(vm.runInContext('questionnaireFlow.incidentId', restored.context), 40);
  assert.equal(restored.elements['assistant-answer'].value, 'Typed location');
  restored.enter('Saved location'); restored.enter('Saved actions'); await tick();
  assert.equal(vm.runInContext('questionnaireFlow.incidentId', restored.context), 41);
  await restored.answerAll();
  assert.equal(restored.storage.size, 0);
});

test('lost receipt survives reload and retry preserves incident, session and all answers', async () => {
  const h = setup({ submission: 'network' }); await h.panic(); h.start(); await h.answerAll();
  const restored = setup({ storage: h.storage, now: h.now() }); restored.restore();
  restored.elements['assistant-next-btn'].click(); await tick();
  const first = h.calls.find(call => call.body.incidentAnswers).body;
  const retry = restored.calls.find(call => call.body.incidentAnswers).body;
  assert.deepEqual(retry.incidentAnswers, first.incidentAnswers);
  assert.equal(retry.incidentId, first.incidentId);
  assert.equal(retry.sessionId, first.sessionId);
  assert.equal(restored.storage.size, 0);
});

test('old backend and backend rollback fail safely without invoking legacy answer persistence', async () => {
  const h = setup({ submission: '404' }); await h.panic(); h.start(); await h.answerAll();
  assert.equal(h.alerts.length, 0);
  assert.match(h.elements['assistant-progress'].textContent, /συμβατό backend/);
  const restored = setup({ submission: '404', storage: h.storage, now: h.now() }); restored.restore();
  restored.elements['assistant-next-btn'].click(); await tick();
  assert.equal(restored.storage.size, 1);
  for (const call of [...h.calls, ...restored.calls].filter(call => call.body.incidentAnswers)) {
    assert.equal(call.url, 'https://backend.test/incident-log/guard-responses');
  }
  restored.setSubmission('ok'); restored.elements['assistant-next-btn'].click(); await tick();
  assert.equal(restored.storage.size, 0);
});

test('another session or guard cannot restore or rebind stored questionnaires', async () => {
  const h = setup(); await h.panic(); h.start(); h.enter('Private draft', false);
  for (const session of [{ guard: { id: 2 }, session: { id: 253 } }, { guard: { id: 1 }, session: { id: 254 } }]) {
    const restored = setup({ storage: h.storage, now: h.now() });
    restored.context.currentGuardSession = session; restored.restore();
    assert.equal(restored.elements['incident-assistant'].classList.contains('hidden'), true);
    assert.equal(restored.calls.length, 0);
    assert.equal(restored.storage.size, 1);
  }
});

test('existing service worker controllerchange reload preserves a new-client questionnaire draft', async () => {
  const h = setup(); await h.panic(); h.start(); h.enter('Survives SW update', false);
  const swListeners = {}, windowListeners = {};
  let reloaded = false;
  const swSource = slice('if ("serviceWorker" in navigator)', '</script>');
  const context = vm.createContext({
    navigator: { serviceWorker: { controller: {}, addEventListener: (name, fn) => { swListeners[name] = fn; }, register: async () => ({ update: async () => {} }) } },
    window: { addEventListener: (name, fn) => { windowListeners[name] = fn; }, location: { reload: () => { reloaded = true; } } },
    document: { addEventListener() {} }, console: { log() {}, error() {} },
  });
  vm.runInContext(swSource, context); await windowListeners.load(); swListeners.controllerchange();
  assert.equal(reloaded, true);
  const restored = setup({ storage: h.storage, now: h.now() }); restored.restore();
  assert.equal(restored.elements['assistant-answer'].value, 'Survives SW update');
  assert.match(source, /queueMicrotask\(restoreIncidentQuestionnaires\)/);
});

test('session change while panic request is pending cannot rebind its questionnaire', async () => {
  const h = setup();
  let finishPanic;
  const originalFetch = h.context.fetch;
  h.context.fetch = (url, options) => url.endsWith('/alert')
    ? new Promise(resolve => { finishPanic = resolve; }) : originalFetch(url, options);
  const activation = h.panic();
  h.context.currentGuardSession = { guard: { id: 2 }, session: { id: 254 } };
  finishPanic({ ok: true, json: async () => ({ incident: { id: '40' }, dispatch: {} }) });
  await activation;
  assert.equal(h.timers.length, 0, "old activation must not schedule a current-view timer");
  const draft = JSON.parse([...h.storage.values()][0]);
  assert.equal(draft.sessionId, 253);
  assert.equal(draft.guardId, 1);
  assert.equal(h.elements['incident-assistant'].classList.contains('hidden'), true);
  assert.equal(h.calls.length, 0);
});

test('unavailable local storage does not block panic or in-memory completion', async () => {
  const h = setup();
  h.context.localStorage.setItem = () => { throw new Error('storage unavailable'); };
  h.context.localStorage.removeItem = () => { throw new Error('storage unavailable'); };
  await h.panic();
  assert.equal(h.calls.filter(call => call.url.endsWith('/alert')).length, 1);
  assert.match(h.context.statusBadge.textContent, /Μην κλείσεις/);
  h.start(); await h.answerAll();
  assert.equal(h.alerts.length, 1);
  assert.equal(h.resets(), 1);
});

function assertQuestionnaireCleared(h) {
  assert.equal(h.elements['incident-assistant'].classList.contains('hidden'), true);
  assert.equal(h.elements['assistant-answer'].value, '');
  assert.equal(h.elements['assistant-question'].textContent, '');
  assert.equal(h.elements['assistant-progress'].textContent, '');
  assert.equal(h.elements['assistant-answer'].disabled, true);
  assert.equal(h.elements['assistant-next-btn'].disabled, true);
  assert.equal(vm.runInContext('questionnaireFlow', h.context), null);
  assert.equal(vm.runInContext('activeIncidentFlow', h.context), null);
  assert.equal(vm.runInContext('Object.keys(incidentAnswers).length', h.context), 0);
}
function viewSnapshot(h) {
  return JSON.stringify({ elements: Object.fromEntries(Object.entries(h.elements).map(([id, e]) => [id, {
    value: e.value, text: e.textContent, disabled: e.disabled, hidden: e.classList.contains('hidden'),
  }])), badge: h.context.statusBadge.textContent, resets: h.resets(), alerts: h.alerts, renders: h.renders });
}

for (const transition of ['logout', 'expiry', 'missing session restore', 'Preview', 'another guard', 'another session']) {
  test(`${transition}: clear displayed answers but retain the unresolved original draft`, async () => {
    const h = setup(); await h.panic(); h.start(); h.enter('Private incident'); h.enter('Private draft location', false);
    const retained = [...h.storage.entries()];
    if (transition === 'logout') await h.logout();
    else if (transition === 'expiry') h.expire();
    else if (transition === 'missing session restore') { h.context.currentGuardSession = null; h.restore(); }
    else h.show(transition === 'Preview'
      ? { guard: { id: 1, access_mode: 'read_only' }, session: { id: 253 } }
      : { guard: { id: transition === 'another guard' ? 2 : 1 }, session: { id: transition === 'another guard' ? 253 : 254 } });
    assertQuestionnaireCleared(h);
    h.flushRestore(); assertQuestionnaireCleared(h);
    h.elements['assistant-next-btn'].click();
    assert.equal(h.calls.filter(call => call.body.incidentAnswers).length, 0);
    assert.deepEqual([...h.storage.entries()], retained);
    const flow = JSON.parse(retained[0][1]);
    assert.equal(flow.guardId, 1); assert.equal(flow.sessionId, 253); assert.equal(flow.incidentId, 40);
    const oldFlow = vm.runInContext('incidentFlowQueue[0]', h.context);
    assert.equal(oldFlow.answers.incident_type, 'Private incident');
    assert.equal(oldFlow.draft, 'Private draft location');
  });
}

test('application exposure is synchronous and startup does not depend on late state initialization', async () => {
  const h = setup(); await h.panic(); h.start(); h.enter('Private answer', false);
  const original = h.elements.mainApp.classList.remove;
  let exposed = false;
  h.elements.mainApp.classList.remove = name => {
    if (name === 'hidden') { assertQuestionnaireCleared(h); exposed = true; }
    original(name);
  };
  h.show({ guard: { id: 2 }, session: { id: 254 } });
  assert.equal(exposed, true);
  // Every setup already called the actual showMainApp before the late flow/questions declarations.
  assert.ok(source.indexOf('let incidentQuestionnaireSessionKey') < source.indexOf('const savedGuardSession ='));
});

test('read-only restore clears an already displayed questionnaire before its early return', async () => {
  const h = setup(); await h.panic(); h.start(); h.enter('Secret', false);
  h.context.currentGuardSession.guard.access_mode = 'read_only';
  h.restore(); assertQuestionnaireCleared(h);
  assert.equal(h.storage.size, 1);
});

test('old timer cannot reveal a new session questionnaire; only the new timer owns that view', async () => {
  const h = setup(); await h.panic();
  h.show({ guard: { id: 2 }, session: { id: 254 } }); await h.panic();
  const before = viewSnapshot(h);
  h.timer(0);
  assert.equal(viewSnapshot(h), before);
  assert.equal(vm.runInContext('questionnaireFlow', h.context), null);
  h.timer(1);
  assert.equal(vm.runInContext('questionnaireFlow.incidentId', h.context), 41);
  assert.equal(vm.runInContext('questionnaireFlow.sessionId', h.context), 254);
  assert.equal(h.elements['assistant-answer'].value, '');
  assert.equal(h.storage.size, 2);
});

for (const outcome of ['receipt', 'failure']) {
  test(`late ${outcome} and finally from an old submit cannot modify a new session's active questionnaire`, async () => {
    const h = setup({ submission: 'deferred' }); await h.panic(); h.start(); await h.answerAll();
    const originalDraft = [...h.storage.entries()][0];
    h.show({ guard: { id: 2 }, session: { id: 254 } }); await h.panic(); h.timer(1);
    h.enter('Second guard private draft', false);
    const before = viewSnapshot(h);
    if (outcome === 'receipt') h.pending[0].resolve({ ok: true, json: async () => ({ status: 'ok', incidentId: 40, responseCount: 3, responsesSaved: true }) });
    else h.pending[0].reject(new Error('old request failed'));
    await tick();
    assert.equal(viewSnapshot(h), before);
    assert.equal(h.storage.get(originalDraft[0]), originalDraft[1], 'stale view must leave the original draft available for a verified retry');
    assert.equal(vm.runInContext('questionnaireFlow.sessionId', h.context), 254);
  });
}

for (const outcome of ['receipt', 'failure']) {
  test(`late ${outcome} after expiry/Preview cannot re-enable cleared controls or expose answers`, async () => {
    const h = setup({ submission: 'deferred' }); await h.panic(); h.start(); await h.answerAll();
    h.expire(); h.show({ guard: { id: 2, access_mode: 'read_only' }, session: { id: 254 } });
    const before = viewSnapshot(h);
    if (outcome === 'receipt') h.pending[0].resolve({ ok: true, json: async () => ({ status: 'ok', incidentId: 40, responseCount: 3, responsesSaved: true }) });
    else h.pending[0].reject(new Error('failed'));
    await tick(); assertQuestionnaireCleared(h); assert.equal(viewSnapshot(h), before);
    assert.equal(h.storage.size, 1);
  });
}

for (const outcome of ['receipt', 'failure']) {
  test(`late panic ${outcome} cannot change another session's notification or questionnaire UI`, async () => {
    const h = setup(); let resolve, reject;
    h.context.fetch = () => new Promise((yes, no) => { resolve = yes; reject = no; });
    const activation = h.panic();
    h.show({ guard: { id: 2 }, session: { id: 254 } });
    const before = viewSnapshot(h);
    if (outcome === 'receipt') resolve({ ok: true, json: async () => ({ incident: { id: 40 }, dispatch: {} }) });
    else reject(new Error('old panic failed'));
    await activation; assert.equal(viewSnapshot(h), before);
    assert.equal(h.timers.length, 0);
    assert.equal(h.storage.size, outcome === 'receipt' ? 1 : 0);
  });
}

test('same original session can recover and retry after a detached in-flight request', async () => {
  const h = setup({ submission: 'deferred' }); await h.panic(); h.start(); await h.answerAll();
  h.show({ guard: { id: 2 }, session: { id: 254 } });
  h.show({ guard: { id: 1 }, session: { id: 253 } }); h.restore();
  assert.equal(h.elements['assistant-next-btn'].disabled, false);
  h.setSubmission('ok'); h.elements['assistant-next-btn'].click(); await tick();
  assert.equal(h.storage.size, 0);
  const before = viewSnapshot(h);
  h.pending[0].reject(new Error('old receipt lost')); await tick();
  assert.equal(viewSnapshot(h), before);
  const attempts = h.calls.filter(call => call.body.incidentAnswers);
  assert.equal(attempts.length, 2);
  assert.deepEqual(attempts[1].body.incidentAnswers, attempts[0].body.incidentAnswers);
  assert.equal(attempts[1].body.sessionId, 253);
});

test('draft retention is origin-local plaintext, never automatically purged or reassigned on logout', async () => {
  const h = setup(); await h.panic(); h.start(); h.enter('Sensitive operational answer', false);
  const [key, serialized] = [...h.storage.entries()][0];
  assert.equal(key, 'aegis-incident-questionnaire-v2:253:40');
  assert.match(serialized, /Sensitive operational answer/);
  assert.doesNotMatch(serialized, /test-token|Authorization|guard_session_token/);
  await h.logout(); assert.equal(h.storage.get(key), serialized);
  h.show({ guard: { id: 2 }, session: { id: 254 } }); h.restore();
  assertQuestionnaireCleared(h); assert.equal(h.storage.get(key), serialized);
  assert.equal(h.calls.filter(call => call.body.incidentAnswers).length, 0);
});

for (const key of ['aegis_guard_session', 'guard_session_token', null]) {
  test(`cross-tab auth storage change (${key}) clears and suspends only questionnaire UI without purging drafts`, async () => {
    const h = setup(); await h.panic(); h.start(); h.enter('Private tab-local answer', false);
    const retained = [...h.storage.entries()];
    const session = h.context.currentGuardSession;
    h.storageEvent(key); assertQuestionnaireCleared(h);
    h.restore(); h.timer(0); assertQuestionnaireCleared(h);
    h.elements['assistant-next-btn'].click();
    assert.equal(h.context.currentGuardSession, session, 'UI isolation must not change authentication');
    assert.deepEqual([...h.storage.entries()], retained);
    assert.equal(h.calls.filter(call => call.body.incidentAnswers).length, 0);
  });
}

test('unrelated localStorage changes do not disturb the active questionnaire', async () => {
  const h = setup(); await h.panic(); h.start(); h.enter('Pending answer', false);
  const before = viewSnapshot(h); h.storageEvent('unrelated-preference');
  assert.equal(viewSnapshot(h), before);
});

for (const identity of [{ guard: { id: 2 }, session: { id: 254 } }, { guard: { id: 1 }, session: { id: 254 } }]) {
  test(`retained session 253 draft cannot prevent session ${identity.session.id}/guard ${identity.guard.id} from completing/resetting`, async () => {
    const h = setup(); await h.panic(); h.start(); h.enter('Guard A private answer', false);
    h.advance(5000);
    h.elements.callStatusList.textContent = 'Guard A call'; h.elements.smsStatusList.textContent = 'Guard A SMS';
    const [oldKey, oldDraft] = [...h.storage.entries()][0];
    assert.equal(h.intervalCount(), 1);
    h.show(identity);
    assert.equal(h.elements.statusCard.classList.contains('hidden'), true);
    assert.equal(h.elements.timeFromStart.textContent, '00:00');
    assert.equal(h.elements.callStatusList.textContent, ''); assert.equal(h.elements.smsStatusList.textContent, '');
    assert.equal(h.intervalCount(), 0);
    await h.panic(); h.timer(1); h.advance(2000);
    const beforeCompletion = h.resets();
    assert.equal(h.elements.statusCard.classList.contains('hidden'), false);
    await h.answerAll();
    assert.equal(h.resets(), beforeCompletion + 1);
    assert.equal(h.elements.statusCard.classList.contains('hidden'), true);
    assert.equal(h.elements.statusBadge.textContent, 'Live ενημέρωση');
    assert.equal(h.elements.timeFromStart.textContent, '00:00');
    assert.equal(h.context.startTimestamp, null); assert.equal(h.context.activeTimer, null);
    assert.equal(h.intervalCount(), 0);
    assert.equal(vm.runInContext('activeIncidentFlow', h.context), null);
    assert.equal(vm.runInContext('incidentFlowQueue.length', h.context), 1);
    assert.equal(h.storage.get(oldKey), oldDraft);
    assert.equal(h.storage.size, 1);
    const before = viewSnapshot(h); h.oldInterval(0); h.oldInterval(1);
    assert.equal(viewSnapshot(h), before, 'already-queued elapsed callbacks must not revive old status');
  });
}

test('foreign drafts do not affect selection/reset while two current-session questionnaires remain queued', async () => {
  const h = setup(); await h.panic(); h.start(); h.enter('Retained Guard A evidence', false);
  const [oldKey, oldDraft] = [...h.storage.entries()][0];
  h.show({ guard: { id: 2 }, session: { id: 254 } });
  await h.panic(); await h.panic(); h.timer(1); h.timer(2);
  assert.equal(h.intervalCount(), 1, 'consecutive panic UI timers must not leave orphan intervals');
  const baseline = h.resets();
  await h.answerAll();
  assert.equal(h.resets(), baseline);
  assert.equal(vm.runInContext('activeIncidentFlow.incidentId', h.context), 42);
  assert.equal(vm.runInContext('activeIncidentFlow.sessionId', h.context), 254);
  assert.equal(vm.runInContext('questionnaireFlow.incidentId', h.context), 42);
  assert.equal(h.elements.statusCard.classList.contains('hidden'), false);
  assert.equal(h.intervalCount(), 1);
  await h.answerAll();
  assert.equal(h.resets(), baseline + 1);
  assert.equal(vm.runInContext('activeIncidentFlow', h.context), null);
  assert.equal(h.elements.statusCard.classList.contains('hidden'), true);
  assert.equal(h.intervalCount(), 0);
  assert.equal(h.storage.get(oldKey), oldDraft); assert.equal(h.storage.size, 1);
});

for (const transition of ['logout', 'expiry', 'Preview', 'account change']) {
  test(`${transition} clears prior Alert Status, dispatch labels and elapsed timer`, async () => {
    const h = setup(); await h.panic(); h.start(); h.advance(3000);
    h.elements.callStatusList.textContent = 'Previous guard call'; h.elements.smsStatusList.textContent = 'Previous guard SMS';
    const retained = [...h.storage.entries()];
    if (transition === 'logout') await h.logout();
    else if (transition === 'expiry') h.expire();
    else h.show({ guard: { id: 2, access_mode: transition === 'Preview' ? 'read_only' : 'standard' }, session: { id: 254 } });
    assert.equal(h.elements.statusCard.classList.contains('hidden'), true);
    assert.equal(h.elements.timeFromStart.textContent, '00:00');
    assert.equal(h.elements.statusBadge.textContent, 'Live ενημέρωση');
    assert.equal(h.elements.callStatusList.textContent, ''); assert.equal(h.elements.smsStatusList.textContent, '');
    assert.equal(h.intervalCount(), 0);
    assert.equal(h.context.startTimestamp, null);
    assert.deepEqual([...h.storage.entries()], retained);
    const before = viewSnapshot(h); h.oldInterval(0); assert.equal(viewSnapshot(h), before);
  });
}

test('Alert Status DOM refs and timer state initialize before startup session reset', () => {
  const startup = source.indexOf('const savedGuardSession = loadSavedGuardSession();');
  for (const declaration of ['const statusCard', 'const callStatusList', 'let activeTimer', 'let startTimestamp']) {
    assert.ok(source.indexOf(declaration) < startup, declaration);
  }
  const h = setup();
  assert.equal(h.elements.statusCard.classList.contains('hidden'), true);
  assert.equal(h.elements.timeFromStart.textContent, '00:00');
  assert.equal(h.intervalCount(), 0);
});
