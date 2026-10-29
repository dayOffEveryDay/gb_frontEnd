# 共用功能控制器

`HomePage` 組合各功能與分頁，保留共同父路由的生命週期。此目錄不改動畫面、樣式或 API 合約。

| 控制器 | 責任 |
| --- | --- |
| `account/useAccount` | 登入、LINE callback、跨視窗登入同步、到期提示、登出與個人資料儲存 |
| `account/useProfileNavigation` | 開啟個人頁、保存來源頁篩選與捲動位置、返回時還原聊天室 |
| `notifications/useNotifications` | 未讀與已讀查詢、輪詢、WebSocket、即時提示、音效與標記已讀 |
| `notifications/useNotificationNavigation` | 將通知導向詢問、託購訂單、聊天室、參團管理或評價 |
| `notifications/useSuccessToast` | 操作提示及計時器清理 |
| `chat/useChatRooms` | 聊天室清單、交易狀態排序、未讀數、權限撤銷、聊天室與訂單視窗狀態 |
| `chat/useChatNavigation` | 合購／託購聊天室開啟與關閉、通知／聊天室清單／參團管理的返回上下文 |
| `useSessionTask` | 登出、憑證更換或卸載後，使先前的非同步操作失效 |

## 相依方向

- 帳號控制器不直接操作通知或聊天室狀態；各控制器依帳號變更清理自身資料。
- 同一帳號更新 token 會更新連線及請求，但不關閉正在使用的聊天室。
- 通知連線將聊天室權限事件交給 `useChatRooms`；跨頁通知由獨立導覽控制器處理。
- 聊天室與參團管理互相開啟時，以延後呼叫的 callback 連接，避免在 render 階段形成初始化循環。
- 登入後、帳號切換或登出時，舊非同步結果不能重新填回私人資料。聊天室重疊查詢以最後啟動的一次為準。

## 驗證

`npm run test:shared` 使用實際 hooks 與 helper，模擬 API、React lifecycle、WebSocket 及計時器，驗證登入來源、登出競態、通知更新、未讀數與跨頁返回；不啟動專案、不連後端。

手動重點：LINE 登入與登出、個人頁返回位置、通知音效與未讀狀態、從通知／我的／參團管理開啟聊天室再返回，以及聊天室權限撤銷。
