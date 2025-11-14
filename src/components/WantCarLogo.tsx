/**
 * 玩咖 WANT CAR Logo Component
 * 設計理念：文字型 LOGO（參考報導者風格）
 * - 左側：橫排中文「玩咖」
 * - 右側：上下排列的英文「WANT / CAR.AUTOS」
 * - 中英文同等高度，專業雙語排版
 */

interface WantCarLogoProps {
  className?: string
  size?: number
}

export function WantCarLogo({ className = '', size = 40 }: WantCarLogoProps) {
  return (
    <div
      className={`inline-flex flex-row items-center gap-1 ${className}`}
      style={{
        height: size,
        writingMode: 'horizontal-tb'
      }}
    >
      {/* 左側：橫排中文「玩咖」（左右排列）*/}
      <div
        className="font-bold text-[#28292B] tracking-tight"
        style={{
          fontSize: `${size * 0.85}px`,
          fontFamily: "'jf-openhuninn-2.0', sans-serif",
          lineHeight: '1',
          whiteSpace: 'nowrap',
          display: 'inline-block'
        }}
      >
        玩咖
      </div>

      {/* 右側：上下排列英文（與中文同高）*/}
      <div
        className="flex flex-col justify-center"
        style={{
          height: size,
          lineHeight: '1',
          gap: `${size * 0.04}px`
        }}
      >
        <div
          className="font-bold text-[var(--brand-primary)]"
          style={{
            fontSize: `${size * 0.4}px`,
            fontFamily: "'PT Serif', serif",
            letterSpacing: '0.05em',
            whiteSpace: 'nowrap'
          }}
        >
          WANT
        </div>
        <div
          className="font-bold text-[var(--brand-primary)]"
          style={{
            fontSize: `${size * 0.3}px`,
            fontFamily: "'PT Serif', serif",
            letterSpacing: '0.02em',
            whiteSpace: 'nowrap'
          }}
        >
          CAR.AUTOS
        </div>
      </div>
    </div>
  )
}
