import sharp from 'sharp'
import path from 'path'

const PUBLIC_DIR = path.join(process.cwd(), 'public')

async function generateLogos() {
  console.log('Generating logos...')

  // 1. logo.png — 512x512, dark background + white text
  const logoSvg = `
    <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
      <rect width="512" height="512" rx="64" fill="#1a1a2e"/>
      <text x="256" y="230" text-anchor="middle" font-family="Arial, sans-serif" font-size="140" font-weight="bold" fill="white">玩咖</text>
      <text x="256" y="340" text-anchor="middle" font-family="Arial, sans-serif" font-size="60" font-weight="bold" fill="#6366f1">WANT CAR</text>
    </svg>
  `

  await sharp(Buffer.from(logoSvg))
    .resize(512, 512)
    .png()
    .toFile(path.join(PUBLIC_DIR, 'logo.png'))

  console.log('✓ logo.png (512x512)')

  // 2. logo-wide.png — 600x60, horizontal banner for JSON-LD publisher
  const logoWideSvg = `
    <svg width="600" height="60" xmlns="http://www.w3.org/2000/svg">
      <rect width="600" height="60" rx="8" fill="#1a1a2e"/>
      <text x="20" y="42" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="white">玩咖</text>
      <text x="120" y="42" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#6366f1">WANT CAR</text>
    </svg>
  `

  await sharp(Buffer.from(logoWideSvg))
    .resize(600, 60)
    .png()
    .toFile(path.join(PUBLIC_DIR, 'logo-wide.png'))

  console.log('✓ logo-wide.png (600x60)')

  // 3. favicon.png — 32x32
  const faviconSvg = `
    <svg width="32" height="32" xmlns="http://www.w3.org/2000/svg">
      <rect width="32" height="32" rx="4" fill="#1a1a2e"/>
      <text x="16" y="23" text-anchor="middle" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="white">玩</text>
    </svg>
  `

  await sharp(Buffer.from(faviconSvg))
    .resize(32, 32)
    .png()
    .toFile(path.join(PUBLIC_DIR, 'favicon.png'))

  console.log('✓ favicon.png (32x32)')

  console.log('All logos generated!')
}

generateLogos().catch(console.error)
