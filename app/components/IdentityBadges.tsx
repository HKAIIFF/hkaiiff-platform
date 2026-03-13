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
  dotBg: string;
}> = {
  creator: {
    label: '創作人',
    bg: 'bg-signal/20',
    text: 'text-signal',
    border: 'border-signal/40',
    glow: 'shadow-[0_0_8px_rgba(204,255,0,0.3)]',
    dotBg: '#FFD700',
  },
  curator: {
    label: '策展人',
    bg: 'bg-[#FFC107]/20',
    text: 'text-[#FFC107]',
    border: 'border-[#FFC107]/40',
    glow: 'shadow-[0_0_8px_rgba(255,193,7,0.3)]',
    dotBg: '#1D9BF0',
  },
  institution: {
    label: '機構',
    bg: 'bg-[#9D00FF]/20',
    text: 'text-[#9D00FF]',
    border: 'border-[#9D00FF]/40',
    glow: 'shadow-[0_0_8px_rgba(157,0,255,0.3)]',
    dotBg: '#829AAB',
  },
};

const VerifiedBadge = ({ color }: { color: string }) => (
  <span
    className="relative inline-flex items-center justify-center w-5 h-5"
    style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.4))' }}
  >
    <svg viewBox="0 0 22 22" aria-hidden="true" className="w-5 h-5">
      <g>
        <path
          fill={color}
          d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.135 2.14 4.735-4.64 1.28 1.313z"
        />
      </g>
    </svg>
  </span>
);

const IDENTITY_BADGE_COLOR: Record<string, string> = {
  creator: '#FFD700',
  curator: '#1D9BF0',
  institution: '#829AAB',
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

  // ── dot 模式：X 平台花型認證徽章（頭像右下角絕對定位） ──────────────────────
  if (variant === 'dot') {
    return (
      <span className={`flex gap-0.5 ${avatarOverlay ? 'absolute -bottom-1 -right-1 z-10' : ''} ${className}`}>
        {verifiedIdentities.map((identity) => {
          const cfg = IDENTITY_CONFIG[identity];
          if (!cfg) return null;
          const color = IDENTITY_BADGE_COLOR[identity] ?? '#829AAB';
          return (
            <span key={identity} title={`${cfg.label}已認證`}>
              <VerifiedBadge color={color} />
            </span>
          );
        })}
      </span>
    );
  }

  // ── icon 模式：X 平台花型認證徽章（Feed 卡片） ───────────────────────────────
  if (variant === 'icon') {
    return (
      <span className={`inline-flex gap-1 ${className}`}>
        {verifiedIdentities.map((identity) => {
          const cfg = IDENTITY_CONFIG[identity];
          if (!cfg) return null;
          const color = IDENTITY_BADGE_COLOR[identity] ?? '#829AAB';
          return (
            <span key={identity} title={`${cfg.label}已認證`}>
              <VerifiedBadge color={color} />
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
      ? 'border-[#2563EB] shadow-[0_0_16px_rgba(37,99,235,0.5)]'
      : ids.includes('creator')
        ? 'border-[#FFD700] shadow-[0_0_16px_rgba(245,158,11,0.5)]'
        : ids.includes('curator')
          ? 'border-[#9333EA] shadow-[0_0_16px_rgba(147,51,234,0.5)]'
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
