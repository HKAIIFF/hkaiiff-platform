import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "用戶服務協議 | Terms of Service — HKAIIFF",
  description: "香港AI國際電影節用戶服務協議 Hong Kong AI International Film Festival Terms of Service",
};

const TERMS_OF_SERVICE = {
  title: "用戶服務協議",
  subtitle: "Terms of Service Agreement",
  effectiveDate: "2026年3月20日",
  lastUpdated: "2026年3月20日",
  organization: "香港AI國際電影節 Hong Kong AI International Film Festival",
  contact: "legal@hkaiff.com",
  sections: [
    {
      id: "s1",
      title: "第一條　總則與協議接受",
      content: `歡迎使用香港AI國際電影節（以下簡稱「本電影節」或「我們」）提供的所有平台、應用程式、網站及相關服務（統稱「服務」）。本用戶服務協議由香港AI國際電影節主辦機構制訂，適用於所有訪問或使用本服務的人士（以下簡稱「用戶」或「閣下」）。`,
      subsections: [
        {
          title: "1.1 協議效力",
          items: [
            "本用戶服務協議",
            "私隱保護政策",
            "社區守則",
            "AI內容創作指引",
            "票務及退票政策",
          ],
          note: "當閣下點擊「同意」、「接受」、完成帳戶註冊，或以任何方式使用本服務時，即表示閣下已閱讀、理解並同意受以上文件約束。如閣下不同意本協議任何條款，請立即停止使用本服務。",
        },
        {
          title: "1.2 用戶資格",
          items: [
            "閣下年滿十六（16）歲或以上；",
            "如閣下未滿十八（18）歲，須獲得父母或法定監護人的明確同意；",
            "閣下具備簽訂具法律約束力合同的完全民事行為能力；",
            "閣下所在地的適用法律不禁止閣下使用本服務。",
          ],
        },
      ],
    },
    {
      id: "s2",
      title: "第二條　帳戶註冊與管理",
      subsections: [
        {
          title: "2.1 帳戶創建",
          content:
            "部分功能需要閣下創建帳戶。閣下同意提供準確、完整且最新的資料，包括但不限於真實姓名、有效電子郵件地址及聯絡資料。",
        },
        {
          title: "2.2 帳戶安全責任",
          items: [
            "妥善保管帳戶登入憑證（包括密碼及雙重驗證信息）；",
            "禁止將帳戶轉讓、出售或授權他人使用；",
            "發現任何未授權使用或安全漏洞時，立即通知我們；",
            "對在閣下帳戶下發生的所有活動承擔責任。",
          ],
        },
        {
          title: "2.3 第三方登入（Privy）",
          content:
            "本服務支援透過Privy、Google、Apple ID、微信等第三方身份驗證服務登入。使用第三方登入服務亦受相應第三方的服務條款約束。本電影節不對第三方平台的服務質量、安全性或可用性承擔責任。",
        },
        {
          title: "2.4 帳戶暫停與終止",
          items: [
            "違反本協議任何條款；",
            "提供虛假或誤導性資料；",
            "從事欺詐、違法或有害活動；",
            "長期（超過兩年）未有任何使用記錄。",
          ],
        },
      ],
    },
    {
      id: "s3",
      title: "第三條　服務內容與AI功能",
      subsections: [
        {
          title: "3.1 服務概覽",
          items: [
            "電影作品提交、審核及展映安排；",
            "AI輔助電影創作工具及資源；",
            "電影節票務購買、管理及電子票據服務；",
            "電影創作者社區互動平台；",
            "AI電影技術展覽及教育內容；",
            "電影行業配對及商業合作服務；",
            "NFT及數位電影資產交易市場（如適用）；",
            "直播觀影及虛擬互動活動。",
          ],
        },
        {
          title: "3.2 AI輔助功能特別條款",
          items: [
            "AI生成內容（包括影像、音頻、劇本建議等）可能存在不準確性，閣下應自行核實所有AI輸出結果；",
            "閣下對使用AI工具創作的最終作品承擔全部法律責任，包括版權所有權及內容合規性；",
            "AI訓練模型可能使用閣下上傳的匿名化數據以改善服務（詳見私隱政策）；",
            "AI創作的作品若參與競賽，必須清晰標示AI輔助程度，符合本電影節AI透明度守則；",
            "嚴禁使用AI功能生成深度偽造（Deepfake）的不實資訊。",
          ],
        },
      ],
    },
    {
      id: "s4",
      title: "第四條　用戶內容與知識產權",
      subsections: [
        {
          title: "4.1 授權許可",
          content:
            "閣下提交用戶內容時，即向電影節機構授予一項非獨家、可轉授、免版稅、全球適用的有限許可，用於平台展示、電影節宣傳、存檔及技術運營。上述授權不影響閣下對用戶內容的所有權及其他使用權利。",
        },
        {
          title: "4.2 版權保護",
          content:
            "本平台所有內容受香港《版權條例》（第528章）保護。未經書面授權，嚴禁任何形式複製、轉載或商業使用。版權投訴請電郵：copyright@hkaiff.com",
        },
      ],
    },
    {
      id: "s5",
      title: "第五條　禁止行為",
      subsections: [
        {
          title: "5.1 非法及有害內容",
          items: [
            "上傳、發布或傳播任何違反香港法律的內容；",
            "散播虛假信息、誹謗、仇恨言論或歧視性內容；",
            "侵犯他人版權、商標或其他知識產權；",
            "未經同意使用他人面部或聲音創作深度偽造內容。",
          ],
        },
        {
          title: "5.2 技術濫用",
          items: [
            "透過自動化手段未授權訪問本平台；",
            "干擾、破壞或入侵本服務的任何系統或網絡；",
            "嘗試獲取其他用戶的帳戶、數據或私人資料。",
          ],
        },
      ],
    },
    {
      id: "s6",
      title: "第六條　票務、付款與退款政策",
      subsections: [
        {
          title: "6.1 退款政策",
          content:
            "除本電影節主動取消場次外，所有已售出門票均不設退款，亦不得更換其他場次。如遇電影節機構主動取消放映、黑色暴雨警告或8號或以上熱帶氣旋警告信號，將以原付款方式退還全額票款。",
        },
      ],
    },
    {
      id: "s7",
      title: "第七條　免責聲明與責任限制",
      content:
        "本服務依「現狀」提供，不附帶任何明示或默示保證。電影節機構對服務中斷、AI內容準確性、第三方服務問題及不可抗力事件不承擔責任。責任總額不超過閣下過去十二個月支付費用或港幣一千元（以較高者為準）。",
    },
    {
      id: "s8",
      title: "第八條　準據法與爭議解決",
      content:
        "本協議受香港特別行政區法律管轄。爭議依次透過協商（30日）、香港國際仲裁中心（HKIAC）調解及仲裁解決。仲裁地點：香港。",
    },
    {
      id: "s9",
      title: "第九條　協議修訂",
      content:
        "電影節機構保留隨時修訂本協議的權利。重大修訂將透過平台公告及電郵通知用戶。閣下繼續使用本服務即表示接受修訂後的協議。",
    },
    {
      id: "s10",
      title: "第十條　聯絡資料",
      content: "如對本協議有任何疑問，請電郵：legal@hkaiff.com",
    },
  ],
  copyright:
    "© 2026 香港AI國際電影節 Hong Kong AI International Film Festival. All Rights Reserved.",
};

type Subsection = {
  title: string;
  content?: string;
  items?: string[];
  note?: string;
};

type Section = {
  id: string;
  title: string;
  content?: string;
  subsections?: Subsection[];
};

function SubsectionBlock({ sub }: { sub: Subsection }) {
  return (
    <div className="mb-4">
      <h3 className="text-sm font-bold text-[#CCFF00] font-mono mb-2">{sub.title}</h3>
      {sub.content && (
        <p className="text-sm text-[#aaa] leading-relaxed">{sub.content}</p>
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
      {sub.note && (
        <p className="mt-2 text-sm text-[#888] italic leading-relaxed border-l-2 border-[#CCFF00]/20 pl-3">
          {sub.note}
        </p>
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
        <p className="text-sm text-[#aaa] leading-relaxed mb-4">{section.content}</p>
      )}
      {section.subsections?.map((sub, i) => (
        <SubsectionBlock key={i} sub={sub} />
      ))}
    </section>
  );
}

export default function TermsPage() {
  const data = TERMS_OF_SERVICE;

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

        {/* Sections */}
        {data.sections.map((section) => (
          <SectionBlock key={section.id} section={section as Section} />
        ))}

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-[#1e1e1e] text-center">
          <p className="text-xs text-[#333] font-mono">{data.copyright}</p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/privacy"
              className="text-xs text-[#555] underline hover:text-[#CCFF00] transition-colors font-mono"
            >
              私隱保護政策 Privacy Policy
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
