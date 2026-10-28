# 主介面共用層

- `MainLayout.jsx`：原有 `.app-shell`、頁首、門市、搜尋、導覽、轉場、下拉刷新提示、通知與成功提示；透過 `children` 放入目前分頁，`overlays` 放入跨頁操作視窗，不額外增加 DOM 包裹。
- `useMainLayoutState.js`：目前頁籤、共用搜尋／門市、手機選單、檢視偏好、手勢 refs、主題及對應瀏覽器監聽。
- `useMainNavigation.js`：原有頁籤切換、左右滑動、下拉刷新觸發、搜尋返回上下文、檢視模式與選單關閉。
- `useReferenceData.js`：共用門市／分類資料及初次載入狀態。
- `mainRoutes.js`、`useMainPageRoute.js`：四頁網址、舊切換值映射、路由切換與轉場方向；URL 是目前分頁的唯一來源。
- `HomeRedirect.jsx`：相容舊首頁及攜帶 state 的入口，以 replace 導向正確分頁。
- `useSessionPreference.js`：同一瀏覽器分頁內的 UI 篩選與搜尋保存。
- `usePageScroll.js`：按路徑保存捲動位置，等候列表呈現後還原；使用者操作或明確定位會優先。

`HomePage` 連接共用登入、通知、聊天與分頁 hook，將登入／聊天／通知及建立入口傳入 layout。分頁業務 API 不放進 layout。內部相容的 `activeType` 由路徑推導，四頁由巢狀 `Outlet` 呈現，父層不因主分頁切換而卸載。
