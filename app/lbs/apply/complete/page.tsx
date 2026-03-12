'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { usePrivy } from '@privy-io/react-auth';
import CyberLoading from '@/app/components/CyberLoading';
import { useI18n } from '@/app/context/I18nContext';

function CompleteContent() {
  const { user, ready, authenticated } = usePrivy();
  const { lang } = useI18n();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!ready) return;
    if (!authenticated || !user?.id) {
      router.replace('/');
      return;
    }

    const sessionId = searchParams.get('session_id');
    if (!sessionId) {
      router.replace('/lbs/apply');
      return;
    }

    const saved = sessionStorage.getItem('lbs_apply_pending');
    if (!saved) {
      // Data may have already been submitted
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

    // Insert the LBS node record
    const insertNode = async () => {
      try {
        const { error } = await supabase
          .from('lbs_nodes')
          .insert({
            ...formData,
            submitted_by: user.id,
            stripe_session_id: sessionId,
            status: 'pending',
            state: 'locked_geo',
            payment_method: 'stripe',
          });
        if (error) {
          setErrorMsg(error.message);
          setStatus('error');
          return;
        }
        sessionStorage.removeItem('lbs_apply_pending');
        setStatus('success');
      } catch (err: unknown) {
        setErrorMsg(err instanceof Error ? err.message : 'Submission failed');
        setStatus('error');
      }
    };
    insertNode();
  }, [ready, authenticated, user?.id, searchParams, router]);

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

  return (
    <div className="min-h-screen bg-[#040404] flex flex-col items-center justify-center px-4 py-14 text-center">
      <div className="w-20 h-20 rounded-full bg-[#FFC107]/10 border border-[#FFC107]/30 flex items-center justify-center mb-6">
        <i className="fas fa-map-marker-alt text-[#FFC107] text-3xl" />
      </div>
      <div className="font-mono text-[9px] tracking-[0.5em] text-[#FFC107]/60 mb-3 uppercase">
        LBS APPLICATION SUBMITTED
      </div>
      <h1 className="text-4xl font-black text-white tracking-wider mb-4">
        {lang === 'zh' ? '提交成功！' : 'SUCCESS!'}
      </h1>
      <p className="text-gray-400 text-sm font-mono max-w-sm leading-relaxed mb-8">
        {lang === 'zh'
          ? '您的 LBS 影展申請已提交。請等待控制中心審核開通，審核時間約 48-72 小時。'
          : 'Your LBS Festival application has been submitted. Please await review from the control center. Estimated review time: 48-72 hours.'}
      </p>
      <div className="mx-auto h-px w-24 bg-gradient-to-r from-transparent via-[#FFC107]/40 to-transparent mb-8" />
      <button
        onClick={() => router.push('/me')}
        className="font-mono text-[10px] tracking-[0.4em] text-[#FFC107]/60 hover:text-[#FFC107] transition-colors flex items-center gap-2"
      >
        <i className="fas fa-arrow-left text-xs" />
        {lang === 'zh' ? '返回我的主頁' : 'BACK TO ME'}
      </button>
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
