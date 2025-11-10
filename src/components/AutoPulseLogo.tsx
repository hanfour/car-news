export function AutoPulseLogo({ className = "w-10 h-10" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* 背景漸變圓形 */}
      <defs>
        <linearGradient id="bg-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#2563eb" />
        </linearGradient>
        <linearGradient id="pulse-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="1" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.8" />
        </linearGradient>
      </defs>

      {/* 背景 */}
      <rect width="100" height="100" rx="20" fill="url(#bg-gradient)" />

      {/* 主體：字母 A 結合車頭輪廓 */}
      <g>
        {/* 字母 A 的左側 - 車頭左側輪廓 */}
        <path
          d="M 30 75 L 42 35 Q 45 25, 50 25"
          stroke="white"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* 字母 A 的右側 - 車頭右側輪廓 */}
        <path
          d="M 50 25 Q 55 25, 58 35 L 70 75"
          stroke="white"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* 字母 A 的橫線 - 結合脈搏波形 */}
        <path
          d="M 35 58 L 40 58 L 43 52 L 46 64 L 50 45 L 54 64 L 57 52 L 60 58 L 65 58"
          stroke="url(#pulse-gradient)"
          strokeWidth="5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />

        {/* 車頭燈效果 - 左 */}
        <circle cx="42" cy="40" r="3" fill="white" opacity="0.9" />

        {/* 車頭燈效果 - 右 */}
        <circle cx="58" cy="40" r="3" fill="white" opacity="0.9" />

        {/* 底部車輪暗示 - 左 */}
        <circle cx="38" cy="78" r="4" fill="none" stroke="white" strokeWidth="2" opacity="0.7" />

        {/* 底部車輪暗示 - 右 */}
        <circle cx="62" cy="78" r="4" fill="none" stroke="white" strokeWidth="2" opacity="0.7" />
      </g>

      {/* 底部小標記線（類似懂車帝的底部裝飾） */}
      <line x1="35" y1="88" x2="65" y2="88" stroke="white" strokeWidth="2" strokeLinecap="round" opacity="0.5" />
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

      <rect width="100" height="100" rx="20" fill="url(#simple-gradient)" />

      {/* 簡化的 A + 脈搏 */}
      <path
        d="M 30 75 L 42 35 L 50 25 L 58 35 L 70 75 M 35 58 L 43 52 L 50 45 L 57 52 L 65 58"
        stroke="white"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  )
}
