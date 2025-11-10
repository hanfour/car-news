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

      {/* 賽車儀表：圓形 + 接近平行的指針 */}
      <g>
        {/* 外圓（儀表外框） */}
        <circle
          cx="50"
          cy="50"
          r="40"
          stroke="url(#logo-gradient)"
          strokeWidth="5"
          fill="none"
        />

        {/* 內圓（儀表內環，可選） */}
        <circle
          cx="50"
          cy="50"
          r="32"
          stroke="url(#logo-gradient)"
          strokeWidth="2"
          fill="none"
          opacity="0.3"
        />

        {/* 左側指針（接近平行，略微向上） */}
        <line
          x1="20"
          y1="52"
          x2="48"
          y2="48"
          stroke="url(#logo-gradient)"
          strokeWidth="5"
          strokeLinecap="round"
        />

        {/* 右側指針（接近平行，略微向上） */}
        <line
          x1="52"
          y1="48"
          x2="80"
          y2="52"
          stroke="url(#logo-gradient)"
          strokeWidth="5"
          strokeLinecap="round"
        />

        {/* 中心點 */}
        <circle
          cx="50"
          cy="50"
          r="4"
          fill="url(#logo-gradient)"
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

      {/* 簡化的圓形儀表 + 平行指針 */}
      <circle cx="50" cy="50" r="40" stroke="url(#simple-gradient)" strokeWidth="6" fill="none" />
      <line x1="20" y1="52" x2="48" y2="48" stroke="url(#simple-gradient)" strokeWidth="6" strokeLinecap="round" />
      <line x1="52" y1="48" x2="80" y2="52" stroke="url(#simple-gradient)" strokeWidth="6" strokeLinecap="round" />
      <circle cx="50" cy="50" r="5" fill="url(#simple-gradient)" />
    </svg>
  )
}
