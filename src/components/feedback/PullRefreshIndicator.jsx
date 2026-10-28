export default function PullRefreshIndicator({ isRefreshing, pullDistance }) {
  return (
    <div
      className={`pull-refresh-indicator${isRefreshing ? ' refreshing' : ''}${pullDistance >= 60 ? ' ready' : ''}`}
      style={{ height: isRefreshing ? 52 : pullDistance }}
    >
      <span>{isRefreshing ? '刷新中...' : pullDistance >= 60 ? '放開即可刷新' : '下拉刷新首頁'}</span>
    </div>
  );
}
