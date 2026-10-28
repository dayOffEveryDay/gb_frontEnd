import { CardViewIcon, CompactViewIcon } from '../icons/Icons';

export default function DealViewControl({
  isVisible: isDealViewControlVisible,
  viewMode: dealViewMode,
  onChange: handleChangeDealViewMode,
}) {
  return (
    <div
      className={isDealViewControlVisible ? 'floating-view-control' : 'floating-view-control hidden'}
      aria-label="檢視模式"
    >
      <button
        type="button"
        className={dealViewMode === 'card' ? 'floating-view-button active' : 'floating-view-button'}
        onClick={() => handleChangeDealViewMode('card')}
        aria-pressed={dealViewMode === 'card'}
        aria-label="卡片檢視"
        title="卡片檢視"
      >
        <CardViewIcon />
      </button>
      <button
        type="button"
        className={dealViewMode === 'compact' ? 'floating-view-button active' : 'floating-view-button'}
        onClick={() => handleChangeDealViewMode('compact')}
        aria-pressed={dealViewMode === 'compact'}
        aria-label="精簡檢視"
        title="精簡檢視"
      >
        <CompactViewIcon />
      </button>
    </div>
  );
}
