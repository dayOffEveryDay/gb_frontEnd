import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const groupBuyStatuses = [
  {
    label: '進行中',
    description: '這筆合購仍在進行，可能還在開放加入，或正在等待後續交付完成。',
  },
  {
    label: '已完成',
    description: '這筆合購已順利結束。',
  },
  {
    label: '失敗',
    description: '這筆合購沒有順利成立或已被取消。',
  },
  {
    label: '異常',
    description: '這筆合購出現爭議、未到場或其他需要特別留意的情況。',
  },
];

const purchaseRequestStatuses = [
  {
    label: '開放中',
    description: '需求已建立，正在等待其他使用者承接或回覆。',
  },
  {
    label: '已指派',
    description: '已有使用者承接這筆託購，雙方可繼續確認細節。',
  },
  {
    label: '已交付',
    description: '商品已完成交付，等待最後確認。',
  },
  {
    label: '已完成',
    description: '這筆託購已順利結束。',
  },
  {
    label: '已取消',
    description: '需求已由發起者取消。',
  },
  {
    label: '已過期',
    description: '在期限內沒有完成承接或處理，需求已失效。',
  },
];

function GuidePage() {
  const navigate = useNavigate();
  const [activeIndex, setActiveIndex] = useState(0);
  const slides = [
    {
      eyebrow: '新手導覽',
      title: '先知道這裡怎麼運作',
      content: (
        <>
          <p>
            GBC 是一個讓使用者彼此發起與參與 Costco 商品分享的平台。你可以加入別人已開好的合購，也可以提出自己的託購需求。
          </p>
          <div className="guide-mini-grid">
            <article>
              <h2>合購</h2>
              <p>由主揪先建立團購，其他使用者查看商品、價格與數量後加入。</p>
            </article>
            <article>
              <h2>託購</h2>
              <p>由需要商品的人先提出需求，等待其他使用者承接或回覆。</p>
            </article>
          </div>
        </>
      ),
    },
    {
      eyebrow: '主要入口',
      title: '要去哪裡看',
      content: (
        <div className="guide-slide-list">
          <div>
            <strong>我的</strong>
            <p>查看自己發起、參與的合購，以及後續狀態。</p>
          </div>
          <div>
            <strong>合購</strong>
            <p>瀏覽目前開放中的合購團。</p>
          </div>
          <div>
            <strong>託購</strong>
            <p>查看他人的託購需求，或發起自己的需求。</p>
          </div>
          <div>
            <strong>設定</strong>
            <p>點選頭像後，可進入個人頁與帳號設定。</p>
          </div>
        </div>
      ),
    },
    {
      eyebrow: '合購狀態',
      title: '你在「我的」裡會看到',
      content: (
        <div className="guide-status-list">
          {groupBuyStatuses.map((status) => (
            <div key={status.label} className="guide-status-item">
              <strong>{status.label}</strong>
              <p>{status.description}</p>
            </div>
          ))}
        </div>
      ),
    },
    {
      eyebrow: '託購狀態',
      title: '一筆需求會怎麼流轉',
      content: (
        <div className="guide-status-list">
          {purchaseRequestStatuses.map((status) => (
            <div key={status.label} className="guide-status-item">
              <strong>{status.label}</strong>
              <p>{status.description}</p>
            </div>
          ))}
        </div>
      ),
    },
    {
      eyebrow: '交易提醒',
      title: '平台不處理金流',
      content: (
        <>
          <p>
            本站提供的是資訊媒合與交流功能，不處理任何金流，也不代為保管款項。
          </p>
          <p>
            加入合購或託購前，請自行確認對方身分、價格、匯款、收款與交付方式，涉及金錢往來時務必保持謹慎。
          </p>
        </>
      ),
    },
  ];

  const activeSlide = slides[activeIndex];

  const goToPrevious = () => {
    setActiveIndex((current) => Math.max(0, current - 1));
  };

  const goToNext = () => {
    setActiveIndex((current) => Math.min(slides.length - 1, current + 1));
  };

  const handleTouchStart = (event) => {
    event.currentTarget.dataset.touchStartX = String(event.touches?.[0]?.clientX ?? '');
  };

  const handleTouchEnd = (event) => {
    const startX = Number(event.currentTarget.dataset.touchStartX);
    const endX = event.changedTouches?.[0]?.clientX;
    if (!Number.isFinite(startX) || endX == null || Math.abs(endX - startX) < 40) {
      return;
    }

    if (endX < startX) {
      goToNext();
      return;
    }

    goToPrevious();
  };

  return (
    <div className="app-shell guide-shell">
      <section className="guide-carousel-shell">
        <div className="guide-progress-row">
          <span>
            {activeIndex + 1} / {slides.length}
          </span>
          <div className="guide-dot-row" aria-label="導覽頁面">
            {slides.map((slide, index) => (
              <button
                key={slide.title}
                type="button"
                className={index === activeIndex ? 'guide-dot active' : 'guide-dot'}
                onClick={() => setActiveIndex(index)}
                aria-label={`前往第 ${index + 1} 頁`}
              />
            ))}
          </div>
        </div>

        <article className="guide-slide-card" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          <p className="eyebrow">{activeSlide.eyebrow}</p>
          <h1>{activeSlide.title}</h1>
          <div className="guide-slide-content">{activeSlide.content}</div>
        </article>

        <div className="guide-page-actions">
          <button
            type="button"
            className={activeIndex > 0 ? 'secondary-button' : 'secondary-button guide-action-placeholder'}
            onClick={goToPrevious}
            aria-hidden={activeIndex === 0}
            tabIndex={activeIndex === 0 ? -1 : 0}
          >
            上一頁
          </button>
          {activeIndex < slides.length - 1 ? (
            <button type="button" className="save-button" onClick={goToNext}>
              下一頁
            </button>
          ) : (
            <button type="button" className="save-button" onClick={() => navigate('/')}>
              開始使用
            </button>
          )}
        </div>
      </section>
    </div>
  );
}

export default GuidePage;
