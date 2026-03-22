import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

const LABELS = {
  all: '\u5168\u90e8',
  instant: '\u5373\u6642',
  preorder: '\u9810\u8cfc',
  drinks: '\u98f2\u6599',
  cookies: '\u9905\u4e7e',
  breads: '\u9eb5\u5305\u5410\u53f8',
  soyMilk: '\u8c46\u725b\u5976',
  login: '\u767b\u5165',
  profile: '\u500b\u4eba\u8cc7\u8a0a',
  account: '\u5e33\u865f',
  notLoggedIn: '\u5c1a\u672a\u767b\u5165',
  mockLogin: '\u6a21\u64ec\u767b\u5165',
  logout: '\u767b\u51fa',
  memberInfo: '\u6703\u54e1\u8cc7\u8a0a',
  membershipCard: '\u6709\u6703\u54e1\u5361',
  prefStores: '\u504f\u597d\u5e97\u5bb6',
  followedLeaders: '\u8ffd\u8e64\u7684\u5718\u4e3b',
  creditScore: '\u4fe1\u7528\u5206',
  notifications: '\u901a\u77e5',
  latestMessages: '\u6700\u65b0\u8a0a\u606f',
  currentStore: '\u73fe\u5728\u8ce3\u5834\u5730\u9ede',
  currentChat: '\u76ee\u524d\u804a\u5929\u5ba4\u5c0e\u5411',
  loadState: '\u8f09\u5165\u72c0\u614b',
  autoLoad: '\u6ed1\u5230\u5e95\u81ea\u52d5\u8f09\u5165\u66f4\u591a',
  noMoreDeals: '\u5df2\u7d93\u6c92\u6709\u66f4\u591a\u5718\u8cfc\u55ae',
  loadingMore: '\u8f09\u5165\u66f4\u591a\u4e2d...',
  noMoreData: '\u6c92\u6709\u66f4\u591a\u8cc7\u6599',
  remaining: '\u5269\u9918',
  itemUnit: '\u4ef6',
  unitPrice: '\u55ae\u50f9',
  leader: '\u5718\u4e3b',
  meetupPlace: '\u9762\u4ea4\u5730\u9ede',
  searchPlaceholder:
    '\u641c\u5c0b\u5546\u54c1\u540d\u3001\u5718\u4e3b\u3001\u9762\u4ea4\u5730\u9ede',
  createDeal: '\u767c\u8d77\u5718\u8cfc',
  addPrefStore: '\u65b0\u589e\u504f\u597d\u5e97\u5bb6',
  addLeader: '\u65b0\u589e\u8ffd\u8e64\u5718\u4e3b',
  syncedProfile:
    '\u53ef\u96a8\u6642\u4fee\u6539\u6703\u54e1\u5361\u72c0\u614b\u8207\u504f\u597d\u8a2d\u5b9a\u3002',
  loginToSync: '\u767b\u5165\u5f8c\u53ef\u540c\u6b65\u5132\u5b58\u6703\u54e1\u8cc7\u8a0a\u3002',
  untitledChat: '\u5c1a\u672a\u9078\u64c7\u804a\u5929\u5ba4',
  stockLeft: '\u5269',
  countdownLeft: '\u5269',
  loginWithLine: 'LINE \u767b\u5165',
  loginPromptTitle: '\u767b\u5165\u5f8c\u5373\u53ef\u4f7f\u7528\u500b\u4eba\u8cc7\u8a0a\u3001\u901a\u77e5\u8207\u504f\u597d\u8a2d\u5b9a',
  loginPromptBody: '\u8acb\u4f7f\u7528 LINE \u5e33\u865f\u767b\u5165\uff0c\u4ee5\u540c\u6b65\u5718\u8cfc\u901a\u77e5\u3001\u504f\u597d\u5e97\u5bb6\u8207\u8ffd\u8e64\u5718\u4e3b\u3002',
  close: '\u95dc\u9589',
  guestState: '\u8acb\u5148\u767b\u5165\u5f8c\u67e5\u770b',
};

const STORES = [
  LABELS.all,
  '\u4e2d\u548c\u5e97',
  '\u5167\u6e56\u5e97',
  '\u5317\u6295\u5e97',
  '\u65b0\u838a\u5e97',
  '\u6c50\u6b62\u5e97',
];

const CATEGORY_OPTIONS = [
  LABELS.all,
  LABELS.drinks,
  LABELS.cookies,
  LABELS.breads,
  LABELS.soyMilk,
];

const CREDIT_EVENTS = [
  { id: 1, title: '\u6e96\u6642\u9762\u4ea4', delta: '+5', date: '03/18' },
  { id: 2, title: '\u4e3b\u52d5\u56de\u8986\u5718\u54e1', delta: '+3', date: '03/14' },
  { id: 3, title: '\u53d6\u6d88\u5df2\u78ba\u8a8d\u8a02\u55ae', delta: '-6', date: '03/05' },
];

const NOTIFICATIONS = [
  {
    id: 1,
    type: 'chat',
    title: '\u963f\u54f2\u5718\u8cfc\u7fa4\u7d44\u6709 3 \u5247\u65b0\u8a0a\u606f',
    target: '\u804a\u5929\u5ba4 / \u963f\u54f2\u5718\u8cfc\u7fa4\u7d44',
    time: '2 min',
  },
  {
    id: 2,
    type: 'system',
    title: '\u4f60\u7684\u504f\u597d\u5e97\u5bb6\u5df2\u65b0\u589e\u4e2d\u548c\u5e97',
    target: '\u500b\u4eba\u8a2d\u5b9a',
    time: '15 min',
  },
  {
    id: 3,
    type: 'chat',
    title: '\u7c73\u679c\u5718\u8cfc\u7fa4\u7d44\u6709\u65b0\u7559\u8a00',
    target: '\u804a\u5929\u5ba4 / \u7c73\u679c\u5718\u8cfc\u7fa4\u7d44',
    time: '28 min',
  },
];

const PRODUCT_POOL = [
  {
    name: '\u7fa9\u7f8e\u7121\u7cd6\u8c46\u5976',
    category: LABELS.soyMilk,
    leader: '\u7c73\u679c\u5abd',
    place: '\u4e2d\u548c\u5bb6\u6a02\u798f\u51fa\u53e3',
    price: 78,
    score: 93,
    hue: 18,
  },
  {
    name: '\u9bae\u5976\u5410\u53f8',
    category: LABELS.breads,
    leader: '\u963f\u54f2',
    place: '\u6377\u904b\u666f\u5b89\u7ad9 2 \u865f\u51fa\u53e3',
    price: 65,
    score: 88,
    hue: 34,
  },
  {
    name: '\u53ef\u53ef\u7a40\u7247\u65e9\u9910\u5305',
    category: LABELS.cookies,
    leader: 'Nina',
    place: '\u4e2d\u548c\u5e97\u505c\u8eca\u5834 B1',
    price: 139,
    score: 95,
    hue: 8,
  },
  {
    name: '\u96f6\u7cd6\u6c23\u6ce1\u98f2',
    category: LABELS.drinks,
    leader: 'Howard',
    place: '\u4e2d\u548c\u74b0\u7403\u5074\u9580',
    price: 42,
    score: 90,
    hue: 192,
  },
  {
    name: '\u5317\u6d77\u9053\u725b\u4e73',
    category: LABELS.soyMilk,
    leader: 'Kelly',
    place: '\u677f\u6a4b\u6c11\u4eab\u8857\u53e3',
    price: 92,
    score: 97,
    hue: 225,
  },
  {
    name: '\u5976\u6cb9\u9910\u5305',
    category: LABELS.breads,
    leader: 'Ryan',
    place: '\u5357\u52e2\u89d2\u90f5\u5c40\u524d',
    price: 84,
    score: 86,
    hue: 42,
  },
  {
    name: '\u6d77\u9e7d\u8607\u6253\u9905',
    category: LABELS.cookies,
    leader: '\u5c0f\u9ea5',
    place: '\u4e2d\u548c\u5e97\u5165\u53e3\u96e8\u906e\u5340',
    price: 119,
    score: 91,
    hue: 350,
  },
  {
    name: '\u51b7\u8403\u62ff\u9435',
    category: LABELS.drinks,
    leader: 'Momo',
    place: '\u79c0\u6717\u6a4b\u982d\u6a5f\u8eca\u683c',
    price: 58,
    score: 89,
    hue: 164,
  },
];

const TOTAL_ITEMS = 30;
const PAGE_SIZE = 6;

function createDealImage(label, hue) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 280">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="hsl(${hue}, 82%, 82%)"/>
          <stop offset="100%" stop-color="hsl(${(hue + 42) % 360}, 72%, 58%)"/>
        </linearGradient>
      </defs>
      <rect width="400" height="280" rx="28" fill="url(#g)"/>
      <circle cx="316" cy="66" r="54" fill="rgba(255,255,255,0.18)"/>
      <circle cx="72" cy="220" r="72" fill="rgba(255,255,255,0.14)"/>
      <text x="32" y="146" fill="#ffffff" font-size="34" font-family="Segoe UI, Arial, sans-serif" font-weight="700">${label}</text>
    </svg>
  `;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function buildDeals() {
  return Array.from({ length: TOTAL_ITEMS }, (_, index) => {
    const base = PRODUCT_POOL[index % PRODUCT_POOL.length];
    const store = STORES[(index % (STORES.length - 1)) + 1];
    return {
      id: index + 1,
      type: index % 3 === 0 ? LABELS.preorder : LABELS.instant,
      name: base.name,
      category: base.category,
      leader: base.leader,
      place: base.place,
      store,
      price: base.price + (index % 4) * 8,
      remaining: 3 + (index % 7),
      score: base.score - (index % 5),
      countdown: `${3 + (index % 10)}h ${10 + ((index * 7) % 50)}m`,
      image: createDealImage(base.name, base.hue + index * 7),
    };
  });
}

const ALL_DEALS = buildDeals();

function AvatarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-4H5l1.38-1.55A1.9 1.9 0 0 0 7 15.2V11a5 5 0 1 1 10 0v4.2c0 .46.17.91.62 1.25Z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M11 5h2v14h-2zM5 11h14v2H5z" />
    </svg>
  );
}

function App() {
  const [activeType, setActiveType] = useState(LABELS.instant);
  const [activeCategory, setActiveCategory] = useState(LABELS.all);
  const [activeStore, setActiveStore] = useState(LABELS.all);
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasMembershipCard, setHasMembershipCard] = useState(true);
  const [preferredStores, setPreferredStores] = useState([
    '\u4e2d\u548c\u5e97',
    '\u5167\u6e56\u5e97',
  ]);
  const [followedLeaders, setFollowedLeaders] = useState([
    '\u7c73\u679c\u5abd',
    '\u963f\u54f2',
  ]);
  const [selectedChat, setSelectedChat] = useState(LABELS.untitledChat);
  const sentinelRef = useRef(null);

  const filteredDeals = useMemo(() => {
    const keyword = deferredSearch.trim().toLowerCase();
    return ALL_DEALS.filter((deal) => {
      const matchType = deal.type === activeType;
      const matchCategory = activeCategory === LABELS.all || deal.category === activeCategory;
      const matchStore = activeStore === LABELS.all || deal.store === activeStore;
      const matchKeyword =
        keyword.length === 0 ||
        [deal.name, deal.leader, deal.place, deal.store].some((field) =>
          field.toLowerCase().includes(keyword)
        );
      return matchType && matchCategory && matchStore && matchKeyword;
    });
  }, [activeCategory, activeStore, activeType, deferredSearch]);

  const visibleDeals = filteredDeals.slice(0, visibleCount);
  const hasMore = visibleCount < filteredDeals.length;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [activeType, activeCategory, activeStore, deferredSearch]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((current) => Math.min(current + PAGE_SIZE, filteredDeals.length));
        }
      },
      { rootMargin: '200px 0px' }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [filteredDeals.length, hasMore]);

  const addPreferredStore = () => {
    const nextStore = window.prompt(LABELS.addPrefStore, '');
    if (!nextStore) {
      return;
    }
    const store = nextStore.trim();
    if (!store || preferredStores.includes(store)) {
      return;
    }
    setPreferredStores((current) => [...current, store]);
  };

  const addFollowedLeader = () => {
    const nextLeader = window.prompt(LABELS.addLeader, '');
    if (!nextLeader) {
      return;
    }
    const leader = nextLeader.trim();
    if (!leader || followedLeaders.includes(leader)) {
      return;
    }
    setFollowedLeaders((current) => [...current, leader]);
  };

  const openProfile = () => {
    if (!isLoggedIn) {
      setIsLoginModalOpen(true);
      setIsProfileOpen(false);
      return;
    }
    setIsProfileOpen((open) => !open);
  };

  const handleLineLogin = () => {
    setIsLoggedIn(true);
    setIsLoginModalOpen(false);
    setIsProfileOpen(true);
  };

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-side">
          <button
            type="button"
            className="icon-chip profile-trigger"
            onClick={openProfile}
          >
            <span className="avatar-circle">
              <AvatarIcon />
            </span>
            <span>{isLoggedIn ? LABELS.profile : LABELS.login}</span>
          </button>
        </div>

        <div className="topbar-side right">
          <div className="store-selector">
            <span className="selector-label">{LABELS.currentStore}</span>
            <select value={activeStore} onChange={(event) => setActiveStore(event.target.value)}>
              {STORES.map((store) => (
                <option key={store} value={store}>
                  {store}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="icon-chip notification-trigger"
            onClick={() => setIsNotificationsOpen((open) => !open)}
          >
            <BellIcon />
            <span className="notification-badge">{NOTIFICATIONS.length}</span>
          </button>
        </div>
      </header>

      <div className="panel-layer">
        {isProfileOpen && (
          <aside className="floating-panel profile-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">{LABELS.account}</p>
                <h2>HowardLu</h2>
              </div>
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  setIsLoggedIn(false);
                  setIsProfileOpen(false);
                }}
              >
                {LABELS.logout}
              </button>
            </div>

            <section className="panel-section">
              <div className="section-title-row">
                <h3>{LABELS.memberInfo}</h3>
                <label className="switch-row">
                  <span>{LABELS.membershipCard}</span>
                  <input
                    type="checkbox"
                    checked={hasMembershipCard}
                    onChange={() => setHasMembershipCard((current) => !current)}
                  />
                </label>
              </div>
              <p className="muted-copy">{LABELS.syncedProfile}</p>
            </section>

            <section className="panel-section">
              <div className="section-title-row">
                <h3>{LABELS.prefStores}</h3>
                <button type="button" className="small-icon-button" onClick={addPreferredStore}>
                  <PlusIcon />
                </button>
              </div>
              <div className="tag-list">
                {preferredStores.map((store) => (
                  <button
                    key={store}
                    type="button"
                    className="tag"
                    onClick={() =>
                      setPreferredStores((current) => current.filter((item) => item !== store))
                    }
                  >
                    {store}
                  </button>
                ))}
              </div>
            </section>

            <section className="panel-section">
              <div className="section-title-row">
                <h3>{LABELS.followedLeaders}</h3>
                <button type="button" className="small-icon-button" onClick={addFollowedLeader}>
                  <PlusIcon />
                </button>
              </div>
              <div className="tag-list">
                {followedLeaders.map((leader) => (
                  <button
                    key={leader}
                    type="button"
                    className="tag"
                    onClick={() =>
                      setFollowedLeaders((current) => current.filter((item) => item !== leader))
                    }
                  >
                    {leader}
                  </button>
                ))}
              </div>
            </section>

            <section className="panel-section">
              <div className="section-title-row">
                <h3>{LABELS.creditScore}</h3>
                <strong className="credit-score">91</strong>
              </div>
              <div className="credit-events">
                {CREDIT_EVENTS.map((event) => (
                  <div key={event.id} className="credit-event">
                    <div>
                      <strong>{event.title}</strong>
                      <p>{event.date}</p>
                    </div>
                    <span className={event.delta.startsWith('+') ? 'delta up' : 'delta down'}>
                      {event.delta}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        )}

        {isNotificationsOpen && (
          <aside className="floating-panel notification-panel">
            <div className="panel-header">
              <div>
                <p className="eyebrow">{LABELS.notifications}</p>
                <h2>{LABELS.latestMessages}</h2>
              </div>
            </div>
            <div className="notification-list">
              {NOTIFICATIONS.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  className="notification-item"
                  onClick={() => setSelectedChat(notification.target)}
                >
                  <strong>{notification.title}</strong>
                  <span>{notification.target}</span>
                  <time>{notification.time}</time>
                </button>
              ))}
            </div>
          </aside>
        )}
      </div>

      {isLoginModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsLoginModalOpen(false)}>
          <div
            className="login-modal"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <button
              type="button"
              className="modal-close"
              onClick={() => setIsLoginModalOpen(false)}
            >
              {LABELS.close}
            </button>
            <p className="eyebrow">{LABELS.login}</p>
            <h2 className="modal-title">{LABELS.loginPromptTitle}</h2>
            <p className="modal-copy">{LABELS.loginPromptBody}</p>
            <button type="button" className="line-login-button" onClick={handleLineLogin}>
              {LABELS.loginWithLine}
            </button>
          </div>
        </div>
      )}

      <main className="content">
        <section className="type-switch">
          <button
            type="button"
            className={activeType === LABELS.instant ? 'mode-button active' : 'mode-button'}
            onClick={() => setActiveType(LABELS.instant)}
          >
            {LABELS.instant}
          </button>
          <button
            type="button"
            className={activeType === LABELS.preorder ? 'mode-button active' : 'mode-button'}
            onClick={() => setActiveType(LABELS.preorder)}
          >
            {LABELS.preorder}
          </button>
        </section>

        <section className="category-strip">
          {CATEGORY_OPTIONS.map((category) => (
            <button
              key={category}
              type="button"
              className={activeCategory === category ? 'category-button active' : 'category-button'}
              onClick={() => setActiveCategory(category)}
            >
              {category}
            </button>
          ))}
        </section>

        <section className="status-row">
          <div>
            <p className="eyebrow">{LABELS.currentChat}</p>
            <strong>{selectedChat}</strong>
          </div>
          <div>
            <p className="eyebrow">{LABELS.loadState}</p>
            <strong>{hasMore ? LABELS.autoLoad : LABELS.noMoreDeals}</strong>
          </div>
        </section>

        <section className="deal-grid">
          {visibleDeals.map((deal) => (
            <article key={deal.id} className="deal-card">
              <div className="deal-image-wrap">
                <img src={deal.image} alt={deal.name} className="deal-image" />
                <span className="countdown-badge">
                  {LABELS.countdownLeft} {deal.countdown}
                </span>
              </div>

              <div className="deal-body">
                <div className="deal-main">
                  <div className="deal-title-row">
                    <h3>{deal.name}</h3>
                    <span
                      className={
                        deal.type === LABELS.instant ? 'type-pill instant' : 'type-pill preorder'
                      }
                    >
                      {deal.type}
                    </span>
                  </div>
                  <ul className="deal-metrics">
                    <li>
                      {LABELS.remaining} {deal.remaining} {LABELS.itemUnit}
                    </li>
                    <li>
                      {LABELS.unitPrice} NT$ {deal.price}
                    </li>
                    <li>{deal.store}</li>
                  </ul>
                </div>

                <div className="deal-footer">
                  <div className="footer-item">
                    <span className="footer-label">{LABELS.leader}</span>
                    <strong>{deal.leader}</strong>
                  </div>
                  <div className="footer-item">
                    <span className="footer-label">{LABELS.creditScore}</span>
                    <strong>{deal.score}</strong>
                  </div>
                  <div className="footer-item place">
                    <span className="footer-label">{LABELS.meetupPlace}</span>
                    <strong>{deal.place}</strong>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </section>

        <div ref={sentinelRef} className="list-sentinel">
          {hasMore ? LABELS.loadingMore : LABELS.noMoreData}
        </div>
      </main>

      <footer className="bottom-bar">
        <label className="search-box">
          <input
            type="search"
            placeholder={LABELS.searchPlaceholder}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <button type="button" className="create-button">
          {LABELS.createDeal}
        </button>
      </footer>
    </div>
  );
}

export default App;
