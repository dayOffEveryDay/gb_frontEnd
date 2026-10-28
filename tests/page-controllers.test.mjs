import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import vm from 'node:vm';

// A deterministic hook lifecycle harness: no browser, backend, timers or dev server.
// It exercises the real feed implementation, including effect cleanup on a page switch.
async function mountFeed(initialProps) {
  const slots = [];
  const observers = [];
  let cursor = 0;
  let dirty = false;
  let effects = [];
  let props = initialProps;
  let value;
  const equal = (a, b) => a && b && a.length === b.length && a.every((item, i) => Object.is(item, b[i]));
  const react = {
    useState(initial) {
      const i = cursor++;
      slots[i] ??= { value: typeof initial === 'function' ? initial() : initial };
      slots[i].set ??= update => {
        const next = typeof update === 'function' ? update(slots[i].value) : update;
        if (!Object.is(next, slots[i].value)) { slots[i].value = next; dirty = true; }
      };
      return [slots[i].value, slots[i].set];
    },
    useRef(initial) {
      const i = cursor++;
      slots[i] ??= { current: initial };
      return slots[i];
    },
    useCallback(fn, deps) {
      const i = cursor++;
      if (!equal(slots[i]?.deps, deps)) slots[i] = { value: fn, deps };
      return slots[i].value;
    },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!equal(slots[i]?.deps, deps)) {
        effects.push(() => {
          slots[i]?.cleanup?.();
          slots[i] = { deps, cleanup: fn() };
        });
      }
    },
  };
  const context = vm.createContext({
    IntersectionObserver: class {
      constructor(callback) { this.callback = callback; observers.push(this); }
      observe() { this.connected = true; }
      disconnect() { this.connected = false; }
    },
  });
  const source = await readFile(new URL('../src/components/campaign/useCampaignFeed.js', import.meta.url), 'utf8');
  const module = new vm.SourceTextModule(source, { context });
  await module.link(specifier => {
    const exports = specifier === 'react' ? react : { getCampaignListSignature: JSON.stringify };
    return new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [name, value] of Object.entries(exports)) this.setExport(name, value);
    }, { context });
  });
  await module.evaluate();
  function render() {
    let passes = 0;
    do {
      if (++passes > 20) throw new Error('Unbounded render loop');
      cursor = 0; dirty = false; effects = [];
      value = module.namespace.default(props);
      value.sentinelRef.current = {};
      effects.forEach(effect => effect());
    } while (dirty);
  }
  render();
  return {
    get value() { return value; },
    update(next) { props = { ...props, ...next }; render(); },
    async settle() { await setImmediate(); render(); },
    intersect() { return observers.findLast(observer => observer.connected)?.callback([{ isIntersecting: true }]); },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}

const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const result = (id, hasMore = false) => ({ items: [{ id }], hasMore });
const ids = feed => Array.from(feed.value.campaigns, item => item.id);

test('late response from an old filter cannot replace the current list', async () => {
  const old = deferred();
  const feed = await mountFeed({ enabled: true, fetchPage: () => old.promise, refreshKey: 0 });
  feed.update({ fetchPage: async () => result('new') });
  await feed.settle();
  old.resolve(result('old'));
  await feed.settle();
  assert.deepEqual(ids(feed), ['new']);
  feed.unmount();
});

test('inactive pages discard pending work; re-entry loads fresh data', async () => {
  const pending = deferred();
  let calls = 0;
  const feed = await mountFeed({ enabled: true, fetchPage: () => { calls++; return pending.promise; } });
  feed.update({ enabled: false });
  pending.resolve(result('stale'));
  await feed.settle();
  assert.deepEqual(ids(feed), []);
  assert.equal(calls, 1);
  feed.update({ enabled: true, fetchPage: async () => result('fresh') });
  await feed.settle();
  assert.deepEqual(ids(feed), ['fresh']);
  feed.unmount();
});

test('market and mine have independent caches and errors', async () => {
  const market = await mountFeed({ enabled: true, fetchPage: async () => result('market') });
  const mine = await mountFeed({ enabled: true, fetchPage: async () => { throw new Error('login required'); } });
  await market.settle(); await mine.settle();
  assert.deepEqual(ids(market), ['market']);
  assert.deepEqual(ids(mine), []);
  assert.equal(market.value.campaignError, '');
  assert.equal(mine.value.campaignError, 'login required');
  market.unmount(); mine.unmount();
});

test('logout clears private cached data even while the page is inactive', async () => {
  const feed = await mountFeed({ enabled: true, resetKey: 'account-a', fetchPage: async () => result('private') });
  await feed.settle();
  feed.update({ enabled: false, resetKey: null });
  assert.deepEqual(ids(feed), []);
  feed.unmount();
});

test('pagination is single-flight and a new filter invalidates its pending response', async () => {
  const more = deferred();
  const calls = [];
  const feed = await mountFeed({ enabled: true, fetchPage: (page, offset) => {
    calls.push([page, offset]);
    return page === 0 ? Promise.resolve(result('first', true)) : more.promise;
  } });
  await feed.settle();
  const request = feed.intersect();
  void feed.intersect();
  assert.deepEqual(calls, [[0, 0], [1, 1]]);
  feed.update({ fetchPage: async () => result('filtered') });
  await feed.settle();
  more.resolve(result('old-next-page')); await request;
  await feed.settle();
  assert.deepEqual(ids(feed), ['filtered']);
  feed.unmount();
});

test('silent refresh failure retains the displayed list', async () => {
  let fail = false;
  const feed = await mountFeed({ enabled: true, fetchPage: async () => {
    if (fail) throw new Error('offline');
    return result('visible');
  } });
  await feed.settle(); fail = true;
  await feed.value.loadCampaignPage({ silent: true }); await feed.settle();
  assert.deepEqual(ids(feed), ['visible']);
  assert.equal(feed.value.campaignError, 'offline');
  assert.equal(feed.value.isInitialLoading, false);
  feed.unmount();
});

test('opening a deal refreshes its data without overwriting a newer filter', async () => {
  const pending = deferred();
  let opening = false;
  const feed = await mountFeed({ enabled: true, fetchPage: () => opening ? pending.promise : Promise.resolve(result(1)) });
  await feed.settle(); opening = true;
  const lookup = feed.value.refreshCampaign({ id: 1 });
  feed.update({ fetchPage: async () => result(2) });
  await feed.settle();
  pending.resolve({ items: [{ id: 1, quantity: 9 }], hasMore: false });
  assert.equal((await lookup).quantity, 9);
  await feed.settle();
  assert.deepEqual(ids(feed), [2]);
  feed.unmount();
});
