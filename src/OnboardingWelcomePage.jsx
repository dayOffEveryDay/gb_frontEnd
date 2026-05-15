import { useNavigate } from 'react-router-dom';
import { getStoredUser } from './api';
import { markOnboardingCompleted } from './onboardingUtils';

function OnboardingWelcomePage() {
  const navigate = useNavigate();
  const user = getStoredUser();

  const handleStart = () => {
    markOnboardingCompleted(user?.id);
    navigate('/', { replace: true });
  };

  const handleOpenGuide = () => {
    markOnboardingCompleted(user?.id);
    navigate('/guide');
  };

  return (
    <div className="app-shell onboarding-shell">
      <section className="onboarding-card onboarding-welcome-card">
        <p className="eyebrow">歡迎加入 GBC</p>
        <h1>一起把 Costco 商品分享得更方便</h1>
        <p className="onboarding-copy">
          GBC 是一個讓使用者彼此發起與參與 Costco 商品分享的平台。你可以加入別人已開好的團，也可以提出自己的購買需求。
        </p>

        <div className="onboarding-info-grid">
          <article>
            <h2>合購</h2>
            <p>由主揪先建立團購，其他人可以查看商品、價格與數量後加入。</p>
          </article>
          <article>
            <h2>託購</h2>
            <p>由需要商品的人先提出需求，等待其他使用者承接或回覆。</p>
          </article>
          <article>
            <h2>主要入口</h2>
            <p>下方導覽列可以前往「我的」、「合購」與「託購」；個人資料與設定可從頭像進入。</p>
          </article>
          <article>
            <h2>交易提醒</h2>
            <p>本站不處理金流。加入合購或託購前，請自行確認價格、匯款與交付方式，務必謹慎交易。</p>
          </article>
        </div>

        <div className="onboarding-actions">
          <button type="button" className="secondary-button" onClick={handleStart}>
            開始使用
          </button>
          <button type="button" className="save-button" onClick={handleOpenGuide}>
            查看狀態說明
          </button>
        </div>
      </section>
    </div>
  );
}

export default OnboardingWelcomePage;
