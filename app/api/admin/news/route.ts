import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth/adminAuth';

export const revalidate = 3600;

const RSS_FEEDS = [
  { name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
  { name: 'Wired', url: 'https://www.wired.com/feed/rss' },
  { name: 'The Verge AI', url: 'https://www.theverge.com/ai-artificial-intelligence/rss/index.xml' },
  { name: 'VentureBeat AI', url: 'https://venturebeat.com/category/ai/feed/' },
  { name: 'MIT Tech Review', url: 'https://www.technologyreview.com/feed/' },
];

const AI_KEYWORDS = ['ai', 'artificial intelligence', 'machine learning', 'generative', 'film', 'cinema', 'video', 'creative', 'web3', 'blockchain', 'nft', 'diffusion', 'llm', 'gpt', 'sora'];

function isRelevant(text: string): boolean {
  const lower = text.toLowerCase();
  return AI_KEYWORDS.some(k => lower.includes(k));
}

function parseRssItems(xml: string, sourceName: string) {
  const items: {
    title: string; description: string | null; url: string;
    source: string; publishedAt: string; image: string | null;
  }[] = [];

  const itemMatches = xml.matchAll(/<item[^>]*>([\s\S]*?)<\/item>/gi);

  for (const match of itemMatches) {
    const item = match[1];

    const title = item.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i)?.[1]?.trim() ?? '';
    const link  = item.match(/<link[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/link>/i)?.[1]?.trim()
               ?? item.match(/<link[^>]*href="([^"]+)"/i)?.[1]?.trim() ?? '';
    const desc  = item.match(/<description[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/i)?.[1]
                   ?.replace(/<[^>]+>/g, '').trim() ?? null;
    const pubDate = item.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim()
                 ?? item.match(/<published[^>]*>([\s\S]*?)<\/published>/i)?.[1]?.trim()
                 ?? new Date().toISOString();
    const image = item.match(/<media:thumbnail[^>]*url="([^"]+)"/i)?.[1]
               ?? item.match(/<media:content[^>]*url="([^"]+)"/i)?.[1]
               ?? item.match(/<enclosure[^>]*url="([^"]+)"/i)?.[1]
               ?? null;

    if (!title || !link) continue;
    if (!isRelevant(title + ' ' + (desc ?? ''))) continue;

    let publishedAt: string;
    try { publishedAt = new Date(pubDate).toISOString(); }
    catch { publishedAt = new Date().toISOString(); }

    items.push({ title, description: desc?.slice(0, 200) ?? null, url: link, source: sourceName, publishedAt, image });
  }

  return items;
}

export async function GET(req: NextRequest) {
  const authResult = await checkAdminAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  try {
    const results = await Promise.allSettled(
      RSS_FEEDS.map(async feed => {
        const res = await fetch(feed.url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HKAIIFF-Bot/1.0)' },
          next: { revalidate: 3600 },
        });
        if (!res.ok) throw new Error(`${feed.name} fetch failed: ${res.status}`);
        const xml = await res.text();
        return parseRssItems(xml, feed.name);
      })
    );

    const articles = results
      .filter((r): r is PromiseFulfilledResult<{ title: string; description: string | null; url: string; source: string; publishedAt: string; image: string | null }[]> => r.status === 'fulfilled')
      .flatMap(r => r.value)
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, 30);

    return NextResponse.json({ articles });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ articles: [], error: message });
  }
}
