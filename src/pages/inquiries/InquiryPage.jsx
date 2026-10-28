import useSessionPreference from '../../layouts/useSessionPreference';
/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import "../../InquiryPage.css";
import "../../InquiryPageEmbedded.css";
import { createInquiry, createInquiryAnswer, fetchInquiry, fetchInquiries, fetchSimilarInquiries, fetchStores, followInquiry, getStoredToken, getStoredUser, unfollowInquiry, updateInquiryAnswer } from "../../api";
import ImageGalleryModal from "../../components/media/ImageGalleryModal";

const TYPES = [{ value: '', label: '全部' }, { value: 'STOCK', label: '庫存詢問' }, { value: 'EXPERIENCE', label: '商品心得' }];
const STOCKS = [{ value: 'IN_STOCK', label: '有貨' }, { value: 'LOW_STOCK', label: '少量' }, { value: 'OUT_OF_STOCK', label: '無貨' }, { value: 'UNKNOWN', label: '不確定' }];
const itemsOf = (data) => Array.isArray(data) ? data : data?.content ?? [];
const typeName = (type) => type === 'STOCK' ? '庫存詢問' : '商品心得';
const timeText = (value) => { if (!value) return ''; const date = new Date(value); const gap = Date.now() - date.getTime(); if (gap >= 0 && gap < 3600000) return `${Math.max(1, Math.floor(gap / 60000))} 分鐘前`; if (gap >= 0 && gap < 86400000) return `${Math.floor(gap / 3600000)} 小時前`; return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' }); };
const isSameUser = (first, second) => first != null && second != null && String(first) === String(second);
const wasEdited = (answer) => {
  if (!answer?.createdAt || !answer?.updatedAt) return false;
  const createdAt = new Date(answer.createdAt).getTime();
  const updatedAt = new Date(answer.updatedAt).getTime();
  return Number.isNaN(createdAt) || Number.isNaN(updatedAt) ? answer.createdAt !== answer.updatedAt : createdAt !== updatedAt;
};

function ImagePicker({ files, onChange }) {
  const [previews, setPreviews] = useState([]);
  useEffect(() => () => previews.forEach((preview) => URL.revokeObjectURL(preview.url)), [previews]);
  const select = (event) => {
    const nextFiles = Array.from(event.target.files ?? []).slice(0, 1);
    setPreviews((current) => { current.forEach((preview) => URL.revokeObjectURL(preview.url)); return nextFiles.map((file) => ({ url: URL.createObjectURL(file), name: file.name })); });
    onChange(nextFiles);
  };
  return <label className="inquiry-image-picker">附圖 <span>（限 1 張）</span><input type="file" accept="image/*" onChange={select} /><small className="file-summary">{files.length ? '已選擇 1 張圖片' : '可上傳商品或貨架照片，幫助其他會員辨識。'}</small>{previews.length > 0 && <div className="inquiry-image-previews">{previews.map((preview) => <figure key={preview.url}><img src={preview.url} alt={preview.name} /><figcaption>{preview.name}</figcaption></figure>)}</div>}</label>;
}

function Card({ inquiry, onOpen, onFollow }) {
  const expired = inquiry.status === 'EXPIRED';
  const navigate = useNavigate();
  const open = () => onOpen ? onOpen(inquiry.id) : navigate(`/inquiries/${inquiry.id}`);
  const imageUrl = inquiry.imageUrls?.[0];
  return <article className={`inquiry-card inquiry-card-clickable${expired ? ' is-expired' : ''}${imageUrl ? ' has-image' : ''}`} role="link" tabIndex={0} onClick={open} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } }}>
    <div className="inquiry-card-content"><div className="inquiry-card-top"><span className={`inquiry-type ${inquiry.type?.toLowerCase()}`}>{typeName(inquiry.type)}</span>{expired && <span className="expired-tag">已過期</span>}</div><h3 className="inquiry-title">{inquiry.title}</h3><div className="inquiry-tags"><span>{inquiry.productName || '未指定商品'}</span>{inquiry.storeName && <span>{inquiry.storeName}</span>}</div>{inquiry.content && <p className="inquiry-preview">{inquiry.content}</p>}<footer className="inquiry-card-footer"><span>💬 {inquiry.answerCount ?? 0} 個回答</span><button type="button" className="follow-button" disabled={expired} onClick={(event) => { event.stopPropagation(); onFollow(inquiry); }}>{inquiry.followed ? '★ 已關注' : '☆ 關注'}</button><time>{timeText(inquiry.createdAt)}</time></footer></div>{imageUrl && <img className="inquiry-card-thumbnail" src={imageUrl} alt={`${inquiry.title} 附圖`} />}
  </article>;
}

function InquiryList({ token, stores, activeStoreIds = [], embedded = false, onOpen, onCreate, onRequireLogin }) {
  const navigate = useNavigate(); const [keyword, setKeyword] = useSessionPreference('inquiries:keyword', ''); const [type, setType] = useSessionPreference('inquiries:type', ''); const [storeId, setStoreId] = useSessionPreference('inquiries:store', ''); const [items, setItems] = useState([]); const [loading, setLoading] = useState(true); const [error, setError] = useState('');
  const load = useCallback(async () => { setLoading(true); setError(''); try { const ids = embedded ? activeStoreIds.map(Number).filter(Boolean) : (storeId ? [storeId] : []); const pages = ids.length > 1 ? await Promise.all(ids.map((id) => fetchInquiries({ keyword, type, storeId: id, page: 0, size: 20 }, token))) : [await fetchInquiries({ keyword, type, storeId: ids[0] || '', page: 0, size: 20 }, token)]; const seen = new Set(); setItems(pages.flatMap(itemsOf).filter((row) => { const id = String(row?.id ?? ''); if (!id || seen.has(id)) return false; seen.add(id); return true; })); } catch (e) { setError(e.message || '問題列表暫時無法載入。'); } finally { setLoading(false); } }, [activeStoreIds, embedded, keyword, storeId, token, type]);
  useEffect(() => { const timer = setTimeout(() => void load(), 250); return () => clearTimeout(timer); }, [load]);
  const login = () => onRequireLogin ? onRequireLogin() : navigate('/login?returnTo=/inquiries');
  const follow = async (inquiry) => { if (!token) return login(); try { const result = inquiry.followed ? await unfollowInquiry(inquiry.id, token) : await followInquiry(inquiry.id, token); setItems((rows) => rows.map((row) => row.id === inquiry.id ? { ...row, followed: result?.followed ?? !inquiry.followed, followCount: Math.max(0, (row.followCount ?? 0) + (inquiry.followed ? -1 : 1)) } : row)); } catch (e) { setError(e.message); } };
  const create = () => { if (!token) return login(); return onCreate ? onCreate() : navigate('/inquiries/new'); };
  const Container = embedded ? 'section' : 'main';
  return <Container className={`inquiry-page${embedded ? ' inquiry-page-embedded' : ''}`}><header className={`inquiry-hero${embedded ? ' page-header-panel' : ''}`}><div>{!embedded && <Link to="/" className="back-link">← 回到首頁</Link>}<div className={embedded ? 'page-identity-copy' : ''}><h1>{embedded ? '詢問' : '商品詢問'}</h1><p className="eyebrow">門市即時情報</p></div>{!embedded && <p>找庫存、問評價，讓每一次逛賣場都更有把握。</p>}</div><button className={embedded ? 'page-primary-action' : 'ask-button'} onClick={create}><span>＋</span> 發問</button></header><section className="inquiry-filters"><label className="inquiry-search"><span>⌕</span><input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="搜尋商品或問題" /></label><div className="filter-row"><div className="type-tabs">{TYPES.map((option) => <button type="button" key={option.value} className={type === option.value ? 'active' : ''} onClick={() => setType(option.value)}>{option.label}</button>)}</div>{!embedded && <label className="store-filter"><span>門市</span><select value={storeId} onChange={(e) => setStoreId(e.target.value)}><option value="">全部門市</option>{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label>}</div></section>{error && <p className="inquiry-error">{error}</p>}<section className="inquiry-list-header"><h2>大家都在問</h2><span>{loading ? '載入中…' : `${items.length} 個問題`}</span></section><section className="inquiry-list">{!loading && !items.length ? <div className="empty-inquiries"><strong>還沒有符合的問題</strong><span>換個關鍵字搜尋，或成為第一個發問的人。</span></div> : items.map((item) => <Card key={item.id} inquiry={item} onOpen={onOpen} onFollow={follow} />)}</section></Container>;
}

function Detail({ token, stores, inquiryId: suppliedId, embedded = false, onBack, onRequireLogin, onShowToast, currentUser }) {
  const { inquiryId: routeId } = useParams();
  const inquiryId = suppliedId ?? routeId;
  const navigate = useNavigate();
  const [item, setItem] = useState(null);
  const [error, setError] = useState('');
  const [answer, setAnswer] = useState('');
  const [stockStatus, setStockStatus] = useState('IN_STOCK');
  const [answerStoreId, setAnswerStoreId] = useState('');
  const [editingAnswerId, setEditingAnswerId] = useState(null);
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [previewImageIndex, setPreviewImageIndex] = useState(null);
  const load = useCallback(async () => { try { setItem(await fetchInquiry(inquiryId, token)); } catch (e) { setError(e.message); } }, [inquiryId, token]);
  useEffect(() => { void load(); }, [load]);
  const login = () => onRequireLogin ? onRequireLogin() : navigate(`/login?returnTo=/inquiries/${inquiryId}`);
  const expired = item?.status === 'EXPIRED';
  const back = embedded ? <button type="button" className="back-link back-button" onClick={onBack}>← 返回所有問題</button> : <Link to="/inquiries" className="back-link">← 返回所有問題</Link>;
  const follow = async () => { if (!token) return login(); try { const result = item.followed ? await unfollowInquiry(item.id, token) : await followInquiry(item.id, token); setItem((row) => ({ ...row, followed: result?.followed ?? !row.followed, followCount: Math.max(0, (row.followCount ?? 0) + (row.followed ? -1 : 1)) })); } catch (e) { setError(e.message); } };
  const openEditor = (row) => { setEditingAnswerId(row.id); setComposerExpanded(true); setAnswer(row.content || ''); setStockStatus(row.stockStatus || 'IN_STOCK'); setAnswerStoreId(row.storeId ? String(row.storeId) : ''); };
  const cancelEditor = () => { setEditingAnswerId(null); setComposerExpanded(false); setAnswer(''); setStockStatus('IN_STOCK'); setAnswerStoreId(''); };
  const submit = async (event) => {
    event.preventDefault();
    if (!token) return login();
    if (!answer.trim() && item.type !== 'STOCK') return window.alert('請先填寫回答內容。');
    const payload = item.type === 'STOCK' ? { storeId: answerStoreId || null, stockStatus, content: answer.trim() } : { content: answer.trim() };
    const editing = Boolean(editingAnswerId);
    try {
      if (editing) await updateInquiryAnswer(item.id, editingAnswerId, payload, token);
      else await createInquiryAnswer(item.id, payload, token);
      cancelEditor();
      await load();
      onShowToast?.({ title: editing ? '回答已修改' : '回答成功', message: editing ? '你的回答已更新。' : '你的回答已經發布。' });
    } catch (err) { window.alert(err.message || (editing ? '回答修改失敗，請稍後再試。' : '回答送出失敗，請稍後再試。')); }
  };
  const Container = embedded ? 'section' : 'main';
  if (error) return <Container className={`inquiry-page${embedded ? ' inquiry-page-embedded' : ''}`}>{back}<p className="inquiry-error">{error}</p></Container>;
  if (!item) return <Container className={`inquiry-page loading-page${embedded ? ' inquiry-page-embedded' : ''}`}>載入問題中…</Container>;
  return <Container className={`inquiry-page${embedded ? ' inquiry-page-embedded' : ''}`}>
    {back}
    <article className="inquiry-detail"><div className="inquiry-card-top"><span className={`inquiry-type ${item.type?.toLowerCase()}`}>{typeName(item.type)}</span>{expired && <span className="expired-tag">已過期</span>}</div><h1>{item.title}</h1><div className="detail-byline">由 {item.author?.displayName || '匿名會員'} 發問 · {timeText(item.createdAt)}</div>{item.content && <p className="detail-content">{item.content}</p>}{item.imageUrls?.length > 0 && <div className="inquiry-images">{item.imageUrls.map((url, index) => <button type="button" className="inquiry-image-button" key={url} onClick={() => setPreviewImageIndex(index)} aria-label={`查看問題附圖 ${index + 1} 完整圖片`}><img src={url} alt={`問題附圖 ${index + 1}`} /></button>)}</div>}{expired && <p className="expired-notice">此問題已過期，庫存資訊可能已經失效。</p>}<div className="detail-actions"><div className="detail-facts"><span title={item.productName || '未指定商品'}>{item.productName || '未指定商品'}</span><i aria-hidden="true">·</i><span>{item.storeName || '不限門市'}</span></div><div className="detail-engagement"><span>💬 {item.answerCount ?? item.answers?.length ?? 0}</span><button className="follow-button" disabled={expired} onClick={follow}>{item.followed ? '★' : '☆'} 關注 <small>{item.followCount ?? 0}</small></button></div></div>{item.expireTime && <small className="detail-expire-time">有效至 {new Date(item.expireTime).toLocaleDateString('zh-TW')}</small>}</article>
    <section className="answers-section"><h2>回答</h2>{item.answers?.length ? item.answers.map((row) => <article className="answer-card" key={row.id}><div className="answer-card-header"><div className="answer-author">{row.author?.profileImageUrl ? <img src={row.author.profileImageUrl} alt={`${row.author.displayName || '會員'}的頭像`} /> : <span className="answer-avatar-fallback" aria-hidden="true">{(row.author?.displayName || '會').slice(0, 1)}</span>}<strong>{row.author?.displayName || '會員'}</strong></div><span className="answer-meta"><time>{timeText(wasEdited(row) ? row.updatedAt : row.createdAt)}</time>{wasEdited(row) && <small>已編輯</small>}{isSameUser(row.author?.id, currentUser?.id) && !expired && <button type="button" className="answer-edit-button" onClick={() => openEditor(row)}>修改回答</button>}</span></div>{item.type === 'STOCK' && <p className="answer-stock">{row.storeName || '未指定門市'} · {STOCKS.find((option) => option.value === row.stockStatus)?.label || '不確定'}</p>}{row.content && <p>{row.content}</p>}</article>) : <p className="no-answers">目前還沒有回答，分享你的經驗吧。</p>}{!expired && <form className={`answer-form answer-composer${composerExpanded ? ' is-expanded' : ''}`} onSubmit={submit}>{editingAnswerId && <h3>修改你的回答</h3>}{composerExpanded && item.type === 'STOCK' && <div className="answer-stock-fields"><select value={answerStoreId} onChange={(e) => setAnswerStoreId(e.target.value)}><option value="">回報門市（選填）</option>{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select><select value={stockStatus} onChange={(e) => setStockStatus(e.target.value)}>{STOCKS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>}<textarea value={answer} onFocus={() => setComposerExpanded(true)} onChange={(e) => setAnswer(e.target.value)} placeholder={token ? '留下回答…' : '登入後即可回答問題'} disabled={!token} onClick={() => { if (!token) login(); }} />{composerExpanded && <div className="answer-form-actions"><button className="secondary-button" type="button" onClick={cancelEditor}>取消</button><button className="primary-button" type="submit">{editingAnswerId ? '儲存修改' : '送出回答'}</button></div>}</form>}</section>
    <ImageGalleryModal isOpen={previewImageIndex != null} title={item.title} images={item.imageUrls ?? []} activeIndex={previewImageIndex ?? 0} onClose={() => setPreviewImageIndex(null)} onPrev={() => setPreviewImageIndex((index) => Math.max(0, (index ?? 0) - 1))} onNext={() => setPreviewImageIndex((index) => Math.min((item.imageUrls?.length ?? 1) - 1, (index ?? 0) + 1))} onSelect={setPreviewImageIndex} />
  </Container>;
}

function NewInquiry({ token, stores, embedded = false, onBack, onCreated, onRequireLogin, onShowToast }) {
  const navigate = useNavigate(); const [form, setForm] = useState({ type: 'STOCK', title: '', productName: '', storeId: '', content: '', images: [] }); const [similar, setSimilar] = useState([]); const [error, setError] = useState(''); const [saving, setSaving] = useState(false); const update = (key, value) => setForm((row) => ({ ...row, [key]: value }));
  useEffect(() => { if (form.title.trim().length < 2) { setSimilar([]); return undefined; } const timer = setTimeout(async () => { try { setSimilar(itemsOf(await fetchSimilarInquiries({ keyword: form.title, type: form.type, storeId: form.storeId }, token))); } catch { setSimilar([]); } }, 500); return () => clearTimeout(timer); }, [form.title, form.type, form.storeId, token]);
  useEffect(() => { if (!token) { if (onRequireLogin) onRequireLogin(); else navigate('/login?returnTo=/inquiries/new'); } }, [navigate, onRequireLogin, token]);
  const submit = async (e) => { e.preventDefault(); if (!form.title.trim() || !form.productName.trim()) return setError('請填寫問題標題與商品名稱。'); setSaving(true); setError(''); try { const created = await createInquiry({ ...form, title: form.title.trim(), productName: form.productName.trim(), content: form.content.trim(), storeId: form.storeId || null }, token); onShowToast?.({ title: '發問成功', message: '問題已發布，等待大家回覆。' }); if (onCreated) onCreated(created?.id); else navigate(`/inquiries/${created?.id ?? ''}`); } catch (err) { setError(err.message || '發問失敗，請稍後再試。'); } finally { setSaving(false); } };
  if (!token) return null; const Container = embedded ? 'section' : 'main'; const back = embedded ? <button type="button" className="back-link back-button" onClick={onBack}>← 取消並返回詢問</button> : <Link to="/inquiries" className="back-link">← 取消並返回詢問</Link>;
  return <Container className={`inquiry-page${embedded ? ' inquiry-page-embedded' : ''}`}>{back}<section className="new-inquiry"><p className="eyebrow">ASK THE COMMUNITY</p><h1>我要發問</h1><p>標題寫得越具體，越容易得到有用的回答。</p><form onSubmit={submit}><label>問題類型<div className="question-type-picker">{TYPES.slice(1).map((option) => <button key={option.value} type="button" className={form.type === option.value ? 'selected' : ''} onClick={() => update('type', option.value)}><b>{option.label}</b><small>{option.value === 'STOCK' ? '詢問哪間門市有貨' : '詢問評價與使用心得'}</small></button>)}</div></label><p className="question-type-help">{form.type === 'STOCK' ? '詢問門市庫存，問題會在 14 天後過期。' : '詢問評價與使用心得，可持續收到回答。'}</p><label>問題標題 <em>*</em><input value={form.title} onChange={(e) => update('title', e.target.value)} placeholder="例如：中和店有明太子醬嗎？" required /></label>{similar.length > 0 && <aside className="similar-inquiries"><strong>可能已經有人問過</strong>{similar.map((row) => embedded ? <button type="button" key={row.id} className="similar-inquiry-button" onClick={() => onCreated?.(row.id)}>{row.title}<small>{timeText(row.createdAt)} · {row.answerCount ?? 0} 個回答 · {row.followCount ?? 0} 人關注</small></button> : <Link key={row.id} to={`/inquiries/${row.id}`}>{row.title}<small>{timeText(row.createdAt)} · {row.answerCount ?? 0} 個回答 · {row.followCount ?? 0} 人關注</small></Link>)}</aside>}<label>商品名稱 <em>*</em><input value={form.productName} onChange={(e) => update('productName', e.target.value)} placeholder="例如：明太子醬" required /></label><label>指定門市 <span>（選填）</span><select value={form.storeId} onChange={(e) => update('storeId', e.target.value)}><option value="">不限門市</option>{stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}</select></label><label>補充說明<textarea value={form.content} onChange={(e) => update('content', e.target.value)} placeholder="例如：最近有人看到嗎？大概什麼時間看到的？" /></label><ImagePicker files={form.images} onChange={(images) => update('images', images)} />{error && <p className="inquiry-error">{error}</p>}<button className="primary-button publish-button" disabled={saving}>{saving ? '發布中…' : '發布問題'}</button></form></section></Container>;
}

export function InquiryPanel({ token, stores, activeStoreIds = [], currentUser, openInquiryId, onOpenInquiryHandled, onDetailViewChange, onRequireLogin, onShowToast }) {
  const [view, setView] = useState('list');
  const [selectedId, setSelectedId] = useState(null);
  const open = useCallback((id) => { setSelectedId(id); setView('detail'); onDetailViewChange?.(true); window.scrollTo({ top: 0, behavior: 'smooth' }); }, [onDetailViewChange]);
  const back = () => { setSelectedId(null); setView('list'); onDetailViewChange?.(false); };
  useEffect(() => () => onDetailViewChange?.(false), [onDetailViewChange]);
  useEffect(() => {
    if (openInquiryId == null) return;
    open(openInquiryId);
    onOpenInquiryHandled?.();
  }, [onOpenInquiryHandled, open, openInquiryId]);
  if (view === 'new') return <NewInquiry token={token} stores={stores} embedded onBack={back} onCreated={(id) => id ? open(id) : back()} onRequireLogin={onRequireLogin} onShowToast={onShowToast} />;
  if (view === 'detail') return <Detail token={token} stores={stores} inquiryId={selectedId} embedded onBack={back} onRequireLogin={onRequireLogin} onShowToast={onShowToast} currentUser={currentUser} />;
  return <InquiryList token={token} stores={stores} activeStoreIds={activeStoreIds} embedded onOpen={open} onCreate={() => setView('new')} onRequireLogin={onRequireLogin} />;
}

export default function InquiryPage() { const { inquiryId } = useParams(); const location = useLocation(); const [token] = useState(() => getStoredToken()); const [currentUser] = useState(() => getStoredUser()); const [stores, setStores] = useState([]); useEffect(() => { fetchStores().then((data) => setStores(itemsOf(data))).catch(() => setStores([])); }, []); if (inquiryId) return <Detail token={token} stores={stores} currentUser={currentUser} />; if (location.pathname.endsWith('/new')) return <NewInquiry token={token} stores={stores} />; return <InquiryList token={token} stores={stores} />; }
