import 'server-only'
/**
 * Flux prompt 組裝（pure functions）
 *
 * 負責：
 * - 場景類型（SceneType）與場景 prompt 片段
 * - 依車輛類型輪換場景（selectScene）
 * - text-to-image prompt 組裝（buildFluxPrompt）
 * - image-to-image prompt 組裝（buildImg2ImgPrompt）
 *
 * 從原 flux-image-generation.ts 拆出（行為零改動）。
 */

import { extractCarModel, getVehicleVisualDescription, chineseBrandToEnglish } from './post-process'

// ============================================================
// 場景輪換系統
// ============================================================

export type SceneType = 'auto_show' | 'studio' | 'city_street' | 'mountain_road'

export const SCENE_PROMPTS: Record<SceneType, string> = {
  auto_show: 'displayed at a modern international auto show, bright exhibition hall lighting, polished floor reflections, show stage with dramatic spotlights',
  studio: 'professional studio lighting, clean gradient background, dramatic rim lighting highlighting body lines, controlled studio environment',
  city_street: 'parked on a sleek urban city street at golden hour, modern architecture backdrop, warm sunset reflections on bodywork, cinematic city atmosphere',
  mountain_road: 'on a scenic mountain road with sweeping curves, dramatic landscape backdrop, adventure setting with natural lighting, alpine environment',
}

/**
 * 根據車輛類型選擇最佳場景
 * SUV → 山路優先、跑車 → 城市優先、豪華 → 攝影棚優先，其餘依 seed 輪換
 */
export function selectScene(vehicleType: string, seed?: number): SceneType {
  const vt = vehicleType.toLowerCase()

  // SUV / 越野 → 山路
  if (vt.includes('suv') || vt.includes('off-road') || vt.includes('pickup') || vt.includes('truck')) {
    return 'mountain_road'
  }

  // 跑車 / 性能車 → 城市街道
  if (vt.includes('sports') || vt.includes('coupe') || vt.includes('roadster') || vt.includes('convertible') || vt.includes('supercar')) {
    return 'city_street'
  }

  // 豪華 / 旗艦 → 攝影棚
  if (vt.includes('luxury') || vt.includes('sedan') || vt.includes('limousine') || vt.includes('flagship')) {
    return 'studio'
  }

  // 其餘車型：基於 seed 輪換（使用 title hash 確保同 run 不同文章分配不同場景）
  const scenes: SceneType[] = ['auto_show', 'studio', 'city_street', 'mountain_road']
  if (seed != null) {
    return scenes[Math.abs(seed) % scenes.length]
  }
  // fallback: 用 vehicleType 字串做簡單 hash
  let hash = 0
  for (let i = 0; i < vehicleType.length; i++) {
    hash = ((hash << 5) - hash + vehicleType.charCodeAt(i)) | 0
  }
  return scenes[Math.abs(hash) % scenes.length]
}

/**
 * 為汽車新聞優化的 Flux prompt
 * 將 Gemini 生成的 prompt 強化車款外觀描述
 */
export function buildFluxPrompt(
  fullPrompt: string,
  title?: string,
  brand?: string,
  scene?: SceneType,
  qualityBoost?: boolean
): string {
  const carModel = title ? extractCarModel(title, brand) : null
  const visualDesc = carModel ? getVehicleVisualDescription(carModel) : null

  // 視覺描述放在 prompt 尾端（suffix 位置，實驗優化結果）
  let vehiclePart = ''
  if (visualDesc) {
    vehiclePart = `${carModel}, ${visualDesc}.`
  } else if (carModel) {
    vehiclePart = `${carModel}.`
  } else if (brand) {
    const brandEn = chineseBrandToEnglish(brand) || brand
    vehiclePart = `${brandEn} vehicle.`
  }

  // Gemini 的 fullPrompt 已經包含 "Professional automotive photography."
  let prompt = fullPrompt

  // 注入場景描述（替換 Gemini 生成的通用 studio 描述）
  if (scene && SCENE_PROMPTS[scene]) {
    prompt += ` ${SCENE_PROMPTS[scene]}.`
  }

  // 視覺描述放尾端（suffix position — 優化實驗 exp-20260316-0rb 結果）
  if (vehiclePart) {
    prompt += ` ${vehiclePart}`
  }

  // qualityBoost: inject enhanced quality directives for regeneration
  if (qualityBoost) {
    prompt += ' Centered hero shot, rule of thirds composition, clean uncluttered background.'
    prompt += ' 8K ultra-detailed, studio-grade three-point lighting, photorealistic rendering, zero AI artifacts.'
    // Reinforce vehicle visual description for quality boost
    if (visualDesc) {
      const keyFeatures = visualDesc.split(',').slice(0, 3).join(',')
      prompt += ` ${keyFeatures}.`
    }
  }

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
  vehicleDescription?: string,
  scene?: SceneType
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

  // 使用場景描述替代硬編碼的 studio 文字
  if (scene && SCENE_PROMPTS[scene]) {
    prompt += `${SCENE_PROMPTS[scene]}, `
  } else {
    prompt += 'professional studio lighting, clean background, '
  }

  prompt += 'sharp focus on vehicle details, editorial quality, '
  prompt += 'no text, no watermarks, no logos.'

  return prompt
}
