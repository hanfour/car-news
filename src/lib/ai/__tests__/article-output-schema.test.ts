/**
 * @jest-environment node
 */
import { ARTICLE_OUTPUT_SCHEMA_PROMPT, stripJSONCodeBlock } from '../article-output-schema'

describe('ARTICLE_OUTPUT_SCHEMA_PROMPT', () => {
  it('contains the JSON output schema with all required fields', () => {
    // Smoke test: 確認核心欄位都還在 schema 裡，
    // 防止有人不小心刪掉某個欄位導致 LLM 不再輸出對應內容
    expect(ARTICLE_OUTPUT_SCHEMA_PROMPT).toContain('"title_zh"')
    expect(ARTICLE_OUTPUT_SCHEMA_PROMPT).toContain('"slug_en"')
    expect(ARTICLE_OUTPUT_SCHEMA_PROMPT).toContain('"content_zh"')
    expect(ARTICLE_OUTPUT_SCHEMA_PROMPT).toContain('"confidence"')
    expect(ARTICLE_OUTPUT_SCHEMA_PROMPT).toContain('"quality_checks"')
    expect(ARTICLE_OUTPUT_SCHEMA_PROMPT).toContain('"brands"')
    expect(ARTICLE_OUTPUT_SCHEMA_PROMPT).toContain('"car_models"')
    expect(ARTICLE_OUTPUT_SCHEMA_PROMPT).toContain('"categories"')
    expect(ARTICLE_OUTPUT_SCHEMA_PROMPT).toContain('"tags"')
  })

  it('lists all 9 article categories used in production', () => {
    const categories = ['新車', '評測', '電動車', '產業', '市場', '科技', '政策', '安全', '賽車']
    for (const cat of categories) {
      expect(ARTICLE_OUTPUT_SCHEMA_PROMPT).toContain(cat)
    }
  })
})

describe('stripJSONCodeBlock', () => {
  it('strips ```json ... ``` wrapper', () => {
    const input = '```json\n{"foo": 1}\n```'
    expect(stripJSONCodeBlock(input)).toBe('{"foo": 1}')
  })

  it('strips bare ``` wrapper', () => {
    const input = '```\n{"foo": 1}\n```'
    expect(stripJSONCodeBlock(input)).toBe('{"foo": 1}')
  })

  it('handles content without code block', () => {
    expect(stripJSONCodeBlock('{"foo": 1}')).toBe('{"foo": 1}')
  })

  it('trims surrounding whitespace', () => {
    expect(stripJSONCodeBlock('  \n{"foo": 1}\n  ')).toBe('{"foo": 1}')
  })

  it('handles multiple code block markers in one string', () => {
    // 罕見但 LLM 偶爾會輸出兩段，確保都剝掉
    const input = '```json\n{"a": 1}\n```\n```json\n{"b": 2}\n```'
    const result = stripJSONCodeBlock(input)
    expect(result).not.toContain('```')
  })

  it('returns empty string for empty input', () => {
    expect(stripJSONCodeBlock('')).toBe('')
  })

  it('returns empty string for whitespace-only input', () => {
    expect(stripJSONCodeBlock('   \n  \t  ')).toBe('')
  })
})
