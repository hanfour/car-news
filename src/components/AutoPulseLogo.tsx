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

      {/* A 字母 + 賽車儀表盤刻度 */}
      <g>
        {/* A 字母左側斜線 */}
        <path
          d="M 25 85 L 45 20 L 50 10"
          stroke="url(#logo-gradient)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* A 字母右側斜線 */}
        <path
          d="M 50 10 L 55 20 L 75 85"
          stroke="url(#logo-gradient)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* A 的橫線 - 儀表盤刻度設計 */}
        {/* 主刻度線（中央） */}
        <line
          x1="35"
          y1="55"
          x2="65"
          y2="55"
          stroke="url(#logo-gradient)"
          strokeWidth="5"
          strokeLinecap="round"
        />

        {/* 小刻度線（左1） */}
        <line
          x1="32"
          y1="50"
          x2="37"
          y2="50"
          stroke="url(#logo-gradient)"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.7"
        />

        {/* 小刻度線（左2） */}
        <line
          x1="30"
          y1="45"
          x2="34"
          y2="45"
          stroke="url(#logo-gradient)"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.5"
        />

        {/* 小刻度線（右1） */}
        <line
          x1="63"
          y1="50"
          x2="68"
          y2="50"
          stroke="url(#logo-gradient)"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.7"
        />

        {/* 小刻度線（右2） */}
        <line
          x1="66"
          y1="45"
          x2="70"
          y2="45"
          stroke="url(#logo-gradient)"
          strokeWidth="2.5"
          strokeLinecap="round"
          opacity="0.5"
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

      {/* 簡化的 A + 儀表刻度 */}
      <path d="M 25 85 L 45 20 L 50 10 L 55 20 L 75 85" stroke="url(#simple-gradient)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <line x1="35" y1="55" x2="65" y2="55" stroke="url(#simple-gradient)" strokeWidth="6" strokeLinecap="round" />
      <line x1="32" y1="50" x2="37" y2="50" stroke="url(#simple-gradient)" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
      <line x1="63" y1="50" x2="68" y2="50" stroke="url(#simple-gradient)" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
    </svg>
  )
}
