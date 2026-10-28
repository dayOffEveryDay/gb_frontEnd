export default function LegacyRequestForm({
  isProxyRequestFormOpen,
  setIsProxyRequestFormOpen,
  handleSubmitProxyPurchaseRequest,
  requestRewardMethod,
  setRequestRewardMethod,
  requestDeliveryMethod,
  setRequestDeliveryMethod,
  requestCompletionTimeMode,
  setRequestCompletionTimeMode,
  requestDeadlineMode,
  setRequestDeadlineMode,
  requestDraftMessage,
}) {
  return (
    <>
      {isProxyRequestFormOpen && (
        <div className="modal-backdrop" onClick={() => setIsProxyRequestFormOpen(false)}>
          <div className="login-modal create-campaign-modal proxy-request-modal" onClick={(event) => event.stopPropagation()}>
            <div className="modal-top-row">
              <p className="eyebrow">託購建單</p>
              <button type="button" className="modal-close" onClick={() => setIsProxyRequestFormOpen(false)}>
                關閉
              </button>
            </div>
            <h2 className="modal-title">發起委託</h2>
            <form className="proxy-request-form" onSubmit={handleSubmitProxyPurchaseRequest}>
              <section className="proxy-request-section">
                <div className="proxy-request-section-title">
                  <span>一</span>
                  <div>
                    <h3>商品資訊</h3>
                    <p>填寫想委託代購的商品內容。</p>
                  </div>
                </div>

                <label className="form-field">
                  <span>商品名稱 *</span>
                  <input type="text" name="productName" placeholder="例：好市多衛生紙" required />
                </label>

                <label className="form-field">
                  <span>商品分類 *</span>
                  <select name="category" required defaultValue="">
                    <option value="" disabled>
                      請選擇分類
                    </option>
                    <option value="fresh">生鮮</option>
                    <option value="daily">日用品</option>
                    <option value="drink">飲料</option>
                    <option value="other">其他</option>
                  </select>
                </label>

                <label className="form-field">
                  <span>商品圖片（可選）</span>
                  <input type="file" name="images" accept="image/*" multiple />
                  <small>最多 1～3 張</small>
                </label>

                <label className="form-field">
                  <span>商品備註（可選）</span>
                  <textarea name="note" rows="3" placeholder="例：指定品牌 / 包裝 / 規格" />
                </label>
              </section>

              <section className="proxy-request-section">
                <div className="proxy-request-section-title">
                  <span>二</span>
                  <div>
                    <h3>報酬設定（幫買費）</h3>
                    <p>設定代購者可取得的幫買報酬。</p>
                  </div>
                </div>

                <fieldset className="option-group">
                  <legend>幫買報酬方式 *</legend>
                  <label>
                    <input
                      type="radio"
                      name="rewardMethod"
                      value="fixed"
                      checked={requestRewardMethod === 'fixed'}
                      onChange={(event) => setRequestRewardMethod(event.target.value)}
                    />
                    固定報酬
                  </label>
                  {requestRewardMethod === 'fixed' && (
                    <label className="form-field nested-field">
                      <span>報酬金額 *</span>
                      <input type="number" min="0" inputMode="numeric" placeholder="元" required />
                    </label>
                  )}
                  <label>
                    <input
                      type="radio"
                      name="rewardMethod"
                      value="quote"
                      checked={requestRewardMethod === 'quote'}
                      onChange={(event) => setRequestRewardMethod(event.target.value)}
                    />
                    由代購者報價（可議價）
                  </label>
                  <p className="field-hint">商品費用由代購者先行支付，交貨時另行結算。</p>
                </fieldset>
              </section>

              <section className="proxy-request-section">
                <div className="proxy-request-section-title">
                  <span>三</span>
                  <div>
                    <h3>收貨方式</h3>
                    <p>依選擇顯示對應資訊欄位。</p>
                  </div>
                </div>

                <fieldset className="option-group">
                  <legend>收貨方式 *</legend>
                  <label>
                    <input
                      type="radio"
                      name="deliveryMethod"
                      value="meetup"
                      checked={requestDeliveryMethod === 'meetup'}
                      onChange={(event) => setRequestDeliveryMethod(event.target.value)}
                    />
                    面交
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="deliveryMethod"
                      value="store"
                      checked={requestDeliveryMethod === 'store'}
                      onChange={(event) => setRequestDeliveryMethod(event.target.value)}
                    />
                    店到店（超商）
                  </label>
                  {requestDeliveryMethod === 'store' && (
                    <label className="form-field nested-field">
                      <span>超商 / 門市資訊 *</span>
                      <input type="text" placeholder="例：7-11 中和門市" required />
                    </label>
                  )}
                  <label>
                    <input
                      type="radio"
                      name="deliveryMethod"
                      value="home"
                      checked={requestDeliveryMethod === 'home'}
                      onChange={(event) => setRequestDeliveryMethod(event.target.value)}
                    />
                    宅配
                  </label>
                  {requestDeliveryMethod === 'home' && (
                    <label className="form-field nested-field">
                      <span>收件地址 *</span>
                      <textarea rows="3" placeholder="請輸入完整收件地址" required />
                    </label>
                  )}
                </fieldset>
              </section>

              <section className="proxy-request-section">
                <div className="proxy-request-section-title">
                  <span>四</span>
                  <div>
                    <h3>交貨時間（代購完成時間）</h3>
                    <p>設定希望代購完成的時間。</p>
                  </div>
                </div>

                <fieldset className="option-group">
                  <legend>交貨時間 *</legend>
                  <label>
                    <input
                      type="radio"
                      name="completionTimeMode"
                      value="specific"
                      checked={requestCompletionTimeMode === 'specific'}
                      onChange={(event) => setRequestCompletionTimeMode(event.target.value)}
                    />
                    指定時間
                  </label>
                  {requestCompletionTimeMode === 'specific' && (
                    <label className="form-field nested-field">
                      <span>日期 + 時間 *</span>
                      <input type="datetime-local" required />
                    </label>
                  )}
                  <label>
                    <input
                      type="radio"
                      name="completionTimeMode"
                      value="flexible"
                      checked={requestCompletionTimeMode === 'flexible'}
                      onChange={(event) => setRequestCompletionTimeMode(event.target.value)}
                    />
                    時間可協調
                  </label>
                </fieldset>
              </section>

              <section className="proxy-request-section">
                <div className="proxy-request-section-title">
                  <span>五</span>
                  <div>
                    <h3>委託期限（接單期限）</h3>
                    <p>設定代購者可接單的期限。</p>
                  </div>
                </div>

                <fieldset className="option-group">
                  <legend>委託期限 *</legend>
                  <label>
                    <input
                      type="radio"
                      name="deadlineMode"
                      value="specific"
                      checked={requestDeadlineMode === 'specific'}
                      onChange={(event) => setRequestDeadlineMode(event.target.value)}
                    />
                    指定截止時間
                  </label>
                  {requestDeadlineMode === 'specific' && (
                    <label className="form-field nested-field">
                      <span>日期 + 時間 *</span>
                      <input type="datetime-local" required />
                    </label>
                  )}
                  <label>
                    <input
                      type="radio"
                      name="deadlineMode"
                      value="longTerm"
                      checked={requestDeadlineMode === 'longTerm'}
                      onChange={(event) => setRequestDeadlineMode(event.target.value)}
                    />
                    長期有效（直到有人接單）
                  </label>
                </fieldset>
              </section>

              <section className="proxy-request-section">
                <div className="proxy-request-section-title">
                  <span>六</span>
                  <div>
                    <h3>進階條件（可選）</h3>
                    <p>限制接單者條件。</p>
                  </div>
                </div>

                <label className="form-field">
                  <span>限制接單者條件（可選）</span>
                  <textarea rows="3" placeholder="例：信用分數 80 以上 / 有好市多會員 / 可今日交貨" />
                </label>
              </section>

              <div className="proxy-request-submit-row">
                {requestDraftMessage && <p className="status-message">{requestDraftMessage}</p>}
                <button type="submit" className="create-button active">
                  發起委託
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
