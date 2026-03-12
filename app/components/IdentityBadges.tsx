'use client';

/**
 * IdentityBadges — 全局多重身份 V 標誌渲染組件
 *
 * 使用場景：Feed、Discover、ME、LBS 策展人詳情頁等所有顯示用戶資訊的地方
 *
 * 徽章樣式：
 *  CREATOR     (創作人)  → 黑金配色：金色漸變 from-yellow-400 to-yellow-600，白邊框，金色發光
 *  CURATOR     (策展人)  → 紫耀配色：紫紅漸變 from-purple-500 to-pink-500，白邊框，紫色發光
 *  INSTITUTION (機構)   → 藍寶石配色：深藍漸變 from-blue-500 to-cyan-500，白邊框，藍色發光
 */

// ── 徽章配置 ────────────────────────────────────────────────────────────────

const IDENTITY_CONFIG: Record<string, {
  label: string;
  bg: string;
  text: string;
  border: string;
  glow: string;
  dotGradient: string;
  dotText: string;
  dotRing: string;
  dotGlow: string;
}> = {
  creator: {
    label: '創作人',
    bg: 'bg-signal/20',
    text: 'text-signal',
    border: 'border-signal/40',
    glow: 'shadow-[0_0_8px_rgba(204,255,0,0.3)]',
    dotGradient: 'bg-gradient-to-br from-yellow-400 to-yellow-600',
    dotText: 'text-white',
    dotRing: 'ring-2 ring-white',
    dotGlow: 'shadow-[0_0_10px_rgba(250,204,21,0.7)]',
  },
  curator: {
    label: '策展人',
    bg: 'bg-[#FFC107]/20',
    text: 'text-[#FFC107]',
    border: 'border-[#FFC107]/40',
    glow: 'shadow-[0_0_8px_rgba(255,193,7,0.3)]',
    dotGradient: 'bg-gradient-to-br from-purple-500 to-pink-500',
    dotText: 'text-white',
    dotRing: 'ring-2 ring-white',
    dotGlow: 'shadow-[0_0_10px_rgba(168,85,247,0.7)]',
  },
  institution: {
    label: '機構',
    bg: 'bg-[#9D00FF]/20',
    text: 'text-[#9D00FF]',
    border: 'border-[#9D00FF]/40',
    glow: 'shadow-[0_0_8px_rgba(157,0,255,0.3)]',
    dotGradient: 'bg-gradient-to-br from-blue-500 to-cyan-500',
    dotText: 'text-white',
    dotRing: 'ring-2 ring-white',
    dotGlow: 'shadow-[0_0_10px_rgba(59,130,246,0.7)]',
  },
};

// ── Inline Pill Badge ────────────────────────────────────────────────────────

interface IdentityBadgesProps {
  /**
   * 用戶已通過認證的身份類型陣列
   * 從 users.verified_identities 欄位讀取
   */
  verifiedIdentities: string[];
  /**
   * 展示樣式：
   *   'pill'   — 帶文字標籤的膠囊（名字旁邊用）
   *   'dot'    — 純圓點 V（頭像角標用，多個疊加）
   *   'icon'   — 中等大小圓形（Feed 卡片用）
   */
  variant?: 'pill' | 'dot' | 'icon';
  className?: string;
  /** dot 模式：是否絕對定位在頭像右下角 */
  avatarOverlay?: boolean;
}

export default function IdentityBadges({
  verifiedIdentities,
  variant = 'pill',
  className = '',
  avatarOverlay = false,
}: IdentityBadgesProps) {
  if (!verifiedIdentities || verifiedIdentities.length === 0) return null;

  // ── pill 模式：帶文字的膠囊（用於名字旁邊）────────────────────────────────
  if (variant === 'pill') {
    return (
      <span className={`inline-flex flex-wrap gap-1 ${className}`}>
        {verifiedIdentities.map((identity) => {
          const cfg = IDENTITY_CONFIG[identity];
          if (!cfg) return null;
          return (
            <span
              key={identity}
              className={`inline-flex items-center gap-1 text-[9px] font-heavy px-2 py-0.5 rounded-full border tracking-wider ${cfg.bg} ${cfg.text} ${cfg.border} ${cfg.glow}`}
            >
              <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 fill-current">
                <path d="M8.5 2L4.2 7.5 1.5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
              {cfg.label}
            </span>
          );
        })}
      </span>
    );
  }

  // ── dot 模式：實體大V徽章（頭像右下角絕對定位） ─────────────────────────────
  if (variant === 'dot') {
    return (
      <span className={`flex gap-0.5 ${avatarOverlay ? 'absolute -bottom-2 -right-2' : ''} ${className}`}>
        {verifiedIdentities.map((identity) => {
          const cfg = IDENTITY_CONFIG[identity];
          if (!cfg) return null;
          return (
            <span
              key={identity}
              title={`${cfg.label}已認證`}
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-heavy ${cfg.dotGradient} ${cfg.dotText} ${cfg.dotRing} ${cfg.dotGlow}`}
            >
              V
            </span>
          );
        })}
      </span>
    );
  }

  // ── icon 模式：中等圓形（Feed 卡片） ─────────────────────────────────────────
  if (variant === 'icon') {
    return (
      <span className={`inline-flex gap-1 ${className}`}>
        {verifiedIdentities.map((identity) => {
          const cfg = IDENTITY_CONFIG[identity];
          if (!cfg) return null;
          return (
            <span
              key={identity}
              title={`${cfg.label}已認證`}
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-heavy ${cfg.dotGradient} ${cfg.dotText} ${cfg.dotRing} ${cfg.dotGlow}`}
            >
              V
            </span>
          );
        })}
      </span>
    );
  }

  return null;
}

// ── AvatarWithBadges 複合組件（快速使用） ────────────────────────────────────

interface AvatarWithBadgesProps {
  avatarSeed: string;
  verifiedIdentities: string[];
  /** xs = w-7 h-7（側邊欄/導航欄）, sm = w-8 h-8, md = w-12 h-12, lg = w-20 h-20 */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

export function AvatarWithBadges({
  avatarSeed,
  verifiedIdentities,
  size = 'md',
  className = '',
}: AvatarWithBadgesProps) {
  const sizeMap = { xs: 'w-7 h-7', sm: 'w-8 h-8', md: 'w-12 h-12', lg: 'w-20 h-20' };
  const ids = verifiedIdentities ?? [];

  // 外框顏色：身份等級 institution > creator > curator > 無
  const borderColorClass =
    ids.includes('institution')
      ? 'border-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.4)]'
      : ids.includes('creator')
        ? 'border-yellow-400 shadow-[0_0_12px_rgba(250,204,21,0.4)]'
        : ids.includes('curator')
          ? 'border-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.4)]'
          : 'border-[#444]';

  return (
    <div className={`relative shrink-0 ${className}`}>
      <img
        src={`https://api.dicebear.com/7.x/bottts/svg?seed=${avatarSeed || 'default'}`}
        alt="avatar"
        className={`${sizeMap[size]} bg-black rounded-full border-2 p-0.5 ${borderColorClass}`}
      />
      {ids.length > 0 && (
        <IdentityBadges
          verifiedIdentities={ids}
          variant="dot"
          avatarOverlay
        />
      )}
    </div>
  );
}
