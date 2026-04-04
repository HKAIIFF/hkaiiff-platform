'use client';

import { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import CyberLoading from '@/app/components/CyberLoading';

interface LbsNode {
  id: string;
  title: string;
  review_status: string | null;
  is_online: boolean | null;
  rejection_reason: string | null;
  created_at: string;
  creator_id: string | null;
}

/* ─── 沙漏动画SVG ──────────────────────────────────────────────────────────── */
function HourglassIcon() {
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="16" y="10" width="40" height="8" rx="4" fill="#FFC107" opacity="0.25" />
      <rect x="16" y="54" width="40" height="8" rx="4" fill="#FFC107" opacity="0.25" />
      <path d="M20 18 L36 36 L52 18" stroke="#FFC107" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.7" />
      <path d="M20 54 L36 36 L52 54" stroke="#FFC107" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity="0.7" />
      <circle cx="36" cy="36" r="3" fill="#FFC107">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite" />
        <animate attributeName="r" values="2;4;2" dur="2s" repeatCount="indefinite" />
      </circle>
      <ellipse cx="36" cy="36" rx="6" ry="6" stroke="#FFC107" strokeWidth="1" opacity="0.2">
        <animate attributeName="r" values="6;14;6" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.2;0;0.2" dur="2s" repeatCount="indefinite" />
      </ellipse>
    </svg>
  );
}

/* ─── 状态配置 ─────────────────────────────────────────────────────────────── */
type ReviewStatus = 'pending' | 'approved_offline' | 'approved_online' | 'rejected' | 'draft';

function getStatusConfig(node: LbsNode): ReviewStatus {
  const rs = node.review_status;
  if (!rs || rs === 'draft') return 'draft';
  if (rs === 'pending') return 'pending';
  if (rs === 'approved' && node.is_online) return 'approved_online';
  if (rs === 'approved') return 'approved_offline';
  if (rs === 'rejected') return 'rejected';
  return 'pending';
}

/* ─── 主页面 ───────────────────────────────────────────────────────────────── */
export default function ReviewPendingPage() {
  const { nodeId } = useParams<{ nodeId: string }>();
  const { user, ready, authenticated } = usePrivy();
  const router = useRouter();
  const [node, setNode] = useState<LbsNode | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated) {
      router.replace('/');
      return;
    }

    const fetchNode = async () => {
      const { data } = await supabase
        .from('lbs_nodes')
        .select('id, title, review_status, is_online, rejection_reason, created_at, creator_id')
        .eq('id', nodeId)
        .maybeSingle();
      setNode(data as LbsNode | null);
      setLoading(false);
    };
    fetchNode();
  }, [ready, authenticated, nodeId, router]);

  if (!ready || loading) return <CyberLoading text="LOADING..." />;
  if (!authenticated) return null;

  if (!node) {
    return (
      <div className="min-h-screen bg-[#040404] flex items-center justify-center">
        <div className="text-center">
          <div className="text-[#333] text-4xl mb-4">◈</div>
          <p className="text-[#444] font-mono text-sm">找不到影展记录</p>
          <button
            onClick={() => router.replace('/')}
            className="mt-6 text-[#FFC107]/60 hover:text-[#FFC107] font-mono text-[10px] tracking-widest transition-colors"
          >
            ← 返回首页
          </button>
        </div>
      </div>
    );
  }

  const status = getStatusConfig(node);

  const configs = {
    pending: {
      bannerBg: 'bg-yellow-500/15',
      bannerBorder: 'border-yellow-500/30',
      bannerText: 'text-yellow-400',
      bannerContent: '⏳ 审核中，请耐心等待',
      title: '审核中',
      subtitle: '您的LBS影展申请已提交，我们将在3-5个工作日内完成审核',
      icon: <HourglassIcon />,
    },
    approved_offline: {
      bannerBg: 'bg-blue-500/15',
      bannerBorder: 'border-blue-500/30',
      bannerText: 'text-blue-400',
      bannerContent: '✓ 审核通过，等待上线',
      title: '审核通过',
      subtitle: '您的LBS影展申请已通过审核，等待管理员将影展上线',
      icon: (
        <div className="w-20 h-20 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
          <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      ),
    },
    approved_online: {
      bannerBg: 'bg-green-500/15',
      bannerBorder: 'border-green-500/30',
      bannerText: 'text-green-400',
      bannerContent: '● 已上线',
      title: '影展已上线',
      subtitle: '您的LBS影展已成功上线，观众现在可以在 Discover 页面发现您的影展',
      icon: (
        <div className="w-20 h-20 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
          <span className="text-4xl">🎬</span>
        </div>
      ),
    },
    rejected: {
      bannerBg: 'bg-red-500/15',
      bannerBorder: 'border-red-500/30',
      bannerText: 'text-red-400',
      bannerContent: '✗ 审核未通过',
      title: '审核未通过',
      subtitle: node.rejection_reason || '您的申请未通过审核，如有疑问请联系客服',
      icon: (
        <div className="w-20 h-20 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
          <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </div>
      ),
    },
    draft: {
      bannerBg: 'bg-[#333]/30',
      bannerBorder: 'border-[#444]/30',
      bannerText: 'text-void-hint',
      bannerContent: '草稿',
      title: '申请草稿',
      subtitle: '请完成排片和支付流程后提交审核',
      icon: (
        <div className="w-20 h-20 rounded-full bg-[#FFC107]/10 border border-[#FFC107]/30 flex items-center justify-center">
          <i className="fas fa-map-marker-alt text-[#FFC107] text-3xl" />
        </div>
      ),
    },
  };

  const cfg = configs[status];

  return (
    <div className="min-h-screen bg-[#040404] px-4 py-14 flex flex-col items-center justify-center text-center">

      {/* 返回首页按钮（使用 replace 清空历史栈，防止返回到支付流程） */}
      <button
        onClick={() => router.replace('/')}
        className="fixed z-50 w-9 h-9 rounded-full backdrop-blur-md bg-white/10 border border-white/20 flex items-center justify-center text-white"
        style={{ top: 'max(16px, env(safe-area-inset-top))', left: '16px' }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M19 12H5M12 5l-7 7 7 7" />
        </svg>
      </button>

      {/* 状态 Banner */}
      {status !== 'draft' && (
        <div className={`w-full max-w-sm mb-8 px-4 py-3 rounded-xl border ${cfg.bannerBg} ${cfg.bannerBorder}`}>
          <span className={`${cfg.bannerText} font-mono text-sm font-semibold`}>{cfg.bannerContent}</span>
          {status === 'rejected' && node.rejection_reason && (
            <p className="text-red-400/60 text-[11px] font-mono mt-1.5 leading-relaxed">
              原因：{node.rejection_reason}
            </p>
          )}
        </div>
      )}

      {/* 图标 */}
      <div className="mb-6">{cfg.icon}</div>

      {/* 影展标签 */}
      <div className="font-mono text-[9px] tracking-[0.5em] text-[#FFC107]/50 mb-2 uppercase">
        LBS FESTIVAL APPLICATION
      </div>

      {/* 影展名称 */}
      <p className="text-[#FFC107]/80 text-sm font-mono mb-5 max-w-xs truncate">{node.title}</p>

      {/* 状态标题 */}
      <h1 className="text-4xl font-black text-white tracking-wider mb-4 font-heavy">
        {cfg.title}
      </h1>

      {/* 副标题 */}
      <p className="text-void-hint text-sm font-mono max-w-sm leading-relaxed mb-6">
        {cfg.subtitle}
      </p>

      {/* 提交时间 */}
      <div className="text-[11px] text-[#444] font-mono mb-8">
        提交时间：{new Date(node.created_at).toLocaleString('zh-CN', {
          year: 'numeric', month: 'long', day: 'numeric',
          hour: '2-digit', minute: '2-digit'
        })}
      </div>

      {/* 分隔线 */}
      <div className="mx-auto h-px w-24 bg-gradient-to-r from-transparent via-[#FFC107]/40 to-transparent mb-8" />

      {/* 操作按钮 */}
      <div className="flex flex-col items-center gap-3">
        {/* 草稿状态：继续完成申请 */}
        {status === 'draft' && (
          <button
            onClick={() => router.push(`/lbs/${nodeId}/screenings`)}
            className="px-8 py-3 rounded-xl bg-[#FFC107] text-black font-heavy tracking-widest uppercase text-sm"
          >
            继续排片 →
          </button>
        )}

        {/* 审核通过：查看排片 */}
        {(status === 'approved_offline' || status === 'approved_online') && (
          <button
            onClick={() => router.push(`/lbs/${nodeId}/screenings`)}
            className="px-8 py-3 rounded-xl border border-[#FFC107]/40 text-[#FFC107] font-mono text-sm tracking-wider hover:bg-[#FFC107]/10 transition-colors"
          >
            查看排片
          </button>
        )}

      </div>

    </div>
  );
}
