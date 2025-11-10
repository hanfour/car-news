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

      {/* 賽車跑錶設計（圓形去掉底部 + A 字指針） */}
      <g>
        {/* 外圓弧（速度表外框，去掉底部） */}
        {/* 從左下 → 上 → 右下，形成 180° 弧線 */}
        <path
          d="M 20 70 Q 15 50, 15 35 Q 15 15, 35 5 Q 45 0, 50 0 Q 55 0, 65 5 Q 85 15, 85 35 Q 85 50, 80 70"
          stroke="url(#logo-gradient)"
          strokeWidth="5"
          strokeLinecap="round"
          fill="none"
        />

        {/* 內圓弧（儀表盤內環） */}
        <path
          d="M 28 65 Q 25 50, 25 38 Q 25 22, 38 12 Q 44 8, 50 8 Q 56 8, 62 12 Q 75 22, 75 38 Q 75 50, 72 65"
          stroke="url(#logo-gradient)"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
          opacity="0.4"
        />

        {/* 中心指針（箭頭形狀，代表 A 的橫線） */}
        {/* 指針底座 */}
        <circle
          cx="50"
          cy="50"
          r="4"
          fill="url(#logo-gradient)"
        />

        {/* 指針箭頭（從中心指向右上方，45度角） */}
        <path
          d="M 50 50 L 70 30"
          stroke="url(#logo-gradient)"
          strokeWidth="4"
          strokeLinecap="round"
        />

        {/* 箭頭尖端（三角形） */}
        <path
          d="M 70 30 L 67 33 L 73 33 Z"
          fill="url(#logo-gradient)"
        />

        {/* 刻度線（3點鐘、9點鐘位置） */}
        <line x1="18" y1="35" x2="22" y2="35" stroke="url(#logo-gradient)" strokeWidth="2" strokeLinecap="round" />
        <line x1="82" y1="35" x2="78" y2="35" stroke="url(#logo-gradient)" strokeWidth="2" strokeLinecap="round" />
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

      {/* 簡化的賽車跑錶 */}
      <path
        d="M 20 70 Q 15 50, 15 35 Q 15 15, 35 5 Q 45 0, 50 0 Q 55 0, 65 5 Q 85 15, 85 35 Q 85 50, 80 70"
        stroke="url(#simple-gradient)"
        strokeWidth="6"
        strokeLinecap="round"
        fill="none"
      />

      {/* 指針 */}
      <circle cx="50" cy="50" r="4" fill="url(#simple-gradient)" />
      <path d="M 50 50 L 70 30" stroke="url(#simple-gradient)" strokeWidth="5" strokeLinecap="round" />
      <path d="M 70 30 L 67 33 L 73 33 Z" fill="url(#simple-gradient)" />
    </svg>
  )
}
