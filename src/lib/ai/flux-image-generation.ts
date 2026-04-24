import 'server-only'
/**
 * Flux 圖片生成工具（orchestrator）
 *
 * 使用 fal.ai 的 Flux 模型生成封面圖
 * 成本僅 $0.008/張，比 DALL-E 3 便宜 5 倍
 *
 * 內部拆分成三層（行為零改動）：
 * - flux/client.ts：Fal SDK 薄封裝（generateWithFlux / Schnell / Img2Img）
 * - flux/prompt-builder.ts：prompt 組裝（SceneType / buildFluxPrompt / buildImg2ImgPrompt）
 * - flux/post-process.ts：車款辨識與外觀描述（extractCarModel / getVehicleVisualDescription）
 *
 * 這個檔案保留原 public API，僅作 re-export，不新增邏輯。
 */

export type { ImageGenerationResult } from './flux/client'
export {
  generateWithFlux,
  generateWithFluxSchnell,
  generateWithFluxImg2Img,
} from './flux/client'

export type { SceneType } from './flux/prompt-builder'
export {
  SCENE_PROMPTS,
  selectScene,
  buildFluxPrompt,
  buildImg2ImgPrompt,
} from './flux/prompt-builder'

export {
  extractCarModel,
  getVehicleVisualDescription,
} from './flux/post-process'
