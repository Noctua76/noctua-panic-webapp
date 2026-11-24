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
const flowSource = slice('  let activeIncidentFlow =', '  function renderPendingAlertNotifications');
const alertSource = slice('  async function triggerAlert()', '  // ===== Incident log');
const sendSource = slice('  async function sendIncidentToBackend(', '  // ===== LIVE CLOCK');
const questionsSource = slice('  const incidentQuestions =', '  </script>');
const tick = () => new Promise(resolve => setImmediate(resolve));

function setup({ ai = 'ok', submission = 'ok', preview = false, panicFails = false } = {}) {
  const elements = Object.fromEntries(['incident-assistant','assistant-question','assistant-progress','assistant-answer','assistant-next-btn'].map(id => {
    const classes = new Set(['hidden']);
    return [id, { value: '', textContent: '', disabled: false, classList: { add: x => classes.add(x), remove: x => classes.delete(x), contains: x => classes.has(x) }, addEventListener: (_event, fn) => { elements[id].click = fn; } }];
  }));
  const calls = [], timers = [], alerts = [];
  let resets = 0;
  const context = vm.createContext({
    document: { getElementById: id => elements[id] },
    BACKEND_BASE: 'https://backend.test',
    currentGuardSession: { guard: { id: 1 }, session: { id: 253 } },
    latestGuardLocation: { latitude: 38, longitude: 23, accuracy: 10, battery: 90, timestamp: 'now' },
    isReadOnlyGuardSession: () => preview,
    getGuardAuthHeaders: () => ({ Authorization: 'Bearer test-token', 'Content-Type': 'application/json' }),
    statusCard: null, statusBadge: { textContent: '' }, startTimestamp: null,
    startActiveTimer() {}, renderPendingAlertNotifications() {}, renderAlertNotifications() {}, renderAlertFailure() {},
    resetWebAppUI() { resets++; },
    setTimeout: (fn, delay) => { timers.push({ fn, delay }); },
    alert: text => alerts.push(text), console: { log() {}, error() {} },
    fetch: async (url, options) => {
      const body = JSON.parse(options.body);
      calls.push({ url, body, headers: options.headers });
      if (url.endsWith('/alert')) return { ok: !panicFails, json: async () => ({ incident: { id: '40' }, dispatch: {} }) };
      if (!body.incidentAnswers) {
        if (ai === 'timeout') return new Promise(() => {});
        return { ok: ai !== '429', status: ai === '429' ? 429 : 200, json: async () => ({ assistantLog: ai === 'quota-fallback' ? 'Assistant failed to process log' : 'Optional summary' }) };
      }
      if (submission === 'network') throw new TypeError('Failed to fetch');
      return { ok: !['401','500'].includes(submission), status: Number(submission) || 200,
        json: async () => submission === 'bad-receipt' ? { status: 'ok', assistantLog: 'old response' }
          : { status: 'ok', incidentId: 40, responsesSaved: true, responseCount: 3 } };
    },
  });
  vm.runInContext(flowSource + alertSource + sendSource + questionsSource, context);
  return { elements, calls, timers, alerts, context, resets: () => resets,
    panic: () => vm.runInContext('handleAlertConfirmed()', context),
    start: () => { assert.equal(timers[0].delay, 15000); timers[0].fn(); },
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

test('a second panic cannot rebind answers from an already displayed questionnaire', async () => {
  const h = setup(); await h.panic(); h.start();
  vm.runInContext('activeIncidentFlow = {incidentId: 41, sessionId: 253, guardId: 1}', h.context);
  await h.answerAll();
  const submission = h.calls.find(call => call.body.incidentAnswers);
  assert.equal(submission.body.incidentId, 40);
  assert.equal(vm.runInContext('activeIncidentFlow.incidentId', h.context), 41);
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
