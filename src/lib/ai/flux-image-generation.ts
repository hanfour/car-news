/**
 * Flux 圖片生成工具
 * 使用 fal.ai 的 Flux 模型生成封面圖
 * 成本僅 $0.008/張，比 DALL-E 3 便宜 5 倍
 */

import { fal } from '@fal-ai/client'
import { getErrorMessage } from '@/lib/utils/error'

// 配置 fal.ai
let configured = false

function configureFal() {
  if (configured) return

  const apiKey = process.env.FAL_KEY
  if (!apiKey) {
    throw new Error('FAL_KEY environment variable is required')
  }

  fal.config({
    credentials: apiKey
  })
  configured = true
}

interface FluxImageResult {
  url: string
  width: number
  height: number
  content_type: string
}

interface FluxGenerationResult {
  images: FluxImageResult[]
  prompt: string
  seed: number
  has_nsfw_concepts: boolean[]
}

export interface ImageGenerationResult {
  url: string
  revisedPrompt?: string
  error?: string
  provider: 'flux' | 'dalle'
  cost: number
}

/**
 * 使用 Flux 生成封面圖片
 * 模型：fal-ai/flux/dev（開源版本，品質好）
 */
export async function generateWithFlux(
  prompt: string,
  options: {
    imageSize?: 'landscape_16_9' | 'landscape_4_3' | 'square' | 'portrait_4_3'
    numImages?: number
    /** Override: guidance_scale (default 5.0) */
    guidanceScale?: number
    /** Override: num_inference_steps (default 28) */
    numInferenceSteps?: number
    /** Override: 固定 seed 確保可重現 */
    seed?: number
  } = {}
): Promise<ImageGenerationResult | null> {
  try {
    configureFal()

    const {
      imageSize = 'landscape_16_9',
      numImages = 1,
      guidanceScale = 5.0,
      numInferenceSteps = 28,
      seed,
    } = options

    console.log('→ Generating image with Flux (fal.ai)...')
    console.log(`   Prompt: ${prompt.slice(0, 200)}...`)
    console.log(`   Size: ${imageSize}, guidance: ${guidanceScale}, steps: ${numInferenceSteps}${seed != null ? `, seed: ${seed}` : ''}`)

    const result = await fal.subscribe('fal-ai/flux/dev', {
      input: {
        prompt,
        image_size: imageSize,
        num_images: numImages,
        enable_safety_checker: true,
        num_inference_steps: numInferenceSteps,
        guidance_scale: guidanceScale,
        ...(seed != null ? { seed } : {}),
      },
      logs: false
    }) as { data: FluxGenerationResult }

    const imageUrl = result.data?.images?.[0]?.url

    if (!imageUrl) {
      console.error('✗ Flux returned no image URL')
      return null
    }

    console.log('✓ Flux image generated successfully')
    console.log(`   URL: ${imageUrl.slice(0, 60)}...`)

    return {
      url: imageUrl,
      revisedPrompt: prompt,
      provider: 'flux',
      cost: 0.008
    }

  } catch (error) {
    console.error('✗ Flux generation failed:', getErrorMessage(error))
    return {
      url: '',
      error: getErrorMessage(error),
      provider: 'flux',
      cost: 0
    }
  }
}

/**
 * 使用 Flux Schnell（更快但品質稍低）
 */
export async function generateWithFluxSchnell(
  prompt: string
): Promise<ImageGenerationResult | null> {
  try {
    configureFal()

    console.log('→ Generating image with Flux Schnell (fast mode)...')

    const result = await fal.subscribe('fal-ai/flux/schnell', {
      input: {
        prompt,
        image_size: 'landscape_16_9',
        num_images: 1,
        enable_safety_checker: true,
        num_inference_steps: 4
      },
      logs: false
    }) as { data: FluxGenerationResult }

    const imageUrl = result.data?.images?.[0]?.url

    if (!imageUrl) {
      console.error('✗ Flux Schnell returned no image URL')
      return null
    }

    console.log('✓ Flux Schnell image generated')

    return {
      url: imageUrl,
      revisedPrompt: prompt,
      provider: 'flux',
      cost: 0.003
    }

  } catch (error) {
    console.error('✗ Flux Schnell failed:', getErrorMessage(error))
    return null
  }
}

/**
 * 為汽車新聞優化的 Flux prompt
 * 將 Gemini 生成的 prompt 強化車款外觀描述
 */
export function buildFluxPrompt(
  fullPrompt: string,
  title?: string,
  brand?: string
): string {
  const carModel = title ? extractCarModel(title, brand) : null
  const visualDesc = carModel ? getVehicleVisualDescription(carModel) : null

  // 如果有視覺描述，把它插入 prompt 最前面（Flux 權重前重後輕）
  let prompt = ''

  if (visualDesc) {
    // 車款外觀描述放最前面，最高權重
    prompt += `${carModel}, ${visualDesc}. `
  } else if (carModel) {
    prompt += `${carModel}. `
  } else if (brand) {
    const brandEn = chineseBrandToEnglish(brand) || brand
    prompt += `${brandEn} vehicle. `
  }

  // Gemini 的 fullPrompt 已經包含 "Professional automotive photography."
  // 避免重複添加
  prompt += fullPrompt

  // 末尾品質標籤
  if (!fullPrompt.toLowerCase().includes('no text or watermarks')) {
    prompt += ' Sharp focus, editorial quality, no text or watermarks.'
  }

  return prompt
}

/**
 * 為 img2img 建立專用 prompt
 */
export function buildImg2ImgPrompt(
  title: string,
  brand?: string,
  vehicleDescription?: string
): string {
  const carModel = extractCarModel(title, brand)
  const visualDesc = carModel ? getVehicleVisualDescription(carModel) : null

  let prompt = 'Professional automotive press photo, '

  if (carModel) {
    prompt += `${carModel}, `
    if (visualDesc) {
      prompt += `${visualDesc}, `
    }
  } else if (brand) {
    const brandEn = chineseBrandToEnglish(brand) || brand
    prompt += `${brandEn} vehicle, `
  }

  if (vehicleDescription) {
    prompt += `${vehicleDescription}, `
  }

  prompt += 'maintaining original vehicle design proportions and styling, '
  prompt += 'same body shape and distinctive features, '
  prompt += 'professional studio lighting, clean background, '
  prompt += 'sharp focus on vehicle details, editorial quality, '
  prompt += 'no text, no watermarks, no logos.'

  return prompt
}

/**
 * 使用參考圖片生成新圖片（Image-to-Image）
 */
export async function generateWithFluxImg2Img(
  referenceImageUrl: string,
  prompt: string,
  options: {
    strength?: number
  } = {}
): Promise<ImageGenerationResult | null> {
  try {
    configureFal()

    const { strength = 0.75 } = options

    console.log('→ Generating image with Flux Image-to-Image...')
    console.log(`   Reference: ${referenceImageUrl.slice(0, 60)}...`)
    console.log(`   Strength: ${strength}`)

    const result = await fal.subscribe('fal-ai/flux/dev/image-to-image', {
      input: {
        image_url: referenceImageUrl,
        prompt,
        strength,
        num_inference_steps: 28,
        guidance_scale: 5.0,
        enable_safety_checker: true
      },
      logs: false
    }) as { data: FluxGenerationResult }

    const imageUrl = result.data?.images?.[0]?.url

    if (!imageUrl) {
      console.error('✗ Flux img2img returned no image URL')
      return null
    }

    console.log('✓ Flux img2img generated successfully')

    return {
      url: imageUrl,
      revisedPrompt: prompt,
      provider: 'flux',
      cost: 0.025
    }

  } catch (error) {
    console.error('✗ Flux img2img failed:', getErrorMessage(error))
    return null
  }
}

// ============================================================
// 車款辨識與外觀描述
// ============================================================

/**
 * 中文品牌名 → 英文品牌名對照表
 * 文章標題是中文，但 Flux 只認英文
 */
const CHINESE_BRAND_MAP: Record<string, string> = {
  '特斯拉': 'Tesla',
  '賓士': 'Mercedes-Benz', '奔馳': 'Mercedes-Benz',
  '寶馬': 'BMW', '宝马': 'BMW',
  '奧迪': 'Audi', '奥迪': 'Audi',
  '保時捷': 'Porsche', '保时捷': 'Porsche',
  '福斯': 'Volkswagen', '大眾': 'Volkswagen', '福特': 'Ford',
  '雪佛蘭': 'Chevrolet', '雪佛兰': 'Chevrolet',
  '豐田': 'Toyota', '丰田': 'Toyota',
  '本田': 'Honda',
  '日產': 'Nissan', '日产': 'Nissan',
  '馬自達': 'Mazda', '马自达': 'Mazda',
  '凌志': 'Lexus', '雷克薩斯': 'Lexus',
  '速霸陸': 'Subaru', '斯巴鲁': 'Subaru',
  '現代': 'Hyundai', '现代': 'Hyundai',
  '起亞': 'Kia', '起亚': 'Kia',
  '捷尼賽思': 'Genesis',
  '富豪': 'Volvo', '沃爾沃': 'Volvo', '沃尔沃': 'Volvo',
  '極星': 'Polestar', '极星': 'Polestar',
  '法拉利': 'Ferrari',
  '藍寶堅尼': 'Lamborghini', '兰博基尼': 'Lamborghini',
  '瑪莎拉蒂': 'Maserati', '玛莎拉蒂': 'Maserati',
  '愛快': 'Alfa Romeo', '阿尔法': 'Alfa Romeo',
  '飛雅特': 'Fiat', '菲亚特': 'Fiat',
  '雷諾': 'Renault', '雷诺': 'Renault',
  '標緻': 'Peugeot', '标致': 'Peugeot',
  '雪鐵龍': 'Citroën', '雪铁龙': 'Citroën',
  '捷豹': 'Jaguar',
  '路虎': 'Land Rover',
  '賓利': 'Bentley', '宾利': 'Bentley',
  '勞斯萊斯': 'Rolls-Royce', '劳斯莱斯': 'Rolls-Royce',
  '奧斯頓馬丁': 'Aston Martin', '阿斯顿马丁': 'Aston Martin',
  '麥拉倫': 'McLaren', '迈凯伦': 'McLaren',
  '蓮花': 'Lotus', '路特斯': 'Lotus',
  '比亞迪': 'BYD', '比亚迪': 'BYD',
  '蔚來': 'NIO', '蔚来': 'NIO',
  '小鵬': 'XPeng', '小鹏': 'XPeng',
  '理想': 'Li Auto',
  '極氪': 'Zeekr', '极氪': 'Zeekr',
  '小米': 'Xiaomi',
  '問界': 'AITO', '问界': 'AITO',
  '鈴木': 'Suzuki', '铃木': 'Suzuki',
  '三菱': 'Mitsubishi',
}

function chineseBrandToEnglish(brand: string): string | null {
  return CHINESE_BRAND_MAP[brand] || null
}

/**
 * 從標題中提取具體車款名稱
 * 支援中文品牌名（特斯拉 Cybertruck → Tesla Cybertruck）
 */
export function extractCarModel(title: string, brand?: string): string | null {
  // 先嘗試中文品牌 + 英文型號（最常見模式：「特斯拉 Cybertruck」）
  for (const [zhBrand, enBrand] of Object.entries(CHINESE_BRAND_MAP)) {
    const escaped = zhBrand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const zhPattern = new RegExp(`${escaped}\\s+([A-Za-z0-9][A-Za-z0-9\\-\\.\\s]*[A-Za-z0-9])`)
    const match = title.match(zhPattern)
    if (match) {
      return `${enBrand} ${match[1].trim()}`
    }
  }

  // 英文品牌 + 英文/數字型號
  const enBrandPattern = /\b(Tesla|BMW|Mercedes(?:-Benz)?|Audi|Porsche|Volkswagen|Toyota|Honda|Nissan|Mazda|Lexus|Ford|Chevrolet|Rivian|Lucid|Hyundai|Kia|Genesis|Volvo|Polestar|Jaguar|Ferrari|Lamborghini|McLaren|Bentley|Rolls-Royce|Aston Martin|BYD|NIO|XPeng|Li Auto|Zeekr|AITO|Xiaomi)\s+([A-Za-z0-9\-\.]+(?:\s+[A-Za-z0-9\-\.]+)?)/i
  const enMatch = title.match(enBrandPattern)
  if (enMatch) {
    return `${enMatch[1]} ${enMatch[2]}`.trim()
  }

  // 只有型號（無品牌名），根據已知型號名稱匹配
  const modelOnlyPattern = /\b(Model\s+[3YSX]|EQS|EQE|iX\d*|i[47]|ID\.\d|e-tron|Taycan|Mustang\s+Mach-E|F-150\s+Lightning|Cybertruck|Ioniq\s+\d|EV\d|ES\d|ET\d|EC\d|G\d{2}|P\d|L\d{2}|SU7|M7|M9|Atto\s+3|Seal|Dolphin|RAV4|Corolla|Camry|CR-V|Civic|Accord|GR86|Supra|Land Cruiser|Highlander|Prius|Mirai|Ariya|Leaf|Qashqai|CX-\d{1,2}|MX-\d{1,2}|RX|NX|UX|LX|GX)\b/i
  const modelMatch = title.match(modelOnlyPattern)
  if (modelMatch) {
    const modelName = modelMatch[1]
    // 補上品牌名
    const resolvedBrand = brand ? (chineseBrandToEnglish(brand) || brand) : null
    if (resolvedBrand) {
      return `${resolvedBrand} ${modelName}`.trim()
    }
    return modelName
  }

  return null
}

/**
 * 車款外觀描述對照表
 * Flux 不認識品牌名稱，必須用外觀特徵描述
 */
export function getVehicleVisualDescription(carModel: string): string | null {
  const model = carModel.toLowerCase()

  const descriptions: Record<string, string> = {
    // === Tesla ===
    'cybertruck': 'angular stainless steel body with flat geometric panels, triangular wedge-shaped profile, sharp creased edges, no curves, brutalist origami-like design, unpainted brushed metal surface, futuristic angular LED light bar, completely non-traditional truck shape unlike any conventional pickup',
    'model y': 'smooth rounded compact crossover SUV with completely sealed front (no grille), sleek aerodynamic egg-shaped body, flush door handles, full glass roof, minimalist design with no chrome',
    'model 3': 'compact four-door sedan with no front grille, smooth unbroken nose, aerodynamic teardrop body, flush door handles, glass roof, extremely minimalist clean design',
    'model s': 'large luxury liftback sedan with no front grille, sleek fastback profile, long hood, smooth flowing body lines, flush door handles, wide haunches',
    'model x': 'large SUV with distinctive falcon-wing rear doors that open upward like gull wings, no front grille, smooth aerodynamic body, panoramic wrap-around windshield',

    // === BMW ===
    'ix': 'large electric SUV with oversized vertically-oriented kidney grille (nearly half the front), slim angular headlights, aerodynamic sculpted body, blue accent details',
    'i4': 'four-door electric gran coupe with large connected kidney grille, sporty fastback silhouette sweeping roofline, blue accent trim details',
    'i7': 'large luxury electric sedan with distinctive split headlights (slim DRL on top, main lights below), illuminated contour kidney grille, very long wheelbase, slab-sided elegant body',
    'ix3': 'compact SUV with signature kidney grille, traditional BMW proportions, slightly elevated ride height, blue EV accents',

    // === Mercedes-Benz ===
    'eqs': 'ultra-smooth luxury electric sedan with seamless one-bow body design from hood to tail, no visible grille, cab-forward proportions, minimal panel gaps, continuous curved surface',
    'eqe': 'mid-size electric sedan with smooth cab-forward design, star-pattern black panel grille, flowing body lines, coupe-like silhouette',
    'eqb': 'compact electric SUV with squared-off body, star-pattern front panel, upright proportions',

    // === Porsche ===
    'taycan': 'low sleek wide electric sports sedan with pronounced rear haunches, distinctive four-point LED headlights, aggressive wide stance, swooping roofline, muscular fenders',
    'macan': 'compact sporty SUV with rounded muscular body, classic Porsche headlight shape, sloping roofline, wide rear track',
    'cayenne': 'large sporty luxury SUV with muscular proportions, signature Porsche headlights, athletic stance',
    '911': 'iconic rear-engine sports car with round headlights, sloping fastback rear, wide rear fenders, unmistakable silhouette unchanged for decades',

    // === Ford ===
    'f-150 lightning': 'full-size electric pickup truck with sealed front grille replaced by body-colored panel, continuous light bar connecting headlights, muscular squared fenders, traditional tall truck proportions',
    'f-150': 'full-size American pickup truck with bold chrome grille, C-clamp headlights, muscular squared body, cargo bed, tall imposing stance',
    'mustang mach-e': 'electric crossover SUV with long hood, no traditional grille, aggressive squinting headlights, fastback rear reminiscent of muscle car, pony badge on nose',
    'mustang': 'iconic American muscle car with long hood, short deck, aggressive front fascia, tri-bar tail lights, wide stance, shark-nose front end',
    'bronco': 'rugged boxy off-road SUV with round headlights, removable doors and roof panels, squared-off body, heritage-inspired design',

    // === Toyota ===
    'rav4': 'compact SUV with angular aggressive front fascia, prominent wheel arches, raised ride height, two-tone roof option, adventure-ready styling',
    'camry': 'mid-size sedan with bold front grille, sweeping character line along body, sophisticated proportions, sportback-like rear',
    'corolla': 'compact sedan or hatchback with aggressive front fascia, J-shaped LED headlights, sporty lower stance than typical compact',
    'prius': 'aerodynamic hybrid with distinctive sharp-angled headlights, steeply raked windshield, hammerhead front end, liftback rear',
    'land cruiser': 'large rugged body-on-frame SUV with boxy proportions, round headlights, heritage-inspired upright stance, extremely capable off-road appearance',
    'gr86': 'small lightweight rear-wheel-drive sports coupe with low slung body, aggressive front intake, flowing fender lines',
    'supra': 'curvaceous sports car with double-bubble roof, long hood, wide body with pronounced rear haunches, aggressive front end',
    'highlander': 'three-row mid-size SUV with bold front grille, sculpted body sides, elevated ride height',
    'crown': 'raised sedan-SUV crossover with unique two-tone paint, coupe-like roofline, modern luxury proportions',
    'bz4x': 'electric SUV with futuristic hammerhead front, sharp angular headlights, cladded wheel arches, no traditional grille',
    'mirai': 'hydrogen fuel cell sedan with dramatic flowing body lines, large front intakes for air filtration, futuristic design language',

    // === Honda ===
    'cr-v': 'compact SUV with upright stance, chrome-accented front grille, clean body lines, practical proportions',
    'civic': 'compact sedan or hatchback with clean horizontal beltline, slim headlights, sporty wedge profile, modern minimalist design',
    'accord': 'mid-size sedan with elegant proportions, chrome grille bar, fastback-style roofline, refined sophisticated appearance',
    'hr-v': 'subcompact crossover with coupe-like sloping roofline, hidden rear door handles, sporty stance',
    'e:ny1': 'electric compact SUV with minimalist grille-less front, smooth aerodynamic body, Honda badge on clean nose',
    'prologue': 'large electric SUV with neo-rugged design, slim headlights, wide body, clean surfaces',

    // === Nissan ===
    'ariya': 'electric crossover with shield-shaped front panel (no grille), slim boomerang headlights, smooth aerodynamic body, futuristic Japanese design',
    'leaf': 'compact electric hatchback with blue-accented V-motion front, no exhaust pipes, distinctive floating roof design',
    'qashqai': 'compact crossover SUV with V-motion front grille, boomerang headlights, floating roof design, muscular body',
    'z': 'retro-modern sports car with long hood, teardrop headlights, fastback rear, muscular proportions honoring 240Z heritage',
    'gt-r': 'legendary performance car with four round tail lights, aggressive aerodynamic body kit, wide track, signature quad exhaust',

    // === Mazda ===
    'cx-5': 'compact SUV with Kodo soul of motion design, signature wing grille, flowing body curves, elegant proportions',
    'cx-30': 'compact crossover with sleek body, Kodo design language, flowing reflections on body panels, subtle raised ride height',
    'cx-60': 'mid-size SUV with long hood rear-drive proportions, elegant Kodo design, premium stance',
    'cx-90': 'three-row luxury SUV with long hood, rear-biased proportions, premium Kodo design language',
    'mx-5': 'small lightweight two-seat roadster with low stance, smiling front grille, classic convertible proportions',
    'mx-30': 'compact electric SUV with freestyle rear-hinged rear doors, minimalist design, cork interior accents',

    // === Hyundai ===
    'ioniq 5': 'retro-futuristic electric hatchback with pixel LED headlights and taillights, flat angular body panels, parametric pixel design, cladded wheel arches, Giugiaro-inspired sharp lines',
    'ioniq 6': 'ultra-streamlined electric sedan with elliptical aerodynamic shape, pixel LED tail lights bar, teardrop profile, extremely low drag',
    'ioniq 9': 'large electric three-row SUV with parametric pixel design, spacious greenhouse, modern clean surfaces',
    'tucson': 'compact SUV with dramatic parametric hidden headlights integrated into grille pattern, angular jewel-like design',
    'santa fe': 'boxy rugged mid-size SUV with H-shaped headlights, adventure-inspired squared-off design, bold vertical rear lights',
    'kona': 'subcompact SUV with seamless light bar front, clean modern design, compact proportions',

    // === Kia ===
    'ev6': 'angular electric crossover with sharp body creases, boomerang-shaped sequential tail lights, aggressive athletic stance, concave body panels',
    'ev9': 'large boxy electric SUV with vertical star-map headlights, flat angular body panels, digital tiger face nose, imposing squared proportions',
    'ev3': 'compact electric SUV with Kia tiger face, angular design language, practical proportions',

    // === Genesis ===
    'gv60': 'electric crossover with crest grille and split headlights, flowing coke-bottle body, athletic stance',
    'g90': 'flagship luxury sedan with two-line headlights and taillights, long elegant body, parabolic line running full length',
    'gv80': 'luxury SUV with crest grille, elegant two-line headlights, refined proportions',

    // === BYD ===
    'seal': 'sleek electric sedan with ocean-inspired flowing curves, no front grille, smooth aerodynamic body, dolphin-inspired design language',
    'atto 3': 'compact electric SUV with dragon face front design, muscular body lines, crossover proportions',
    'dolphin': 'compact electric hatchback with cute rounded body, ocean-inspired design, friendly face',
    'han': 'large electric sedan with dragon face chrome grille, elegant Chinese design elements, premium proportions',
    'tang': 'large electric SUV with dragon face design, bold proportions, premium flagship appearance',

    // === Volvo ===
    'ex90': 'large Scandinavian electric SUV with Thor hammer T-shaped headlights, clean minimalist body, squared-off D-pillar, understated elegant design',
    'ex30': 'compact electric SUV with Thor hammer headlights, minimalist clean surfaces, Scandinavian design simplicity',
    'xc90': 'large premium SUV with Thor hammer headlights, vertical iron mark grille, clean slab-sided body',
    'xc60': 'mid-size premium SUV with Thor hammer headlights, sculpted body, Scandinavian minimalism',
    'xc40': 'compact premium SUV with Thor hammer headlights, two-tone cladding option, chunky proportions',

    // === Lucid ===
    'air': 'ultra-aerodynamic luxury electric sedan with micro-lens array headlights creating unique light signature, extremely low drag body, flowing proportions, glass canopy roof, miniature grille-less front',

    // === Rivian ===
    'r1t': 'electric pickup truck with distinctive oval stadium headlights and continuous light bar, rounded friendly body panels, adventure-ready design, unique short truck bed proportions',
    'r1s': 'electric SUV with distinctive oval stadium headlights and light bar, rounded body panels, three-row adventure vehicle',
    'r2': 'compact electric SUV with oval headlights, rounded body, more affordable Rivian design language',

    // === Volkswagen ===
    'id.4': 'friendly rounded electric SUV with light bar connecting headlights, smooth body with no grille, clean aerodynamic design',
    'id.7': 'aerodynamic electric sedan fastback with continuous light bar front, smooth flowing body, no visible grille',
    'id. buzz': 'retro-modern electric van inspired by classic VW Bus, two-tone paint, friendly rounded face, boxy tall body with short overhangs',
    'golf': 'iconic compact hatchback with clean understated design, horizontal lines, practical proportions',
    'tiguan': 'compact SUV with horizontal design language, clean body sides, practical proportions',

    // === Polestar ===
    'polestar 2': 'electric fastback sedan with frameless grille, Thor hammer headlights (Volvo heritage), athletic proportions, Swedish minimalism',
    'polestar 3': 'electric performance SUV with aerodynamic body, SmartZone front sensor panel, muscular stance',
    'polestar 4': 'electric SUV-coupe with no rear window, dramatic sloping roofline, futuristic design',

    // === Xiaomi ===
    'su7': 'sleek electric sedan with smooth flowing body inspired by supercars, low aggressive stance, minimal front grille, long hood with short rear deck',

    // === Subaru ===
    'solterra': 'electric compact SUV with angular design, cladded wheel arches, distinctive C-shaped headlights, rugged appearance',
    'outback': 'raised station wagon with rugged body cladding, practical proportions, adventure-capable stance',
    'forester': 'compact SUV with boxy practical shape, large greenhouse for visibility, rugged capable appearance',
    'wrx': 'sporty compact sedan with aggressive hood scoop, wide fenders, rally-inspired design, performance stance',
    'brz': 'lightweight rear-drive sports coupe with low slung body, compact proportions, Toyota 86 twin',

    // === Lexus ===
    'rx': 'mid-size luxury SUV with bold spindle grille, L-shaped headlights, sculpted dramatic body lines',
    'nx': 'compact luxury SUV with spindle grille, sharp angular design, L-shaped running lights',
    'rz': 'electric SUV with spindle body design (no traditional grille), dramatic flowing lines, futuristic Lexus styling',
    'lc': 'grand touring coupe with dramatic flowing design, wide aggressive stance, extremely sculpted body',
    'lm': 'luxury minivan with bold spindle grille, opulent design, premium proportions',
  }

  // 精確匹配優先（完全等於 key 或 "brand key" 格式）
  for (const [key, desc] of Object.entries(descriptions)) {
    if (model === key || model.endsWith(` ${key}`)) return desc
  }

  // Fallback: 最長 key 優先的子字串匹配（避免 'cx-5' 被 'cx-' 短 key 搶先）
  const sortedKeys = Object.keys(descriptions).sort((a, b) => b.length - a.length)
  for (const key of sortedKeys) {
    if (model.includes(key)) return descriptions[key]
  }

  return null
}
