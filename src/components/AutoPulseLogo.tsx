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

        {/* 中間橫線 - 眼鏡造型 */}
        {/* 左鏡框 */}
        <ellipse
          cx="38"
          cy="52"
          rx="8"
          ry="6"
          stroke="url(#logo-gradient)"
          strokeWidth="4"
          fill="none"
        />

        {/* 右鏡框 */}
        <ellipse
          cx="62"
          cy="52"
          rx="8"
          ry="6"
          stroke="url(#logo-gradient)"
          strokeWidth="4"
          fill="none"
        />

        {/* 鼻樑 */}
        <line
          x1="46"
          y1="52"
          x2="54"
          y2="52"
          stroke="url(#logo-gradient)"
          strokeWidth="4"
          strokeLinecap="round"
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

      {/* 眼鏡簡化版 */}
      <ellipse cx="38" cy="52" rx="7" ry="5" stroke="url(#simple-gradient)" strokeWidth="4" fill="none" />
      <ellipse cx="62" cy="52" rx="7" ry="5" stroke="url(#simple-gradient)" strokeWidth="4" fill="none" />
      <line x1="45" y1="52" x2="55" y2="52" stroke="url(#simple-gradient)" strokeWidth="4" />
    </svg>
  )
}
