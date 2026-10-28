import { SearchIcon } from '../icons/Icons';

export default function DesktopNavigation({
  activeType,
  isSearchExpanded,
  search,
  searchPlaceholder,
  searchInputRef,
  onNavigate: switchActiveType,
  onOpenSearch,
  onFocusSearch,
  onBlurSearch,
  onSearchChange,
  onCreateRequest,
  onCreateCampaign: handleOpenCreateCampaignForCurrentType,
}) {
  return (
    <footer
      className={[
        'bottom-bar',
        'desktop-bottom-bar',
        isSearchExpanded ? 'search-expanded' : '',
        activeType === 'REQUEST' ? 'request-mode' : '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <button
        type="button"
        className={activeType === 'MINE' ? 'create-button bottom-nav-button active' : 'create-button bottom-nav-button'}
        onClick={() => switchActiveType('MINE')}
        aria-label="我的團購"
        title="我的團購"
      >
        我的
      </button>
      <label
        className="search-box"
        onClick={onOpenSearch}
      >
        <SearchIcon />
        <span className="search-box-label">搜尋</span>
        <input
          ref={searchInputRef}
          type="search"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          onFocus={onFocusSearch}
          onBlur={onBlurSearch}
        />
      </label>
      <button
        type="button"
        className={activeType === 'INQUIRY' ? 'create-button bottom-nav-button active' : 'create-button bottom-nav-button'}
        onClick={() => switchActiveType('INQUIRY')}
        aria-label="詢問區"
        title="詢問區"
      >
        詢問
      </button>
      {activeType === 'MINE' ? (
        <>
          <button
            type="button"
            className="create-button bottom-nav-button"
            onClick={() => switchActiveType('CAMPAIGN')}
            aria-label="合購"
            title="合購"
          >
            合購
          </button>
          <button
            type="button"
            className="create-button bottom-nav-button request-button"
            onClick={() => switchActiveType('REQUEST')}
            aria-label="託購"
            title="託購"
          >
            託購
          </button>
        </>
      ) : activeType === 'REQUEST' ? (
        <>
          <button
            type="button"
            className="create-button bottom-nav-button"
            onClick={() => switchActiveType('CAMPAIGN')}
            aria-label="合購"
            title="合購"
          >
            合購
          </button>
          <button
            type="button"
            className="create-button request-button request-create-button active"
            onClick={onCreateRequest}
            aria-label="發起委託"
            title="發起委託"
          >
            發起委託
          </button>
        </>
      ) : activeType === 'INQUIRY' ? (
        <>
          <button
            type="button"
            className="create-button bottom-nav-button"
            onClick={() => switchActiveType('CAMPAIGN')}
          >
            合購
          </button>
          <button
            type="button"
            className="create-button bottom-nav-button request-button"
            onClick={() => switchActiveType('REQUEST')}
          >
            託購
          </button>
        </>
      ) : (
        <>
          <button
            type="button"
            className="create-button bottom-nav-button request-button"
            onClick={() => switchActiveType('REQUEST')}
            aria-label="託購"
            title="託購"
          >
            託購
          </button>
          <button
            type="button"
            className="create-button active"
            onClick={handleOpenCreateCampaignForCurrentType}
          >
            開團
          </button>
        </>
      )}
    </footer>
  );
}
