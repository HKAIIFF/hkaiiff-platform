"use client";

import { useState, useEffect } from "react";
import { usePrivy, useCreateWallet } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useI18n } from "@/app/context/I18nContext";
import { useToast } from "@/app/context/ToastContext";
import CyberLoading from "@/app/components/CyberLoading";
import { supabase } from "@/lib/supabase";
import QRCode from "react-qr-code";

function randomSeed() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

const getStatusUI = (status: string) => {
  switch (status) {
    case 'approved':
      return { color: 'text-signal border-signal bg-signal/10', icon: 'fa-check-circle' };
    case 'rejected':
      return { color: 'text-red-500 border-red-500 bg-red-500/10', icon: 'fa-times-circle' };
    case 'pending':
    default:
      return { color: 'text-yellow-500 border-yellow-500 bg-yellow-500/10', icon: 'fa-hourglass-half' };
  }
};

type TeamMember = { name: string; role: string };

export default function MePage() {
  const { login, ready, authenticated, user, logout, getAccessToken } = usePrivy();
  const { createWallet } = useCreateWallet();
  const router = useRouter();
  const { t, lang } = useI18n();
  const { showToast } = useToast();

  // ── 頁面級鑒權硬鎖 ────────────────────────────────────────────────────────
  useEffect(() => {
    if (ready && !authenticated) {
      router.replace('/');
    }
  }, [ready, authenticated, router]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [mySubmissions, setMySubmissions] = useState<any[]>([]);
  const [selectedFilm, setSelectedFilm] = useState<any | null>(null);
  const [interactionHistory, setInteractionHistory] = useState<any[]>([]);

  const [dbProfile, setDbProfile] = useState<{
    agent_id: string;
    name: string;
    display_name: string | null;
    role: string;
    aif_balance: number;
    avatar_seed: string;
    bio: string | null;
    tech_stack: string | null;
    core_team: TeamMember[] | null;
    deposit_address: string | null;
    wallet_index: number | null;
  } | null>(null);

  const [displaySolanaAddress, setDisplaySolanaAddress] = useState<string | null>(null);

  // ── Supabase Realtime 狀態 ────────────────────────────────────────────────
  /** WebSocket 是否成功訂閱（用於顯示 LIVE 狀態圓點） */
  const [isRealtimeConnected, setIsRealtimeConnected] = useState(false);
  /** 當 aif_balance 發生變化時，短暫閃爍高亮提示用戶 */
  const [aifFlash, setAifFlash] = useState(false);

  // ── 資料加載狀態（區分「加載中」vs「加載完但無數據」，防止永遠卡在 ...） ──
  const [isProfileLoading, setIsProfileLoading] = useState(true);

  // ── HD Wallet 充值地址 State ──────────────────────────────────────────────
  const [depositAddress, setDepositAddress] = useState<string | null>(null);
  const [isFetchingDepositAddress, setIsFetchingDepositAddress] = useState(false);

  // ── Top-Up Modal State ────────────────────────────────────────────────────
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const handleTopUpCopy = async () => {
    if (!depositAddress) return;
    try {
      await navigator.clipboard.writeText(depositAddress);
      setIsCopied(true);
      showToast(lang === 'en' ? 'Address copied!' : '地址已複製！', 'success');
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      showToast(lang === 'en' ? 'Failed to copy' : '複製失敗', 'error');
    }
  };

  /**
   * 呼叫 /api/wallet/assign 的統一封裝函數。
   * 在 body 中攜帶 walletAddress，以便後端在用戶行不存在時能自動 upsert 創建。
   * 使用相對路徑，本地開發與生產環境均可正常運作，絕不寫死域名。
   */
  const callAssignWalletApi = async (solanaAddress: string | null): Promise<string | null> => {
    const token = await getAccessToken();
    const res = await fetch('/api/wallet/assign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        walletAddress: solanaAddress,
      }),
      cache: 'no-store',
    });
    const data = await res.json();
    if (res.ok && data.address) {
      return data.address as string;
    }
    throw new Error(data?.error ?? 'Failed to assign wallet address');
  };

  /**
   * 用戶在 Modal 內主動點擊「生成充值地址」按鈕時觸發。
   */
  const handleGenerateAddress = async () => {
    if (isFetchingDepositAddress) return;
    setIsFetchingDepositAddress(true);
    try {
      const address = await callAssignWalletApi(displaySolanaAddress);
      setDepositAddress(address);
      setDbProfile((prev) => prev ? { ...prev, deposit_address: address } : prev);
      showToast(lang === 'en' ? 'Deposit address generated!' : '專屬充值地址已生成！', 'success');
    } catch (error) {
      console.error('[handleGenerateAddress] error:', error);
      const msg = error instanceof Error ? error.message : (lang === 'en' ? 'Network error, please retry' : '網絡錯誤，請重試');
      showToast(msg, 'error');
    } finally {
      setIsFetchingDepositAddress(false);
    }
  };

  /** TOP UP 按鈕：只負責打開 Modal，地址顯示/生成邏輯由 Modal 內部處理 */
  const handleOpenTopUp = () => {
    setIsTopUpOpen(true);
  };

  // ── Profile Edit Modal State ──────────────────────────────────────────────
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAvatarSeed, setEditAvatarSeed] = useState('');
  const [editAboutStudio, setEditAboutStudio] = useState('');
  const [editTechStack, setEditTechStack] = useState('');
  const [editCoreTeam, setEditCoreTeam] = useState<TeamMember[]>([]);

  function openProfileModal() {
    // display_name 优先，其次 name（非默认值），再用 agent_id 兜底
    const nameValue = dbProfile?.display_name
      || (dbProfile?.name && dbProfile.name !== 'New Agent' ? dbProfile.name : '')
      || dbProfile?.agent_id
      || '';
    setEditName(nameValue);
    setEditAvatarSeed(dbProfile?.avatar_seed || user?.id || 'default');
    setEditAboutStudio(dbProfile?.bio || '');
    setEditTechStack(dbProfile?.tech_stack || '');
    setEditCoreTeam(
      Array.isArray(dbProfile?.core_team) ? dbProfile.core_team : []
    );
    setIsProfileModalOpen(true);
  }

  function closeProfileModal() {
    setIsProfileModalOpen(false);
  }

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!displaySolanaAddress) return;
    try {
      await navigator.clipboard.writeText(displaySolanaAddress);
      showToast(lang === 'en' ? 'Address copied to clipboard!' : '地址已複製！', 'success');
    } catch (err) {
      console.error('Failed to copy:', err);
      showToast(lang === 'en' ? 'Failed to copy address' : '複製失敗', 'error');
    }
  };

  function addTeamMember() {
    setEditCoreTeam((prev) => [...prev, { name: '', role: '' }]);
  }

  function updateTeamMember(index: number, field: 'name' | 'role', value: string) {
    setEditCoreTeam((prev) => prev.map((m, i) => i === index ? { ...m, [field]: value } : m));
  }

  function removeTeamMember(index: number) {
    setEditCoreTeam((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSaveProfile() {
    if (!user?.id) return;
    setIsSaving(true);
    try {
      const filteredCoreTeam = Array.isArray(editCoreTeam)
        ? editCoreTeam.filter((m) => m.name.trim())
        : [];

      const { error } = await supabase
        .from('users')
        .update({
          display_name: editName,
          avatar_seed: editAvatarSeed,
          bio: editAboutStudio,
          tech_stack: editTechStack,
          core_team: filteredCoreTeam,
        })
        .eq('id', user.id);

      if (error) {
        console.error('❌ Profile save error (full):', error);
        showToast("Profile update failed, please try again", "error");
      } else {
        setDbProfile((prev) =>
          prev
            ? {
                ...prev,
                display_name: editName,
                avatar_seed: editAvatarSeed,
                bio: editAboutStudio,
                tech_stack: editTechStack,
                core_team: filteredCoreTeam,
              }
            : prev
        );
        showToast("Profile updated successfully", "success");
        closeProfileModal();
      }
    } catch (err: any) {
      console.error('❌ handleSaveProfile exception:', err);
      showToast("Something went wrong, please try again", "error");
    } finally {
      setIsSaving(false);
    }
  }

  // 登錄後同步用戶數據到 Supabase，並拉取投稿記錄
  useEffect(() => {
    const syncData = async () => {
      if (authenticated && user) {
        // Step 1: 同步基础信息（确保用户行存在）
        try {
          await fetch('/api/sync-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user }),
            cache: 'no-store',
          });
        } catch (err) {
          console.error('Failed to sync', err);
        }

        // Step 2: 直接从 Supabase 读取完整 profile（含充值地址字段）
        try {
          const { data: profileRow, error: profileError } = await supabase
            .from('users')
            .select('agent_id, name, display_name, role, aif_balance, avatar_seed, bio, tech_stack, core_team, deposit_address, wallet_index')
            .eq('id', user.id)
            .single();
          if (profileError) {
            console.error('❌ Failed to fetch profile:', profileError.message);
            // 查詢失敗時設置預設值，防止餘額永遠卡在 ...
            setDbProfile({
              agent_id: '',
              name: 'New Agent',
              display_name: null,
              role: 'human',
              aif_balance: 0,
              avatar_seed: user.id,
              bio: null,
              tech_stack: null,
              core_team: null,
              deposit_address: null,
              wallet_index: null,
            });
          } else if (profileRow) {
            setDbProfile(profileRow);

            if (profileRow.deposit_address) {
              // 已有充值地址，直接使用
              setDepositAddress(profileRow.deposit_address);
            } else if (!profileRow.wallet_index && profileRow.wallet_index !== 0) {
              // 全新用戶（無 wallet_index）：靜默自動分配充值地址
              try {
                const privyEmbedded = user.linkedAccounts?.find(
                  (acc: any) => acc.type === 'wallet' && acc.walletClientType === 'privy'
                );
                const solanaAddr: string | null = (privyEmbedded as any)?.address ?? null;

                const token = await getAccessToken();
                const res = await fetch('/api/wallet/assign', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                  },
                  body: JSON.stringify({ walletAddress: solanaAddr }),
                });
                if (res.ok) {
                  const assignData = await res.json();
                  if (assignData.address) {
                    setDepositAddress(assignData.address);
                    setDbProfile((prev) => prev ? { ...prev, deposit_address: assignData.address } : prev);
                  }
                } else {
                  console.warn('⚠️ Auto-assign deposit address failed, user can generate manually in Modal.');
                }
              } catch (assignErr) {
                console.warn('⚠️ Auto-assign deposit address exception, user can generate manually in Modal:', assignErr);
              }
            } else {
              // 已有 wallet_index 但 deposit_address 被清空：
              // 不靜默重生成（否則清空後立即又出現同一個舊地址）。
              // 用戶需在 Modal 內點擊「恢復充值地址」按鈕手動恢復。
              console.log('[me] deposit_address cleared by admin; wallet_index exists. Awaiting manual restore.');
            }
          } else {
            // 查詢無結果（用戶行尚未創建），顯示預設 0
            setDbProfile({
              agent_id: '',
              name: 'New Agent',
              display_name: null,
              role: 'human',
              aif_balance: 0,
              avatar_seed: user.id,
              bio: null,
              tech_stack: null,
              core_team: null,
              deposit_address: null,
              wallet_index: null,
            });
          }
        } catch (err) {
          console.error('❌ Profile fetch exception:', err);
          // 異常時同樣設置預設值，確保 UI 不卡死
          setDbProfile({
            agent_id: '',
            name: 'New Agent',
            display_name: null,
            role: 'human',
            aif_balance: 0,
            avatar_seed: user.id,
            bio: null,
            tech_stack: null,
            core_team: null,
            deposit_address: null,
            wallet_index: null,
          });
        } finally {
          // 無論成功或失敗，標記 profile 加載完成
          setIsProfileLoading(false);
        }

        try {
          const userId = user.id;
          const filmsRes = await fetch(`/api/user-films?userId=${userId}`, { cache: 'no-store' });
          const filmsData = await filmsRes.json();
          if (!filmsData.error && Array.isArray(filmsData.films)) {
            setMySubmissions(filmsData.films);
          }
        } catch (err) {
          console.error('Failed to fetch films', err);
        }

        try {
          const fetchInteractionHistory = async () => {
            const { data, error } = await supabase
              .from('interactive_submissions')
              .select('*')
              .eq('user_id', user.id)
              .order('created_at', { ascending: false });
            if (error) {
              console.error('Failed to fetch interaction history', error);
            } else {
              setInteractionHistory(data ?? []);
            }
          };
          await fetchInteractionHistory();
        } catch (err) {
          console.error('Failed to fetch interaction history', err);
        }
      }
    };
    syncData();
  }, [authenticated, user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!authenticated || !user) return;

    // Only use the Privy embedded wallet as the profile display address,
    // so external wallets (Phantom, MetaMask, etc.) are never shown.
    const embeddedWallet = user.linkedAccounts?.find(
      (acc: any) => acc.type === 'wallet' && acc.walletClientType === 'privy'
    );
    const privyWalletAddress: string | null = (embeddedWallet as any)?.address ?? null;

    if (privyWalletAddress && !privyWalletAddress.startsWith('0x')) {
      setDisplaySolanaAddress(privyWalletAddress);
    } else {
      setDisplaySolanaAddress(null);
    }
  }, [authenticated, user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Supabase Realtime：自動監聽當前用戶的 aif_balance 變化 ──────────────
  useEffect(() => {
    if (!authenticated || !user?.id) return;

    const channelName = `me-aif-balance-${user.id}`;

    const channel = supabase
      .channel(channelName)
      .on<{ aif_balance: number }>(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          const newBalance = payload.new?.aif_balance;
          if (typeof newBalance === 'number') {
            setDbProfile((prev) =>
              prev ? { ...prev, aif_balance: newBalance } : prev
            );
            // 觸發短暫閃爍動畫，告知用戶數值已自動更新
            setAifFlash(true);
            setTimeout(() => setAifFlash(false), 900);
          }
        }
      )
      .subscribe((status) => {
        setIsRealtimeConnected(status === 'SUBSCRIBED');
      });

    // 組件 unmount 或 user 切換時，銷毀 WebSocket channel，防止內存洩漏
    return () => {
      supabase.removeChannel(channel);
      setIsRealtimeConnected(false);
    };
  }, [authenticated, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── 九國語言充值按鈕字典 ─────────────────────────────────────────────────
  const topUpLabels: Record<string, string> = {
    zh: '充值',
    en: 'TOP UP / DEPOSIT',
    ja: 'チャージ',
    ko: '충전',
    th: 'เติมเงิน',
    fr: 'RECHARGER',
    de: 'AUFLADEN',
    es: 'RECARGAR',
    ar: 'تعبئة الرصيد',
  };
  const topUpLabel = topUpLabels[lang] ?? 'TOP UP / DEPOSIT';

  /* ─── AUTH GUARD ─────────────────────────────────────────────────────────── */
  // Privy 尚未初始化完成時，渲染空白等待 redirect；已就緒未登錄同樣清空防閃爍
  if (!ready || !authenticated) return null;

  /* ─── AUTHENTICATED VIEW ──────────────────────────────────────────────────── */
  return (
    <div className="flex-1 h-full w-full overflow-y-auto bg-void flex flex-col min-h-screen px-4 pt-28 pb-32 relative">
      {isHistoryLoading && <CyberLoading text="LOADING PARALLEL UNIVERSE..." />}

      {/* ── Page Header ────────────────────────────────────────────────── */}
      <div className="hidden md:flex sticky top-0 z-10 bg-void/95 backdrop-blur border-b border-[#222] px-6 py-4 items-center justify-between flex-shrink-0">
        <div className="hidden md:block">
          <h1 className="font-heavy text-2xl text-white tracking-wider leading-none">
            USER CENTER
          </h1>
          <div className="text-[9px] font-mono text-signal tracking-widest mt-1">
            HKAIIFF · IDENTITY &amp; WALLET
          </div>
        </div>
        <button
          onClick={() => logout()}
          className="hidden md:flex w-8 h-8 rounded-full bg-[#111] border border-[#333] items-center justify-center
                     text-gray-400 hover:text-white hover:border-signal transition-all cursor-pointer"
          title="Sign Out"
        >
          <i className="fas fa-sign-out-alt text-sm" />
        </button>
      </div>

      {/* ── Profile Card ───────────────────────────────────────────────── */}
      <div className="relative flex items-center gap-5 mb-6 bg-[#111] p-5 rounded-xl border border-[#333] shadow-[0_0_20px_rgba(0,0,0,0.5)] mt-6">

        {/* Edit / Logout controls (top-right) */}
        <div className="absolute top-4 right-4 flex items-center space-x-2 z-10">
          {/* 編輯按鈕 → 打開 Modal */}
          <button
            onClick={openProfileModal}
            className="w-8 h-8 rounded-full bg-[#111] border border-[#333] flex items-center justify-center text-gray-400 hover:text-signal hover:border-signal transition-colors"
            title="Edit Profile"
          >
            <i className="fas fa-edit text-xs" />
          </button>
          {/* 登出按鈕 */}
          <button
            onClick={() => logout()}
            className="w-8 h-8 rounded-full bg-[#111] border border-[#333] flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-500 transition-colors"
            title="Logout"
          >
            <i className="fas fa-sign-out-alt text-xs" />
          </button>
        </div>

        {/* Avatar */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          <div className="relative">
            <img
              src={`https://api.dicebear.com/7.x/bottts/svg?seed=${dbProfile?.avatar_seed || user?.id || 'default'}`}
              alt="avatar"
              className="w-20 h-20 bg-black rounded-full border-2 border-signal p-1"
            />
            <div className="absolute bottom-0 right-0 w-6 h-6 bg-signal rounded-full border-2 border-black flex items-center justify-center text-[10px] text-black">
              <i className="fas fa-check" />
            </div>
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0 pr-16">
          <h2 className="font-heavy text-2xl text-white mb-0.5 tracking-wide truncate">
            {dbProfile?.display_name || (user?.id ? `Agent_${user.id.replace('did:privy:', '').substring(0, 6)}` : 'Agent_SYNCING')}
          </h2>
          <div className="text-[9px] text-gray-400 font-mono mb-2 tracking-wider uppercase">
            {dbProfile ? t(`role_${dbProfile?.role || 'human'}`).toUpperCase() : '...'}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopy}
              className="flex items-center space-x-2 bg-[#111] border border-[#333] px-3 py-1 rounded text-xs text-gray-400 hover:text-signal transition-colors"
            >
              <i className="fa-brands fa-solana text-signal" />
              <span className="font-mono ltr-force">
                {displaySolanaAddress
                  ? `${displaySolanaAddress.slice(0, 4)}...${displaySolanaAddress.slice(-4)}`
                  : 'NO SOL WALLET'}
              </span>
              <i className="far fa-copy"></i>
            </button>
          </div>
        </div>
      </div>

      {/* ── Funding Account Panel ──────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-[#0d1a00] to-[#0a0a0a] p-5 rounded-xl border border-signal/30
                      shadow-[0_0_20px_rgba(204,255,0,0.06)] relative overflow-hidden group mb-4 min-h-[100px] shrink-0">
        {/* Corner glow — pointer-events-none 防止裝飾層攔截按鈕點擊 */}
        <div className="absolute top-0 right-0 w-28 h-28 bg-signal/5 rounded-bl-full transition-colors group-hover:bg-signal/10 pointer-events-none" />
        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-signal/60 via-signal/20 to-transparent pointer-events-none" />

        {/* Label row */}
        <div className="text-[10px] text-signal font-mono tracking-widest flex items-center gap-2 mb-3">
          <i className="fas fa-wallet" />
          FUNDING ACCOUNT
          {/* ── Realtime LIVE 狀態圓點 ── */}
          {!isProfileLoading && (
            <span
              className="flex items-center gap-1"
              title={isRealtimeConnected ? 'Realtime connected · auto-updating' : 'Connecting to realtime...'}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full transition-colors duration-500
                  ${isRealtimeConnected
                    ? 'bg-signal shadow-[0_0_5px_rgba(204,255,0,0.8)] animate-pulse'
                    : 'bg-gray-700'
                  }`}
              />
              <span className={`font-mono text-[8px] tracking-widest transition-colors duration-500
                ${isRealtimeConnected ? 'text-signal/60' : 'text-gray-700'}`}>
                {isRealtimeConnected ? 'LIVE' : 'CONNECTING'}
              </span>
            </span>
          )}
        </div>

        {/* Balance + TOP UP row */}
        <div className="flex flex-row justify-between items-center flex-wrap gap-4 mb-1">
          <div className="flex items-baseline gap-2">
            {/* 數字閃爍：aif_balance 更新時短暫變綠，通知用戶 */}
            <span
              className={`text-4xl font-heavy ltr-force transition-colors duration-300
                ${isProfileLoading
                  ? 'text-gray-500'
                  : aifFlash
                    ? 'text-signal drop-shadow-[0_0_10px_rgba(204,255,0,0.6)]'
                    : 'text-white'
                }`}
            >
              {isProfileLoading
                ? <span className="text-2xl animate-pulse">...</span>
                : (dbProfile?.aif_balance ?? 0).toLocaleString()
              }
            </span>
            {!isProfileLoading && (
              <span className={`text-lg font-heavy transition-colors duration-300
                ${aifFlash ? 'text-signal' : 'text-signal'}`}>
                AIF
              </span>
            )}
          </div>
          <button
            onClick={handleOpenTopUp}
            className="relative z-10 flex items-center gap-1.5 text-[10px] font-heavy tracking-widest
                       bg-signal text-black px-3 py-1.5 rounded-lg
                       shadow-[0_0_12px_rgba(204,255,0,0.4)]
                       hover:shadow-[0_0_20px_rgba(204,255,0,0.6)]
                       active:scale-95 transition-all shrink-0"
          >
            <i className="fas fa-plus text-[9px]" />
            {topUpLabel}
          </button>
        </div>

      </div>

      {/* ── My Submissions ─────────────────────────────────────────────── */}
      <h3 className="font-heavy text-xl mb-4 border-b border-[#333] pb-2 text-white flex items-center gap-2">
        <i className="fas fa-film text-gray-500" /> MY SUBMISSIONS
        {mySubmissions.length > 0 && (
          <span className="ml-auto text-[10px] font-mono text-signal bg-signal/10 border border-signal/30 px-2 py-0.5 rounded">
            {mySubmissions.length} FILM{mySubmissions.length > 1 ? 'S' : ''}
          </span>
        )}
      </h3>
      <div className="mb-8">
        {mySubmissions.length === 0 ? (
          <div className="text-center text-xs text-gray-500 font-mono py-8 border border-dashed border-[#333] rounded-xl">
            <i className="fas fa-film text-2xl mb-3 block text-gray-700" />
            No submissions yet. Mint your first film.
          </div>
        ) : (
          <div className="flex flex-col">
            {mySubmissions.map((film) => {
              const isApproved = film?.status === 'approved';
              return (
                <div
                  key={film.id}
                  onClick={() => setSelectedFilm(film)}
                  className="flex flex-row items-center gap-4 bg-[#111] border border-[#333] p-3 rounded-lg hover:border-[#CCFF00]/50 transition-colors cursor-pointer mb-3"
                >
                  {/* 左側海報 */}
                  <div className="w-16 h-24 bg-black rounded overflow-hidden flex-shrink-0">
                    {film?.poster_url ? (
                      <img
                        src={film.poster_url}
                        alt={film?.title || 'FILM'}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <i className="fas fa-film text-gray-700 text-xl" />
                      </div>
                    )}
                  </div>

                  {/* 右側內容 */}
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    {/* 標題 */}
                    <div className="font-heavy text-sm text-white tracking-wide truncate uppercase">
                      {film?.title || 'UNTITLED'}
                    </div>
                    {/* 廠牌 / 核心陣容 */}
                    <div className="text-[11px] text-gray-500 font-mono truncate">
                      {film?.studio || film?.core_cast || dbProfile?.display_name || '—'}
                    </div>
                    {/* 底部：日期 + 狀態 Badge */}
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-[10px] font-mono text-gray-600">
                        {film?.created_at
                          ? new Date(film.created_at).toLocaleDateString()
                          : '—'}
                      </span>
                      {isApproved ? (
                        <span className="text-[#CCFF00] border border-[#CCFF00] px-2 py-0.5 rounded text-[10px] font-mono">
                          APPROVED
                        </span>
                      ) : (
                        <span className="text-yellow-500 border border-yellow-500/60 px-2 py-0.5 rounded text-[10px] font-mono">
                          PENDING
                        </span>
                      )}
                    </div>
                  </div>

                  <i className="fas fa-chevron-right text-gray-600 flex-shrink-0 text-xs" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Interaction History ────────────────────────────────────────── */}
      <h3 className="font-heavy text-xl mb-4 border-b border-[#333] pb-2 text-white flex items-center gap-2">
        <i className="fas fa-history text-gray-500" /> INTERACTION HISTORY
      </h3>
      <div className="space-y-3 pb-4">
        {interactionHistory.length > 0 ? (
          interactionHistory.map((item) => (
            <div
              key={item.id}
              className="border border-[#222] bg-[#111] rounded-lg p-3 flex gap-4 items-center cursor-pointer hover:border-signal transition-colors active:scale-[0.98]"
              onClick={() => {
                setIsHistoryLoading(true);
                setTimeout(() => setIsHistoryLoading(false), 2000);
              }}
            >
              <img
                src={item.film_cover_url || item.media_url || "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?q=80&w=200"}
                alt={item.film_title || 'UNKNOWN PROTOCOL'}
                className="w-16 h-12 object-cover rounded border border-[#333]"
              />
              <div className="flex-1">
                <div className="text-sm font-bold text-white tracking-wide">{item.film_title || 'UNKNOWN PROTOCOL'}</div>
                <div className="text-[9px] text-signal font-mono mt-1 bg-signal/10 inline-block px-1.5 py-0.5 rounded">
                  Rendered via: {item.inject_type || 'Data'}
                </div>
              </div>
              <button className="text-gray-500 hover:text-white">
                <i className="fas fa-play-circle text-2xl" />
              </button>
            </div>
          ))
        ) : (
          <div className="text-center text-xs text-gray-500 font-mono py-8 border border-dashed border-[#333] rounded-xl">
            No interactions yet. Inject data to render universes.
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          FILM INFO MODAL — APPROVED: 官方參賽證書 / PENDING: 審核中提示
      ═══════════════════════════════════════════════════════════════════ */}
      {selectedFilm && (
        <div
          className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedFilm(null); }}
        >
          <div className="relative w-full max-w-sm">
            {/* Close button */}
            <button
              onClick={() => setSelectedFilm(null)}
              className="absolute -top-3 -right-3 z-20 w-9 h-9 bg-black border border-[#333] rounded-full
                         flex items-center justify-center text-gray-400 hover:text-white hover:border-[#CCFF00]
                         active:scale-90 transition-all"
            >
              <i className="fas fa-times text-sm" />
            </button>

            {selectedFilm?.status === 'approved' ? (
              /* ── 官方參賽證書 UI (重構版) ───────────────────────────────── */
              <div className="relative bg-[#050505] rounded-xl overflow-hidden shadow-2xl">

                {/* 雙層金邊框架 */}
                <div className="absolute inset-0 rounded-xl border-2 border-[#D4AF37]/50 pointer-events-none z-20" />
                <div className="absolute inset-[6px] rounded-lg border border-[#D4AF37]/25 pointer-events-none z-20" />

                {/* 四角裝飾 */}
                <div className="absolute top-2.5 left-2.5 text-[#D4AF37]/40 text-base select-none pointer-events-none z-20">✦</div>
                <div className="absolute top-2.5 right-2.5 text-[#D4AF37]/40 text-base select-none pointer-events-none z-20">✦</div>
                <div className="absolute bottom-2.5 left-2.5 text-[#D4AF37]/40 text-base select-none pointer-events-none z-20">✦</div>
                <div className="absolute bottom-2.5 right-2.5 text-[#D4AF37]/40 text-base select-none pointer-events-none z-20">✦</div>

                {/* 背景水印：徑向漸變 */}
                <div
                  className="absolute inset-0 pointer-events-none select-none"
                  style={{ background: 'radial-gradient(ellipse at 50% 35%, rgba(212,175,55,0.08) 0%, transparent 68%)' }}
                />
                {/* 頂部金色細線 */}
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-[#D4AF37]/70 to-transparent" />
                {/* 底部金色細線 */}
                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-[#D4AF37]/50 to-transparent" />

                <div className="relative z-10 p-8 pb-5">
                  {/* 頂部 Header */}
                  <div className="text-center mb-5">
                    <div className="text-[#D4AF37]/50 font-mono text-[8px] tracking-[0.4em] uppercase mb-1">
                      Hong Kong AI International Film Festival
                    </div>
                    <h3
                      className="text-[#D4AF37] text-3xl tracking-widest uppercase"
                      style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                    >
                      Certificate
                    </h3>
                    <div
                      className="text-[#D4AF37]/60 text-base mt-0.5 tracking-wider"
                      style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: 'italic' }}
                    >
                      of Official Selection
                    </div>
                    <div className="w-20 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/60 to-transparent mx-auto mt-3" />
                  </div>

                  {/* 證書正文 */}
                  <div
                    className="text-center leading-relaxed relative z-10 mb-5"
                    style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                  >
                    <p className="text-gray-400 text-sm">This is to certify that the AI-Native Film</p>
                    <p className="text-white text-xl font-bold my-3 uppercase tracking-wide leading-snug">
                      {selectedFilm?.title || 'UNTITLED'}
                    </p>
                    <p className="text-gray-400 text-sm">
                      submitted by{' '}
                      <span className="text-[#CCFF00]">
                        {selectedFilm?.studio || dbProfile?.display_name || 'Unknown Studio'}
                      </span>
                    </p>
                    <p className="text-gray-400 text-sm mt-2">
                      has been officially selected and approved by the
                    </p>
                    <p className="text-white font-semibold text-sm mt-1">
                      Hong Kong AI International Film Festival Jury
                    </p>
                  </div>

                  {/* 關鍵數據網格 */}
                  <div className="grid grid-cols-3 gap-2 relative z-10 mb-5">
                    <div className="bg-black/40 border border-[#D4AF37]/20 rounded-lg p-2 text-center">
                      <div className="text-[8px] font-mono text-gray-500 tracking-widest mb-1">AI RATIO</div>
                      <div className="text-[#CCFF00] font-bold text-base">{selectedFilm?.ai_ratio ?? 0}%</div>
                    </div>
                    <div className="bg-black/40 border border-[#D4AF37]/20 rounded-lg p-2 text-center">
                      <div className="text-[8px] font-mono text-gray-500 tracking-widest mb-1">TECH STACK</div>
                      <div className="text-white font-mono text-[9px] leading-tight">
                        {selectedFilm?.tech_stack
                          ? (Array.isArray(selectedFilm.tech_stack)
                              ? selectedFilm.tech_stack[0]
                              : selectedFilm.tech_stack.split(',')[0]?.trim())
                          : '—'}
                      </div>
                    </div>
                    <div className="bg-black/40 border border-[#D4AF37]/20 rounded-lg p-2 text-center">
                      <div className="text-[8px] font-mono text-gray-500 tracking-widest mb-1">DATE</div>
                      <div className="text-white font-mono text-[9px]">
                        {selectedFilm?.created_at
                          ? new Date(selectedFilm.created_at).toLocaleDateString('en-GB', { year: 'numeric', month: 'short', day: 'numeric' })
                          : '—'}
                      </div>
                    </div>
                  </div>

                  {/* 英式紅色印章 + 分享按鈕 同排 */}
                  <div className="flex items-end justify-between gap-3">
                    {/* 分享按鈕 */}
                    <button
                      onClick={async () => {
                        const certUrl = `${window.location.origin}/certificate/${selectedFilm?.id}`;
                        const shareData = {
                          title: `Certificate — ${selectedFilm?.title}`,
                          text: `Official Selection at the Hong Kong AI International Film Festival 🏆`,
                          url: certUrl,
                        };
                        try {
                          if (navigator.share) {
                            await navigator.share(shareData);
                          } else {
                            await navigator.clipboard.writeText(certUrl);
                            showToast('Certificate link copied!', 'success');
                          }
                        } catch {
                          // user cancelled
                        }
                      }}
                      className="flex items-center gap-2 px-4 py-2.5 border border-[#D4AF37]/40 text-[#D4AF37] rounded-lg text-xs font-mono tracking-wider hover:bg-[#D4AF37]/10 active:scale-95 transition-all"
                    >
                      <i className="fas fa-share-alt" />
                      SHARE CERTIFICATE
                    </button>

                    {/* 英式傳統紅色印章 SVG */}
                    <div className="w-24 h-24 -rotate-12 opacity-85 select-none pointer-events-none shrink-0">
                      <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                        {Array.from({ length: 24 }).map((_, i) => {
                          const angle = (i * 360) / 24;
                          const rad = (angle * Math.PI) / 180;
                          return (
                            <line
                              key={i}
                              x1={60 + 50 * Math.cos(rad)} y1={60 + 50 * Math.sin(rad)}
                              x2={60 + 57 * Math.cos(rad)} y2={60 + 57 * Math.sin(rad)}
                              stroke="#8B0000" strokeWidth="2.5" strokeLinecap="round"
                            />
                          );
                        })}
                        <circle cx="60" cy="60" r="50" fill="none" stroke="#8B0000" strokeWidth="2.5" />
                        <circle cx="60" cy="60" r="42" fill="none" stroke="#8B0000" strokeWidth="1.5" />
                        <circle cx="60" cy="60" r="41" fill="#8B0000" fillOpacity="0.12" />
                        <circle cx="60" cy="60" r="36" fill="none" stroke="#8B0000" strokeWidth="0.8" strokeDasharray="3 2" />
                        <text x="60" y="26" textAnchor="middle" fill="#8B0000" fontSize="12" fontFamily="Georgia, serif">✦</text>
                        <text x="60" y="52" textAnchor="middle" fill="#8B0000" fontSize="8.5" fontFamily="Georgia, serif" fontWeight="bold" letterSpacing="2">OFFICIAL</text>
                        <text x="60" y="65" textAnchor="middle" fill="#8B0000" fontSize="11" fontFamily="Georgia, serif" fontWeight="bold" letterSpacing="1">SELECTION</text>
                        <line x1="36" y1="70" x2="84" y2="70" stroke="#8B0000" strokeWidth="0.8" />
                        <text x="60" y="81" textAnchor="middle" fill="#8B0000" fontSize="7" fontFamily="Georgia, serif" letterSpacing="1.5">HKAIIFF JURY</text>
                        <text x="60" y="93" textAnchor="middle" fill="#8B0000" fontSize="6.5" fontFamily="Georgia, serif" letterSpacing="2">MMXXV</text>
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* ── PENDING / REJECTED 提示 ──────────────────────────────── */
              <div className="relative bg-[#080808] border border-[#333] rounded-2xl overflow-hidden shadow-[0_0_60px_rgba(204,255,0,0.1)]">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-signal" />

                {/* Poster */}
                <div className="relative w-full h-44 overflow-hidden bg-[#0a0a0a]">
                  {selectedFilm?.poster_url ? (
                    <img
                      src={selectedFilm.poster_url}
                      alt={selectedFilm?.title || 'FILM'}
                      className="w-full h-full object-cover opacity-60"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <i className="fas fa-film text-5xl text-gray-700" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-black/30 to-transparent" />
                  <div className="absolute bottom-0 left-0 p-4">
                    <h2 className="font-heavy text-xl text-white leading-tight tracking-wide drop-shadow-lg uppercase">
                      {selectedFilm?.title || 'UNTITLED'}
                    </h2>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  {selectedFilm?.status === 'rejected' ? (
                    <div className="flex flex-col items-center gap-3 py-4 text-center">
                      <i className="fas fa-times-circle text-red-500 text-3xl" />
                      <div className="text-red-500 font-heavy tracking-widest text-sm">NOT SELECTED</div>
                      <p className="text-red-400/80 text-xs font-mono leading-relaxed border border-red-500/30 bg-red-500/10 rounded-lg p-3">
                        This submission was not approved by the jury. A new entry with separate submission fee is required.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-3 py-4 text-center">
                      <div className="w-12 h-12 rounded-full border-2 border-yellow-500/50 flex items-center justify-center">
                        <i className="fas fa-hourglass-half text-yellow-500 text-xl animate-pulse" />
                      </div>
                      <div className="text-yellow-500 font-heavy tracking-widest text-sm">UNDER REVIEW</div>
                      <p className="text-gray-500 text-xs font-mono leading-relaxed">
                        Your submission is being reviewed by the HKAIIFF jury. You will be notified once a decision is made.
                      </p>
                    </div>
                  )}

                  <div className="text-[9px] font-mono text-gray-700 text-center pt-1">
                    SUBMITTED · {selectedFilm?.created_at
                      ? new Date(selectedFilm.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                      : '—'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          TOP-UP MODAL
      ═══════════════════════════════════════════════════════════════════ */}
      {isTopUpOpen && (
        <div
          className="fixed inset-0 z-[300] bg-black/90 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setIsTopUpOpen(false); }}
        >
          <div className="relative w-full sm:max-w-sm bg-[#070707] border border-signal/30 sm:rounded-2xl rounded-t-2xl
                          overflow-hidden shadow-[0_0_60px_rgba(204,255,0,0.15)] flex flex-col">
            {/* Top accent */}
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-signal via-signal/50 to-transparent" />

            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a] flex-shrink-0">
              <div>
                <div className="font-heavy text-base text-white tracking-widest flex items-center gap-2">
                  <i className="fas fa-arrow-down text-signal text-sm" />
                  TOP UP AIF
                </div>
                <div className="text-[9px] font-mono text-signal/70 tracking-widest mt-0.5">
                  DEPOSIT VIA SOLANA NETWORK
                </div>
              </div>
              <button
                onClick={() => setIsTopUpOpen(false)}
                className="w-9 h-9 bg-[#111] border border-[#2a2a2a] rounded-full flex items-center justify-center
                           text-gray-400 hover:text-white hover:border-signal active:scale-90 transition-all"
              >
                <i className="fas fa-times text-sm" />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-5 space-y-5">
              {/* Warning Banner */}
              <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/40 rounded-xl px-4 py-3">
                <i className="fas fa-exclamation-triangle text-amber-400 text-sm mt-0.5 flex-shrink-0" />
                <p className="text-[11px] font-mono text-amber-300/90 leading-relaxed">
                  Please send <span className="text-amber-300 font-bold">ONLY $AIF tokens</span> on the{' '}
                  <span className="text-amber-300 font-bold">Solana network</span> to this address.
                  Other assets will be <span className="text-red-400 font-bold">lost</span>.
                </p>
              </div>

              {/* QR Code 區域 */}
              <div className="flex flex-col items-center gap-3">
                {depositAddress ? (
                  /* ── 已有地址：渲染 QR Code ─────────────────────────── */
                  <>
                    <div className="p-3 bg-white rounded-xl shadow-[0_0_24px_rgba(204,255,0,0.2)]">
                      <QRCode
                        value={depositAddress}
                        size={160}
                        bgColor="#ffffff"
                        fgColor="#000000"
                        level="M"
                      />
                    </div>
                    <div className="text-[9px] font-mono text-gray-500 tracking-wider">
                      SCAN WITH SOLANA WALLET
                    </div>
                  </>
                ) : isFetchingDepositAddress ? (
                  /* ── 生成中：轉圈動畫 ──────────────────────────────── */
                  <div className="w-[186px] h-[186px] border-2 border-dashed border-signal/30 rounded-xl flex flex-col items-center justify-center gap-3 bg-signal/5">
                    <i className="fas fa-circle-notch fa-spin text-3xl text-signal/50" />
                    <span className="text-[10px] font-mono text-signal/60 tracking-wider text-center px-4">
                      GENERATING ADDRESS...
                    </span>
                  </div>
                ) : (
                  /* ── 無地址：醒目的生成按鈕 ────────────────────────── */
                  <div className="w-full flex flex-col items-center gap-4 py-2">
                    <div className="w-16 h-16 rounded-full border-2 border-dashed border-signal/40 flex items-center justify-center bg-signal/5">
                      <i className="fas fa-wallet text-2xl text-signal/50" />
                    </div>
                    <div className="text-center space-y-1">
                      <div className="text-[11px] font-mono text-gray-400 tracking-wider">
                        NO DEPOSIT ADDRESS YET
                      </div>
                      <div className="text-[10px] font-mono text-gray-600">
                        Generate a dedicated Solana address to receive $AIF
                      </div>
                    </div>
                    <button
                      onClick={handleGenerateAddress}
                      className="flex items-center gap-2 bg-signal text-black font-heavy text-[11px] tracking-widest
                                 px-5 py-2.5 rounded-xl shadow-[0_0_20px_rgba(204,255,0,0.35)]
                                 hover:shadow-[0_0_30px_rgba(204,255,0,0.55)]
                                 active:scale-95 transition-all"
                    >
                      <i className="fas fa-plus-circle text-sm" />
                      Generate Deposit Address
                    </button>
                    <div className="text-[9px] font-mono text-gray-700 text-center">
                      生成專屬充值地址
                    </div>
                  </div>
                )}
              </div>

              {/* Address Display + Copy（僅在地址存在或加載中時顯示） */}
              {(depositAddress || isFetchingDepositAddress) && (
                <div className="space-y-2">
                  <div className="text-[9px] font-mono text-gray-600 tracking-widest">
                    DEPOSIT ADDRESS
                  </div>
                  <div className="bg-[#0d0d0d] border border-[#2a2a2a] rounded-xl p-3 flex items-center gap-3">
                    {depositAddress ? (
                      <>
                        <span className="font-mono text-[11px] text-signal/90 flex-1 break-all ltr-force leading-relaxed">
                          {depositAddress}
                        </span>
                        <button
                          onClick={handleTopUpCopy}
                          className={`flex-shrink-0 w-9 h-9 rounded-lg border flex items-center justify-center
                                     transition-all active:scale-90
                                     ${isCopied
                                       ? 'bg-signal/20 border-signal text-signal shadow-[0_0_12px_rgba(204,255,0,0.3)]'
                                       : 'bg-[#111] border-[#333] text-gray-400 hover:border-signal hover:text-signal'
                                     }`}
                          title="Copy address"
                        >
                          <i className={`fas ${isCopied ? 'fa-check' : 'fa-copy'} text-xs`} />
                        </button>
                      </>
                    ) : (
                      <span className="text-[11px] font-mono text-gray-600 flex-1 flex items-center gap-2">
                        <i className="fas fa-circle-notch fa-spin text-[10px]" />
                        GENERATING DEDICATED ADDRESS...
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-[#111] bg-[#050505] flex items-center gap-2">
              <i className="fas fa-circle-notch fa-spin text-signal/50 text-[10px] flex-shrink-0" />
              <p className="text-[9px] font-mono text-gray-600 leading-relaxed tracking-wide">
                Network confirmations typically take{' '}
                <span className="text-signal/70">1-3 minutes</span>.
                Balance will update automatically.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          PROFILE EDIT MODAL
      ═══════════════════════════════════════════════════════════════════ */}
      {isProfileModalOpen && (
        <div
          className="fixed inset-0 z-[300] bg-black/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={(e) => { if (e.target === e.currentTarget) closeProfileModal(); }}
        >
          <div className="relative w-full sm:max-w-lg bg-[#080808] border border-[#2a2a2a] sm:rounded-2xl rounded-t-2xl overflow-hidden shadow-[0_0_80px_rgba(204,255,0,0.12)] max-h-[92vh] flex flex-col">

            {/* Top accent line */}
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-signal via-signal/60 to-transparent" />

            {/* Modal Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-[#1a1a1a] flex-shrink-0">
              <div>
                <div className="font-heavy text-base text-white tracking-wider">EDIT PROFILE</div>
                <div className="text-[9px] font-mono text-signal tracking-widest mt-0.5">
                  {mySubmissions.length > 0 ? 'BASIC + CREATOR SETTINGS UNLOCKED' : 'BASIC SETTINGS'}
                </div>
              </div>
              <button
                onClick={closeProfileModal}
                className="w-9 h-9 bg-[#111] border border-[#333] rounded-full flex items-center justify-center text-gray-400 hover:text-white hover:border-signal active:scale-90 transition-all"
              >
                <i className="fas fa-times text-sm" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="overflow-y-auto flex-1 px-5 py-5 space-y-6">

              {/* ── Section: Basic Settings ─────────────────────────────── */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-1 h-4 bg-signal rounded-full" />
                  <span className="text-[10px] font-mono text-signal tracking-widest">BASIC SETTINGS</span>
                </div>

                {/* Avatar Preview + Randomize */}
                <div className="flex items-center gap-5 mb-5">
                  <div className="relative shrink-0">
                    <img
                      src={`https://api.dicebear.com/7.x/bottts/svg?seed=${editAvatarSeed}`}
                      alt="preview avatar"
                      className="w-16 h-16 bg-black rounded-full border-2 border-signal/50 p-1"
                    />
                    <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 bg-signal rounded-full border-2 border-black flex items-center justify-center">
                      <i className="fas fa-check text-[8px] text-black" />
                    </div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="text-[10px] font-mono text-gray-500">AVATAR SEED</div>
                    <div className="flex items-center gap-2">
                      <div className="font-mono text-xs text-signal bg-signal/10 border border-signal/20 px-2 py-1 rounded tracking-widest">
                        {editAvatarSeed.substring(0, 10)}
                      </div>
                      <button
                        onClick={() => setEditAvatarSeed(randomSeed())}
                        className="text-[9px] font-mono text-signal border border-signal/40 bg-signal/10 px-2 py-1
                                   rounded tracking-widest hover:bg-signal/20 active:scale-95 transition-all"
                      >
                        <i className="fas fa-random mr-1" />RANDOMIZE
                      </button>
                    </div>
                  </div>
                </div>

                {/* Nickname Input */}
                <div>
                  <label className="block text-[10px] font-mono text-gray-500 tracking-widest mb-1.5">
                    DISPLAY NAME
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    maxLength={40}
                    placeholder="Enter display name..."
                    className="w-full bg-[#0d0d0d] border border-[#2a2a2a] text-white font-mono text-sm px-3 py-2.5 rounded-lg
                               outline-none focus:border-signal focus:shadow-[0_0_12px_rgba(204,255,0,0.15)]
                               placeholder:text-gray-700 transition-all"
                  />
                </div>
              </div>

              {/* ── Section: Creator Advanced Settings (locked if no films) ── */}
              {mySubmissions.length === 0 ? (
                <div className="border border-dashed border-[#2a2a2a] rounded-xl p-5 text-center">
                  <div className="w-10 h-10 bg-[#111] border border-[#333] rounded-full flex items-center justify-center mx-auto mb-3">
                    <i className="fas fa-lock text-gray-600 text-sm" />
                  </div>
                  <div className="text-[11px] font-heavy text-gray-500 tracking-widest mb-1">CREATOR PROFILE LOCKED</div>
                  <div className="text-[10px] font-mono text-gray-700 leading-relaxed">
                    Submit at least one film to unlock<br />advanced creator settings.
                  </div>
                </div>
              ) : (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-4 bg-[#00F0FF] rounded-full" />
                    <span className="text-[10px] font-mono text-[#00F0FF] tracking-widest">CREATOR PROFILE</span>
                    <span className="text-[9px] font-mono text-signal bg-signal/10 border border-signal/30 px-1.5 py-0.5 rounded ml-auto">
                      <i className="fas fa-unlock mr-1" />UNLOCKED
                    </span>
                  </div>

                  {/* About Studio */}
                  <div className="mb-4">
                    <label className="block text-[10px] font-mono text-gray-500 tracking-widest mb-1.5">
                      <i className="fas fa-building mr-1 text-[#00F0FF]" />ABOUT STUDIO
                    </label>
                    <textarea
                      value={editAboutStudio}
                      onChange={(e) => setEditAboutStudio(e.target.value)}
                      rows={3}
                      maxLength={400}
                      placeholder="Describe your studio, vision, and creative process..."
                      className="w-full bg-[#0d0d0d] border border-[#2a2a2a] text-white font-mono text-xs px-3 py-2.5 rounded-lg
                                 outline-none focus:border-[#00F0FF] focus:shadow-[0_0_12px_rgba(0,240,255,0.12)]
                                 placeholder:text-gray-700 resize-none transition-all leading-relaxed"
                    />
                    <div className="text-right text-[9px] font-mono text-gray-700 mt-0.5">
                      {editAboutStudio.length}/400
                    </div>
                  </div>

                  {/* Tech Stack */}
                  <div className="mb-5">
                    <label className="block text-[10px] font-mono text-gray-500 tracking-widest mb-1.5">
                      <i className="fas fa-microchip mr-1 text-signal" />TECH STACK
                      <span className="text-gray-700 ml-2 normal-case tracking-normal">comma-separated</span>
                    </label>
                    <input
                      type="text"
                      value={editTechStack}
                      onChange={(e) => setEditTechStack(e.target.value)}
                      placeholder="Sora, Midjourney, Suno, RunwayML..."
                      className="w-full bg-[#0d0d0d] border border-[#2a2a2a] text-white font-mono text-xs px-3 py-2.5 rounded-lg
                                 outline-none focus:border-signal focus:shadow-[0_0_12px_rgba(204,255,0,0.15)]
                                 placeholder:text-gray-700 transition-all"
                    />
                    {editTechStack && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {editTechStack.split(',').map((tech) => tech.trim()).filter(Boolean).map((tech) => (
                          <span key={tech} className="text-[10px] font-mono text-signal bg-signal/10 border border-signal/20 px-2 py-0.5 rounded">
                            {tech}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Core Team */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[10px] font-mono text-gray-500 tracking-widest">
                        <i className="fas fa-users mr-1 text-[#9D00FF]" />CORE TEAM
                      </label>
                      <button
                        onClick={addTeamMember}
                        className="flex items-center gap-1 text-[9px] font-mono text-signal border border-signal/40 bg-signal/10
                                   px-2 py-1 rounded tracking-widest hover:bg-signal/20 active:scale-95 transition-all"
                      >
                        <i className="fas fa-plus text-[8px]" />ADD MEMBER
                      </button>
                    </div>

                    {editCoreTeam.length === 0 ? (
                      <div className="border border-dashed border-[#222] rounded-lg py-4 text-center text-[10px] font-mono text-gray-700">
                        No team members added yet.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {editCoreTeam.map((member, index) => (
                          <div key={index} className="flex gap-2 items-start bg-[#0d0d0d] border border-[#222] rounded-lg p-3">
                            <div className="flex flex-col gap-2 flex-1">
                              <input
                                type="text"
                                value={member.name}
                                onChange={(e) => updateTeamMember(index, 'name', e.target.value)}
                                placeholder="Name"
                                className="bg-black border border-[#2a2a2a] text-white font-mono text-xs px-2.5 py-1.5 rounded
                                           outline-none focus:border-[#9D00FF] focus:shadow-[0_0_8px_rgba(157,0,255,0.15)]
                                           placeholder:text-gray-700 transition-all w-full"
                              />
                              <input
                                type="text"
                                value={member.role}
                                onChange={(e) => updateTeamMember(index, 'role', e.target.value)}
                                placeholder="Role (e.g. Director, Sound Designer)"
                                className="bg-black border border-[#2a2a2a] text-white font-mono text-xs px-2.5 py-1.5 rounded
                                           outline-none focus:border-[#9D00FF] focus:shadow-[0_0_8px_rgba(157,0,255,0.15)]
                                           placeholder:text-gray-700 transition-all w-full"
                              />
                            </div>
                            <button
                              onClick={() => removeTeamMember(index)}
                              className="w-7 h-7 bg-red-500/10 border border-red-500/30 rounded flex items-center justify-center
                                         text-red-500 hover:bg-red-500/20 active:scale-90 transition-all flex-shrink-0 mt-0.5"
                            >
                              <i className="fas fa-trash-alt text-[10px]" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center gap-3 px-5 py-4 border-t border-[#1a1a1a] flex-shrink-0 bg-[#080808]">
              <button
                onClick={closeProfileModal}
                disabled={isSaving}
                className="flex-1 py-2.5 bg-[#111] text-gray-300 font-heavy text-[11px] rounded-lg tracking-widest
                           border border-[#333] hover:border-white hover:text-white active:scale-95 transition-all
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                CANCEL
              </button>
              <button
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="flex-[2] py-2.5 bg-signal text-black font-heavy text-[11px] rounded-lg tracking-widest
                           shadow-[0_0_20px_rgba(204,255,0,0.3)] hover:shadow-[0_0_30px_rgba(204,255,0,0.45)]
                           active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSaving ? (
                  <><i className="fas fa-spinner fa-spin mr-1.5" />SAVING...</>
                ) : (
                  <><i className="fas fa-check mr-1.5" />SAVE PROFILE</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
