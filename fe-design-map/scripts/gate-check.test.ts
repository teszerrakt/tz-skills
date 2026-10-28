// #13: two runner bugs let gates tick work they never tested. Each test runs the real script on a ledger.
import { afterAll, expect, test } from 'bun:test'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'gate-check-'))
afterAll(() => rmSync(dir, { recursive: true, force: true }))

function run(gate: string, ...flags: string[]) {
  const file = join(dir, `${crypto.randomUUID()}.md`)
  writeFileSync(file, `FB: ${dir}\n\n${gate}\n    EVIDENCE: pending\n`)
  const result = Bun.spawnSync(['node', join(import.meta.dir, 'gate-check.mjs'), ...flags, file])
  return { code: result.exitCode, ledger: readFileSync(file, 'utf8') }
}

test('an anchored EXPECT matches output that ends in a newline', () => {
  const { code, ledger } = run('- [ ] G1 count\n    CHECK: printf "3\\n"\n    EXPECT: /^3$/')
  expect(code).toBe(0)
  expect(ledger).toContain('- [x] G1')
})

test('a substring EXPECT needs a word boundary, so MATCH is not met by MISMATCH', () => {
  const { code, ledger } = run('- [ ] G1 compare\n    CHECK: echo MISMATCH\n    EXPECT: MATCH')
  expect(code).toBe(1)
  expect(ledger).toContain('- [ ] G1')
})

test('a dry run fails a gate that passes before any work exists, and leaves no tick behind', () => {
  const { code, ledger } = run('- [ ] G1 vacuous\n    CHECK: echo ok\n    EXPECT: ok', '--dry')
  expect(code).toBe(1)
  expect(ledger).toContain('- [ ] G1')
  expect(ledger).toContain('EVIDENCE: pending')
})
