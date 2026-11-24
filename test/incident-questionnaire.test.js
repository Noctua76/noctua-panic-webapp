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
const flowSource = slice('  const INCIDENT_DRAFT_PREFIX =', '  function renderPendingAlertNotifications');
const alertSource = slice('  async function triggerAlert()', '  // ===== Incident log');
const sendSource = slice('  async function sendIncidentToBackend(', '  // ===== LIVE CLOCK');
const questionsSource = slice('  const incidentQuestions =', '  </script>');
const tick = () => new Promise(resolve => setImmediate(resolve));

function setup({ ai = 'ok', submission = 'ok', preview = false, panicFails = false, storage = new Map(), now = 1795500100000 } = {}) {
  const elements = Object.fromEntries(['incident-assistant','assistant-question','assistant-progress','assistant-answer','assistant-next-btn'].map(id => {
    const classes = new Set(['hidden']);
    return [id, { value: '', textContent: '', disabled: false, classList: { add: x => classes.add(x), remove: x => classes.delete(x), contains: x => classes.has(x) }, addEventListener: (event, fn) => { elements[id][event] = fn; } }];
  }));
  const calls = [], timers = [], alerts = [], pending = [];
  let clock = now, nextIncident = 40;
  class ClockDate extends Date { static now() { return clock; } }
  const localStorage = { get length() { return storage.size; }, key: index => [...storage.keys()][index], getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  let resets = 0;
  const context = vm.createContext({
    document: { getElementById: id => elements[id] }, Date: ClockDate, localStorage,
    BACKEND_BASE: 'https://backend.test',
    currentGuardSession: { guard: { id: 1 }, session: { id: 253 } },
    latestGuardLocation: { latitude: 38, longitude: 23, accuracy: 10, battery: 90, timestamp: 'now' },
    isReadOnlyGuardSession: () => preview,
    getGuardAuthHeaders: () => ({ Authorization: 'Bearer test-token', 'Content-Type': 'application/json' }),
    statusCard: null, statusBadge: { textContent: '' }, startTimestamp: null,
    startActiveTimer() {}, renderPendingAlertNotifications() {}, renderAlertNotifications() {}, renderAlertFailure() {},
    resetWebAppUI() { resets++; },
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
  vm.runInContext(flowSource + alertSource + sendSource + questionsSource, context);
  return { elements, calls, timers, alerts, context, storage, pending, now: () => clock, setSubmission: mode => { submission = mode; },
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
  await activation; h.start();
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
