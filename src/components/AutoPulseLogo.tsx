export function AutoPulseLogo({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="logo-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="1" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* 圓潤質感的「咖」字 */}
      <text
        x="50"
        y="72"
        textAnchor="middle"
        fontSize="64"
        fontWeight="700"
        fontFamily="'PingFang TC', 'Microsoft JhengHei', 'Noto Sans TC', sans-serif"
        fill="url(#logo-gradient)"
        filter="url(#glow)"
        style={{ letterSpacing: '0px' }}
      >
        咖
      </text>
    </svg>
  )
}

// 簡化版本（用於 Favicon）
export function AutoPulseLogoSimple({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="simple-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
      </defs>

      {/* 簡化「咖」字 */}
      <text
        x="50"
        y="72"
        textAnchor="middle"
        fontSize="64"
        fontWeight="700"
        fontFamily="'PingFang TC', 'Microsoft JhengHei', 'Noto Sans TC', sans-serif"
        fill="url(#simple-gradient)"
      >
        咖
      </text>
    </svg>
  )
}
