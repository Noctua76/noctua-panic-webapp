const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'reports.html'), 'utf8');
const script = source.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
const controls = ['category', 'normal', 'important', 'message', 'cameraInput', 'galleryInput', 'submitBtn'];

function mount(accessMode) {
  const elements = {};
  for (const [, id] of source.matchAll(/id="([^"]+)"/g)) {
    const classes = new Set();
    elements[id] = {
      disabled: false, value: '', textContent: '', innerHTML: '', listeners: {},
      classList: {
        toggle(name, enabled) { enabled ? classes.add(name) : classes.delete(name); },
        contains(name) { return classes.has(name); },
      },
      addEventListener(event, handler) { this.listeners[event] = handler; },
    };
  }
  elements.category.value = 'OBSERVATION';
  elements.normal.value = 'NORMAL';
  const requests = [];
  let resets = 0;
  let compressions = 0;
  const context = vm.createContext({
    document: {
      getElementById(id) { assert.ok(elements[id], id); return elements[id]; },
      querySelector(selector) {
        assert.equal(selector, 'input[name="priority"]:checked');
        return elements.normal;
      },
    },
    window: { AEGIS_CONFIG: { backendBase: 'https://backend.example' }, location: { replace() { assert.fail('unexpected redirect'); } } },
    localStorage: {
      getItem(key) { return key === 'guard_session_token' ? 'test-token' : JSON.stringify({ guard: { access_mode: accessMode, full_name: 'Demo Guard', site_name: 'Demo Site' } }); },
      removeItem() { assert.fail('unexpected session removal'); },
    },
    FormData, Intl,
    createImageBitmap() { compressions++; throw new Error('unexpected image processing'); },
    fetch: async (url, options) => {
      requests.push({ url, options });
      return { ok: true, status: 200, json: async () => options.method === 'POST' ? { report: { report_number: 'SR-001' } } : { reports: [] } };
    },
  });
  vm.runInContext(script, context);
  return { elements, requests, context, compressions: () => compressions, resets: () => resets,
    submit: () => elements.reportForm.listeners.submit({ preventDefault() {}, target: { reset() { resets++; } } }),
  };
}

for (const mode of ['read_only', 'standard']) {
  test(`${mode}: full form, header and history remain present`, () => {
    const page = mount(mode);
    assert.equal(page.elements.formCard.classList.contains('hidden'), false);
    for (const label of ['Shift Reports', 'Guard', 'Site', 'New Shift Report', 'Category', 'Priority', 'Normal', 'Important', 'Operational note', 'Photos · optional', 'Take photo', 'Choose photos', 'Up to 5 images. Images are compressed before secure upload.', 'Submit Shift Report', 'Current Shift']) {
      assert.ok(source.includes(label), label);
    }
    assert.match(source, /id="charCount">0<\/span>\/5000/);
    assert.equal(page.elements.guardName.textContent, 'Demo Guard');
    assert.equal(page.elements.siteName.textContent, 'Demo Site');
    for (const id of controls) assert.equal(page.elements[id].disabled, mode === 'read_only', id);
    assert.equal(page.elements.readOnlyBanner.classList.contains('show'), mode === 'read_only');
    assert.equal(page.elements.formCard.classList.contains('read-only-preview'), mode === 'read_only');
    assert.match(source, /Προσωρινή πρόσβαση μόνο για προβολή\. Δεν επιτρέπεται η δημιουργία Shift Report\./);
    assert.doesNotMatch(script, /\.remove\(|removeChild|formCard[^\n]*(?:hidden|innerHTML|outerHTML)/);
  });
}

test('Preview blocks submit requests and photo processing even for synthetic events', async () => {
  const page = mount('read_only');
  await page.submit();
  for (const id of ['cameraInput', 'galleryInput']) {
    page.elements[id].listeners.change({ target: { files: [{ type: 'image/jpeg' }], value: 'photo.jpg' } });
  }
  await vm.runInContext('addFiles([{type:"image/jpeg"}])', page.context);
  assert.equal(page.compressions(), 0);
  assert.equal(page.elements.previews.innerHTML, '');
  assert.equal(page.resets(), 0);
  assert.equal(page.elements.submitBtn.disabled, true);
  assert.equal(page.requests.length, 1);
  assert.equal(page.requests[0].url, 'https://backend.example/guard/shift-reports/current-shift');
  assert.match(script, /event\.preventDefault\(\);if\(readOnly\)return;/);
});

test('Standard Guard keeps existing successful POST, reset and history refresh', async () => {
  const page = mount('standard');
  page.elements.message.value = 'Operational note';
  await page.submit();
  const posts = page.requests.filter(({ options }) => options.method === 'POST');
  assert.equal(posts.length, 1);
  assert.equal(posts[0].url, 'https://backend.example/guard/shift-reports');
  assert.equal(posts[0].options.headers.Authorization, 'Bearer test-token');
  assert.deepEqual([...posts[0].options.body.entries()], [
    ['category', 'OBSERVATION'], ['priority', 'NORMAL'], ['message', 'Operational note'],
  ]);
  assert.equal(page.resets(), 1);
  assert.equal(page.requests.length, 3);
  assert.equal(page.elements.charCount.textContent, '0');
  assert.match(page.elements.feedback.textContent, /SR-001.*επιτυχώς/);
  assert.equal(page.elements.submitBtn.disabled, false);
});

test('Only the existing Guard Shift Report endpoints and guarded POST are present', () => {
  const calls = [...script.matchAll(/\bapi\(\s*["']([^"']+)["']/g)].map(match => match[1]);
  assert.deepEqual(calls.sort(), ['/guard/shift-reports', '/guard/shift-reports/current-shift']);
  assert.equal((script.match(/method\s*:\s*["']POST["']/g) || []).length, 1);
  assert.match(script, /api\(\s*["']\/guard\/shift-reports["']\s*,\s*\{\s*method\s*:\s*["']POST["']/);
  assert.match(script, /api\(\s*["']\/guard\/shift-reports\/current-shift["']\s*\)/);
  assert.match(script, /event\.preventDefault\(\);if\(readOnly\)return;/);
  assert.doesNotMatch(script, /method\s*:\s*["'](?:PUT|PATCH|DELETE)["']/i);
  assert.equal((script.match(/\bfetch\s*\(/g) || []).length, 1);
});

test('Preview CSS preserves visible controls without revealing transparent input overlays', () => {
  assert.match(source, /#formCard\.read-only-preview select:disabled,#formCard\.read-only-preview textarea:disabled,#formCard\.read-only-preview \.submit:disabled\{opacity:1;color:var\(--text\);-webkit-text-fill-color:var\(--text\)\}/);
  assert.match(source, /#formCard\.read-only-preview :disabled,[^\n]+cursor:not-allowed/);
  assert.match(source, /\.hidden\{display:none!important\}/);
});
