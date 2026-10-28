import { MyDealsIcon, CartHandshakeIcon, BulbIcon, SearchIcon } from '../icons/Icons';

export default function MobileNavigation({
  containerRef: navigationRef,
  activeType,
  isOpen: isNavigationOpen,
  onNavigate: switchActiveType,
  onOpenSearch: handleOpenMobileSearch,
  onToggle,
}) {
  return (
    <div ref={navigationRef} className="mobile-navigation-fab">
      {isNavigationOpen && (
        <div className="mobile-navigation-menu" id="mobile-navigation-menu" role="menu">
          <button
            type="button"
            className={`mobile-navigation-item ${activeType === 'MINE' ? 'active' : ''}`}
            role="menuitem"
            aria-current={activeType === 'MINE' ? 'page' : undefined}
            onClick={() => switchActiveType('MINE')}
          >
            <span className="mobile-navigation-item-icon"><MyDealsIcon /></span>
            <span>我的</span>
          </button>
          <button
            type="button"
            className={`mobile-navigation-item ${activeType === 'INSTANT' || activeType === 'SCHEDULED' ? 'active' : ''}`}
            role="menuitem"
            aria-current={activeType === 'INSTANT' || activeType === 'SCHEDULED' ? 'page' : undefined}
            onClick={() => switchActiveType('CAMPAIGN')}
          >
            <span className="mobile-navigation-item-icon"><CartHandshakeIcon /></span>
            <span>合購</span>
          </button>
          <button
            type="button"
            className={`mobile-navigation-item ${activeType === 'REQUEST' ? 'active' : ''}`}
            role="menuitem"
            aria-current={activeType === 'REQUEST' ? 'page' : undefined}
            onClick={() => switchActiveType('REQUEST')}
          >
            <span className="mobile-navigation-item-icon"><CartHandshakeIcon /></span>
            <span>託購</span>
          </button>
          <button
            type="button"
            className={`mobile-navigation-item ${activeType === 'INQUIRY' ? 'active' : ''}`}
            role="menuitem"
            aria-current={activeType === 'INQUIRY' ? 'page' : undefined}
            onClick={() => switchActiveType('INQUIRY')}
          >
            <span className="mobile-navigation-item-icon"><BulbIcon /></span>
            <span>詢問</span>
          </button>
          <button
            type="button"
            className="mobile-navigation-item"
            role="menuitem"
            onClick={handleOpenMobileSearch}
          >
            <span className="mobile-navigation-item-icon"><SearchIcon /></span>
            <span>搜尋</span>
          </button>
        </div>
      )}
    
      <div className="mobile-navigation-controls">
        <button
          type="button"
          className={`mobile-navigation-trigger ${isNavigationOpen ? 'open' : ''}`}
          aria-label={isNavigationOpen ? '收合導覽選單' : '展開導覽選單'}
          aria-expanded={isNavigationOpen}
          aria-controls="mobile-navigation-menu"
          onClick={onToggle}
        >
          {isNavigationOpen ? (
            <span className="mobile-navigation-close-icon" aria-hidden="true"></span>
          ) : (
            <span className="mobile-navigation-grid-icon" aria-hidden="true">
              <i></i><i></i><i></i><i></i>
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
