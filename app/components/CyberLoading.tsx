"use client";

interface CyberLoadingProps {
  text?: string;
  /** 局部容器模式：absolute 定位覆盖父容器，而非 fixed 全屏 */
  inline?: boolean;
}

export default function CyberLoading({
  text = "ESTABLISHING SECURE CONNECTION...",
  inline = false,
}: CyberLoadingProps) {
  const positionClass = inline
    ? "absolute inset-0 z-50"
    : "fixed inset-0 z-[9999]";

  return (
    <div
      className={`${positionClass} bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center`}
    >
      {/* 外圈装饰环 */}
      <div className="relative flex items-center justify-center mb-6">
        <div className="absolute w-20 h-20 rounded-full border border-[#CCFF00]/20 animate-ping" />
        <div className="absolute w-16 h-16 rounded-full border border-[#CCFF00]/10 animate-pulse" />
        {/* 主 Spinner */}
        <div className="w-12 h-12 rounded-full border-4 border-[#1a1a1a] border-t-[#CCFF00] animate-spin" />
        {/* 中心点 */}
        <div className="absolute w-2 h-2 rounded-full bg-[#CCFF00] shadow-[0_0_8px_#CCFF00]" />
      </div>

      {/* 状态文字 */}
      <p className="font-mono text-[10px] text-[#CCFF00] mt-2 tracking-widest animate-pulse uppercase">
        {text}
      </p>

      {/* 扫描线装饰 */}
      <div className="mt-4 flex gap-1 items-end h-4">
        {[3, 5, 7, 5, 3, 6, 4, 7, 5, 3].map((h, i) => (
          <div
            key={i}
            className="w-0.5 bg-[#CCFF00]/60 animate-pulse rounded-full"
            style={{
              height: `${h * 2}px`,
              animationDelay: `${i * 80}ms`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
