import { readFileSync } from 'fs'
import { join } from 'path'

export function loadPrompts() {
  const promptsDir = join(process.cwd(), 'src/config/prompts')

  return {
    system: readFileSync(join(promptsDir, 'system.txt'), 'utf-8'),
    styleGuide: readFileSync(join(promptsDir, 'style-guide.txt'), 'utf-8')
  }
}
