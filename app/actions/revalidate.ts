'use server';

import { revalidatePath } from 'next/cache';

/**
 * 清除 Feed 首页及全局布局缓存
 * 在 Admin 变更影片状态/上下架后调用，确保前端立即看到最新状态
 */
export async function revalidateFeed() {
  revalidatePath('/', 'layout');
}
