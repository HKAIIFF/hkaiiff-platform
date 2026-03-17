import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "私隱保護政策 | Privacy Policy — HKAIIFF",
  description: "香港AI國際電影節私隱保護政策 Hong Kong AI International Film Festival Privacy Protection Policy",
};

const PRIVACY_POLICY = {
  title: "私隱保護政策",
  subtitle: "Privacy Protection Policy",
  effectiveDate: "2026年3月20日",
  lastUpdated: "2026年3月20日",
  organization: "香港AI國際電影節 Hong Kong AI International Film Festival",
  contact: "privacy@hkaiff.com",
  preamble:
    "香港AI國際電影節重視並尊重閣下的私隱權。本政策說明我們如何收集、使用、儲存、分享及保護閣下的個人資料，符合香港《個人資料（私隱）條例》（第486章）的要求。",
  sections: [
    {
      id: "p1",
      title: "第一條　資料控制者",
      content:
        "本服務的個人資料控制者為香港AI國際電影節主辦機構。個人資料保護主任電郵：privacy@hkaiff.com。我們按照香港私隱條例規定的六項保障資料原則處理所有個人資料。",
    },
    {
      id: "p2",
      title: "第二條　我們收集的個人資料",
      subsections: [
        {
          title: "2.1 閣下直接提供的資料",
          items: [
            "帳戶資料：姓名、電子郵件地址；",
            "出生日期（用於年齡核實）；",
            "購票記錄及交易信息；",
            "電影作品信息（創作者）；",
            "銀行帳戶資料（用於獎金發放，受嚴格保密保護）。",
          ],
        },
        {
          title: "2.2 自動收集的資料",
          items: [
            "設備信息（設備型號、操作系統）；",
            "IP地址及網絡信息；",
            "使用行為數據（瀏覽頁面、點擊行為、使用時長）；",
            "Cookies及類似追蹤技術收集的數據。",
          ],
        },
        {
          title: "2.3 第三方登入資料（Privy）",
          content:
            "如閣下使用Privy、Google、Apple ID或微信登入，我們接收相應的基本身份驗證資料（帳戶識別碼、電郵地址）。第三方提供的資料受其各自的私隱政策管轄。",
        },
        {
          title: "2.4 AI功能相關數據",
          items: [
            "閣下上傳的素材用於AI處理；",
            "AI工具的使用記錄及生成結果；",
            "對AI內容的評分及反饋。",
          ],
        },
      ],
    },
    {
      id: "p3",
      title: "第三條　個人資料的使用目的",
      subsections: [
        {
          title: "3.1 服務提供",
          items: [
            "帳戶創建、驗證及管理；",
            "電影節票務處理及核驗；",
            "電影作品提交、審核及展映；",
            "AI功能的個人化服務。",
          ],
        },
        {
          title: "3.2 行銷（需閣下同意）",
          items: [
            "發送電影節活動通知；",
            "個人化電影推薦；",
            "定向廣告（閣下可隨時選擇退出）。",
          ],
        },
        {
          title: "3.3 法律及安全目的",
          items: [
            "遵守香港法律及監管機構要求；",
            "防範及處理欺詐或違規行為；",
            "維護平台安全。",
          ],
        },
      ],
    },
    {
      id: "p4",
      title: "第四條　資料分享與披露",
      content: "我們絕不出售閣下的個人資料。",
      subsections: [
        {
          title: "4.1 服務提供商",
          content:
            "我們與受合約約束的服務提供商合作，包括：支付處理商、雲端基礎設施、電郵服務、身份驗證服務（Privy）及AI技術服務提供商。所有服務提供商均須簽署數據處理協議。",
        },
        {
          title: "4.2 法律要求",
          content:
            "我們可能依法回應有效的法律程序或主管機構要求，並在法律允許範圍內及時通知受影響用戶。",
        },
      ],
    },
    {
      id: "p5",
      title: "第五條　數據安全措施",
      items: [
        "傳輸加密：TLS 1.3或以上版本；",
        "儲存加密：AES-256；",
        "支援雙重驗證登入保護；",
        "定期安全審計；",
        "數據洩露72小時通知義務。",
      ],
    },
    {
      id: "p6",
      title: "第六條　資料保留期限",
      items: [
        "帳戶資料：帳戶存在期間及關閉後三（3）年；",
        "票務及交易記錄：七（7）年；",
        "AI使用記錄：最長二（2）年；",
        "行銷同意記錄：自最後一次互動起三（3）年。",
      ],
    },
    {
      id: "p7",
      title: "第七條　閣下的私隱權利",
      subsections: [
        {
          title: "7.1 查閱及更正權",
          content: "閣下有權查閱及更正我們持有的個人資料。我們將在40日內回應。",
        },
        {
          title: "7.2 刪除權",
          content:
            "在資料不再用於原收集目的、閣下撤回同意或資料被違法處理等情況下，閣下有權要求刪除個人資料。",
        },
        {
          title: "7.3 反對行銷權",
          content:
            "閣下可隨時透過電郵底部的「取消訂閱」連結或發送電郵至 optout@hkaiff.com 退出行銷通訊。",
        },
        {
          title: "7.4 可攜帶性權利",
          content: "閣下有權以JSON或CSV格式獲取個人資料副本。",
        },
        {
          title: "7.5 提出私隱投訴",
          content:
            "閣下有權向香港私隱專員公署提出投訴。網址：www.pcpd.org.hk",
        },
      ],
    },
    {
      id: "p8",
      title: "第八條　Cookies政策",
      items: [
        "必要Cookies：平台運行所必需，無法關閉；",
        "功能Cookies：記住閣下的偏好設置；",
        "分析Cookies：了解平台使用情況（可選擇退出）；",
        "廣告Cookies：個人化廣告（可選擇退出）。",
      ],
    },
    {
      id: "p9",
      title: "第九條　未成年人保護",
      content:
        "本服務不針對十六（16）歲以下的未成年人。如發現未成年子女未獲授權使用本服務，請電郵：privacy@hkaiff.com，我們將及時刪除相關資料。",
    },
    {
      id: "p10",
      title: "第十條　跨境數據傳輸",
      content:
        "閣下的個人資料可能傳輸至香港以外地區（美國、歐盟、新加坡等）。我們確保所有跨境傳輸符合同等數據保護標準，並與接收方簽訂標準合約條款。",
    },
    {
      id: "p11",
      title: "第十一條　政策更新",
      content:
        "政策更新後將在平台公告及電郵通知。閣下繼續使用本服務即視為接受更新後的政策。",
    },
    {
      id: "p12",
      title: "第十二條　聯絡我們",
      content:
        "個人資料保護主任（Data Protection Officer）\n電郵：privacy@hkaiff.com\n書面郵件：香港AI國際電影節 個人資料保護部\n\n查閱/更正申請表格可於平台官方網站下載。",
    },
  ],
  copyright:
    "© 2026 香港AI國際電影節 Hong Kong AI International Film Festival. All Rights Reserved.",
};

type Subsection = {
  title: string;
  content?: string;
  items?: string[];
};

type Section = {
  id: string;
  title: string;
  content?: string;
  items?: string[];
  subsections?: Subsection[];
};

function SubsectionBlock({ sub }: { sub: Subsection }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-bold text-[#CCFF00] font-mono mb-2">{sub.title}</h3>
      {sub.content && (
        <p className="text-sm text-[#aaa] leading-relaxed whitespace-pre-line">{sub.content}</p>
      )}
      {sub.items && sub.items.length > 0 && (
        <ul className="list-none space-y-1.5 mt-1">
          {sub.items.map((item, i) => (
            <li key={i} className="text-sm text-[#aaa] leading-relaxed flex gap-2">
              <span className="text-[#CCFF00]/60 font-mono text-xs mt-0.5 shrink-0">▸</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SectionBlock({ section }: { section: Section }) {
  return (
    <section className="mb-10">
      <h2 className="text-lg font-heavy text-white tracking-tight mb-4 pb-2 border-b border-[#1e1e1e]">
        {section.title}
      </h2>
      {section.content && (
        <p className="text-sm text-[#aaa] leading-relaxed mb-4 whitespace-pre-line">
          {section.content}
        </p>
      )}
      {section.items && section.items.length > 0 && (
        <ul className="list-none space-y-1.5 mb-4">
          {section.items.map((item, i) => (
            <li key={i} className="text-sm text-[#aaa] leading-relaxed flex gap-2">
              <span className="text-[#CCFF00]/60 font-mono text-xs mt-0.5 shrink-0">▸</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
      {section.subsections?.map((sub, i) => (
        <SubsectionBlock key={i} sub={sub} />
      ))}
    </section>
  );
}

export default function PrivacyPage() {
  const data = PRIVACY_POLICY;

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="max-w-3xl mx-auto px-4 py-12 pb-24">

        {/* Back link */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[#555] hover:text-[#CCFF00] transition-colors text-xs font-mono tracking-wider"
          >
            <i className="fas fa-arrow-left text-[10px]" />
            BACK TO HKAIIFF
          </Link>
        </div>

        {/* Header */}
        <div className="text-center mb-12 pb-8 border-b border-[#1e1e1e]">
          <div className="inline-block bg-[#CCFF00]/10 border border-[#CCFF00]/20 rounded-full px-4 py-1 text-[10px] font-mono text-[#CCFF00] tracking-widest uppercase mb-4">
            Legal Document
          </div>
          <h1 className="text-4xl font-heavy text-white tracking-tighter leading-none mb-2">
            {data.title}
          </h1>
          <p className="text-[#555] font-mono text-sm mt-2">{data.subtitle}</p>
          <p className="text-xs text-[#444] font-mono mt-4">
            生效日期：{data.effectiveDate}　｜　最後更新：{data.lastUpdated}
          </p>
          <p className="text-xs text-[#333] mt-1">{data.organization}</p>
        </div>

        {/* Preamble */}
        <div className="mb-10 p-4 bg-[#0e0e0e] border border-[#1e1e1e] rounded-xl">
          <p className="text-sm text-[#888] leading-relaxed">{data.preamble}</p>
        </div>

        {/* Sections */}
        {data.sections.map((section) => (
          <SectionBlock key={section.id} section={section as Section} />
        ))}

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-[#1e1e1e] text-center">
          <p className="text-xs text-[#333] font-mono">{data.copyright}</p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/terms"
              className="text-xs text-[#555] underline hover:text-[#CCFF00] transition-colors font-mono"
            >
              用戶服務協議 Terms of Service
            </Link>
            <span className="text-[#1e1e1e] hidden sm:block">|</span>
            <a
              href={`mailto:${data.contact}`}
              className="text-xs text-[#555] underline hover:text-[#CCFF00] transition-colors font-mono"
            >
              {data.contact}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
