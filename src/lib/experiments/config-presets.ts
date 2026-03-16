/**
 * 預設實驗配置
 * baseline 使用當前 prod 參數，變體測試不同策略
 */

import { ExperimentConfig, ExperimentParams, PromptTemplate } from './types'

// 當前 production 使用的 prompt 模板（優化結果：suffix > prefix > inline）
const DEFAULT_TEMPLATE: PromptTemplate = {
  visual_description_position: 'suffix',
  prefix: '',
  suffix: 'Sharp focus, editorial quality, no text or watermarks.',
  max_prompt_words: 300,
}

// 當前 production 使用的參數（優化結果：guidance 3.5 > 5.0 > 7.5 > 10.0）
const BASELINE_PARAMS: ExperimentParams = {
  guidance_scale: 3.5,
  num_inference_steps: 28,
  gemini_temperature: 0.3,
  prompt_template: { ...DEFAULT_TEMPLATE },
  seed: 42,
}

const DEFAULT_BUDGET = {
  max_images: 10,
  max_cost_usd: 0.15,
}

function makeId(): string {
  const now = new Date()
  const date = now.toISOString().slice(0, 10).replace(/-/g, '')
  const rand = Math.random().toString(36).slice(2, 5)
  return `exp-${date}-${rand}`
}

/**
 * 預設實驗配置
 */
export const PRESETS: Record<string, Omit<ExperimentConfig, 'id'>> = {
  baseline: {
    name: 'Baseline (current prod)',
    params: { ...BASELINE_PARAMS },
    budget: { ...DEFAULT_BUDGET },
  },

  high_guidance: {
    name: 'High guidance scale (7.5)',
    params: {
      ...BASELINE_PARAMS,
      guidance_scale: 7.5,
    },
    budget: { ...DEFAULT_BUDGET },
  },

  low_guidance: {
    name: 'Low guidance scale (3.5)',
    params: {
      ...BASELINE_PARAMS,
      guidance_scale: 3.5,
    },
    budget: { ...DEFAULT_BUDGET },
  },

  more_steps: {
    name: 'More inference steps (40)',
    params: {
      ...BASELINE_PARAMS,
      num_inference_steps: 40,
    },
    budget: { ...DEFAULT_BUDGET },
  },

  fewer_steps: {
    name: 'Fewer inference steps (15)',
    params: {
      ...BASELINE_PARAMS,
      num_inference_steps: 15,
    },
    budget: { ...DEFAULT_BUDGET },
  },

  creative_prompt: {
    name: 'Creative Gemini prompt (temp 0.5)',
    params: {
      ...BASELINE_PARAMS,
      gemini_temperature: 0.5,
    },
    budget: { ...DEFAULT_BUDGET },
  },

  visual_suffix: {
    name: 'Visual description at suffix',
    params: {
      ...BASELINE_PARAMS,
      prompt_template: {
        ...DEFAULT_TEMPLATE,
        visual_description_position: 'suffix',
      },
    },
    budget: { ...DEFAULT_BUDGET },
  },

  // --- 額外測試用 presets ---

  guidance_10: {
    name: 'Very high guidance (10.0)',
    params: {
      ...BASELINE_PARAMS,
      guidance_scale: 10.0,
    },
    budget: { ...DEFAULT_BUDGET },
  },

  visual_inline: {
    name: 'Visual description inline',
    params: {
      ...BASELINE_PARAMS,
      prompt_template: {
        ...DEFAULT_TEMPLATE,
        visual_description_position: 'inline',
      },
    },
    budget: { ...DEFAULT_BUDGET },
  },

  temp_low: {
    name: 'Conservative Gemini (temp 0.1)',
    params: {
      ...BASELINE_PARAMS,
      gemini_temperature: 0.1,
    },
    budget: { ...DEFAULT_BUDGET },
  },

  temp_high: {
    name: 'Creative Gemini (temp 0.7)',
    params: {
      ...BASELINE_PARAMS,
      gemini_temperature: 0.7,
    },
    budget: { ...DEFAULT_BUDGET },
  },
}

/**
 * 從 preset 名稱建立完整的 ExperimentConfig
 */
export function createConfigFromPreset(
  presetName: string,
  baselineExperimentId?: string
): ExperimentConfig {
  const preset = PRESETS[presetName]
  if (!preset) {
    const available = Object.keys(PRESETS).join(', ')
    throw new Error(`Unknown preset "${presetName}". Available: ${available}`)
  }

  return {
    id: makeId(),
    ...preset,
    baseline_experiment_id: baselineExperimentId,
  }
}

/**
 * 建立自訂配置（用於組合最佳參數）
 */
export function createCustomConfig(
  name: string,
  overrides: Partial<ExperimentParams>,
  baselineExperimentId?: string
): ExperimentConfig {
  return {
    id: makeId(),
    name,
    params: {
      ...BASELINE_PARAMS,
      ...overrides,
      prompt_template: {
        ...DEFAULT_TEMPLATE,
        ...(overrides.prompt_template || {}),
      },
    },
    budget: { ...DEFAULT_BUDGET },
    baseline_experiment_id: baselineExperimentId,
  }
}

/**
 * 列出所有可用的 preset
 */
export function listPresets(): Array<{ name: string; description: string }> {
  return Object.entries(PRESETS).map(([key, preset]) => ({
    name: key,
    description: preset.name,
  }))
}
