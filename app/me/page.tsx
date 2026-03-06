"use client";

import { useState, useEffect } from "react";
import { usePrivy, useWallets } from "@privy-io/react-auth";
import { useI18n } from "@/app/context/I18nContext";
import { useToast } from "@/app/context/ToastContext";
import CyberLoading from "@/app/components/CyberLoading";
import { Connection, PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddress } from '@solana/spl-token';
import { supabase } from "@/lib/supabase";

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
  const { login, ready, authenticated, user, logout } = usePrivy();
  const { wallets } = useWallets();
  const { t } = useI18n();
  const { showToast } = useToast();
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
  } | null>(null);

  const [onChainAifBalance, setOnChainAifBalance] = useState<number | null>(null);
  const [displaySolanaAddress, setDisplaySolanaAddress] = useState<string | null>(null);
  const [isFetchingBalance, setIsFetchingBalance] = useState(false);

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
        .eq('privy_id', user.id);

      if (error) {
        console.error('❌ Profile save error (full):', error);
        showToast("UPDATE FAILED: " + error.message, "error");
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
      showToast("SYSTEM ERROR: " + (err?.message ?? String(err)), "error");
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

        // Step 2: 直接从 Supabase 读取完整 profile（含新字段，用 privy_id 匹配）
        try {
          const { data: profileRow, error: profileError } = await supabase
            .from('users')
            .select('agent_id, name, display_name, role, aif_balance, avatar_seed, bio, tech_stack, core_team')
            .eq('privy_id', user.id)
            .single();
          if (profileError) {
            console.error('❌ Failed to fetch profile:', profileError.message);
          } else if (profileRow) {
            setDbProfile(profileRow);
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

    let targetSolanaAddress: string | null = null;

    const activeSolanaWallet = wallets.find((w) => w.chainType === 'solana');
    if (activeSolanaWallet && activeSolanaWallet.address) {
      targetSolanaAddress = activeSolanaWallet.address;
    } else {
      const linkedSolanaAccount = user.linkedAccounts?.find(
        (acc: any) => acc.type === 'wallet' && acc.chainType === 'solana'
      );
      if (linkedSolanaAccount && linkedSolanaAccount.address) {
        targetSolanaAddress = linkedSolanaAccount.address;
      }
    }

    if (targetSolanaAddress && !targetSolanaAddress.startsWith('0x')) {
      setDisplaySolanaAddress(targetSolanaAddress);
      fetchAIFBalance(targetSolanaAddress);
    } else {
      setDisplaySolanaAddress(null);
      setOnChainAifBalance(0);
    }
  }, [authenticated, user, wallets]); // eslint-disable-line react-hooks/exhaustive-deps

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

  /* ─── LOGIN VIEW ─────────────────────────────────────────────────────────── */
  if (!authenticated) {
    return (
      <div className="flex-1 h-full w-full bg-void min-h-screen flex items-center justify-center px-6 pt-28 pb-32">
        <div className="w-full max-w-sm flex flex-col items-center gap-6">
          {/* Scan-line decoration */}
          <div className="relative w-full border border-signal/30 rounded-2xl p-8 bg-[#050505] shadow-[0_0_40px_rgba(204,255,0,0.08)] overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-0.5 bg-signal" />
            <div className="absolute bottom-0 left-0 w-full h-0.5 bg-signal/30" />

            {/* Logo */}
            <div className="text-center mb-6">
              <div className="font-heavy text-5xl tracking-tighter text-white mb-1">
                HKAIIFF
              </div>
              <div className="text-[9px] font-mono text-signal tracking-widest">
                Something has to change
              </div>
            </div>

            {/* Lock icon */}
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 rounded-full border-2 border-signal/40 flex items-center justify-center relative">
                <div className="absolute inset-0 rounded-full border border-signal/20 animate-ping" />
                <i className="fas fa-lock text-3xl text-signal" />
              </div>
            </div>

            {/* Status */}
            <div className="text-center mb-8">
              <div className="font-heavy text-2xl text-white tracking-[0.3em] mb-2">
                SYSTEM LOCKED
              </div>
              <div className="text-[10px] font-mono text-gray-500 tracking-widest">
                IDENTITY VERIFICATION REQUIRED
              </div>
            </div>

            {/* Connect button */}
            <button
              onClick={login}
              disabled={!ready}
              className="w-full py-4 bg-signal text-black font-heavy text-base tracking-widest rounded-xl
                         shadow-[0_0_30px_rgba(204,255,0,0.35)] active:scale-[0.97] transition-all
                         hover:shadow-[0_0_40px_rgba(204,255,0,0.5)]
                         disabled:opacity-60 disabled:cursor-not-allowed disabled:shadow-none"
            >
              <i className="fas fa-plug mr-2" />
              {!ready ? "LOADING SYSTEM..." : "CONNECT PRIVY IDENTITY"}
            </button>

            <div className="mt-4 text-center text-[9px] font-mono text-gray-600 tracking-widest">
              POWERED BY PRIVY · AIF PROTOCOL
            </div>
          </div>

          {/* Bottom hint */}
          <div className="font-mono text-[10px] text-gray-700 text-center">
            v0.9.1-alpha · Web3 Auth Layer Ready
          </div>
        </div>
      </div>
    );
  }

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
            {user?.id ? `Agent_${user.id.replace('did:privy:', '').substring(0, 6)}` : 'Agent_SYNCING'}
          </h2>
          <div className="text-[9px] text-gray-400 font-mono mb-2 tracking-wider uppercase">
            {dbProfile ? t(`role_${dbProfile?.role || 'human'}`).toUpperCase() : '...'}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                if (displaySolanaAddress) {
                  navigator.clipboard.writeText(displaySolanaAddress);
                }
              }}
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

      {/* ── AIF Balance ────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-[#111] to-[#0a0a0a] p-5 rounded-xl border border-[#333] shadow-lg
                      relative overflow-hidden group mb-6">
        <div className="absolute top-0 right-0 w-24 h-24 bg-signal/5 rounded-bl-full transition-colors group-hover:bg-signal/10" />
        <div className="text-[10px] text-gray-500 mb-2 font-mono flex items-center gap-2">
          <i className="fas fa-coins text-signal" /> AIF BALANCE
        </div>
        <div className="text-4xl font-heavy text-white ltr-force flex items-baseline gap-1">
          {onChainAifBalance !== null ? (
            <>
              {onChainAifBalance.toLocaleString()}{" "}
              <span className="text-signal text-lg">AIF</span>
            </>
          ) : (
            <span className="text-2xl text-gray-500 font-mono animate-pulse">...</span>
          )}
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
          <div className="grid grid-cols-1 gap-3">
            {mySubmissions.map((film) => {
              const statusUI = getStatusUI(film.status);
              return (
                <div
                  key={film.id}
                  onClick={() => setSelectedFilm(film)}
                  className="flex gap-4 items-center bg-[#111] border border-[#333] rounded-xl p-3
                             cursor-pointer hover:border-signal active:scale-[0.98] transition-all
                             shadow-[0_0_10px_rgba(0,0,0,0.5)] group"
                >
                  {/* Poster */}
                  <div className="relative shrink-0 w-16 h-20 rounded-lg overflow-hidden border border-[#333]">
                    {film.poster_url ? (
                      <img
                        src={film.poster_url}
                        alt={film.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-[#0a0a0a] flex items-center justify-center">
                        <i className="fas fa-film text-gray-700 text-xl" />
                      </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-heavy text-sm text-white tracking-wide truncate group-hover:text-signal transition-colors mb-1">
                      {film.title || 'UNTITLED'}
                    </div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <div className="text-[10px] font-mono text-gray-400 bg-black border border-[#222] px-1.5 py-0.5 rounded">
                        <i className="fas fa-robot text-signal mr-1" />
                        AI {film.ai_ratio ?? 0}%
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className={`inline-flex items-center text-[10px] px-2 py-1 border rounded-sm font-mono ${statusUI.color}`}>
                        <i className={`fas ${statusUI.icon} mr-1`} />
                        {t('status_' + film.status)}
                      </div>
                      <i className="fas fa-lock text-gray-600 text-xs" />
                    </div>
                  </div>

                  <i className="fas fa-chevron-right text-gray-600 group-hover:text-signal transition-colors shrink-0" />
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
          FILM INFO MODAL (READ-ONLY)
      ═══════════════════════════════════════════════════════════════════ */}
      {selectedFilm && (
        <div
          className="fixed inset-0 z-[200] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setSelectedFilm(null); }}
        >
          <div className="relative w-full max-w-sm bg-[#080808] border border-[#333] rounded-2xl overflow-hidden
                          shadow-[0_0_60px_rgba(204,255,0,0.1)]">
            {/* Top accent line */}
            <div className="absolute top-0 left-0 w-full h-0.5 bg-signal" />

            {/* Close button */}
            <button
              onClick={() => setSelectedFilm(null)}
              className="absolute top-4 right-4 z-10 w-9 h-9 bg-black/80 border border-[#333] rounded-full
                         flex items-center justify-center text-gray-400 hover:text-white hover:border-signal
                         active:scale-90 transition-all"
            >
              <i className="fas fa-times text-sm" />
            </button>

            {/* Poster */}
            <div className="relative w-full h-52 overflow-hidden bg-[#0a0a0a]">
              {selectedFilm.poster_url ? (
                <img
                  src={selectedFilm.poster_url}
                  alt={selectedFilm.title}
                  className="w-full h-full object-cover opacity-80"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <i className="fas fa-film text-5xl text-gray-700" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#080808] via-black/30 to-transparent" />
              <div className="absolute bottom-0 left-0 p-4">
                <h2 className="font-heavy text-2xl text-white leading-tight tracking-wide drop-shadow-lg">
                  {selectedFilm.title || 'UNTITLED'}
                </h2>
              </div>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4">
              {/* Dynamic status badge */}
              {(() => {
                const modalStatusUI = getStatusUI(selectedFilm.status);
                return (
                  <>
                    <div className={`text-xs px-2 py-1 rounded inline-flex items-center mb-4 border ${modalStatusUI.color}`}>
                      <i className={`fas ${modalStatusUI.icon} mr-2`} />
                      {t('status_' + selectedFilm.status)} - LOCKED
                    </div>
                    {selectedFilm.status === 'rejected' && (
                      <p className="text-red-500 text-xs mt-4 border border-red-500/50 p-2 rounded bg-red-500/10">
                        This submission was not approved. You need to submit a new entry and pay the fee again.
                      </p>
                    )}
                  </>
                );
              })()}

              {/* Stats row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#111] border border-[#222] rounded-lg p-3">
                  <div className="text-[9px] font-mono text-gray-500 mb-1">AI RATIO</div>
                  <div className="font-heavy text-xl text-signal">
                    {selectedFilm.ai_ratio ?? 0}%
                  </div>
                </div>
                <div className="bg-[#111] border border-[#222] rounded-lg p-3">
                  <div className="text-[9px] font-mono text-gray-500 mb-1">STATUS</div>
                  <div className="font-heavy text-sm text-signal tracking-widest">
                    {(selectedFilm.status || 'PENDING').toUpperCase()}
                  </div>
                </div>
              </div>

              {/* Tech Stack */}
              {selectedFilm.tech_stack && (
                <div className="bg-[#111] border border-[#222] rounded-lg p-3">
                  <div className="text-[9px] font-mono text-gray-500 mb-2 flex items-center gap-1">
                    <i className="fas fa-microchip text-signal" /> TECH STACK
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(Array.isArray(selectedFilm.tech_stack)
                      ? selectedFilm.tech_stack
                      : selectedFilm.tech_stack.split(',')
                    ).map((t: string) => (
                      <span
                        key={t}
                        className="text-[10px] font-mono text-signal bg-signal/10 border border-signal/20 px-2 py-0.5 rounded"
                      >
                        {t.trim()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Synopsis */}
              {selectedFilm.synopsis && (
                <div className="bg-[#111] border border-[#222] rounded-lg p-3">
                  <div className="text-[9px] font-mono text-gray-500 mb-2 flex items-center gap-1">
                    <i className="fas fa-scroll text-gray-400" /> WORLD SYNOPSIS
                  </div>
                  <p className="text-[11px] font-mono text-gray-400 leading-relaxed">
                    {selectedFilm.synopsis}
                  </p>
                </div>
              )}

              <div className="text-[9px] font-mono text-gray-700 text-center pt-1">
                SUBMITTED · {selectedFilm.created_at
                  ? new Date(selectedFilm.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                  : '—'}
              </div>
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
