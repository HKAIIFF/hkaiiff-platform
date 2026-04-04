import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "私隱保護政策 | Privacy Policy — HKAIIFF",
  description:
    "香港AI國際電影節私隱保護政策 Hong Kong AI International Film Festival Privacy Protection Policy",
};

// ─── Data ─────────────────────────────────────────────────────────────────────

interface Subsection {
  title: string;
  content?: string;
  items?: string[];
}

interface Section {
  id: string;
  titleZh: string;
  titleEn: string;
  contentZh?: string;
  contentEn?: string;
  itemsZh?: string[];
  itemsEn?: string[];
  subsectionsZh?: Subsection[];
  subsectionsEn?: Subsection[];
}

const SECTIONS: Section[] = [
  {
    id: "p1",
    titleZh: "第一條　資料控制者",
    titleEn: "Article 1 — Data Controller",
    contentZh:
      "本服務的個人資料控制者為香港AI國際電影節主辦機構。個人資料保護主任電郵：privacy@hkaiiff.com。我們按照香港私隱條例規定的六項保障資料原則處理所有個人資料。",
    contentEn:
      "The data controller for the Services is the Hong Kong AI International Film Festival organising body. Data Protection Officer email: privacy@hkaiiff.com. We process all personal data in accordance with the six Data Protection Principles under the Hong Kong Personal Data (Privacy) Ordinance (Cap. 486).",
  },
  {
    id: "p2",
    titleZh: "第二條　我們收集的個人資料",
    titleEn: "Article 2 — Personal Data We Collect",
    subsectionsZh: [
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
    subsectionsEn: [
      {
        title: "2.1 Data You Provide Directly",
        items: [
          "Account data: name, email address;",
          "Date of birth (for age verification);",
          "Ticketing records and transaction information;",
          "Film submission information (for creators);",
          "Bank account details (for prize payments, strictly confidential).",
        ],
      },
      {
        title: "2.2 Automatically Collected Data",
        items: [
          "Device information (model, operating system);",
          "IP address and network information;",
          "Usage behaviour data (pages viewed, clicks, session duration);",
          "Data collected via Cookies and similar tracking technologies.",
        ],
      },
      {
        title: "2.3 Third-Party Login Data (Privy)",
        content:
          "If you log in via Privy, Google, Apple ID or WeChat, we receive basic authentication data (account identifier, email address). Data provided by third parties is governed by their respective privacy policies.",
      },
      {
        title: "2.4 AI Feature Data",
        items: [
          "Materials you upload for AI processing;",
          "AI tool usage logs and generated outputs;",
          "Ratings and feedback on AI content.",
        ],
      },
    ],
  },
  {
    id: "p3",
    titleZh: "第三條　個人資料的使用目的",
    titleEn: "Article 3 — Purposes of Processing",
    subsectionsZh: [
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
    subsectionsEn: [
      {
        title: "3.1 Service Delivery",
        items: [
          "Account creation, verification and management;",
          "Festival ticketing processing and validation;",
          "Film submission, review and screening;",
          "Personalised AI features.",
        ],
      },
      {
        title: "3.2 Marketing (with your consent)",
        items: [
          "Sending festival activity notifications;",
          "Personalised film recommendations;",
          "Targeted advertising (you may opt out at any time).",
        ],
      },
      {
        title: "3.3 Legal & Security Purposes",
        items: [
          "Compliance with Hong Kong law and regulatory requirements;",
          "Prevention and investigation of fraud or misconduct;",
          "Maintaining platform security.",
        ],
      },
    ],
  },
  {
    id: "p4",
    titleZh: "第四條　資料分享與披露",
    titleEn: "Article 4 — Data Sharing & Disclosure",
    contentZh: "我們絕不出售閣下的個人資料。",
    contentEn: "We will never sell your personal data.",
    subsectionsZh: [
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
    subsectionsEn: [
      {
        title: "4.1 Service Providers",
        content:
          "We work with trusted service providers bound by contract, including: payment processors, cloud infrastructure, email services, identity verification (Privy), and AI technology providers. All providers must sign data processing agreements.",
      },
      {
        title: "4.2 Legal Requirements",
        content:
          "We may disclose personal data in response to valid legal process or regulatory authority requirements, and will notify affected users to the extent permitted by law.",
      },
    ],
  },
  {
    id: "p5",
    titleZh: "第五條　數據安全措施",
    titleEn: "Article 5 — Security Measures",
    itemsZh: [
      "傳輸加密：TLS 1.3或以上版本；",
      "儲存加密：AES-256；",
      "支援雙重驗證登入保護；",
      "定期安全審計；",
      "數據洩露72小時通知義務。",
    ],
    itemsEn: [
      "Encryption in transit: TLS 1.3 or above;",
      "Encryption at rest: AES-256;",
      "Two-factor authentication support;",
      "Regular security audits;",
      "72-hour data breach notification obligation.",
    ],
  },
  {
    id: "p6",
    titleZh: "第六條　資料保留期限",
    titleEn: "Article 6 — Data Retention",
    itemsZh: [
      "帳戶資料：帳戶存在期間及關閉後三（3）年；",
      "票務及交易記錄：七（7）年；",
      "AI使用記錄：最長二（2）年；",
      "行銷同意記錄：自最後一次互動起三（3）年。",
    ],
    itemsEn: [
      "Account data: duration of account plus 3 years after closure;",
      "Ticketing and transaction records: 7 years;",
      "AI usage logs: maximum 2 years;",
      "Marketing consent records: 3 years from last interaction.",
    ],
  },
  {
    id: "p7",
    titleZh: "第七條　閣下的私隱權利",
    titleEn: "Article 7 — Your Privacy Rights",
    subsectionsZh: [
      { title: "7.1 查閱及更正權", content: "閣下有權查閱及更正我們持有的個人資料。我們將在40日內回應。" },
      { title: "7.2 刪除權", content: "在資料不再用於原收集目的、閣下撤回同意或資料被違法處理等情況下，閣下有權要求刪除個人資料。" },
      { title: "7.3 反對行銷權", content: "閣下可隨時透過電郵底部的「取消訂閱」連結或發送電郵至 optout@hkaiiff.com 退出行銷通訊。" },
      { title: "7.4 可攜帶性權利", content: "閣下有權以JSON或CSV格式獲取個人資料副本。" },
      { title: "7.5 提出私隱投訴", content: "閣下有權向香港私隱專員公署提出投訴。網址：www.pcpd.org.hk" },
    ],
    subsectionsEn: [
      { title: "7.1 Right of Access & Correction", content: "You have the right to access and correct personal data we hold about you. We will respond within 40 days." },
      { title: "7.2 Right to Erasure", content: "You may request deletion of your personal data where it is no longer needed for the original purpose, you withdraw consent, or it has been unlawfully processed." },
      { title: "7.3 Right to Object to Marketing", content: "You may opt out of marketing communications at any time via the unsubscribe link in any email or by emailing optout@hkaiiff.com." },
      { title: "7.4 Data Portability", content: "You have the right to receive a copy of your personal data in JSON or CSV format." },
      { title: "7.5 Right to Lodge a Complaint", content: "You have the right to lodge a complaint with the Hong Kong Privacy Commissioner for Personal Data. Website: www.pcpd.org.hk" },
    ],
  },
  {
    id: "p8",
    titleZh: "第八條　Cookies政策",
    titleEn: "Article 8 — Cookies Policy",
    itemsZh: [
      "必要Cookies：平台運行所必需，無法關閉；",
      "功能Cookies：記住閣下的偏好設置；",
      "分析Cookies：了解平台使用情況（可選擇退出）；",
      "廣告Cookies：個人化廣告（可選擇退出）。",
    ],
    itemsEn: [
      "Essential Cookies: required for platform operation, cannot be disabled;",
      "Functional Cookies: remember your preferences;",
      "Analytics Cookies: understand platform usage (opt-out available);",
      "Advertising Cookies: personalised ads (opt-out available).",
    ],
  },
  {
    id: "p9",
    titleZh: "第九條　未成年人保護",
    titleEn: "Article 9 — Protection of Minors",
    contentZh:
      "本服務不針對十六（16）歲以下的未成年人。如發現未成年子女未獲授權使用本服務，請電郵：privacy@hkaiiff.com，我們將及時刪除相關資料。",
    contentEn:
      "The Services are not directed at persons under 16 years of age. If you discover that a minor has used the Services without authorisation, please email privacy@hkaiiff.com and we will promptly delete the relevant data.",
  },
  {
    id: "p10",
    titleZh: "第十條　跨境數據傳輸",
    titleEn: "Article 10 — Cross-Border Data Transfers",
    contentZh:
      "閣下的個人資料可能傳輸至香港以外地區（美國、歐盟、新加坡等）。我們確保所有跨境傳輸符合同等數據保護標準，並與接收方簽訂標準合約條款。",
    contentEn:
      "Your personal data may be transferred to regions outside Hong Kong (including the US, EU and Singapore). We ensure all cross-border transfers meet equivalent data protection standards and are covered by standard contractual clauses.",
  },
  {
    id: "p11",
    titleZh: "第十一條　政策更新",
    titleEn: "Article 11 — Policy Updates",
    contentZh:
      "政策更新後將在平台公告及電郵通知。閣下繼續使用本服務即視為接受更新後的政策。",
    contentEn:
      "Updates will be announced on the platform and notified by email. Continued use of the Services after changes take effect constitutes acceptance of the updated Policy.",
  },
  {
    id: "p12",
    titleZh: "第十二條　聯絡我們",
    titleEn: "Article 12 — Contact Us",
    contentZh:
      "個人資料保護主任（Data Protection Officer）\n電郵：privacy@hkaiiff.com\n書面郵件：香港AI國際電影節 個人資料保護部\n\n查閱/更正申請表格可於平台官方網站下載。",
    contentEn:
      "Data Protection Officer\nEmail: privacy@hkaiiff.com\nPostal: Hong Kong AI International Film Festival, Data Protection Department\n\nAccess/Correction request forms are available on the official website.",
  },
];

// ─── Sub-components ────────────────────────────────────────────────────────────

function SubsectionCol({ sub }: { sub: Subsection }) {
  return (
    <div className="mb-3">
      <p className="text-xs font-bold text-[#CCFF00]/80 font-mono mb-1.5">{sub.title}</p>
      {sub.content && (
        <p className="text-sm text-void-muted leading-relaxed whitespace-pre-line">{sub.content}</p>
      )}
      {sub.items && sub.items.length > 0 && (
        <ul className="space-y-1 mt-1">
          {sub.items.map((item, i) => (
            <li key={i} className="flex gap-2 text-sm text-void-muted leading-relaxed">
              <span className="text-[#CCFF00]/68 font-mono text-xs mt-0.5 shrink-0">▸</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ItemList({ items, muted }: { items: string[]; muted?: boolean }) {
  return (
    <ul className="space-y-1">
      {items.map((item, i) => (
        <li key={i} className={`flex gap-2 text-sm leading-relaxed ${muted ? "text-void-subtle" : "text-void-muted"}`}>
          <span className="text-[#CCFF00]/68 font-mono text-xs mt-0.5 shrink-0">▸</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function BilingualSectionRow({ section }: { section: Section }) {
  return (
    <section className="mb-10 pb-8 border-b border-[#1a1a1a] last:border-0">
      <h2 className="text-base font-heavy text-white tracking-tight mb-5">
        <span className="text-[#CCFF00]">{section.titleZh}</span>
        <span className="text-[#444] mx-2">/</span>
        <span className="text-void-hint font-mono font-normal text-sm">{section.titleEn}</span>
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Chinese column */}
        <div className="space-y-2">
          {section.contentZh && (
            <p className="text-sm text-void-muted leading-relaxed whitespace-pre-line">{section.contentZh}</p>
          )}
          {section.itemsZh && <ItemList items={section.itemsZh} />}
          {section.subsectionsZh?.map((sub, i) => (
            <SubsectionCol key={i} sub={sub} />
          ))}
        </div>

        {/* English column */}
        <div className="space-y-2 md:border-l md:border-[#1a1a1a] md:pl-6">
          {section.contentEn && (
            <p className="text-sm text-void-subtle leading-relaxed whitespace-pre-line">{section.contentEn}</p>
          )}
          {section.itemsEn && <ItemList items={section.itemsEn} muted />}
          {section.subsectionsEn?.map((sub, i) => (
            <SubsectionCol key={i} sub={sub} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="max-w-6xl mx-auto px-4 py-12 pb-24">

        {/* Back link */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-void-subtle hover:text-[#CCFF00] transition-colors text-xs font-mono tracking-wider"
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
          <h1 className="text-4xl font-heavy text-white tracking-tighter leading-tight">
            私隱保護政策
            <span className="block text-xl font-mono font-normal text-void-subtle mt-1">
              Privacy Protection Policy
            </span>
          </h1>
          <p className="text-xs text-[#444] font-mono mt-4">
            生效日期 Effective Date：2026年3月20日 March 20, 2026
            {" "}｜{" "}
            最後更新 Last Updated：2026年3月20日 March 20, 2026
          </p>
          <p className="text-xs text-[#333] mt-1">
            香港AI國際電影節 Hong Kong AI International Film Festival
          </p>
        </div>

        {/* Preamble */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10 p-4 bg-[#0e0e0e] border border-[#1e1e1e] rounded-xl">
          <p className="text-sm text-void-hint leading-relaxed">
            香港AI國際電影節重視並尊重閣下的私隱權。本政策說明我們如何收集、使用、儲存、分享及保護閣下的個人資料，符合香港《個人資料（私隱）條例》（第486章）的要求。
          </p>
          <p className="text-sm text-void-subtle leading-relaxed md:border-l md:border-[#1a1a1a] md:pl-6">
            HKAIFF values and respects your right to privacy. This Policy explains how we collect, use, store, share and protect your personal data, in compliance with the Hong Kong Personal Data (Privacy) Ordinance (Cap. 486).
          </p>
        </div>

        {/* Column labels */}
        <div className="hidden md:grid grid-cols-2 gap-6 mb-6 pb-3 border-b border-[#1a1a1a]">
          <p className="text-[10px] font-mono text-[#CCFF00]/78 tracking-widest uppercase">中文版本 Chinese</p>
          <p className="text-[10px] font-mono text-void-subtle tracking-widest uppercase pl-6">English Version</p>
        </div>

        {/* Bilingual sections */}
        {SECTIONS.map((section) => (
          <BilingualSectionRow key={section.id} section={section} />
        ))}

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-[#1e1e1e] text-center">
          <p className="text-xs text-[#333] font-mono">
            © 2026 香港AI國際電影節 Hong Kong AI International Film Festival. All Rights Reserved.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/terms"
              className="text-xs text-void-subtle underline hover:text-[#CCFF00] transition-colors font-mono"
            >
              用戶服務協議 Terms of Service
            </Link>
            <span className="text-[#1e1e1e] hidden sm:block">|</span>
            <a
              href="mailto:privacy@hkaiiff.com"
              className="text-xs text-void-subtle underline hover:text-[#CCFF00] transition-colors font-mono"
            >
              privacy@hkaiiff.com
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
