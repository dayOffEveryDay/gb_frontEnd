import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import './App.css';
import {
  fetchPublicCampaign,
  getStoredToken,
  joinCampaign,
} from './api';
import DealCard from './DealCard';
import ImageGalleryModal from './ImageGalleryModal';
import JoinCampaignModal from './JoinCampaignModal';
import { LABELS } from './homeConfig';
import {
  formatCountdown,
  formatDateTime,
  getScenarioLabel,
  getTypeClass,
  mapCampaign,
} from './homeUtils';
import { shareCampaign } from './shareUtils';

const SHARE_LABELS = {
  ...LABELS,
  joinCampaign: '加入團購',
  purchaseQuantity: '認購數量',
  confirmJoinCampaign: '確認加入',
  submittingJoinCampaign: '送出中...',
};

function getLoadErrorMessage(error) {
  if (error?.status === 404) {
    return '找不到這筆團購，連結可能有誤或內容已被刪除。';
  }

  if (error?.status === 410) {
    return '這筆團購已下架，無法再查看。';
  }

  return error?.message || '目前無法載入這筆團購，請稍後再試。';
}

function ShareCampaignPage() {
  const { campaignId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const token = getStoredToken();
  const [campaign, setCampaign] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedDeal, setSelectedDeal] = useState(null);
  const [purchaseQuantity, setPurchaseQuantity] = useState('1');
  const [purchaseError, setPurchaseError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [galleryIndex, setGalleryIndex] = useState(null);
  const [countdownNow, setCountdownNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setCountdownNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let isActive = true;

    const loadCampaign = async () => {
      setIsLoading(true);
      setLoadError('');

      try {
        const data = await fetchPublicCampaign(campaignId);
        if (isActive) {
          setCampaign(mapCampaign(data, 0));
        }
      } catch (error) {
        if (isActive) {
          setCampaign(null);
          setLoadError(getLoadErrorMessage(error));
        }
      } finally {
        if (isActive) {
          setIsLoading(false);
        }
      }
    };

    void loadCampaign();
    return () => {
      isActive = false;
    };
  }, [campaignId]);

  const galleryImages = useMemo(() => campaign?.imageUrls ?? [], [campaign?.imageUrls]);

  const handleOpenJoin = (deal) => {
    if (!token) {
      const returnTo = location.pathname;
      navigate(`/login?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }

    setSelectedDeal(deal);
    setPurchaseQuantity('1');
    setPurchaseError('');
  };

  const handleSubmitJoin = async () => {
    const quantity = Number(purchaseQuantity);

    if (!Number.isInteger(quantity) || quantity <= 0) {
      setPurchaseError('請輸入正整數的認購數量。');
      return;
    }

    if (quantity > Number(selectedDeal?.availableQuantity ?? 0)) {
      setPurchaseError('認購數量不能超過剩餘數量。');
      return;
    }

    setIsSubmitting(true);
    setPurchaseError('');

    try {
      const response = await joinCampaign(selectedDeal.id, { quantity }, token);
      const nextAvailableQuantity =
        response?.availableQuantity ??
        response?.available_quantity ??
        Math.max(0, Number(selectedDeal.availableQuantity) - quantity);

      setCampaign((current) => current ? {
        ...current,
        availableQuantity: nextAvailableQuantity,
        canJoin: nextAvailableQuantity > 0,
      } : current);
      setSelectedDeal(null);
      setPurchaseQuantity('1');
      setSuccessMessage(`已加入「${selectedDeal.itemName}」，認購 ${quantity} 件。`);
    } catch (error) {
      setPurchaseError(error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const closeGallery = () => setGalleryIndex(null);
  const stepGallery = (direction) => {
    setGalleryIndex((current) => {
      if (current == null || galleryImages.length === 0) return current;
      return (current + direction + galleryImages.length) % galleryImages.length;
    });
  };

  return (
    <div className="share-campaign-page">
      <header className="share-campaign-topbar">
        <button type="button" className="share-brand" onClick={() => navigate('/')}>Good Buy Costco</button>
        <span>團購分享</span>
      </header>

      <main className="share-campaign-content">
        <div className="share-campaign-heading">
          <div>
            <p className="eyebrow">團購分享</p>
            <h1>一起看看這筆團購</h1>
          </div>
          <button type="button" className="ghost-button" onClick={() => navigate('/')}>查看更多合購</button>
        </div>

        {isLoading && <section className="share-campaign-state">正在載入團購資料...</section>}

        {!isLoading && loadError && (
          <section className="share-campaign-state error">
            <h2>無法顯示團購</h2>
            <p>{loadError}</p>
            <button type="button" className="save-button" onClick={() => navigate('/')}>返回合購首頁</button>
          </section>
        )}

        {!isLoading && campaign && (
          <>
            {successMessage && <div className="share-campaign-success" role="status">{successMessage}</div>}
            <DealCard
              labels={SHARE_LABELS}
              deal={campaign}
              countdownNow={countdownNow}
              formatCountdown={formatCountdown}
              formatDateTime={formatDateTime}
              getScenarioLabel={getScenarioLabel}
              getTypeClass={getTypeClass}
              onJoin={handleOpenJoin}
              onOpenGallery={(_, index) => setGalleryIndex(index)}
              onOpenUserProfile={(profileUser) => profileUser?.id && navigate(`/users/${profileUser.id}`)}
              onShare={shareCampaign}
              showJoinAction={campaign.canJoin !== false}
            />
            {!token && campaign.canJoin !== false && (
              <p className="share-login-note">點擊「加入」後登入，即可返回這一頁完成認購。</p>
            )}
          </>
        )}
      </main>

      <JoinCampaignModal
        isOpen={Boolean(selectedDeal)}
        labels={SHARE_LABELS}
        selectedDeal={selectedDeal}
        purchaseQuantity={purchaseQuantity}
        purchaseError={purchaseError}
        isSubmitting={isSubmitting}
        onClose={() => !isSubmitting && setSelectedDeal(null)}
        onChangeQuantity={setPurchaseQuantity}
        onSubmit={handleSubmitJoin}
      />

      <ImageGalleryModal
        isOpen={galleryIndex != null}
        title={campaign?.itemName ?? '團購圖片'}
        images={galleryImages}
        activeIndex={galleryIndex ?? 0}
        onClose={closeGallery}
        onPrev={() => stepGallery(-1)}
        onNext={() => stepGallery(1)}
        onSelect={setGalleryIndex}
      />
    </div>
  );
}

export default ShareCampaignPage;
