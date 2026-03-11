'use client';

/**
 * 已廢棄：影片報名支付流程已縮編至 /upload 的 Step 2，
 * 點擊 PROCEED TO PAYMENT 後直接彈出結帳視窗，無需中轉頁。
 * 此路由保留為重定向，避免舊連結或 Stripe cancel URL 404。
 */

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PaymentRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/upload');
  }, [router]);
  return null;
}
