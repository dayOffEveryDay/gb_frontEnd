# 四個主分頁與分頁控制邏輯

| 元件 | 現有切換值 | 呈現內容 |
| --- | --- | --- |
| `mine/MinePage.jsx` | `MINE` | 我的分類、參與角色與狀態篩選、我的合購／託購列表 |
| `campaigns/CampaignsPage.jsx` | `SCHEDULED`／`INSTANT` 等合購值 | 合購標題、開團入口、類型／商品篩選、共用團購列表 |
| `requests/RequestsPage.jsx` | `REQUEST` | 託購標題、建立委託入口及 `PurchaseRequestsPanel` |
| `inquiries/InquiriesPage.jsx` | `INQUIRY` | 首頁內嵌的 `InquiryPanel`、詢問目標與詳情狀態回傳 |

## 狀態、API 與副作用的歸屬

| 所屬目錄 | 責任 |
| --- | --- |
| `campaigns/useCampaignsPageState.js` | 合購篩選、開團表單、參團表單與成功摘要狀態 |
| `campaigns/useCampaignsFeed.js` | 多門市查詢、去重、分頁、篩選持久化、背景輪詢與視窗焦點刷新 |
| `campaigns/useCampaignActions.js` | 開團／參團驗證及 API、預設面交時間、成功摘要計時 |
| `mine/useMinePageState.js` | 我的分類／角色／狀態篩選、管理視窗與評價狀態 |
| `mine/useMineCampaigns.js` | 我發起／我參加查詢、聊天權限、操作前更新資料、指定團購定位 |
| `mine/useParticipationActions.js` | 修改數量、退出、取消、交貨、收貨、爭議、成員管理與評價；供聊天室共用 |
| `mine/useCampaignGallery.js` | 團購圖片瀏覽、排序與儲存 API；供列表及管理視窗共用 |
| `requests/useRequestsPage.js` | 建立入口及視窗開關、保留的舊表單狀態 |
| `requests/PurchaseRequestsPanel.jsx` | 託購查詢、篩選、建立、編輯、報價、訂單與評價的既有狀態／API／effects；「我的託購」共用此功能模組 |
| `inquiries/useInquiriesPage.js` | 通知指定詢問、詳情開關狀態 |
| `inquiries/InquiryPage.jsx` | 詢問列表、建立、回答、追蹤與詳情的既有狀態／API／effects；也提供原有獨立詢問路由 |

分頁 hook 由 `HomePage` 持續組合，四個分頁由巢狀路由的 `Outlet` 呈現，透過 `useOutletContext` 取得控制器。切換主分頁不會卸載共同父層，讓篩選和跨頁操作視窗延續，也讓通知或聊天室可開啟目前未顯示分頁的操作。

## 分頁網址

| 網址 | 分頁 |
| --- | --- |
| `/mine` | 我的 |
| `/campaigns` | 合購 |
| `/requests` | 託購 |
| `/inquiries` | 發問 |

`/` 以 replace 導向 `/campaigns`；帶有舊版 `activeType` 或 `focusCampaignId` 的入口會轉至對應頁並保留其他 state。`/campaigns/:campaignId`、`/share/campaigns/:campaignId`、`/inquiries/new` 與個人頁沿用原路由。詢問詳情使用 `/inquiries/qid=5`，保留共用主版型，並相容 `/inquiries/5` 舊網址；直接進入、重新整理及上一頁／下一頁皆由路由決定問題。

目前分頁以 URL 為唯一來源，導覽和滑動都使用 React Router。上一頁／下一頁也會更新選取項目和轉場方向。`useSessionPreference` 在同一瀏覽器分頁保存搜尋、門市與各頁篩選，重新整理仍保留；不保存表單、聊天或 API 資料。`usePageScroll` 記錄各網址的捲動位置，資料呈現後嘗試還原；使用者主動操作或 5 秒後停止等待。明確的通知／團購定位優先於一般捲動還原。

合購與我的列表各自擁有 `useCampaignFeed` 實例。停用頁面、改變查詢或重新整理會使舊請求失效；載入更多避免重複請求。我的快取在登入憑證變更時清除。跨頁的團購狀態／圖片／數量更新會同步套用到兩份快取；合購的篩選不會刪除我的列表資料。

## 保留的行為

- `AppRoutes.jsx` 定義四個主分頁，共用 `HomePage` 與 `MainLayout`。`App.jsx` 提供唯一的 `BrowserRouter`。
- 保留外層 `.content`、帶有 `key={activeType}` 的 `.page-transition` 與動畫方向。分頁不新增包裹 DOM。
- `layouts/MainLayout.jsx` 集中頁首、搜尋、手機／桌面導覽、指示器、檢視切換、提示及跨頁視窗插槽；手勢與導覽控制放在 `layouts/useMainNavigation.js`。
- 「我的」與「合購」共用 `components/campaign/CampaignList.jsx`，保留原本的精簡列、展開卡片、權限判斷、錯誤顯示及 sentinel ref。
- `inquiries/InquiryPage.jsx` 仍處理既有獨立詢問路由；`InquiriesPage` 負責主介面的內嵌分頁。
- `requests/components/LegacyRequestForm.jsx` 保留原有 `REQUEST_DISABLED` 分支，不增加導覽入口、不更動其行為；後續另行評估清理。
- CSS 檔案及其載入順序保持原樣。

## 自動驗證

- `npm run test:pages`：驗證過期回應、切頁重新載入、獨立快取、登出、分頁互斥、背景刷新錯誤與操作前查詢；使用 Node VM hook lifecycle harness，不連接後端、不啟動伺服器。
- `npm run test:routes`：驗證路徑映射、滑動邊界／方向、觸控取消、搜尋返回，並用實際路由配置驗證四頁直接渲染、共用父路由與上一頁／下一頁 state；SSR 編譯不啟動伺服器。
- `npm run lint`、`npm run build`。
- 上一階段已比對拆分前後 10 組初始 HTML；本階段新增路由測試，CSS 建置產物雜湊維持一致。

## 手動驗收

1. 透過手機導覽、桌面導覽及左右滑動切換四頁，確認顯示內容、轉場方向和頁面指示器。
2. 合購切換全部／即時／預購、商品分類、隱藏已滿、卡片／精簡檢視；檢查載入更多及卡片展開。
3. 我的切換團購／託購、我發起／我參加及狀態；確認各操作視窗、聊天室入口正常。
4. 託購開關建立表單、查看訂單、報價，確認頁首按鈕與底部入口操作一致。
5. 詢問開啟詳情、返回列表；從通知進入指定詢問，確認導覽顯示／隱藏正常。
6. 切頁前後檢查搜尋、門市條件、返回個人頁後的還原行為與原版本一致。
7. 網路較慢時快速切換合購／我的與篩選，確認清單不被前一個請求覆蓋；登入後切到別頁再登出，確認我的資料清除。
8. 從通知／聊天室開啟參團管理、評價或訂單，關閉後確認返回位置及列表狀態；檢查合購在背景停止輪詢、回到頁面後重新載入。
9. 分別直接開啟四個網址並重新整理，確認頁面正確；依序切換後使用瀏覽器上一頁／下一頁，確認 URL、選取頁籤及轉場一致。
10. 修改四頁的篩選、切頁、返回與重新整理，確認搜尋／門市／篩選保留；長列表返回時檢查捲動位置，從信用紀錄定位團購時以目標團購優先。

正式環境須讓四個主頁網址回傳 SPA 的 `index.html`（與既有 BrowserRouter 詳情路由相同）；本次不變更部署設定。

專案由使用者自行啟動。靜態比對及建置無法取代登入後的完整流程與實機觸控驗收。
