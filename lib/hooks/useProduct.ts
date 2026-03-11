'use client';

/**
 * useProduct / useProducts
 *
 * 萬能產品 Hook — 從 /api/products 拉取 platform_products 清單，
 * 帶輕量級內存緩存（模塊級單例），避免組件重複請求。
 *
 * 用法：
 *   const { product, loading, error } = useProduct('vip_ticket');
 *   const { products, loading } = useProducts();
 */

import { useEffect, useState } from 'react';

// ─── 類型定義（與 platform_products 表結構對齊）──────────────────────────────
export interface PlatformProduct {
  id: string;
  product_code: string;
  name_zh: string;
  name_en: string;
  price_usd: number;
  price_aif: number;
  metadata: Record<string, unknown> | null;
  is_active: boolean;
  created_at: string;
}

// ─── 模塊級緩存（跨組件共享，頁面刷新前有效）───────────────────────────────────
const productByCode = new Map<string, PlatformProduct>();
let cachedAll: PlatformProduct[] | null = null;
let inflight: Promise<PlatformProduct[]> | null = null;

async function fetchProducts(): Promise<PlatformProduct[]> {
  if (cachedAll !== null) return cachedAll;
  if (inflight) return inflight;

  inflight = fetch('/api/products')
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<{ products: PlatformProduct[] }>;
    })
    .then(({ products }) => {
      cachedAll = products;
      products.forEach((p) => productByCode.set(p.product_code, p));
      return products;
    })
    .finally(() => {
      inflight = null;
    });

  return inflight;
}

// ─── useProduct：按 productCode 查單個產品 ─────────────────────────────────────
export function useProduct(productCode: string) {
  const cached = productByCode.get(productCode);
  const [product, setProduct] = useState<PlatformProduct | null>(cached ?? null);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (productByCode.has(productCode)) {
      setProduct(productByCode.get(productCode)!);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchProducts()
      .then((products) => {
        if (cancelled) return;
        const found = products.find((p) => p.product_code === productCode) ?? null;
        setProduct(found);
        if (!found) setError(`Product "${productCode}" not found`);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load product');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [productCode]);

  return { product, loading, error };
}

// ─── useProducts：取完整產品清單 ───────────────────────────────────────────────
export function useProducts() {
  const [products, setProducts] = useState<PlatformProduct[]>(cachedAll ?? []);
  const [loading, setLoading] = useState(!cachedAll);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cachedAll !== null) {
      setProducts(cachedAll);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchProducts()
      .then((p) => { if (!cancelled) setProducts(p); })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load products');
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, []);

  return { products, loading, error };
}

// ─── 工具函數：強制清除緩存（例如後台更新產品後刷新） ────────────────────────────
export function invalidateProductCache() {
  cachedAll = null;
  productByCode.clear();
}
