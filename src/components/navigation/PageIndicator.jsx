export default function PageIndicator({ tabs: swipeTabs, activeTab }) {
  return (
    <div className="swipe-page-indicator" aria-label="頁面位置：可左右滑動切換">
      {swipeTabs.map((tab) => (
        <span key={tab} className={tab === activeTab ? 'active' : ''}></span>
      ))}
    </div>
  );
}
