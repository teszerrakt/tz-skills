import { expect, test } from 'bun:test'
import { assemble } from './assemble.ts'

const A = 'https://www.figma.com/design/K/?node-id=1-1 — frame "A"'
const B = 'https://www.figma.com/design/K/?node-id=1-2 — frame "B"'
const NOTE = 'https://www.figma.com/design/K/?node-id=1-2 — annotation "Disabled"'

test('each piece numbers from 1; the whole map renumbers in order of first appearance', () => {
  const { markdown, sourceCount } = assemble([
    { name: 'sections/a.md', text: `# Page: A [1]\n- x [2]\n\n## Sources\n[1] ${A}\n[2] ${NOTE}\n` },
    { name: 'sections/b.md', text: `# Page: B [1]\n- y [2]\n\n## Sources\n[1] ${B}\n[2] ${A}\n` },
  ])
  expect(markdown).toContain('# Page: A [1]\n- x [2]')
  expect(markdown).toContain('# Page: B [3]\n- y [1]')
  expect(markdown.endsWith(`## Sources\n[1] ${A}\n[2] ${NOTE}\n[3] ${B}\n`)).toBe(true)
  expect(sourceCount).toBe(3)
})

test('a frame and an annotation on the same node stay two sources', () => {
  const { sourceCount } = assemble([{ name: 's.md', text: `- a [1] [2]\n\n## Sources\n[1] ${B}\n[2] ${NOTE}\n` }])
  expect(sourceCount).toBe(2)
})

test('a markdown link is not a citation, and a citation with no source line is reported', () => {
  const { markdown, problems } = assemble([{ name: 's.md', text: `- see [3](#x) and [9]\n\n## Sources\n[1] ${A}\n` }])
  expect(markdown).toContain('- see [3](#x) and [9]')
  expect(problems).toEqual(['s.md: [9] has no line in its Sources block'])
})
