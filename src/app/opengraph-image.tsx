import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = '玩咖 WANT CAR - AI 驅動的玩車資訊平台'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
        }}
      >
        <div
          style={{
            fontSize: 120,
            fontWeight: 'bold',
            color: 'white',
            marginBottom: 20,
          }}
        >
          玩咖
        </div>
        <div
          style={{
            fontSize: 60,
            fontWeight: 'bold',
            color: '#6366f1',
            marginBottom: 40,
          }}
        >
          WANT CAR
        </div>
        <div
          style={{
            fontSize: 28,
            color: '#94a3b8',
          }}
        >
          AI 驅動的玩車資訊平台
        </div>
      </div>
    ),
    { ...size }
  )
}
