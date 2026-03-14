'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/app/context/ToastContext';
import CyberLoading from '@/app/components/CyberLoading';
import UniversalCheckout from '@/app/components/UniversalCheckout';

/* ─── Types ──────────────────────────────────────────────────────────────── */

interface Film {
  id: string;
  title: string;
  poster_url: string | null;
  trailer_url: string | null;
  creator_id: string | null;
}

interface LbsNode {
  id: string;
  title: string;
  review_status: string | null;
  is_online: boolean | null;
  creator_id: string | null;
}

const MAX_SCREENINGS = 18;

/* ─── 小工具 ─────────────────────────────────────────────────────────────── */

function Spinner({ size = 5, color = '#FFC107' }: { size?: number; color?: string }) {
  return (
    <div
      className={`w-${size} h-${size} rounded-full border-2 border-t-transparent animate-spin shrink-0`}
      style={{ borderColor: `${color} transparent transparent transparent` }}
    />
  );
}

/* ─── 影片卡片 ────────────────────────────────────────────────────────────── */

function FilmCard({
  film,
  selected,
  disabled,
  onToggle,
  isLocked,
}: {
  film: Film;
  selected: boolean;
  disabled: boolean;
  onToggle: (id: string) => void;
  isLocked: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovering, setIsHovering] = useState(false);

  const handleClick = () => {
    if (!disabled || selected) onToggle(film.id);
  };

  useEffect(() => {
    if (!videoRef.current || !film.trailer_url) return;
    if (isHovering) {
      videoRef.current.play().catch(() => { /* ignore */ });
    } else {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [isHovering, film.trailer_url]);

  return (
    <div
      className={`relative rounded-xl overflow-hidden transition-all duration-200 cursor-pointer select-none
        ${selected
          ? 'ring-2 ring-[#FFC107] shadow-[0_0_16px_rgba(255,193,7,0.3)]'
          : disabled
            ? 'opacity-40 cursor-not-allowed grayscale'
            : 'hover:ring-1 hover:ring-[#FFC107]/40 hover:shadow-[0_0_12px_rgba(255,193,7,0.1)]'
        }`}
      style={{ aspectRatio: '2/3' }}
      onClick={handleClick}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      {/* Poster */}
      {film.poster_url ? (
        <img
          src={film.poster_url}
          alt={film.title}
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full bg-[#111] flex items-center justify-center">
          <span className="text-[#333] text-3xl">🎬</span>
        </div>
      )}

      {/* Trailer overlay on hover */}
      {film.trailer_url && isHovering && (
        <video
          ref={videoRef}
          src={film.trailer_url}
          className="absolute inset-0 w-full h-full object-cover"
          muted
          playsInline
          loop
        />
      )}

      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />

      {/* Title */}
      <div className="absolute bottom-0 left-0 right-0 px-2 pb-2">
        <p className="text-white text-[11px] font-medium leading-tight line-clamp-2">{film.title}</p>
      </div>

      {/* 已选中 ✓ 标记 */}
      {selected && (
        <div className="absolute top-2 right-2 w-6 h-6 rounded-full bg-[#FFC107] flex items-center justify-center shadow-lg">
          <svg className="w-3 h-3 text-black" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" />
          </svg>
        </div>
      )}

      {/* 已达上限（未选中时）*/}
      {!selected && disabled && !isLocked && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <span className="bg-black/80 text-[#666] text-[9px] font-mono px-2 py-1 rounded-full tracking-wider">已达上限</span>
        </div>
      )}

      {/* 锁定状态 */}
      {isLocked && (
        <div className="absolute top-2 left-2 bg-black/70 text-[#FFC107]/60 text-[8px] font-mono px-1.5 py-0.5 rounded-full flex items-center gap-1">
          <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          锁定
        </div>
      )}
    </div>
  );
}

/* ─── 底部影片圆形头像 ────────────────────────────────────────────────────── */

function ScreeningSlot({
  film,
  onRemove,
  isLocked,
}: {
  film: Film | null;
  onRemove?: () => void;
  isLocked: boolean;
}) {
  if (!film) {
    return (
      <div className="w-9 h-9 rounded-full bg-[#111] border border-[#222] flex items-center justify-center shrink-0">
        <div className="w-1.5 h-1.5 rounded-full bg-[#333]" />
      </div>
    );
  }

  return (
    <button
      onClick={() => !isLocked && onRemove?.()}
      disabled={isLocked}
      className={`relative w-9 h-9 rounded-full overflow-hidden border-2 border-[#FFC107] shrink-0 transition-all
        ${!isLocked ? 'hover:border-red-400 hover:scale-105 group' : 'cursor-default'}`}
      title={isLocked ? film.title : `移除 ${film.title}`}
    >
      {film.poster_url ? (
        <img src={film.poster_url} alt={film.title} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full bg-[#FFC107]/20 flex items-center justify-center">
          <span className="text-[8px]">🎬</span>
        </div>
      )}
      {!isLocked && (
        <div className="absolute inset-0 bg-red-500/80 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </div>
      )}
    </button>
  );
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ─── 主页面 ───────────────────────────────────────────────────────────────── */

export default function ScreeningsPage() {
  const { nodeId } = useParams<{ nodeId: string }>();
  const { user, ready, authenticated } = usePrivy();
  const router = useRouter();
  const { showToast } = useToast();

  const [node, setNode] = useState<LbsNode | null>(null);
  const [films, setFilms] = useState<Film[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadingNode, setLoadingNode] = useState(true);
  const [loadingFilms, setLoadingFilms] = useState(true);
  const [search, setSearch] = useState('');
  const [showPayment, setShowPayment] = useState(false);

  const isLocked = node?.review_status === 'approved' || node?.review_status === 'rejected';
  const isReadonly = isLocked;

  // ── 加载节点信息 ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    if (!authenticated) { router.replace('/'); return; }

    // nodeId 必须是合法 UUID，否则直接拒绝，防止非 UUID 字符串传入 UUID 列触发 PostgREST pattern 报错
    if (!nodeId || !UUID_RE.test(nodeId)) {
      console.error('[screenings] Invalid nodeId:', nodeId);
      router.replace('/lbs/apply');
      return;
    }

    const load = async () => {
      const { data, error } = await supabase
        .from('lbs_nodes')
        .select('id, title, review_status, is_online, creator_id')
        .eq('id', nodeId)
        .maybeSingle();
      if (error) console.error('[screenings] lbs_nodes fetch error:', error.message);
      setNode(data as LbsNode | null);
      setLoadingNode(false);
    };
    load();
  }, [ready, authenticated, nodeId, router]);

  // ── 加载可用影片 ──────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      // 放宽查询条件：只要有 trailer_url 的影片都可加入排片池，方便测试
      const { data, error } = await supabase
        .from('films')
        .select('id, title, poster_url, trailer_url, user_id')
        .not('trailer_url', 'is', null)
        .order('created_at', { ascending: false });
      if (error) console.error('[screenings] films fetch error:', error.message);
      // 映射 user_id → creator_id 以保持 Film 类型兼容
      setFilms((data ?? []).map((f: { id: string; title: string; poster_url: string | null; trailer_url: string | null; user_id: string | null }) => ({
        ...f,
        creator_id: f.user_id,
      })));
      setLoadingFilms(false);
    };
    load();
  }, []);

  // ── 恢复已选排片 ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!nodeId || !UUID_RE.test(nodeId)) return;
    const restore = async () => {
      const { data, error } = await supabase
        .from('lbs_screenings')
        .select('film_id')
        .eq('lbs_node_id', nodeId);
      if (error) console.error('[screenings] lbs_screenings restore error:', error.message);
      if (data) {
        setSelectedIds(new Set(data.map((r: { film_id: string }) => r.film_id)));
      }
    };
    restore();
  }, [nodeId]);

  // ── 选中/取消 ────────────────────────────────────────────────────────────
  const handleToggle = useCallback(async (filmId: string) => {
    if (isReadonly) return;

    const isSelected = selectedIds.has(filmId);

    if (!isSelected && selectedIds.size >= MAX_SCREENINGS) {
      showToast('已达上限（最多18部）', 'error');
      return;
    }

    // 乐观更新
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (isSelected) next.delete(filmId);
      else next.add(filmId);
      return next;
    });

    try {
      const method = isSelected ? 'DELETE' : 'POST';
      const res = await fetch('/api/lbs/screenings', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId, filmId, userId: user?.id }),
      });
      const json = await res.json() as { error?: string };
      if (!res.ok) throw new Error(json.error ?? '操作失败');
    } catch (err: unknown) {
      // 回滚乐观更新
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (isSelected) next.add(filmId);
        else next.delete(filmId);
        return next;
      });
      showToast(err instanceof Error ? err.message : '操作失败', 'error');
    }
  }, [isReadonly, selectedIds, nodeId, user?.id, showToast]);

  // ── AIF 支付成功回调（节点状态由 internal-checkout 的 handleLbsLicensePaid 负责更新）──
  const handleAifPaymentSuccess = useCallback(async () => {
    sessionStorage.removeItem('lbs_draft_node_id');
    sessionStorage.removeItem('lbs_apply_form');
    showToast('支付成功！您的申请已提交，等待审核。', 'success');
    setTimeout(() => router.push(`/lbs/${nodeId}/review-pending`), 800);
  }, [nodeId, router, showToast]);

  // ── 过滤影片 ──────────────────────────────────────────────────────────────
  const filteredFilms = search.trim()
    ? films.filter((f) => f.title.toLowerCase().includes(search.toLowerCase()))
    : films;

  // ── 已选影片对象列表 ──────────────────────────────────────────────────────
  const selectedFilms = Array.from(selectedIds)
    .map((id) => films.find((f) => f.id === id))
    .filter(Boolean) as Film[];

  const successUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/lbs/apply/complete?nodeId=${nodeId}`
    : `/lbs/apply/complete?nodeId=${nodeId}`;

  /* ── Loading ──────────────────────────────────────────────────────────── */
  if (!ready || loadingNode) return <CyberLoading text="LOADING..." />;
  if (!authenticated) return null;

  /* ─── Render ─────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-[#040404] pb-28">

      {/* ── 固定顶栏 ────────────────────────────────────────────────────── */}
      <div
        className="fixed top-0 left-0 right-0 z-40 bg-[#040404]/95 backdrop-blur-md border-b border-[#111]"
        style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}
      >
        <div className="max-w-2xl mx-auto px-4 pb-3">
          {/* 返回按钮 + 标题 */}
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => router.push('/lbs/apply')}
              className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white shrink-0"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-white font-heavy text-lg tracking-wider uppercase truncate">
                {node?.title || 'LBS 影展'}
              </h1>
            </div>
            <div className="shrink-0 flex items-center gap-2">
              <span className={`font-mono text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
                selectedIds.size >= MAX_SCREENINGS
                  ? 'bg-[#FFC107]/20 border-[#FFC107]/40 text-[#FFC107]'
                  : 'bg-[#111] border-[#222] text-[#666]'
              }`}>
                已选 {selectedIds.size} / {MAX_SCREENINGS} 部
              </span>
              {!isReadonly && (
                <button
                  onClick={() => setShowPayment(true)}
                  disabled={selectedIds.size === 0}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-heavy tracking-[0.1em] transition-all
                    ${selectedIds.size > 0
                      ? 'bg-[#FFC107] text-black shadow-[0_0_16px_rgba(255,193,7,0.3)] hover:shadow-[0_0_24px_rgba(255,193,7,0.45)] active:scale-[0.97]'
                      : 'bg-[#1a1a1a] border border-[#2a2a2a] text-[#444] cursor-not-allowed'
                    }`}
                >
                  <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  下一步
                </button>
              )}
            </div>
          </div>

          {/* Banner - 根据 review_status 显示 */}
          {node?.review_status === 'pending' && (
            <div className="mb-3 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/25 flex items-center gap-2">
              <span className="text-yellow-400 text-xs">⏳</span>
              <span className="text-yellow-400/80 font-mono text-[11px]">审核中，请耐心等待</span>
            </div>
          )}
          {node?.review_status === 'approved' && !node.is_online && (
            <div className="mb-3 px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/25 flex items-center gap-2">
              <span className="text-blue-400 text-xs">✓</span>
              <span className="text-blue-400/80 font-mono text-[11px]">审核通过，等待上线</span>
            </div>
          )}
          {node?.review_status === 'approved' && node.is_online && (
            <div className="mb-3 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/25 flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
              <span className="text-green-400/80 font-mono text-[11px]">● 已上线</span>
            </div>
          )}
          {node?.review_status === 'rejected' && (
            <div className="mb-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/25 flex items-center gap-2">
              <span className="text-red-400 text-xs">✗</span>
              <span className="text-red-400/80 font-mono text-[11px]">审核未通过</span>
            </div>
          )}

          {/* 只读提示条 */}
          {isLocked && (
            <div className="mb-3 px-3 py-2 rounded-lg bg-[#FFC107]/10 border border-[#FFC107]/20 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-[#FFC107]/60" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <rect x="3" y="11" width="18" height="11" rx="2" />
                  <path d="M7 11V7a5 5 0 0110 0v4" />
                </svg>
                <span className="text-[#FFC107]/70 font-mono text-[10px]">影展已通过审核，如需修改请联系客服</span>
              </div>
            </div>
          )}

          {/* 搜索框（只读时隐藏）*/}
          {!isReadonly && (
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444] text-xs">⌕</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索影片名称..."
                className="w-full bg-[#0a0a0a] border border-[#222] text-white text-sm pl-8 pr-4 py-2 rounded-lg outline-none focus:border-[#FFC107]/30 placeholder-[#333] font-mono"
              />
            </div>
          )}
        </div>
      </div>

      {/* ── 主内容 ──────────────────────────────────────────────────────── */}
      <div
        className="max-w-2xl mx-auto px-4"
        style={{ paddingTop: `calc(max(12px, env(safe-area-inset-top)) + ${node?.review_status ? '170px' : '100px'})` }}
      >
        {loadingFilms ? (
          <div className="flex items-center justify-center py-20 gap-3 text-[#444]">
            <Spinner />
            <span className="font-mono text-sm">加载影片中...</span>
          </div>
        ) : filteredFilms.length === 0 ? (
          <div className="py-20 text-center">
            <div className="text-[#222] text-5xl mb-3">◈</div>
            <p className="text-[#444] font-mono text-sm">
              {search ? '未找到匹配影片' : '暂无可用影片'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {filteredFilms.map((film) => {
              const isSelected = selectedIds.has(film.id);
              const isDisabled = !isSelected && selectedIds.size >= MAX_SCREENINGS;
              return (
                <FilmCard
                  key={film.id}
                  film={film}
                  selected={isSelected}
                  disabled={isDisabled || isReadonly}
                  onToggle={handleToggle}
                  isLocked={isReadonly}
                />
              );
            })}
          </div>
        )}
      </div>

      {/* ── 固定底部栏 ──────────────────────────────────────────────────── */}
      <div
        className="fixed bottom-0 left-0 right-0 z-40 bg-[#040404]/95 backdrop-blur-md border-t border-[#111]"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 16px)' }}
      >
        <div className="max-w-2xl mx-auto px-4 pt-3">

          {/* 18个圆形占位，横向滚动 */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-1 mb-3">
            {Array.from({ length: MAX_SCREENINGS }).map((_, i) => {
              const film = selectedFilms[i] ?? null;
              return (
                <ScreeningSlot
                  key={i}
                  film={film}
                  onRemove={film ? () => handleToggle(film.id) : undefined}
                  isLocked={isReadonly}
                />
              );
            })}
          </div>

          {/* 只读状态说明 */}
          {isReadonly && (
            <div className="flex items-center justify-between mb-2">
              <span className="text-[#444] font-mono text-[11px]">
                共 {selectedIds.size} 部排片 · 已锁定
              </span>
              <button
                onClick={() => router.push(`/lbs/${nodeId}/review-pending`)}
                className="px-4 py-2 rounded-lg border border-[#FFC107]/30 text-[#FFC107] font-mono text-[11px] hover:bg-[#FFC107]/10 transition-colors"
              >
                查看审核状态 →
              </button>
            </div>
          )}
        </div>

        {/* UniversalCheckout 支付弹窗（受控模式，渲染全屏遮罩） */}
        {showPayment && (
          <UniversalCheckout
            productCode="lbs_license"
            open={showPayment}
            onClose={() => setShowPayment(false)}
            successUrl={successUrl}
            cancelUrl={typeof window !== 'undefined' ? window.location.href : ''}
            extraMetadata={{ nodeId }}
            onSuccess={handleAifPaymentSuccess}
          />
        )}
      </div>

    </div>
  );
}
