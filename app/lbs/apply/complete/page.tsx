'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { usePrivy } from '@privy-io/react-auth';
import { useToast } from '@/app/context/ToastContext';
import CyberLoading from '@/app/components/CyberLoading';

function CompleteContent() {
  const { user, ready, authenticated } = usePrivy();
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [nodeId, setNodeId] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!authenticated || !user?.id) {
      router.replace('/');
      return;
    }

    const sessionId = searchParams.get('session_id');
    const paramNodeId = searchParams.get('nodeId');

    // 只有当 sessionId 和 nodeId 都缺失时才重定向回 apply
    // Stripe success_url 可能不包含 session_id（当 product-checkout 未附加时），
    // 但只要有 nodeId 就可以继续处理
    if (!sessionId && !paramNodeId) {
      router.replace('/lbs/apply');
      return;
    }

    const processPayment = async () => {
      try {
        // ── 情况1：已有草稿节点（新流程）────────────────────────────────────
        // 注：Stripe Webhook 已在服务端更新节点状态，这里只做客户端兜底
        if (paramNodeId) {
          const { error } = await supabase
            .from('lbs_nodes')
            .update({
              review_status: 'pending',
              status: 'under_review',
            })
            .eq('id', paramNodeId)
            .eq('creator_id', user.id);

          if (error) {
            setErrorMsg(error.message);
            setStatus('error');
            return;
          }

          // 清理 sessionStorage
          sessionStorage.removeItem('lbs_draft_node_id');
          sessionStorage.removeItem('lbs_apply_form');
          sessionStorage.removeItem('lbs_apply_pending');

          setNodeId(paramNodeId);
          setStatus('success');

          // 显示成功 Toast，然后跳转
          showToast('支付成功！您的申请已提交，等待审核。', 'success');
          setTimeout(() => {
            router.replace(`/lbs/${paramNodeId}/review-pending`);
          }, 1500);
          return;
        }

        // ── 情况2：旧流程 fallback（从 sessionStorage 读取表单数据创建节点）──
        const saved = sessionStorage.getItem('lbs_apply_pending');
        if (!saved) {
          setStatus('success');
          return;
        }

        let formData: Record<string, unknown>;
        try {
          formData = JSON.parse(saved);
        } catch {
          setErrorMsg('Form data corrupted');
          setStatus('error');
          return;
        }

        const { data, error } = await supabase
          .from('lbs_nodes')
          .insert({
            ...formData,
            creator_id: user.id,
            status: 'under_review',
            review_status: 'pending',
          })
          .select('id')
          .single();

        if (error) {
          setErrorMsg(error.message);
          setStatus('error');
          return;
        }

        sessionStorage.removeItem('lbs_apply_pending');
        const newNodeId = (data as { id: string }).id;
        setNodeId(newNodeId);
        setStatus('success');

        showToast('支付成功！您的申请已提交，等待审核。', 'success');
        setTimeout(() => {
          router.replace(`/lbs/${newNodeId}/review-pending`);
        }, 1500);
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : 'Submission failed');
        setStatus('error');
      }
    };

    processPayment();
  }, [ready, authenticated, user?.id, searchParams, router, showToast]);

  if (status === 'loading') return <CyberLoading text="PROCESSING APPLICATION..." />;

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-[#040404] flex flex-col items-center justify-center px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-5">
          <i className="fas fa-exclamation-triangle text-red-500 text-2xl" />
        </div>
        <h1 className="text-3xl font-black text-white mb-3">ERROR</h1>
        <p className="text-gray-400 text-sm font-mono mb-6 max-w-sm">{errorMsg || 'An error occurred. Please contact support.'}</p>
        <button
          onClick={() => router.push('/me')}
          className="font-mono text-[10px] tracking-[0.4em] text-[#444] hover:text-white transition-colors"
        >
          ← BACK TO ME
        </button>
      </div>
    );
  }

  // 成功时显示短暂过渡界面（会自动跳转到 review-pending）
  return (
    <div className="min-h-screen bg-[#040404] flex flex-col items-center justify-center px-4 py-14 text-center">
      <div className="w-20 h-20 rounded-full bg-[#FFC107]/10 border border-[#FFC107]/30 flex items-center justify-center mb-6 animate-pulse">
        <svg className="w-10 h-10 text-[#FFC107]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="font-mono text-[9px] tracking-[0.5em] text-[#FFC107]/60 mb-3 uppercase">
        PAYMENT CONFIRMED
      </div>
      <h1 className="text-4xl font-black text-white tracking-wider mb-4">支付成功！</h1>
      <p className="text-gray-400 text-sm font-mono max-w-sm leading-relaxed mb-4">
        您的 LBS 影展申请已提交，正在跳转至审核状态页面...
      </p>
      <div className="flex items-center gap-2 text-[#FFC107]/40 font-mono text-[10px]">
        <div className="w-3 h-3 rounded-full border border-t-transparent border-[#FFC107]/40 animate-spin" />
        跳转中...
      </div>
    </div>
  );
}

export default function LbsCompletePage() {
  return (
    <Suspense fallback={<CyberLoading text="PROCESSING APPLICATION..." />}>
      <CompleteContent />
    </Suspense>
  );
}
