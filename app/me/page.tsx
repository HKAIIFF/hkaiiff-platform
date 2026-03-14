"use client";

import React, { useState, useEffect, useRef } from "react";
import { usePrivy, useCreateWallet } from "@privy-io/react-auth";
import { useRouter, usePathname } from "next/navigation";
import { useI18n } from "@/app/context/I18nContext";
import { useToast } from "@/app/context/ToastContext";
import CyberLoading from "@/app/components/CyberLoading";
import { supabase } from "@/lib/supabase";
import QRCode from "react-qr-code";

function randomSeed() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  return `${year}${month}${day} ${hours}:${mins}`;
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
  const pathname = usePathname();
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

  // ── 已上线 LBS 影展 ────────────────────────────────────────────────────────
  const [onlineLbsNodes, setOnlineLbsNodes] = useState<Array<{
    id: string;
    title: string;
    poster_url: string | null;
  }>>([]);
  // ── 审核通过但未上线的 LBS 影展 ──────────────────────────────────────────
  const [approvedLbsNodes, setApprovedLbsNodes] = useState<Array<{
    id: string;
    title: string;
    poster_url: string | null;
  }>>([]);
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
    verification_status: 'unverified' | 'pending' | 'approved' | 'rejected';
    verification_type: 'creator' | 'institution' | 'curator' | null;
    rejection_reason: string | null;
    verified_identities: string[];
    username_locked: boolean;
  } | null>(null);

  /** 用戶所有的身份申請記錄（含多種身份） */
  const [identityApplications, setIdentityApplications] = useState<Array<{
    id: string;
    identity_type: 'creator' | 'institution' | 'curator';
    status: 'awaiting_payment' | 'pending' | 'approved' | 'rejected';
    expires_at: string | null;
    rejection_reason: string | null;
    submitted_at: string;
    verification_name: string | null;
  }>>([]);

  /** 認證按鈕鎖定：有任何 pending 或 approved 未過期的記錄即鎖定 */
  const [isVerifyLocked, setIsVerifyLocked] = useState(false);

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

  /**
   * wallet/assign 一次性鎖：防止 syncData useEffect 因 user 對象不穩定
   * 而重複觸發，導致新用戶的充值地址被多次分配（死循環）。
   */
  const walletAssignCalledRef = useRef(false);

  // ── Top-Up Modal State ────────────────────────────────────────────────────
  const [isTopUpOpen, setIsTopUpOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [copiedFilmId, setCopiedFilmId] = useState<string | null>(null);

  /** 靜默輪詢計時器：TopUp Modal 打開期間每 5 秒自動查帳 */
  const pollingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** 防止多個輪詢請求並發 */
  const isPollingRef = useRef(false);

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

  /**
   * TOP UP 按鈕：打開 Modal。
   * - 若 state/DB 中已有地址：直接渲染 QR Code，零等待。
   * - 若完全無地址（極少數情況）：打開 Modal 的同時在背景自動呼叫
   *   /api/wallet/assign，生成完畢後立即渲染 QR Code。
   *   絕不顯示「手動生成」按鈕，用戶無需多點擊一次。
   */
  const handleOpenTopUp = () => {
    // 優先從 dbProfile 同步（避免 state 落後於 DB）
    const resolvedAddress = depositAddress || dbProfile?.deposit_address || null;
    if (resolvedAddress && !depositAddress) {
      setDepositAddress(resolvedAddress);
    }
    setIsTopUpOpen(true);

    // 若完全無地址，在背景自動分配，無需用戶干預
    if (!resolvedAddress && !isFetchingDepositAddress) {
      setIsFetchingDepositAddress(true);
      callAssignWalletApi(displaySolanaAddress)
        .then((address) => {
          setDepositAddress(address);
          setDbProfile((prev) => prev ? { ...prev, deposit_address: address } : prev);
          showToast(lang === 'en' ? 'Deposit address ready!' : '專屬充值地址已就緒！', 'success');
        })
        .catch((err) => {
          console.error('[handleOpenTopUp] auto-assign error:', err);
          const msg = err instanceof Error ? err.message : (lang === 'en' ? 'Network error, please retry' : '網絡錯誤，請重試');
          showToast(msg, 'error');
        })
        .finally(() => setIsFetchingDepositAddress(false));
    }
  };

  /**
   * ATA 初始化觸發器：每次 TopUp Modal 打開且地址存在，必定觸發一次後端確認。
   * 後端 init-ata 有 getAccountInfo 冪等校驗，ATA 已存在時零消耗直接返回。
   * 不設任何前端 useRef 鎖，確保每次打開都能接通後端、輸出 Debug 日誌。
   */
  useEffect(() => {
    if (!isTopUpOpen || !depositAddress) return;

    let cancelled = false;
    const initAta = async () => {
      try {
        const token = await getAccessToken();
        if (cancelled) return;
        await fetch('/api/wallet/init-ata', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // 靜默失敗：ATA init 為背景冪等操作，不影響用戶使用
      }
    };

    initAta();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTopUpOpen, depositAddress]);

  /**
   * 靜默自動查帳輪詢：TopUp Modal 打開 + 有充值地址時啟動。
   * 每 5 秒調用一次 /api/wallet/sync-balance。
   * 一旦餘額入帳：立刻清除輪詢、關閉 Modal、閃爍餘額並彈出成功 Toast。
   */
  useEffect(() => {
    if (!isTopUpOpen || !depositAddress) {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      isPollingRef.current = false;
      return;
    }

    const pollBalance = async () => {
      if (isPollingRef.current) return;
      isPollingRef.current = true;
      try {
        const token = await getAccessToken();
        const res = await fetch('/api/wallet/sync-balance', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        const data = await res.json();
        if (res.ok && data.synced === true) {
          // 餘額入帳！清除輪詢，關閉 Modal，更新餘額
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          setDbProfile((prev) => prev ? { ...prev, aif_balance: data.aif_balance } : prev);
          setAifFlash(true);
          setTimeout(() => setAifFlash(false), 900);
          setIsTopUpOpen(false);
          showToast(
            lang === 'en'
              ? `+${data.aifAmount} AIF credited! Balance updated.`
              : `+${data.aifAmount} AIF 已入帳！餘額已更新。`,
            'success'
          );
        }
      } catch {
        // 靜默忽略輪詢錯誤，繼續下一輪
      } finally {
        isPollingRef.current = false;
      }
    };

    // 立刻執行一次，再每 5 秒一次
    pollBalance();
    pollingIntervalRef.current = setInterval(pollBalance, 5000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      isPollingRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTopUpOpen, depositAddress]);


  // ── Profile Edit Modal State ──────────────────────────────────────────────
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAvatarSeed, setEditAvatarSeed] = useState('');
  const [editAboutStudio, setEditAboutStudio] = useState('');
  const [editTechStack, setEditTechStack] = useState('');
  const [editCoreTeam, setEditCoreTeam] = useState<TeamMember[]>([]);

  function openProfileModal() {
    // 防呆：已認證或審核中時拒絕打開
    const isVerified = (dbProfile?.verified_identities?.length ?? 0) > 0;
    const isPending = identityApplications.some(
      (a) => a.status === 'pending' || a.status === 'awaiting_payment'
    );
    if (isVerified) {
      showToast('已認證，如需修改資料請重新提交身份認證', 'error');
      return;
    }
    if (isPending) {
      showToast('認證審核中，暫不可修改資料', 'error');
      return;
    }
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

      // 已認證或審核中時，嚴禁覆寫 display_name（後端由 verification_name 管理）
      const isNameLocked =
        (dbProfile?.verified_identities?.length ?? 0) > 0 ||
        identityApplications.some(
          (a) => a.status === 'pending' || a.status === 'awaiting_payment'
        );

      const { error } = await supabase
        .from('users')
        .update({
          ...(isNameLocked ? {} : { display_name: editName }),
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
                ...(isNameLocked ? {} : { display_name: editName }),
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
  // ⚠️ 依賴陣列使用 user?.id（穩定字串）而非 user 對象，
  //    防止 Privy 每次渲染返回新引用導致此 effect 無限重跑形成死循環。
  useEffect(() => {
    if (!authenticated || !user?.id) return;

    // 重置 wallet assign 鎖（用戶切換時允許重新分配）
    walletAssignCalledRef.current = false;

    const syncData = async () => {
      const userId = user.id;

      // Step 1: 同步基础信息（确保用户行存在），并利用返回值立即初始化余额
      const defaultProfile = {
        agent_id: '',
        name: 'New Agent',
        display_name: null as string | null,
        role: 'human',
        aif_balance: 0,
        avatar_seed: userId,
        bio: null as string | null,
        tech_stack: null as string | null,
        core_team: null as TeamMember[] | null,
        deposit_address: null as string | null,
        wallet_index: null as number | null,
        verification_status: 'unverified' as const,
        verification_type: null as 'creator' | 'institution' | 'curator' | null,
        rejection_reason: null as string | null,
        verified_identities: [] as string[],
        username_locked: false,
      };

      try {
        const syncRes = await fetch('/api/sync-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user }),
          cache: 'no-store',
        });
        if (syncRes.ok) {
          const syncData = await syncRes.json();
          // sync-user 返回完整用戶行（含 aif_balance），立即更新餘額避免顯示 0
          if (syncData && typeof syncData.aif_balance === 'number') {
            setDbProfile((prev) =>
              prev
                ? { ...prev, aif_balance: syncData.aif_balance }
                : { ...defaultProfile, aif_balance: syncData.aif_balance }
            );
          }
        }
      } catch (err) {
        console.error('Failed to sync', err);
      }

      // Step 2: 直接從 Supabase 讀取完整 profile（含充值地址及所有驗證欄位）
      try {
        const { data: profileRow, error: profileError } = await supabase
          .from('users')
          .select('agent_id, name, display_name, role, aif_balance, avatar_seed, bio, tech_stack, core_team, deposit_address, wallet_index, verification_status, verification_type, rejection_reason, verified_identities, username_locked')
          .eq('id', userId)
          .single();

        if (profileError) {
          console.error('❌ Failed to fetch profile:', profileError.message);
          setDbProfile((prev) => prev ?? { ...defaultProfile, verified_identities: [] });
        } else if (profileRow) {
          setDbProfile({ ...profileRow, verified_identities: profileRow.verified_identities ?? [], username_locked: profileRow.username_locked ?? false });

          // Step 2b: 加載多重身份申請記錄（含認證名稱）
          const { data: apps } = await supabase
            .from('creator_applications')
            .select('id, identity_type, status, expires_at, rejection_reason, submitted_at, verification_name')
            .eq('user_id', userId)
            .in('status', ['pending', 'approved', 'rejected', 'awaiting_payment'])
            .order('submitted_at', { ascending: false });
          setIdentityApplications(apps ?? []);

          // 計算認證按鈕鎖定狀態：有任何 pending 或 approved 未過期記錄即鎖定
          const nowTs = new Date().toISOString();
          const locked = (apps ?? []).some(
            (a) =>
              a.status === 'pending' ||
              a.status === 'awaiting_payment' ||
              (a.status === 'approved' && (!a.expires_at || a.expires_at > nowTs))
          );
          setIsVerifyLocked(locked);

          if (profileRow.deposit_address) {
            setDepositAddress(profileRow.deposit_address);
          } else if (!profileRow.wallet_index && profileRow.wallet_index !== 0) {
            // 全新用戶（無 wallet_index）：一次性自動分配充值地址
            // walletAssignCalledRef 防止 effect 重跑時重複呼叫
            if (!walletAssignCalledRef.current) {
              walletAssignCalledRef.current = true;
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
                  console.warn('⚠️ Auto-assign deposit address failed, user can generate manually.');
                  walletAssignCalledRef.current = false; // 失敗允許重試
                }
              } catch (assignErr) {
                console.warn('⚠️ Auto-assign exception:', assignErr);
                walletAssignCalledRef.current = false;
              }
            }
          } else {
            // 已有 wallet_index 但 deposit_address 被清空：自動重派生地址（冪等操作）
            if (!walletAssignCalledRef.current) {
              walletAssignCalledRef.current = true;
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
                  walletAssignCalledRef.current = false;
                }
              } catch (err) {
                console.warn('[me] Failed to restore deposit address:', err);
                walletAssignCalledRef.current = false;
              }
            }
          }
        } else {
          setDbProfile((prev) => prev ?? defaultProfile);
        }
      } catch (err) {
        console.error('❌ Profile fetch exception:', err);
        setDbProfile((prev) => prev ?? defaultProfile);
      } finally {
        setIsProfileLoading(false);
      }

      try {
        const filmsRes = await fetch(`/api/user-films?userId=${userId}`, { cache: 'no-store' });
        const filmsData = await filmsRes.json();
        if (!filmsData.error && Array.isArray(filmsData.films)) {
          setMySubmissions(filmsData.films);
        }
      } catch (err) {
        console.error('Failed to fetch films', err);
      }

      try {
        const { data, error } = await supabase
          .from('interactive_submissions')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false });
        if (error) {
          console.error('Failed to fetch interaction history', error);
        } else {
          setInteractionHistory(data ?? []);
        }
      } catch (err) {
        console.error('Failed to fetch interaction history', err);
      }

      // 加载已上线的 LBS 影展节点
      try {
        const { data: lbsData } = await supabase
          .from('lbs_nodes')
          .select('id, title, poster_url')
          .eq('creator_id', userId)
          .eq('is_online', true)
          .order('created_at', { ascending: false });
        setOnlineLbsNodes(lbsData ?? []);
      } catch (err) {
        console.error('Failed to fetch online LBS nodes', err);
      }

      // 加载审核通过（但未必上线）的 LBS 影展节点
      // 使用 neq('is_online', true) 而非 eq('is_online', false)，确保 null 值也被包含
      try {
        const { data: approvedData } = await supabase
          .from('lbs_nodes')
          .select('id, title, poster_url')
          .eq('creator_id', userId)
          .eq('review_status', 'approved')
          .neq('is_online', true)
          .order('created_at', { ascending: false });
        setApprovedLbsNodes(approvedData ?? []);
      } catch (err) {
        console.error('Failed to fetch approved LBS nodes', err);
      }
    };

    syncData();
  }, [authenticated, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── pathname 变化时重新拉取用户 profile + 身份 + LBS 数据（不含钱包分配）──
  useEffect(() => {
    if (!authenticated || !user?.id) return;
    const userId = user.id;

    const refreshUserData = async () => {
      try {
        const { data: profileRow } = await supabase
          .from('users')
          .select('agent_id, name, display_name, role, aif_balance, avatar_seed, bio, tech_stack, core_team, deposit_address, wallet_index, verification_status, verification_type, rejection_reason, verified_identities, username_locked')
          .eq('id', userId)
          .single();
        if (profileRow) {
          setDbProfile((prev) => ({
            ...(prev ?? {
              agent_id: '', name: 'New Agent', display_name: null, role: 'human',
              aif_balance: 0, avatar_seed: userId, bio: null, tech_stack: null,
              core_team: null, deposit_address: null, wallet_index: null,
              verification_status: 'unverified' as const, verification_type: null,
              rejection_reason: null, verified_identities: [], username_locked: false,
            }),
            ...profileRow,
            verified_identities: profileRow.verified_identities ?? [],
            username_locked: profileRow.username_locked ?? false,
          }));
        }
      } catch (err) {
        console.error('[me] refreshUserData profile error:', err);
      }

      try {
        const { data: apps } = await supabase
          .from('creator_applications')
          .select('id, identity_type, status, expires_at, rejection_reason, submitted_at, verification_name')
          .eq('user_id', userId)
          .in('status', ['pending', 'approved', 'rejected', 'awaiting_payment'])
          .order('submitted_at', { ascending: false });
        setIdentityApplications(apps ?? []);
        const nowTs = new Date().toISOString();
        const locked = (apps ?? []).some(
          (a) =>
            a.status === 'pending' ||
            a.status === 'awaiting_payment' ||
            (a.status === 'approved' && (!a.expires_at || a.expires_at > nowTs))
        );
        setIsVerifyLocked(locked);
      } catch (err) {
        console.error('[me] refreshUserData apps error:', err);
      }

      try {
        const { data: lbsOnline } = await supabase
          .from('lbs_nodes')
          .select('id, title, poster_url')
          .eq('creator_id', userId)
          .eq('is_online', true)
          .order('created_at', { ascending: false });
        setOnlineLbsNodes(lbsOnline ?? []);
      } catch (err) {
        console.error('[me] refreshUserData lbs online error:', err);
      }

      try {
        const { data: lbsApproved } = await supabase
          .from('lbs_nodes')
          .select('id, title, poster_url')
          .eq('creator_id', userId)
          .eq('review_status', 'approved')
          .neq('is_online', true)
          .order('created_at', { ascending: false });
        setApprovedLbsNodes(lbsApproved ?? []);
      } catch (err) {
        console.error('[me] refreshUserData lbs approved error:', err);
      }
    };

    refreshUserData();
  }, [pathname, authenticated, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!authenticated || !user?.id) return;

    const embeddedWallet = user.linkedAccounts?.find(
      (acc: any) => acc.type === 'wallet' && acc.walletClientType === 'privy'
    );
    const privyWalletAddress: string | null = (embeddedWallet as any)?.address ?? null;

    if (privyWalletAddress && !privyWalletAddress.startsWith('0x')) {
      setDisplaySolanaAddress(privyWalletAddress);
    } else {
      setDisplaySolanaAddress(null);
    }
  }, [authenticated, user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Supabase Realtime：監聽整個 users 表 UPDATE，同步所有相關狀態 ──────────
  useEffect(() => {
    if (!authenticated || !user?.id) return;

    const channelName = `me-user-updates-${user.id}`;

    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'users',
          filter: `id=eq.${user.id}`,
        },
        (payload) => {
          const newData = payload.new as any;
          if (!newData) return;
          setDbProfile((prev) => prev ? {
            ...prev,
            aif_balance: newData.aif_balance ?? prev.aif_balance,
            display_name: newData.display_name ?? prev.display_name,
            verified_identities: newData.verified_identities ?? prev.verified_identities,
            verification_status: newData.verification_status ?? prev.verification_status,
            username_locked: newData.username_locked ?? prev.username_locked,
          } : prev);
          if (typeof newData.aif_balance === 'number') {
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

  // ── 強制從服務端拉取最新 aif_balance（每次掛載或支付回調後呼叫）────────────
  // 使用 /api/sync-user（Service Role Key）確保能繞過 RLS 讀取正確餘額
  const refreshBalance = async () => {
    if (!user?.id) return;
    try {
      const syncRes = await fetch('/api/sync-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user }),
        cache: 'no-store',
      });
      if (!syncRes.ok) {
        console.error('[me] refreshBalance sync-user failed:', syncRes.status);
        return;
      }
      const data = await syncRes.json();
      if (data && typeof data.aif_balance === 'number') {
        setDbProfile((prev) =>
          prev
            ? {
                ...prev,
                aif_balance: data.aif_balance,
                deposit_address: data.deposit_address ?? prev.deposit_address,
                verification_status: data.verification_status ?? prev.verification_status,
                verification_type: data.verification_type ?? prev.verification_type,
                role: data.role ?? prev.role,
                verified_identities: data.verified_identities ?? prev.verified_identities,
              }
            : prev
        );
        setAifFlash(true);
        setTimeout(() => setAifFlash(false), 900);
      }
    } catch (err) {
      console.error('[me] refreshBalance exception:', err);
    }
  };

  // ── 頁面掛載時強制刷新餘額（解決刷新顯示 0 的問題）──────────────────────────
  useEffect(() => {
    if (!authenticated || !user?.id) return;
    // 延遲 500ms 確保 syncData 已先執行，refreshBalance 再做二次確認
    const timer = setTimeout(() => { refreshBalance(); }, 500);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, user?.id]);

  // ── Stripe / AIF 支付回調：監聽 URL 參數並顯示 Toast ─────────────────────
  useEffect(() => {
    if (!authenticated || !user?.id) return;

    const url = new URL(window.location.href);
    const paymentParam = url.searchParams.get('payment');
    if (!paymentParam) return;

    // 立即清除 URL 參數，保持網址乾淨
    router.replace('/me', { scroll: false });

    if (paymentParam === 'success') {
      showToast(
        lang === 'zh'
          ? '支付成功！正在更新您的帳戶狀態...'
          : 'Payment successful! Updating your account...',
        'success'
      );
      // 強制刷新餘額與身份狀態
      refreshBalance();
    } else if (paymentParam === 'cancelled' || paymentParam === 'canceled') {
      showToast(
        lang === 'zh' ? '支付已取消' : 'Payment cancelled',
        'error'
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, user?.id]);

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
    <div className="flex-1 h-full w-full bg-void flex flex-col relative overflow-y-auto md:overflow-hidden pt-28 md:pt-0 pb-32 md:pb-0 min-h-screen md:min-h-0">
      {isHistoryLoading && <CyberLoading text="LOADING PARALLEL UNIVERSE..." />}

      {/* ── Desktop Page Header (full-width banner) ──────────────────── */}
      <div className="hidden md:flex flex-shrink-0 z-10 bg-[#030303]/95 backdrop-blur border-b border-[#1a1a1a] px-6 py-4 items-center justify-between">
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

      {/* ═══════ Dashboard Layout: flex-col mobile, flex-row desktop ═══════ */}
      <div className="flex flex-col md:flex-row flex-1 md:overflow-hidden md:min-h-0">

        {/* ─── LEFT PANEL: Profile + Wallet (desktop: sticky sidebar) ─── */}
        <div className="md:w-72 lg:w-80 md:flex-shrink-0 md:border-r md:border-[#1a1a1a] md:overflow-y-auto md:h-full px-4 md:px-5 md:py-6 py-4">

      {/* ── Profile Card ───────────────────────────────────────────────── */}
      <div className="relative flex items-center gap-5 mb-6 bg-[#111] p-5 rounded-xl border border-[#333] shadow-[0_0_20px_rgba(0,0,0,0.5)] mt-0 md:mt-0">

        {/* Edit / Logout controls (top-right) */}
        <div className="absolute top-4 right-4 flex items-center space-x-2 z-10">
          {/* 編輯按鈕 → 已認證或審核中時鎖定 */}
          {(() => {
            const isVerified = (dbProfile?.verified_identities?.length ?? 0) > 0;
            const isPending = identityApplications.some(
              (a) => a.status === 'pending' || a.status === 'awaiting_payment'
            );
            if (isVerified) {
              return (
                <button
                  disabled
                  className="w-8 h-8 rounded-full bg-[#111] border border-[#2a2a2a] flex items-center justify-center text-gray-600 cursor-not-allowed opacity-60"
                  title="已認證，如需修改資料請重新提交身份認證"
                >
                  <i className="fas fa-lock text-xs" />
                </button>
              );
            }
            if (isPending) {
              return (
                <button
                  disabled
                  className="w-8 h-8 rounded-full bg-[#111] border border-[#2a2a2a] flex items-center justify-center text-gray-600 cursor-not-allowed opacity-60"
                  title="認證審核中，暫不可修改資料"
                >
                  <i className="fas fa-lock text-xs" />
                </button>
              );
            }
            return (
              <button
                onClick={openProfileModal}
                className="w-8 h-8 rounded-full bg-[#111] border border-[#333] flex items-center justify-center text-gray-400 hover:text-signal hover:border-signal transition-colors"
                title="Edit Profile"
              >
                <i className="fas fa-edit text-xs" />
              </button>
            );
          })()}
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
            {/* 頭像：邊框顏色根據最高優先身份決定 */}
            <img
              src={`https://api.dicebear.com/7.x/bottts/svg?seed=${dbProfile?.avatar_seed || user?.id || 'default'}`}
              alt="avatar"
              className={`w-20 h-20 bg-black rounded-full border-2 p-1
                ${(dbProfile?.verified_identities ?? []).includes('institution')
                  ? 'border-[#2563EB] shadow-[0_0_16px_rgba(37,99,235,0.5)]'
                  : (dbProfile?.verified_identities ?? []).includes('creator')
                    ? 'border-[#FFD700] shadow-[0_0_16px_rgba(245,158,11,0.5)]'
                    : (dbProfile?.verified_identities ?? []).includes('curator')
                      ? 'border-[#9333EA] shadow-[0_0_16px_rgba(147,51,234,0.5)]'
                      : 'border-[#444]'
                }`}
            />
            {/* 多重身份認證徽章：X 平台花型，絕對定位在頭像右下角 */}
            {(dbProfile?.verified_identities ?? []).length > 0 && (
              <div className="absolute -bottom-1 -right-1 z-10 flex gap-0.5">
                {(['creator', 'curator', 'institution'] as const).map((id) => {
                  if (!(dbProfile?.verified_identities ?? []).includes(id)) return null;
                  const color = id === 'creator' ? '#FFD700' : id === 'curator' ? '#1D9BF0' : '#829AAB';
                  const title = id === 'creator' ? '認證創作人' : id === 'curator' ? '認證策展人' : '認證機構';
                  return (
                    <span key={id} title={title} className="relative inline-flex items-center justify-center w-5 h-5" style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.4))' }}>
                      <svg viewBox="0 0 22 22" aria-hidden="true" className="w-5 h-5">
                        <g>
                          <path fill={color} d="M20.396 11c-.018-.646-.215-1.275-.57-1.816-.354-.54-.852-.972-1.438-1.246.223-.607.27-1.264.14-1.897-.131-.634-.437-1.218-.882-1.687-.47-.445-1.053-.75-1.687-.882-.633-.13-1.29-.083-1.897.14-.273-.587-.704-1.086-1.245-1.44S11.647 1.62 11 1.604c-.646.017-1.273.213-1.813.568s-.969.854-1.24 1.44c-.608-.223-1.267-.272-1.902-.14-.635.13-1.22.436-1.69.882-.445.47-.749 1.055-.878 1.688-.13.633-.08 1.29.144 1.896-.587.274-1.087.705-1.443 1.245-.356.54-.555 1.17-.574 1.817.02.647.218 1.276.574 1.817.356.54.856.972 1.443 1.245-.224.606-.274 1.263-.144 1.896.13.634.433 1.218.877 1.688.47.443 1.054.747 1.687.878.633.132 1.29.084 1.897-.136.274.586.705 1.084 1.246 1.439.54.354 1.17.551 1.816.569.647-.016 1.276-.213 1.817-.567s.972-.854 1.245-1.44c.604.239 1.266.296 1.903.164.636-.132 1.22-.447 1.68-.907.46-.46.776-1.044.908-1.681s.075-1.299-.165-1.903c.586-.274 1.084-.705 1.439-1.246.354-.54.551-1.17.569-1.816zM9.662 14.85l-3.429-3.428 1.293-1.302 2.135 2.14 4.735-4.64 1.28 1.313z"/>
                        </g>
                      </svg>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5 pr-16">
            <h2 className="font-heavy text-2xl text-white tracking-wide truncate">
              {(() => {
                const approvedApp = identityApplications.find(
                  (a) => a.status === 'approved' && a.verification_name
                );
                return (
                  approvedApp?.verification_name ||
                  dbProfile?.display_name ||
                  dbProfile?.name ||
                  (user?.id ? `Agent_${user.id.replace('did:privy:', '').substring(0, 6)}` : 'Agent_SYNCING')
                );
              })()}
            </h2>
            {/* 多重身份認證徽章 */}
            {(dbProfile?.verified_identities ?? []).map((identity) => {
              const cfg = {
                creator: { cls: 'bg-signal/20 text-signal border-signal/40', label: t('verify_badge_creator') },
                institution: { cls: 'bg-[#9D00FF]/20 text-[#9D00FF] border-[#9D00FF]/40', label: t('verify_badge_institution') },
                curator: { cls: 'bg-[#FFC107]/20 text-[#FFC107] border-[#FFC107]/40', label: t('verify_badge_curator') },
              }[identity];
              if (!cfg) return null;
              return (
                <span key={identity} className={`inline-flex items-center gap-1 text-[9px] font-heavy px-2 py-0.5 rounded-full tracking-wider shrink-0 border ${cfg.cls}`}>
                  <i className="fas fa-check-circle text-[8px]" />
                  {cfg.label}
                </span>
              );
            })}
          </div>
          {(dbProfile?.verified_identities?.length ?? 0) === 0 && (
            <div className="mb-2 pr-14">
              <span className="text-[9px] text-gray-400 font-mono tracking-wider uppercase">普通用戶</span>
            </div>
          )}
          {/* Wallet address + Verify button — full width, no padding constraint */}
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 bg-[#111] border border-[#333] px-3 py-1.5 rounded text-xs text-gray-400 hover:text-signal transition-colors"
            >
              <i className="fa-brands fa-solana text-signal" />
              <span className="font-mono ltr-force">
                {displaySolanaAddress
                  ? `${displaySolanaAddress.slice(0, 4)}...${displaySolanaAddress.slice(-4)}`
                  : 'NO SOL WALLET'}
              </span>
              <i className="far fa-copy"></i>
            </button>

            {/* ── 多重身份狀態 Pills + 認證按鈕 ── */}
            {dbProfile && (() => {
              const pendingApps = identityApplications.filter(
                (a) => a.status === 'pending' || a.status === 'awaiting_payment'
              );

              const pendingPills = pendingApps.map((app) => {
                const label = { creator: '創作人', institution: '機構', curator: '策展人' }[app.identity_type] ?? app.identity_type;
                return (
                  <span key={app.id} className="inline-flex items-center gap-1.5 text-[9px] font-bold bg-neutral-800 text-yellow-400 border border-yellow-700/40 rounded-full px-3 py-1.5 whitespace-nowrap">
                    <i className="fas fa-clock text-[8px]" />
                    {label} 審核中
                  </span>
                );
              });

              return (
                <>
                  {pendingPills}
                  {isVerifyLocked ? (
                    <button
                      disabled
                      className="inline-flex items-center gap-1.5 text-[9px] font-bold bg-neutral-800/60 text-gray-500 border border-gray-700/40 rounded-full px-4 py-1.5 opacity-50 cursor-not-allowed whitespace-nowrap"
                    >
                      <i className="fas fa-lock text-[8px]" />
                      {lang === 'zh' ? '認證中' : 'In Review'}
                    </button>
                  ) : (
                    <button
                      onClick={() => router.push('/verification')}
                      className="inline-flex items-center gap-1.5 text-[10px] font-bold bg-white text-black rounded-full px-4 py-1.5 hover:scale-105 transition-transform uppercase tracking-wider whitespace-nowrap shadow-[0_0_10px_rgba(255,255,255,0.15)]"
                    >
                      <i className="fas fa-shield-alt text-[9px]" />
                      {lang === 'zh' ? '立即認證' : t('verify_inline_verify')}
                    </button>
                  )}
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* ── 退回通知（每個被退回的身份都顯示） ──────────────────────────── */}
      {identityApplications
        .filter((app) => app.status === 'rejected' && app.rejection_reason)
        .map((app) => {
          const typeLabel = { creator: '創作人', institution: '機構', curator: '策展人' }[app.identity_type] ?? app.identity_type;
          return (
            <div key={app.id} className="mb-2 bg-red-500/5 border border-red-500/20 rounded-lg px-4 py-2.5 flex items-start gap-2">
              <i className="fas fa-exclamation-circle text-red-400 mt-0.5 text-xs shrink-0" />
              <p className="text-red-400 text-[11px] font-mono leading-relaxed">
                <span className="font-bold">[{typeLabel}]</span> {app.rejection_reason}
              </p>
            </div>
          );
        })
      }

      {/* ── LBS Curator Entry Banner ───────────────────────────────────── */}
      {(dbProfile?.verified_identities ?? []).includes('curator') && (
        <div className="mb-6">
          {/* 已上线影展横向滚动列表 */}
          {onlineLbsNodes.length > 0 && (
            <div className="mb-3">
              <div className="text-[9px] font-mono text-[#FFC107]/50 tracking-widest uppercase mb-2 px-0.5">
                {lang === 'zh' ? '已上线影展' : 'LIVE FESTIVALS'}
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {onlineLbsNodes.map((node) => (
                  <button
                    key={node.id}
                    onClick={() => router.push(`/lbs/${node.id}/screenings`)}
                    className="flex-shrink-0 group relative"
                    title={node.title}
                  >
                    <div
                      className="w-16 rounded-xl overflow-hidden border-2 border-[#FFC107]/50 group-hover:border-[#FFC107] transition-all shadow-[0_0_8px_rgba(255,193,7,0.15)] group-hover:shadow-[0_0_16px_rgba(255,193,7,0.35)]"
                      style={{ aspectRatio: '2/3' }}
                    >
                      {node.poster_url ? (
                        <img src={node.poster_url} alt={node.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-[#111] flex items-center justify-center">
                          <i className="fas fa-map-marker-alt text-[#FFC107]/30 text-lg" />
                        </div>
                      )}
                    </div>
                    <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/20 transition-colors" />
                    <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-green-400 shadow-[0_0_4px_rgba(74,222,128,0.8)] animate-pulse" />
                    <p className="text-[9px] text-[#FFC107]/60 font-mono mt-1 w-16 truncate text-center leading-tight">
                      {node.title}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 审核通过影展横向滚动列表 */}
          {approvedLbsNodes.length > 0 && (
            <div className="mb-3">
              <div className="text-[9px] font-mono text-green-400/60 tracking-widest uppercase mb-2 px-0.5 flex items-center gap-1.5">
                <i className="fas fa-check-circle text-green-400/60" />
                {lang === 'zh' ? '已通过影展' : 'APPROVED FESTIVALS'}
              </div>
              <div className="flex gap-3 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {approvedLbsNodes.map((node) => (
                  <button
                    key={node.id}
                    onClick={() => router.push(`/lbs/${node.id}/screenings`)}
                    className="flex-shrink-0 group relative"
                    title={node.title}
                  >
                    <div
                      className="w-16 rounded-xl overflow-hidden border-2 border-green-500/50 group-hover:border-green-400 transition-all shadow-[0_0_8px_rgba(74,222,128,0.15)] group-hover:shadow-[0_0_16px_rgba(74,222,128,0.35)]"
                      style={{ aspectRatio: '2/3' }}
                    >
                      {node.poster_url ? (
                        <img src={node.poster_url} alt={node.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-[#111] flex items-center justify-center">
                          <i className="fas fa-film text-green-400/30 text-lg" />
                        </div>
                      )}
                    </div>
                    <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/20 transition-colors" />
                    <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-green-400 shadow-[0_0_4px_rgba(74,222,128,0.8)]" />
                    <p className="text-[9px] text-green-400/60 font-mono mt-1 w-16 truncate text-center leading-tight">
                      {node.title}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 新建/提交 Banner */}
          <div
            onClick={() => router.push('/lbs/apply')}
            className="bg-gradient-to-r from-[#111] to-black border border-[#FFC107] hover:border-[#FFC107]/80 transition-all rounded-xl p-5 cursor-pointer group relative overflow-hidden"
          >
            {/* Hover glow */}
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
              style={{ background: 'radial-gradient(ellipse 80% 60% at 20% 50%, rgba(255,193,7,0.08) 0%, transparent 70%)' }}
            />
            <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-[#FFC107]/60 via-[#FFC107]/20 to-transparent pointer-events-none" />

            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#FFC107]/10 border border-[#FFC107]/20 flex items-center justify-center flex-shrink-0 group-hover:bg-[#FFC107]/20 transition-colors">
                  <i className="fas fa-map-marker-alt text-[#FFC107] text-sm" />
                </div>
                <div>
                  <div className="text-[9px] font-mono text-[#FFC107]/50 tracking-widest mb-0.5 uppercase">
                    {lang === 'zh' ? '策展人 · 專屬通道' : 'CURATOR · EXCLUSIVE'}
                  </div>
                  <div className="font-heavy text-white text-sm tracking-wider">
                    {lang === 'zh' ? 'LBS 影展/影院' : 'LBS FESTIVAL / CINEMA'}
                  </div>
                  <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                    {lang === 'zh' ? '新建/提交 LBS 地理位置展映節點申請' : 'New LBS Geolocation Screening Node'}
                  </div>
                </div>
              </div>
              <i className="fas fa-chevron-right text-[#FFC107] text-sm group-hover:translate-x-1 transition-transform" />
            </div>
          </div>
        </div>
      )}

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
                ${isRealtimeConnected ? 'text-signal/60' : 'text-gray-500'}`}>
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
        {/* end LEFT PANEL inner content */}
        </div>

        {/* ─── RIGHT PANEL: Submissions + History (desktop: main content) ─── */}
        <div className="flex-1 md:overflow-y-auto md:h-full px-4 md:px-8 py-4 md:py-6">

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
          <div className="grid grid-cols-2 gap-3">
            {mySubmissions.map((film) => {
              const filmStatus: string = film?.status || 'pending';
              const statusUI = getStatusUI(filmStatus);
              const STATUS_LABELS: Record<string, string> = {
                approved: 'APPROVED',
                rejected: 'REJECTED',
                pending: 'PENDING',
              };
              const statusLabel = STATUS_LABELS[filmStatus] ?? 'PENDING';
              return (
                <div
                  key={film.id}
                  onClick={() => setSelectedFilm(film)}
                  className="bg-[#0f0f0f] border border-[#2a2a2a] rounded-xl overflow-hidden
                             hover:border-[#CCFF00]/50 hover:shadow-[0_0_16px_rgba(204,255,0,0.07)]
                             transition-all duration-300 cursor-pointer group"
                >
                  {/* 垂直海報 aspect-[2/3] */}
                  <div className="aspect-[2/3] relative overflow-hidden bg-black">
                    {film?.poster_url ? (
                      <img
                        src={film.poster_url}
                        alt={film?.title || 'FILM'}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#0a0a0a]">
                        <i className="fas fa-film text-gray-700 text-2xl" />
                      </div>
                    )}
                    {/* 狀態角標 */}
                    <div className={`absolute top-1.5 right-1.5 border px-1.5 py-0.5 rounded text-[8px] font-mono
                                    flex items-center gap-1 backdrop-blur-sm ${statusUI.color}`}>
                      <i className={`fas ${statusUI.icon} text-[7px]`} />
                      {statusLabel}
                    </div>
                    {/* 底部漸變遮罩 */}
                    <div className="absolute bottom-0 left-0 w-full h-10
                                    bg-gradient-to-t from-[#0f0f0f] to-transparent" />
                  </div>

                  {/* 資訊區塊 */}
                  <div className="p-2.5 space-y-1.5">
                    {/* 片名 */}
                    <div className="font-heavy text-[13px] text-white tracking-wide truncate uppercase leading-tight">
                      {film?.title || 'UNTITLED'}
                    </div>

                    {/* 創作者 */}
                    <div className="text-[10px] text-gray-500 font-mono truncate">
                      {film?.studio || film?.core_cast || dbProfile?.display_name || '—'}
                    </div>

                    {/* 詳細時間 YYYYMMDD HH:mm */}
                    <div className="text-[9px] font-mono text-gray-500 tracking-wider">
                      {film?.created_at ? formatDateTime(film.created_at) : '—'}
                    </div>

                    {/* 流水串號 + 一鍵複製 */}
                    <div className="flex items-center gap-1 pt-0.5">
                      <span className="text-[9px] font-mono text-gray-500 flex-1 truncate tracking-wider">
                        #{(film?.id ?? '').slice(0, 8).toUpperCase()}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(film.id ?? '').then(() => {
                            setCopiedFilmId(film.id);
                            showToast(lang === 'en' ? 'Serial ID copied!' : '串號已複製！', 'success');
                            setTimeout(() => setCopiedFilmId(null), 2000);
                          }).catch(() => {
                            showToast(lang === 'en' ? 'Copy failed' : '複製失敗', 'error');
                          });
                        }}
                        className="flex-shrink-0 w-5 h-5 flex items-center justify-center
                                   text-gray-600 hover:text-signal transition-colors rounded"
                        title="Copy serial ID"
                      >
                        {copiedFilmId === film.id ? (
                          <svg viewBox="0 0 16 16" className="w-3 h-3 text-signal" fill="currentColor">
                            <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
                          </svg>
                        ) : (
                          <svg viewBox="0 0 16 16" className="w-3 h-3" fill="currentColor">
                            <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z"/>
                            <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z"/>
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
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
        </div>
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

                  <div className="text-[9px] font-mono text-gray-500 text-center pt-1">
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
                  /* ── 已有地址：立刻渲染 QR Code，ATA init 靜默背景執行 ── */
                  (() => {
                    const mintAddr = process.env.NEXT_PUBLIC_AIF_MINT_ADDRESS;
                    if (!mintAddr) {
                      return (
                        <div className="w-full bg-red-500/10 border border-red-500/40 rounded-xl px-4 py-5 flex flex-col items-center gap-2">
                          <i className="fas fa-exclamation-circle text-red-400 text-2xl" />
                          <div className="text-[11px] font-mono text-red-400 font-bold tracking-wider text-center">
                            系統設定錯誤：缺少合約地址
                          </div>
                          <div className="text-[10px] font-mono text-red-400/70 text-center">
                            SYSTEM CONFIG ERROR: Missing AIF_MINT_ADDRESS
                          </div>
                        </div>
                      );
                    }
                    const qrUri = `solana:${depositAddress}?spl-token=${mintAddr}`;
                    return (
                      <>
                        <div className="p-3 bg-white rounded-xl shadow-[0_0_24px_rgba(204,255,0,0.2)]">
                          <QRCode
                            value={qrUri}
                            size={160}
                            bgColor="#ffffff"
                            fgColor="#000000"
                            level="M"
                          />
                        </div>
                        <div className="text-[9px] font-mono text-gray-500 tracking-wider">
                          SCAN WITH PHANTOM / ANY SOLANA WALLET
                        </div>
                      </>
                    );
                  })()
                ) : isFetchingDepositAddress ? (
                  /* ── 地址分配中：轉圈動畫 ──────────────────────────── */
                  <div className="w-[186px] h-[186px] border-2 border-dashed border-signal/30 rounded-xl flex flex-col items-center justify-center gap-3 bg-signal/5">
                    <i className="fas fa-circle-notch fa-spin text-3xl text-signal/50" />
                    <span className="text-[10px] font-mono text-signal/60 tracking-wider text-center px-4">
                      GENERATING ADDRESS...
                    </span>
                  </div>
                ) : (
                  /* ── 自動生成中（用戶無需操作，handleOpenTopUp 已在背景觸發） ── */
                  <div className="w-[186px] h-[186px] border-2 border-dashed border-signal/30 rounded-xl flex flex-col items-center justify-center gap-3 bg-signal/5">
                    <i className="fas fa-circle-notch fa-spin text-3xl text-signal/50" />
                    <span className="text-[10px] font-mono text-signal/60 tracking-wider text-center px-4">
                      AUTO-GENERATING ADDRESS...
                    </span>
                    <span className="text-[9px] font-mono text-gray-600 text-center px-4">
                      自動生成中，請稍候
                    </span>
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

            {/* Footer — 顯示靜默輪詢狀態 */}
            <div className="px-5 py-4 border-t border-[#111] bg-[#050505] flex items-center gap-2">
              {depositAddress ? (
                <>
                  <span className="relative flex-shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-signal/70 animate-ping absolute inline-flex" />
                    <span className="w-1.5 h-1.5 rounded-full bg-signal inline-flex" />
                  </span>
                  <p className="text-[9px] font-mono text-gray-600 leading-relaxed tracking-wide">
                    {lang === 'en' ? 'Auto-checking every 5s. Will credit ' : '每 5 秒自動查帳。入帳後'}
                    <span className="text-signal/70">{lang === 'en' ? 'instantly.' : '立即自動關閉。'}</span>
                  </p>
                </>
              ) : (
                <>
                  <i className="fas fa-circle-notch fa-spin text-signal/50 text-[10px] flex-shrink-0" />
                  <p className="text-[9px] font-mono text-gray-600 leading-relaxed tracking-wide">
                    {lang === 'en' ? 'Generating your dedicated deposit address...' : '正在自動生成您的專屬充值地址...'}
                  </p>
                </>
              )}
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
                  {(dbProfile?.verified_identities?.length ?? 0) > 0
                    ? <span className="text-yellow-500 flex items-center gap-1"><i className="fas fa-lock text-[8px]" />已認證用戶 — 名稱欄位已鎖定</span>
                    : identityApplications.some((a) => a.status === 'pending' || a.status === 'awaiting_payment')
                      ? <span className="text-yellow-500 flex items-center gap-1"><i className="fas fa-clock text-[8px]" />認證審核中 — 名稱欄位已鎖定</span>
                      : mySubmissions.length > 0 ? 'BASIC + CREATOR SETTINGS UNLOCKED' : 'BASIC SETTINGS'}
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
                {(() => {
                  const isUsernameLocked = dbProfile?.username_locked === true;
                  const isNameLocked =
                    isUsernameLocked ||
                    (dbProfile?.verified_identities?.length ?? 0) > 0 ||
                    identityApplications.some(
                      (a) => a.status === 'pending' || a.status === 'awaiting_payment'
                    );
                  const lockReason = isUsernameLocked
                    ? '已認證，名稱已鎖定'
                    : (dbProfile?.verified_identities?.length ?? 0) > 0
                      ? '已認證，名稱由認證系統管理'
                      : '認證審核中，暫不可修改';
                  return (
                    <div>
                      <label className="block text-[10px] font-mono text-gray-500 tracking-widest mb-1.5 flex items-center gap-1.5">
                        DISPLAY NAME
                        {isNameLocked && (
                          <span className="flex items-center gap-1 text-[9px] text-yellow-500">
                            <i className="fas fa-lock text-[8px]" />
                            {lockReason}
                          </span>
                        )}
                      </label>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => !isNameLocked && setEditName(e.target.value)}
                        maxLength={40}
                        placeholder="Enter display name..."
                        disabled={isNameLocked}
                        className={`w-full font-mono text-sm px-3 py-2.5 rounded-lg outline-none transition-all
                          ${isNameLocked
                            ? 'bg-gray-100 border border-yellow-900/30 text-gray-500 cursor-not-allowed opacity-60 select-none'
                            : 'bg-[#0d0d0d] border border-[#2a2a2a] text-white focus:border-signal focus:shadow-[0_0_12px_rgba(204,255,0,0.15)] placeholder:text-gray-600'
                          }`}
                      />
                    </div>
                  );
                })()}
              </div>

              {/* ── Section: Creator Advanced Settings (locked if no films) ── */}
              {mySubmissions.length === 0 ? (
                <div className="border border-dashed border-[#2a2a2a] rounded-xl p-5 text-center">
                  <div className="w-10 h-10 bg-[#111] border border-[#333] rounded-full flex items-center justify-center mx-auto mb-3">
                    <i className="fas fa-lock text-gray-600 text-sm" />
                  </div>
                  <div className="text-[11px] font-heavy text-gray-500 tracking-widest mb-1">CREATOR PROFILE LOCKED</div>
                  <div className="text-[10px] font-mono text-gray-500 leading-relaxed">
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
                                 placeholder:text-gray-600 resize-none transition-all leading-relaxed"
                    />
                    <div className="text-right text-[9px] font-mono text-gray-600 mt-0.5">
                      {editAboutStudio.length}/400
                    </div>
                  </div>

                  {/* Tech Stack */}
                  <div className="mb-5">
                    <label className="block text-[10px] font-mono text-gray-500 tracking-widest mb-1.5">
                      <i className="fas fa-microchip mr-1 text-signal" />TECH STACK
                      <span className="text-gray-600 ml-2 normal-case tracking-normal">comma-separated</span>
                    </label>
                    <input
                      type="text"
                      value={editTechStack}
                      onChange={(e) => setEditTechStack(e.target.value)}
                      placeholder="Sora, Midjourney, Suno, RunwayML..."
                      className="w-full bg-[#0d0d0d] border border-[#2a2a2a] text-white font-mono text-xs px-3 py-2.5 rounded-lg
                                 outline-none focus:border-signal focus:shadow-[0_0_12px_rgba(204,255,0,0.15)]
                                 placeholder:text-gray-600 transition-all"
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
                      <div className="border border-dashed border-[#222] rounded-lg py-4 text-center text-[10px] font-mono text-gray-500">
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
                                           placeholder:text-gray-600 transition-all w-full"
                              />
                              <input
                                type="text"
                                value={member.role}
                                onChange={(e) => updateTeamMember(index, 'role', e.target.value)}
                                placeholder="Role (e.g. Director, Sound Designer)"
                                className="bg-black border border-[#2a2a2a] text-white font-mono text-xs px-2.5 py-1.5 rounded
                                           outline-none focus:border-[#9D00FF] focus:shadow-[0_0_8px_rgba(157,0,255,0.15)]
                                           placeholder:text-gray-600 transition-all w-full"
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
              {(() => {
                const isUsernameLocked = dbProfile?.username_locked === true;
                const isNameLocked =
                  isUsernameLocked ||
                  (dbProfile?.verified_identities?.length ?? 0) > 0 ||
                  identityApplications.some(
                    (a) => a.status === 'pending' || a.status === 'awaiting_payment'
                  );
                const isFullyVerified = (dbProfile?.verified_identities?.length ?? 0) > 0;

                if (isNameLocked) {
                  return (
                    <button
                      disabled
                      className="flex-[2] py-2.5 bg-gray-800/60 text-gray-500 font-heavy text-[11px] rounded-lg tracking-widest
                                 border border-yellow-900/40 cursor-not-allowed opacity-70 flex items-center justify-center gap-1.5"
                    >
                      <i className="fas fa-lock text-yellow-600 text-[10px]" />
                      {isUsernameLocked ? '🔒 已認證，名稱已鎖定' : isFullyVerified ? '🔒 身份已認證，資料已鎖定' : '🔒 審核中，資料已鎖定'}
                    </button>
                  );
                }

                return (
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
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
