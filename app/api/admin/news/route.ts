import { NextRequest, NextResponse } from 'next/server';
import { checkAdminAuth } from '@/lib/auth/adminAuth';

export const revalidate = 3600;

const RSS_FEEDS = [
  { name: 'TechCrunch AI', url: 'https://techcrunch.com/category/artificial-intelligence/feed/' },
  { name: 'The Verge AI', url: 'https://www.theverge.com/ai-artificial-intelligence/rss/index.xml' },
  { name: 'VentureBeat AI', url: 'https://venturebeat.com/category/ai/feed/' },
  { name: 'MIT Tech Review', url: 'https://www.technologyreview.com/feed/' },
  { name: 'Wired', url: 'https://www.wired.com/feed/rss' },
  { name: 'Decrypt Web3', url: 'https://decrypt.co/feed' },
  { name: 'CoinDesk', url: 'https://www.coindesk.com/arc/outboundfeeds/rss/' },
  { name: 'Hugging Face Blog', url: 'https://huggingface.co/blog/feed.xml' },
  { name: 'Google AI Blog', url: 'https://blog.google/technology/ai/rss/' },
  { name: 'DeepMind Blog', url: 'https://deepmind.google/blog/rss.xml' },
  { name: 'OpenAI News', url: 'https://openai.com/news/rss.xml' },
  { name: 'Runway Blog', url: 'https://runwayml.com/blog/rss' },
  { name: 'Deadline Hollywood', url: 'https://deadline.com/feed/' },
  { name: 'Variety', url: 'https://variety.com/feed/' },
  { name: 'Hollywood Reporter', url: 'https://www.hollywoodreporter.com/feed/' },
];

const AI_KEYWORDS = [
  // AI视频模型
  'sora', 'runway', 'kling', 'veo', 'luma', 'wan2', 'ltx',
  'openclaw', 'open-source video', 'video generation', 'video model',
  'generative vfx', 'gvfx', 'neural rendering', 'gaussian splatting',
  // AI电影产业
  'ai film', 'ai cinema', 'ai movie', 'ai video', 'artificial intelligence film',
  'ai film festival', 'virtual production', 'icvfx', 'pre-visualization',
  'ai dubbing', 'lip-sync', 'emotional synthesis', 'ai performance',
  // Web3融合
  'depin', 'render network', 'ai agent', 'web3 ai', 'content provenance',
  'c2pa', 'data nft', 'model nft', 'proof of compute', 'zkml',
  // 具体工具
  'elevenLabs', 'nvidia omniverse', 'rtx remix', 'unreal engine ai',
  'comfyui', 'stable diffusion', 'midjourney',
  // 通用
  'generative ai', 'diffusion model', 'llm film', 'deepfake film',
  'character consistency', 'text to video', 'image to video',
];

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
    items.push({ title, description: desc?.slice(0, 300) ?? null, url: link, source: sourceName, publishedAt, image });
  }
  return items;
}

export async function GET(req: NextRequest) {
  const authResult = await checkAdminAuth(req);
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(req.url);
  const translateTo = searchParams.get('translate'); // 'zh' | null

  try {
    const results = await Promise.allSettled(
      RSS_FEEDS.map(async feed => {
        const res = await fetch(feed.url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (compatible; HKAIIFF-Bot/1.0)' },
          next: { revalidate: 3600 },
        });
        if (!res.ok) throw new Error(`${feed.name}: ${res.status}`);
        const xml = await res.text();
        return parseRssItems(xml, feed.name);
      })
    );

    let articles = results
      .filter((r): r is PromiseFulfilledResult<ReturnType<typeof parseRssItems>> => r.status === 'fulfilled')
      .flatMap(r => r.value)
      .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
      .slice(0, 40);

    // 翻译功能：使用 Google Translate 免费接口
    if (translateTo === 'zh' && articles.length > 0) {
      const translateText = async (text: string): Promise<string> => {
        try {
          const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-TW&dt=t&q=${encodeURIComponent(text)}`;
          const r = await fetch(url);
          const data = await r.json();
          return data?.[0]?.map((s: [string]) => s[0]).join('') ?? text;
        } catch { return text; }
      };

      articles = await Promise.all(
        articles.map(async a => ({
          ...a,
          title: await translateText(a.title),
          description: a.description ? await translateText(a.description) : null,
        }))
      );
    }

    return NextResponse.json({ articles, total: articles.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ articles: [], error: message });
  }
}
