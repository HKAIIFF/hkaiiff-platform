"use client";

import { useState, useEffect } from "react";
import { usePrivy, useCreateWallet } from "@privy-io/react-auth";
import { useRouter } from "next/navigation";
import { useI18n } from "@/app/context/I18nContext";
import { useToast } from "@/app/context/ToastContext";
import CyberLoading from "@/app/components/CyberLoading";
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
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
  } | null>(null);

  const [onChainAifBalance, setOnChainAifBalance] = useState<number | null>(null);
  const [displaySolanaAddress, setDisplaySolanaAddress] = useState<string | null>(null);
  const [isFetchingBalance, setIsFetchingBalance] = useState(false);

  // ── HD Wallet 充值地址 State ──────────────────────────────────────────────
  const [depositAddress, setDepositAddress] = useState<string | null>(null);
  const [isFetchingDepositAddress, setIsFetchingDepositAddress] = useState(false);

  // ── Top-Up Modal State ────────────────────────────────────────────────────
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isCreatingWallet, setIsCreatingWallet] = useState(false);

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

  const handleCreateWallet = async () => {
    setIsCreatingWallet(true);
    try {
      await createWallet();
      showToast(lang === 'en' ? 'Deposit address generated!' : '充值地址已生成！', 'success');
    } catch (err) {
      console.error('Failed to create embedded wallet:', err);
      showToast(lang === 'en' ? 'Failed to generate address, please try again' : '生成地址失敗，請重試', 'error');
    } finally {
      setIsCreatingWallet(false);
    }
  };

  const handleOpenTopUp = async () => {
    setIsTopUpOpen(true);
    // 已有地址，直接顯示 Modal
    if (depositAddress) return;

    // 尚無地址，調用 API 生成
    try {
      setIsFetchingDepositAddress(true);
      const token = await getAccessToken();
      const res = await fetch('/api/wallet/assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.address) {
          setDepositAddress(data.address);
          setDbProfile((prev) => prev ? { ...prev, deposit_address: data.address } : prev);
        }
      } else {
        showToast(lang === 'en' ? 'Failed to generate address' : '生成地址失敗', 'error');
      }
    } catch (error) {
      console.error('handleOpenTopUp error:', error);
    } finally {
      setIsFetchingDepositAddress(false);
    }
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
          });
        } catch (err) {
          console.error('Failed to sync', err);
        }

        // Step 2: 直接从 Supabase 读取完整 profile（含充值地址字段）
        try {
          const { data: profileRow, error: profileError } = await supabase
            .from('users')
            .select('agent_id, name, display_name, role, aif_balance, avatar_seed, bio, tech_stack, core_team, deposit_address')
            .eq('id', user.id)
            .single();
          if (profileError) {
            console.error('❌ Failed to fetch profile:', profileError.message);
          } else if (profileRow) {
            setDbProfile(profileRow);

            if (profileRow.deposit_address) {
              // 已有充值地址，直接使用
              setDepositAddress(profileRow.deposit_address);
            } else {
              // 靜默調用 assign API 獲取並寫入充值地址
              setIsFetchingDepositAddress(true);
              try {
                const token = await getAccessToken();
                const res = await fetch('/api/wallet/assign', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                  },
                });
                const assignData = await res.json();
                if (assignData.address) {
                  setDepositAddress(assignData.address);
                }
              } catch (assignErr) {
                console.error('❌ Failed to assign deposit address:', assignErr);
              } finally {
                setIsFetchingDepositAddress(false);
              }
            }
          }
        } catch (err) {
          console.error('❌ Profile fetch exception:', err);
        }

        try {
          const userId = user.id;
          const filmsRes = await fetch(`/api/user-films?userId=${userId}`);
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
      fetchAIFBalance(privyWalletAddress);
    } else {
      setDisplaySolanaAddress(null);
      setOnChainAifBalance(0);
    }
  }, [authenticated, user]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchAIFBalance = async (address: string) => {
    setIsFetchingBalance(true);
    try {
      const mintAddress = process.env.NEXT_PUBLIC_AIF_MINT_ADDRESS;
      if (!mintAddress) {
        setOnChainAifBalance(0);
        return;
      }

      const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
      const connection = new Connection(rpcUrl, 'confirmed');
      const mintPubkey = new PublicKey(mintAddress);
      const ownerPubkey = new PublicKey(address);

      const ataAddress = await getAssociatedTokenAddress(mintPubkey, ownerPubkey);

      try {
        const balanceInfo = await connection.getTokenAccountBalance(ataAddress);
        setOnChainAifBalance(balanceInfo.value.uiAmount ?? 0);
      } catch (error) {
        console.error("ATA 餘額獲取失敗，可能無餘額", error);
        setOnChainAifBalance(0);
      }
    } catch (error) {
      console.error('AIF balance query error:', error);
      setOnChainAifBalance(0);
    } finally {
      setIsFetchingBalance(false);
    }
  };

  /* ─── AUTH GUARD ─────────────────────────────────────────────────────────── */
  // Privy 尚未初始化完成時，渲染空白等待 redirect；已就緒未登錄同樣清空防閃爍
  if (!ready || !authenticated) return null;

  /* ─── AUTHENTICATED VIEW ──────────────────────────────────────────────────── */
  return (
    <div className="flex-1 h-full w-full overflow-y-auto bg-void flex flex-col min-h-screen px-4 pt-28 pb-32 relative">
      {isHistoryLoading && <CyberLoading text="LOADING PARALLEL UNIVERSE..." />}

      {/* ── Page Header ────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 bg-void/95 backdrop-blur border-b border-[#222] px-6 py-4 flex items-center justify-between flex-shrink-0">
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
                      shadow-[0_0_20px_rgba(204,255,0,0.06)] relative overflow-hidden group mb-4">
        {/* Corner glow */}
        <div className="absolute top-0 right-0 w-28 h-28 bg-signal/5 rounded-bl-full transition-colors group-hover:bg-signal/10" />
        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-signal/60 via-signal/20 to-transparent" />

        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] text-signal font-mono tracking-widest flex items-center gap-2">
            <i className="fas fa-wallet" />
            FUNDING ACCOUNT
          </div>
          <button
            onClick={handleOpenTopUp}
            className="flex items-center gap-1.5 text-[10px] font-heavy tracking-widest
                       bg-signal text-black px-3 py-1.5 rounded-lg
                       shadow-[0_0_12px_rgba(204,255,0,0.4)]
                       hover:shadow-[0_0_20px_rgba(204,255,0,0.6)]
                       active:scale-95 transition-all"
          >
            <i className="fas fa-plus text-[9px]" />
            TOP UP
          </button>
        </div>

        {/* Internal AIF Balance (from Supabase) */}
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-4xl font-heavy text-white ltr-force">
            {dbProfile !== null
              ? (dbProfile.aif_balance ?? 0).toLocaleString()
              : <span className="text-2xl text-gray-500 animate-pulse">...</span>
            }
          </span>
          <span className="text-signal text-lg font-heavy">AIF</span>
          <span className="text-[9px] font-mono text-gray-600 ml-1">INTERNAL LEDGER</span>
        </div>

        {/* On-chain balance (secondary) */}
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[#222]">
          <i className="fa-brands fa-solana text-[#9945FF] text-[10px]" />
          <span className="text-[10px] font-mono text-gray-500">ON-CHAIN:</span>
          <span className="text-[10px] font-mono text-white ltr-force">
            {isFetchingBalance
              ? <span className="animate-pulse text-gray-600">QUERYING...</span>
              : onChainAifBalance !== null
                ? `${onChainAifBalance.toLocaleString()} AIF`
                : '—'
            }
          </span>
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
              /* ── 官方參賽證書 UI ────────────────────────────────────────── */
              <div className="relative bg-[#050505] border-2 border-[#D4AF37]/50 rounded-xl p-8 overflow-hidden shadow-2xl">

                {/* 背景水印：徑向漸變 */}
                <div
                  className="absolute inset-0 pointer-events-none select-none"
                  style={{
                    background: 'radial-gradient(ellipse at 50% 40%, rgba(212,175,55,0.06) 0%, transparent 70%)',
                  }}
                />
                {/* 頂部金色細線 */}
                <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-[#D4AF37]/60 to-transparent" />
                {/* 底部金色細線 */}
                <div className="absolute bottom-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-[#D4AF37]/40 to-transparent" />

                {/* 頂部 Header */}
                <div className="text-center mb-6 relative z-10">
                  <h3 className="text-[#D4AF37] font-serif text-2xl tracking-widest uppercase">
                    Certificate of Entry
                  </h3>
                  <div className="text-gray-500 text-[10px] tracking-widest mt-1">
                    HONG KONG AI INTERNATIONAL FILM FESTIVAL
                  </div>
                  <div className="w-16 h-0.5 bg-[#D4AF37]/40 mx-auto mt-3" />
                </div>

                {/* 證書正文 */}
                <div className="text-gray-300 text-sm leading-relaxed text-center font-mono relative z-10 mb-6">
                  This is to certify that the AI-Native Film
                  <span className="text-white text-xl font-heavy block my-3 uppercase tracking-wide">
                    {selectedFilm?.title || 'UNTITLED'}
                  </span>
                  submitted by{' '}
                  <span className="text-[#CCFF00]">
                    {selectedFilm?.studio || dbProfile?.display_name || 'Unknown Studio'}
                  </span>
                  <br />
                  has been officially selected and approved by the
                  <br />
                  <span className="text-white font-bold">
                    Hong Kong AI International Film Festival Jury
                  </span>
                  .
                </div>

                {/* 關鍵數據網格 */}
                <div className="grid grid-cols-3 gap-2 relative z-10 mb-2">
                  <div className="bg-black/40 border border-[#D4AF37]/20 rounded-lg p-2 text-center">
                    <div className="text-[8px] font-mono text-gray-500 tracking-widest mb-1">AI RATIO</div>
                    <div className="text-[#CCFF00] font-heavy text-base">
                      {selectedFilm?.ai_ratio ?? 0}%
                    </div>
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
                        ? new Date(selectedFilm.created_at).toLocaleDateString()
                        : '—'}
                    </div>
                  </div>
                </div>

                {/* ── 官方防偽印章 (任務三) ─────────────────────────────── */}
                <div className="absolute bottom-6 right-6 w-24 h-24 rounded-full border-[3px] border-double border-red-700/80 flex items-center justify-center transform -rotate-12 opacity-80 pointer-events-none select-none">
                  <div className="text-center">
                    <div className="text-red-700/80 text-[8px] font-bold tracking-widest uppercase">Official</div>
                    <div className="text-red-700/80 text-lg font-heavy my-0.5">SELECTION</div>
                    <div className="text-red-700/80 text-[6px] font-mono">HKAIIFF JURY</div>
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

              {/* QR Code */}
              <div className="flex flex-col items-center gap-3">
                {depositAddress ? (
                  <div className="p-3 bg-white rounded-xl shadow-[0_0_24px_rgba(204,255,0,0.2)]">
                    <QRCode
                      value={depositAddress}
                      size={160}
                      bgColor="#ffffff"
                      fgColor="#000000"
                      level="M"
                    />
                  </div>
                ) : (
                  <div className="w-[186px] h-[186px] border-2 border-dashed border-signal/30 rounded-xl flex flex-col
                                  items-center justify-center gap-3 bg-signal/5 px-4">
                    {isFetchingDepositAddress ? (
                      <>
                        <i className="fas fa-circle-notch fa-spin text-3xl text-signal/50" />
                        <span className="text-[10px] font-mono text-signal/60 tracking-wider text-center">
                          GENERATING ADDRESS...
                        </span>
                      </>
                    ) : (
                      <>
                        <i className="fas fa-qrcode text-4xl text-signal/40" />
                        <span className="text-[10px] font-mono text-gray-600 tracking-wider text-center">
                          ADDRESS NOT READY
                        </span>
                      </>
                    )}
                  </div>
                )}
                {depositAddress && (
                  <div className="text-[9px] font-mono text-gray-500 tracking-wider">
                    SCAN WITH SOLANA WALLET
                  </div>
                )}
              </div>

              {/* Address Display + Copy */}
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
                      {isFetchingDepositAddress ? (
                        <>
                          <i className="fas fa-circle-notch fa-spin text-[10px]" />
                          GENERATING DEDICATED ADDRESS...
                        </>
                      ) : (
                        'ADDRESS UNAVAILABLE'
                      )}
                    </span>
                  )}
                </div>
              </div>
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
