export function AutoPulseLogo({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
      </defs>

      {/* 字母 A 外框 - 扁平倒 U 型（圓潤頂部） */}
      <g>
        {/* 整體倒 U 型曲線（增加頂部圓弧曲率） */}
        <path
          d="M 30 75 Q 25 60, 25 50 Q 25 28, 38 17 Q 43 12, 50 12 Q 57 12, 62 17 Q 75 28, 75 50 Q 75 60, 70 75"
          stroke="url(#logo-gradient)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* 中間橫線 - 速度線（動態流線） */}
        {/* 第一條速度線（最長） */}
        <line
          x1="32"
          y1="48"
          x2="68"
          y2="48"
          stroke="url(#logo-gradient)"
          strokeWidth="4"
          strokeLinecap="round"
        />

        {/* 第二條速度線（中等） */}
        <line
          x1="35"
          y1="54"
          x2="65"
          y2="54"
          stroke="url(#logo-gradient)"
          strokeWidth="3.5"
          strokeLinecap="round"
          opacity="0.8"
        />

        {/* 第三條速度線（最短） */}
        <line
          x1="38"
          y1="60"
          x2="62"
          y2="60"
          stroke="url(#logo-gradient)"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.6"
        />
      </g>
    </svg>
  )
}

// 簡化版本（用於 Favicon）
export function AutoPulseLogoSimple({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="simple-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
      </defs>

      {/* 簡化的扁平倒 U 型（圓潤頂部）+ 眼鏡 */}
      <path
        d="M 30 75 Q 25 60, 25 48 Q 25 26, 38 16 Q 43 12, 50 12 Q 57 12, 62 16 Q 75 26, 75 48 Q 75 60, 70 75"
        stroke="url(#simple-gradient)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* 速度線簡化版 */}
      <line x1="32" y1="48" x2="68" y2="48" stroke="url(#simple-gradient)" strokeWidth="4" strokeLinecap="round" />
      <line x1="35" y1="54" x2="65" y2="54" stroke="url(#simple-gradient)" strokeWidth="3.5" strokeLinecap="round" opacity="0.8" />
      <line x1="38" y1="60" x2="62" y2="60" stroke="url(#simple-gradient)" strokeWidth="3" strokeLinecap="round" opacity="0.6" />
    </svg>
  )
}
