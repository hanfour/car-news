/**
 * @jest-environment node
 */
import {
  claudeThinkingParams,
  extractClaudeText,
  getClaudeTextOrThrow,
  isThinkingParamRejected,
  parseClaudeJson,
} from '../claude-response'

const thinking = { type: 'thinking', thinking: '' }
const text = (value: string) => ({ type: 'text', text: value })

describe('extractClaudeText', () => {
  it('thinking 區塊排在前面時，仍能取出後面的文字', () => {
    expect(extractClaudeText([thinking, text('{"a":1}')])).toBe('{"a":1}')
  })

  it('多個文字區塊會串接', () => {
    expect(extractClaudeText([text('前半'), thinking, text('後半')])).toBe('前半後半')
  })

  it('沒有文字區塊時回空字串', () => {
    expect(extractClaudeText([thinking])).toBe('')
    expect(extractClaudeText([])).toBe('')
  })
})

describe('getClaudeTextOrThrow', () => {
  it('正常回應回傳文字，stop_reason 缺少時也視為正常', () => {
    expect(getClaudeTextOrThrow({ stop_reason: 'end_turn', content: [text('ok')] })).toBe('ok')
    expect(getClaudeTextOrThrow({ content: [text('ok')] })).toBe('ok')
  })

  it('被拒絕時丟錯', () => {
    expect(() => getClaudeTextOrThrow({ stop_reason: 'refusal', content: [] })).toThrow(/declined/)
  })

  it('被 max_tokens 截斷時丟錯，除非明確允許', () => {
    const response = { stop_reason: 'max_tokens', content: [text('{"title":"半')] }
    expect(() => getClaudeTextOrThrow(response)).toThrow(/cut off/)
    expect(getClaudeTextOrThrow(response, { allowTruncated: true })).toBe('{"title":"半')
  })

  it('只有思考、沒有文字時丟錯，而不是回傳空字串', () => {
    expect(() => getClaudeTextOrThrow({ stop_reason: 'end_turn', content: [thinking] })).toThrow(
      /no text/
    )
  })

  it('只有空白的文字也算沒有文字', () => {
    expect(() => getClaudeTextOrThrow({ content: [text('  \n')] })).toThrow(/no text/)
  })
})

describe('parseClaudeJson', () => {
  it('一般 JSON', () => {
    expect(parseClaudeJson('{"a":1}')).toEqual({ a: 1 })
  })

  it('markdown 程式碼區塊包起來的 JSON', () => {
    expect(parseClaudeJson('```json\n{"a":1}\n```')).toEqual({ a: 1 })
  })

  it('JSON 前後有多餘的說明文字', () => {
    expect(parseClaudeJson('以下是文章：\n{"title_zh":"標題","n":{"x":1}}\n希望有幫助')).toEqual({
      title_zh: '標題',
      n: { x: 1 },
    })
  })

  it('真的不是 JSON 時丟出 SyntaxError', () => {
    expect(() => parseClaudeJson('抱歉，我無法完成')).toThrow(SyntaxError)
    expect(() => parseClaudeJson('{"a":')).toThrow(SyntaxError)
  })
})

describe('claudeThinkingParams', () => {
  it('Sonnet 5.5 關閉思考', () => {
    expect(claudeThinkingParams('claude-sonnet-5-5')).toEqual({
      thinking: { type: 'between_tools' },
    })
  })

  it('其他模型不送任何思考參數', () => {
    for (const model of [
      'claude-sonnet-5',
      'claude-sonnet-4-6',
      'claude-opus-5-5',
      'claude-haiku-5-5',
    ]) {
      expect(claudeThinkingParams(model)).toEqual({})
    }
  })
})

describe('isThinkingParamRejected', () => {
  const httpError = (status: number, message: string) =>
    Object.assign(new Error(message), { status })

  it('400 且訊息提到 thinking → true', () => {
    expect(isThinkingParamRejected(httpError(400, 'thinking.type: Input should be adaptive'))).toBe(
      true
    )
  })

  it('其他 400（例如餘額不足）→ false', () => {
    expect(isThinkingParamRejected(httpError(400, 'Your credit balance is too low'))).toBe(false)
  })

  it('非 400 → false', () => {
    expect(isThinkingParamRejected(httpError(500, 'thinking failed'))).toBe(false)
    expect(isThinkingParamRejected(new Error('thinking'))).toBe(false)
    expect(isThinkingParamRejected(null)).toBe(false)
  })
})
