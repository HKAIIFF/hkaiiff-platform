import { NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth/adminAuth';

export const revalidate = 3600; // 缓存1小时

const KEYWORDS = 'AI film OR AI cinema OR artificial intelligence movie OR generative AI art OR Web3 film';

export async function GET(req: Request) {
  const authResult = await checkAdminAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ articles: [], error: 'NEWS_API_KEY not configured' });
  }

  try {
    const today = new Date().toISOString().split('T')[0];
    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(KEYWORDS)}&from=${today}&sortBy=publishedAt&language=en&pageSize=20&apiKey=${apiKey}`;

    const res = await fetch(url, { next: { revalidate: 3600 } });
    const data = await res.json();

    if (data.status !== 'ok') {
      return NextResponse.json({ articles: [], error: data.message ?? 'NewsAPI error' });
    }

    const articles = (data.articles ?? []).map((a: {
      title: string;
      description: string | null;
      url: string;
      source: { name: string };
      publishedAt: string;
      urlToImage: string | null;
    }) => ({
      title: a.title,
      description: a.description,
      url: a.url,
      source: a.source?.name ?? 'Unknown',
      publishedAt: a.publishedAt,
      image: a.urlToImage,
    }));

    return NextResponse.json({ articles });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ articles: [], error: message });
  }
}
