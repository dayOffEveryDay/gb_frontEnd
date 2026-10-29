import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { setImmediate } from 'node:timers/promises';
import vm from 'node:vm';

export function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function eventTarget() {
  const listeners = new Map();
  return {
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
    dispatchEvent(event) { for (const fn of listeners.get(event.type) ?? []) fn(event); },
    listenerCount() { return [...listeners.values()].reduce((sum, set) => sum + set.size, 0); },
  };
}

// Runs the real hooks and helper modules with controlled React lifecycles and I/O.
// No browser, server, real socket or wall-clock timers are started.
export async function mountController(file, initialProps = {}, apiOverrides = {}, initialStorage = {}) {
  const slots = [], modules = new Map(), clients = [], timers = new Map();
  let cursor = 0, dirty = false, effects = [], value, props = initialProps, nextTimer = 0;
  let auth = { token: initialProps.token ?? 'token-a', user: initialProps.user ?? { id: 1, displayName: 'Alice' } };
  const storage = new Map(Object.entries(initialStorage));
  const storageApi = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, val) => storage.set(key, String(val)),
    removeItem: key => storage.delete(key),
  };
  const window = {
    ...eventTarget(), location: { origin: 'http://localhost:5173' }, scrollY: 10,
    scrollTo: () => {},
    setTimeout(fn) { const id = ++nextTimer; timers.set(id, fn); return id; },
    clearTimeout: id => timers.delete(id),
    setInterval(fn) { const id = ++nextTimer; timers.set(id, fn); return id; },
    clearInterval: id => timers.delete(id),
  };
  const document = { ...eventTarget(), hidden: false, visibilityState: 'visible' };
  const frames = new Map();
  const requestAnimationFrame = fn => { const id = ++nextTimer; frames.set(id, fn); return id; };
  const cancelAnimationFrame = id => frames.delete(id);
  const api = {
    AUTH_STORAGE_EVENT: 'auth-change', AUTH_EXPIRED_MESSAGE: 'expired', LINE_LOGIN_SUCCESS_MESSAGE: 'line-login-success',
    getStoredToken: () => auth.token, getStoredUser: () => auth.user,
    getFrontendBaseUrl: () => window.location.origin, getBackendBaseUrl: () => window.location.origin,
    setStoredAuth(next) { auth = { ...auth, ...next }; window.dispatchEvent({ type: 'auth-change' }); },
    clearStoredAuth() { auth = { token: '', user: null }; window.dispatchEvent({ type: 'auth-change' }); },
    isDevLoginEnabled: true, devLogin: async () => ({ token: 'dev', userId: 2 }),
    openLineLoginPopup: () => {}, updateCurrentUserProfile: async () => {},
    fetchMyHostedCampaigns: async () => [], fetchMyJoinedCampaigns: async () => [],
    fetchPurchaseChatRooms: async () => [], fetchPurchaseChatUnreadCount: async () => ({ unreadCount: 0 }),
    fetchMyParticipation: async () => ({ chatAccess: 'FULL' }), fetchCampaignChatMessages: async () => [],
    fetchHostDashboard: async () => ({}),
    fetchUnreadNotifications: async () => [], fetchReadNotifications: async () => [],
    markCampaignChatRead: async () => ({ unreadCount: 0 }),
    markNotificationRead: async () => {}, markPurchaseChatRoomRead: async () => {},
    ...apiOverrides,
  };
  const equal = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
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
    useRef(initial) { const i = cursor++; slots[i] ??= { current: initial }; return slots[i]; },
    useCallback(fn, deps) {
      const i = cursor++;
      if (!equal(slots[i]?.deps, deps)) slots[i] = { value: fn, deps };
      return slots[i].value;
    },
    useMemo(fn, deps) {
      const i = cursor++;
      if (!equal(slots[i]?.deps, deps)) slots[i] = { value: fn(), deps };
      return slots[i].value;
    },
    useEffect(fn, deps) {
      const i = cursor++;
      if (!equal(slots[i]?.deps, deps)) effects.push(() => {
        slots[i]?.cleanup?.(); slots[i] = { deps, cleanup: fn() };
      });
    },
  };
  react.useLayoutEffect = react.useEffect;
  class Client {
    constructor(config) { this.config = config; this.subscriptions = new Map(); clients.push(this); }
    activate() { this.config.onConnect(); }
    subscribe(path, fn) { this.subscriptions.set(path, fn); }
    deactivate() { this.deactivated = true; }
    push(path, payload) { this.subscriptions.get(path)?.({ body: JSON.stringify(payload) }); }
  }
  const context = vm.createContext({ window, document, localStorage: storageApi, sessionStorage: storageApi, URL, Event, requestAnimationFrame, cancelAnimationFrame });
  function synthetic(key, exports) {
    if (!modules.has(key)) modules.set(key, new vm.SyntheticModule(Object.keys(exports), function () {
      for (const [name, val] of Object.entries(exports)) this.setExport(name, val);
    }, { context, identifier: key }));
    return modules.get(key);
  }
  function load(path) {
    if (modules.has(path)) return modules.get(path);
    const mod = new vm.SourceTextModule(readFileSync(path, 'utf8'), {
      context, identifier: path,
      importModuleDynamically: async () => {
        const sock = synthetic('sockjs', { default: class {} });
        if (sock.status === 'unlinked') await sock.link(() => {});
        if (sock.status === 'linked') await sock.evaluate();
        return sock;
      },
    });
    modules.set(path, mod);

    return mod;
  }
  const linker = (specifier, parent) => {
      if (specifier === 'react') return synthetic('react', react);
      if (specifier === '@stomp/stompjs') return synthetic('stomp', { Client });
      if (specifier.endsWith('/api')) return synthetic('api', api);
      if (specifier.endsWith('/onboardingUtils')) return synthetic('onboarding', { hasCompletedOnboarding: () => true });
      return load(resolve(dirname(parent.identifier), specifier + (specifier.endsWith('.js') ? '' : '.js')));
    };
  const mod = load(resolve(file));
  await mod.link(linker);
  await mod.evaluate();
  function render() {
    let passes = 0;
    do {
      if (++passes > 30) throw Error('Unbounded render loop');
      cursor = 0; dirty = false; effects = [];
      value = mod.namespace.default(props);
      effects.forEach(effect => effect());
    } while (dirty);
  }
  render();
  return {
    get value() { return value; }, get auth() { return auth; }, window, document, clients, timers, storage,
    async paint() { const callbacks = [...frames.values()]; frames.clear(); await Promise.all(callbacks.map(fn => fn())); },
    update(next = {}) { props = { ...props, ...next }; render(); },
    async settle() { for (let i = 0; i < 4; i++) { await setImmediate(); render(); } },
    unmount() { slots.forEach(slot => slot?.cleanup?.()); },
  };
}
