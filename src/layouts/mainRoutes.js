export const MAIN_TABS = ['MINE', 'CAMPAIGN', 'REQUEST', 'INQUIRY'];
export const MAIN_PATHS = {
  MINE: '/mine',
  CAMPAIGN: '/campaigns',
  REQUEST: '/requests',
  INQUIRY: '/inquiries',
};

export function mainTab(type) {
  return type === 'INSTANT' || type === 'SCHEDULED' ? 'CAMPAIGN' : type;
}

export function mainPath(type) {
  return MAIN_PATHS[mainTab(type)] ?? MAIN_PATHS.CAMPAIGN;
}

export function pageType(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';
  // 開啟問題詳情時，主導覽仍選取詢問分頁。
  if (path.startsWith('/inquiries/')) return 'INQUIRY';
  const tab = MAIN_TABS.find(key => MAIN_PATHS[key] === path) ?? 'CAMPAIGN';
  return tab === 'CAMPAIGN' ? 'SCHEDULED' : tab;
}

export function transitionDirection(previous, next) {
  return MAIN_TABS.indexOf(mainTab(next)) >= MAIN_TABS.indexOf(mainTab(previous)) ? 'forward' : 'backward';
}

export function homeRedirect(state) {
  return state?.focusCampaignId ? MAIN_PATHS.MINE : mainPath(state?.activeType);
}
