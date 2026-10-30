import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import vm from 'node:vm';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, createMemoryRouter, createRoutesFromChildren } from 'react-router-dom';
import { build } from 'vite';
import { homeRedirect, mainPath, pageType, transitionDirection, MAIN_TABS } from '../src/layouts/mainRoutes.js';

test('canonical paths, legacy aliases, root entries and transition direction', () => {
  for (const [type, path] of [['MINE', '/mine'], ['SCHEDULED', '/campaigns'], ['REQUEST', '/requests'], ['INQUIRY', '/inquiries']]) {
    assert.equal(mainPath(type), path);
    assert.equal(pageType(path), type);
    assert.equal(pageType(`${path}/`), type);
  }
  assert.equal(mainPath('INSTANT'), '/campaigns');
  assert.equal(pageType('/inquiries/qid=5'), 'INQUIRY');
  assert.equal(pageType('/inquiries/5'), 'INQUIRY');
  assert.equal(homeRedirect(null), '/campaigns');
  assert.equal(homeRedirect({ activeType: 'REQUEST' }), '/requests');
  assert.equal(homeRedirect({ focusCampaignId: 7 }), '/mine');
  assert.equal(transitionDirection('MINE', 'REQUEST'), 'forward');
  assert.equal(transitionDirection('REQUEST', 'SCHEDULED'), 'backward');
});

async function navigation(initial = 'SCHEDULED', width = 390) {
  let current = initial;
  const navigations = [];
  const state = { category: 'ALL', search: '', expanded: false, refreshes: 0 };
  const noop = () => {};
  const ref = () => ({ current: null });
  const context = vm.createContext({
    window: { innerWidth: width, scrollY: 0, setTimeout: fn => fn(), scrollTo: noop },
    localStorage: { setItem: noop }, Element: class {},
  });
  const source = await readFile(new URL('../src/layouts/useMainNavigation.js', import.meta.url), 'utf8');
  const module = new vm.SourceTextModule(source, { context });
  await module.link(specifier => {
    const exports = specifier === 'react' ? { useCallback: fn => fn, useEffect: noop } : {
      getNavigationTabValue: type => ['INSTANT', 'SCHEDULED'].includes(type) ? 'CAMPAIGN' : type,
      DEAL_VIEW_MODE_KEYS: {},
    };
    return new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
    }, { context });
  });
  await module.evaluate();
  const api = module.namespace.default({
    setIsNavigationOpen: noop,
    setActiveType: value => {
      const next = typeof value === 'function' ? value(current) : value;
      if (mainPath(next) !== mainPath(current)) navigations.push(mainPath(next));
      current = next;
    },
    setActiveCampaignType: value => { state.category = value; },
    setIsProxyRequestFormOpen: noop, swipeTabs: MAIN_TABS,
    isNavigationOpen: false, navigationRef: ref(), swipeStartXRef: ref(), pullStartYRef: ref(),
    gestureLockRef: ref(), canPullRef: ref(), isRefreshing: false,
    setPullDistance: noop, pullDistance: 0, refreshHome: () => { state.refreshes++; },
    activeType: initial, isDesktopViewport: width >= 700, activeMyCampaignScope: 'ALL',
    dealViewModePreferences: {}, setDealViewModePreferences: noop, setExpandedCompactDealId: noop,
    mobileSearchInputRef: ref(), searchReturnContextRef: ref(), activeCampaignType: 'INSTANT',
    setMobileSearchScope: noop, setIsSearchExpanded: value => { state.expanded = value; },
    setSearch: value => { state.search = value; },
  });
  return { api, navigations, state };
}

test('swipes follow the four routes and clamp at the first/last page', async () => {
  const { api, navigations } = await navigation('MINE');
  api.switchActiveTypeBySwipe('right');
  for (let i = 0; i < 4; i++) api.switchActiveTypeBySwipe('left');
  api.switchActiveTypeBySwipe('right');
  assert.deepEqual(navigations, ['/campaigns', '/requests', '/inquiries', '/requests']);
  const desktop = await navigation('MINE', 1000);
  desktop.api.switchActiveTypeBySwipe('left');
  assert.deepEqual(desktop.navigations, []);
});

test('horizontal touch navigates; vertical and cancelled gestures do not', async () => {
  const { api, navigations } = await navigation();
  const start = () => api.handleTouchStart({ target: null, touches: [{ clientX: 120, clientY: 120 }] });
  start();
  api.handleTouchEnd({ changedTouches: [{ clientX: 110, clientY: 230 }] });
  assert.deepEqual(navigations, []);
  start(); api.handleTouchCancel();
  api.handleTouchEnd({ changedTouches: [{ clientX: 10, clientY: 120 }] });
  assert.deepEqual(navigations, []);
  start(); api.handleTouchEnd({ changedTouches: [{ clientX: 10, clientY: 120 }] });
  assert.deepEqual(navigations, ['/requests']);
});

test('mobile search crosses routes and returns to the original tab and filter', async () => {
  const { api, navigations, state } = await navigation('MINE');
  api.handleOpenMobileSearch();
  api.handleChangeMobileSearchScope('REQUEST');
  api.handleCloseMobileSearch();
  assert.deepEqual(navigations, ['/campaigns', '/requests', '/mine']);
  assert.equal(state.category, 'INSTANT');
  assert.equal(state.expanded, false);
  assert.equal(state.search, '');
});

test('actual nested routes render directly and preserve browser history state', async () => {
  // Compile for Node only. This starts neither Vite nor a preview server.
  await build({
    configLoader: 'native', logLevel: 'error',
    build: { ssr: 'src/AppRoutes.jsx', outDir: 'node_modules/.cache/routes-test',
      rolldownOptions: { output: { entryFileNames: 'routes.mjs' } } },
  });
  const storage = new Map();
  const storageApi = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  globalThis.localStorage = storageApi;
  globalThis.sessionStorage = storageApi;
  globalThis.window = {
    location: { origin: 'http://localhost:5173', hostname: 'localhost', pathname: '/' },
    matchMedia: () => ({ matches: false }),
  };
  const { default: AppRoutes } = await import(pathToFileURL(resolve('node_modules/.cache/routes-test/routes.mjs')));
  for (const [path, label] of [['/mine', '個人內容'], ['/campaigns', '一起購買'], ['/requests', '代買需求'], ['/inquiries', 'inquiry-page-embedded']]) {
    const html = renderToString(React.createElement(MemoryRouter, { initialEntries: [path] }, React.createElement(AppRoutes)));
    assert.ok(html.includes(label), `direct entry ${path}`);
    assert.equal((html.match(/class="app-shell/g) ?? []).length, 1);
  }
  const router = createMemoryRouter(createRoutesFromChildren(AppRoutes().props.children), { initialEntries: ['/mine'] });
  // 新舊問題網址都應直接顯示詳情，並保留共用主版型。
  for (const path of ['/inquiries/qid=5', '/inquiries/5']) {
    const html = renderToString(React.createElement(MemoryRouter, { initialEntries: [path] }, React.createElement(AppRoutes)));
    assert.ok(html.includes('載入問題中…'), `direct detail entry ${path}`);
    assert.equal((html.match(/class="app-shell/g) ?? []).length, 1);
  }
  const layoutId = router.state.matches[0].route.id;
  await router.navigate('/requests', { state: { focusPurchaseRequestId: '42' } });
  assert.equal(router.state.matches[0].route.id, layoutId);
  await router.navigate('/inquiries');
  await router.navigate('/inquiries/qid=5');
  assert.equal(router.state.matches[0].route.id, layoutId);
  assert.equal(router.state.matches.at(-1).params.inquiryId, 'qid=5');
  assert.equal(router.state.errors, null);
  await router.navigate(-1);
  assert.equal(router.state.location.pathname, '/inquiries');
  await router.navigate(1);
  assert.equal(router.state.location.pathname, '/inquiries/qid=5');
  await router.navigate(-1);
  await router.navigate(-1);
  assert.equal(router.state.location.pathname, '/requests');
  assert.equal(router.state.location.state.focusPurchaseRequestId, '42');
  await router.navigate(-1);
  assert.equal(router.state.location.pathname, '/mine');
  await router.navigate(1);
  assert.equal(router.state.location.pathname, '/requests');
  await router.navigate('/inquiries/7');
  assert.equal(router.state.matches[0].route.id, layoutId);
  for (const path of ['/campaigns/7', '/share/campaigns/7', '/inquiries/new', '/users/7']) {
    await router.navigate(path);
    assert.notEqual(router.state.matches[0].route.id, layoutId, `preserved detail route ${path}`);
    assert.equal(router.state.errors, null);
  }
  router.dispose();
  delete globalThis.window;
  delete globalThis.localStorage;
  delete globalThis.sessionStorage;
});
