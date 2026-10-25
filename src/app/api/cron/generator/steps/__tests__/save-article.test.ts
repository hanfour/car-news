import { insertGeneratedArticle } from '../save-article'

const row = { id: 'abc123', title_zh: '標題', content_zh: '內文', ai_model: 'claude-sonnet-5-5' }
const saved = { id: 'abc123' }

const columnMissing = (column: string) => ({
  code: 'PGRST204',
  message: `Could not find the '${column}' column of 'generated_articles' in the schema cache`,
})

describe('insertGeneratedArticle', () => {
  it('資料庫接受時，原樣寫入（含 ai_model）並回傳結果', async () => {
    const insertRow = jest.fn().mockResolvedValue({ data: saved, error: null })

    const result = await insertGeneratedArticle(insertRow, row)

    expect(insertRow).toHaveBeenCalledTimes(1)
    expect(insertRow).toHaveBeenCalledWith(row)
    expect(result).toEqual({ data: saved, error: null })
  })

  it.each([
    ['PostgREST 找不到欄位', columnMissing('ai_model')],
    [
      'Postgres 直接回欄位不存在',
      {
        code: '42703',
        message: 'column "ai_model" of relation "generated_articles" does not exist',
      },
    ],
  ])('%s（migration 還沒套用）時，去掉 ai_model 重寫一次，文章仍然保存', async (_label, error) => {
    const insertRow = jest
      .fn()
      .mockResolvedValueOnce({ data: null, error })
      .mockResolvedValueOnce({ data: saved, error: null })

    const result = await insertGeneratedArticle(insertRow, row)

    expect(insertRow).toHaveBeenCalledTimes(2)
    expect(insertRow.mock.calls[1][0]).toEqual({
      id: 'abc123',
      title_zh: '標題',
      content_zh: '內文',
    })
    expect(result).toEqual({ data: saved, error: null })
  })

  it('其他錯誤，例如 id 重複，不重試，原樣回傳', async () => {
    const error = { code: '23505', message: 'duplicate key value violates unique constraint' }
    const insertRow = jest.fn().mockResolvedValue({ data: null, error })

    const result = await insertGeneratedArticle(insertRow, row)

    expect(insertRow).toHaveBeenCalledTimes(1)
    expect(result.error).toEqual(error)
  })

  it('缺少的是別的欄位時不重試，避免掩蓋其他 schema 問題', async () => {
    const error = columnMissing('cover_image')
    const insertRow = jest.fn().mockResolvedValue({ data: null, error })

    const result = await insertGeneratedArticle(insertRow, row)

    expect(insertRow).toHaveBeenCalledTimes(1)
    expect(result.error).toEqual(error)
  })

  it('重試之後仍失敗時，回傳第二次的錯誤', async () => {
    const second = { code: '23505', message: 'duplicate key value violates unique constraint' }
    const insertRow = jest
      .fn()
      .mockResolvedValueOnce({ data: null, error: columnMissing('ai_model') })
      .mockResolvedValueOnce({ data: null, error: second })

    const result = await insertGeneratedArticle(insertRow, row)

    expect(insertRow).toHaveBeenCalledTimes(2)
    expect(result.error).toEqual(second)
  })
})
