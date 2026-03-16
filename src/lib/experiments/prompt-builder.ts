/**
 * 參數化 prompt 組裝器
 * 根據 ExperimentConfig 組裝不同結構的 prompt
 */

import { ExperimentParams } from './types'
import { extractCarModel, getVehicleVisualDescription } from '@/lib/ai/flux-image-generation'
import { ImagePromptResult } from '@/lib/ai/image-prompt-generator'

/**
 * 根據實驗參數組裝最終的 Flux prompt
 * 取代 hardcoded 的 buildFluxPrompt
 */
export function buildParameterizedPrompt(
  geminiResult: ImagePromptResult,
  params: ExperimentParams,
  title: string,
  brand?: string
): string {
  const { prompt_template: template } = params
  const { fullPrompt } = geminiResult

  // 從標題提取車款資訊
  const carModel = extractCarModel(title, brand)
  const visualDesc = carModel ? getVehicleVisualDescription(carModel) : null

  // 組裝視覺描述部分
  let vehiclePart = ''
  if (visualDesc) {
    vehiclePart = `${carModel}, ${visualDesc}. `
  } else if (carModel) {
    vehiclePart = `${carModel}. `
  } else if (brand) {
    vehiclePart = `${brand} vehicle. `
  }

  // 根據 position 策略放置視覺描述
  let prompt = ''

  switch (template.visual_description_position) {
    case 'prefix':
      // 視覺描述在最前面（Flux 權重前重後輕）
      prompt = vehiclePart + template.prefix + ' ' + fullPrompt
      break
    case 'suffix':
      // 視覺描述在最後面
      prompt = template.prefix + ' ' + fullPrompt + ' ' + vehiclePart
      break
    case 'inline':
      // 視覺描述嵌入 prompt 中間
      prompt = template.prefix + ' ' + fullPrompt.replace(
        'Professional automotive photography.',
        `Professional automotive photography. ${vehiclePart}`
      )
      break
  }

  // 加上後綴
  if (template.suffix && !prompt.toLowerCase().includes(template.suffix.toLowerCase())) {
    prompt += ' ' + template.suffix
  }

  // 截斷到最大字數
  const words = prompt.split(/\s+/)
  if (words.length > template.max_prompt_words) {
    prompt = words.slice(0, template.max_prompt_words).join(' ')
  }

  return prompt.replace(/\s+/g, ' ').trim()
}
