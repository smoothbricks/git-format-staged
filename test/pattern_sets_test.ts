import test from 'ava'
import * as path from 'path'
import {
  Repo,
  cleanup,
  formatStagedCaptureError,
  git,
  setContent,
  stage,
  testRepo
} from './helpers/git'
import { loadFixture } from './helpers/fixtures'

test.beforeEach(async t => {
  const repo = await testRepo()
  setRepo(repo, t)
  
  // Create initial commit to have a HEAD
  await setContent(repo, 'dummy.txt', 'dummy content')
  await stage(repo, 'dummy.txt')
  await git(repo, 'commit', '-m', 'initial commit')
})

test.afterEach(t => {
  cleanup(repo(t))
})

test('pattern sets with single inheritance', async t => {
  const r = repo(t)
  
  await setContent(r, '.git-format-staged.yml', await loadFixture('pattern-sets.yml'))
  
  // Create test files
  const fse = require('fs-extra')
  await fse.mkdirp(path.join(r.path, 'src'))
  await fse.mkdirp(path.join(r.path, 'test'))
  await fse.mkdirp(path.join(r.path, 'node_modules'))
  
  await setContent(r, 'src/app.js', 'const app = 1')
  await setContent(r, 'test/app.test.js', 'test("app", () => {})')
  await setContent(r, 'node_modules/lib.js', 'module.exports = {}')
  
  await stage(r, 'src/app.js')
  await stage(r, 'test/app.test.js')
  await stage(r, 'node_modules/lib.js')
  
  const { stderr } = await formatStagedCaptureError(r, '--debug')
  
  // eslint should match both src/app.js (from 'common') and test/app.test.js (additional pattern)
  t.regex(stderr, /Processing staged file: src\/app\.js/)
  t.regex(stderr, /Formatter 'eslint' matches/)
  t.regex(stderr, /Processing staged file: test\/app\.test\.js/)
  // Should see eslint matching test file too
  const lines = stderr.split('\n')
  const testFileIdx = lines.findIndex(l => l.includes('test/app.test.js'))
  const eslintMatches = lines.slice(testFileIdx).find(l => l.includes("Formatter 'eslint' matches"))
  t.truthy(eslintMatches, 'eslint should match test file')
  
  // node_modules should be excluded
  t.regex(stderr, /Processing staged file: node_modules\/lib\.js/)
  t.regex(stderr, /No formatters match - skipping/)
})

test('pattern sets with multiple inheritance', async t => {
  const r = repo(t)
  
  await setContent(r, '.git-format-staged.yml', await loadFixture('pattern-sets.yml'))
  
  // Create test files
  const fse = require('fs-extra')
  await fse.mkdirp(path.join(r.path, 'src'))
  await fse.mkdirp(path.join(r.path, 'test'))
  
  await setContent(r, 'src/app.js', 'const app = 1')
  await setContent(r, 'test/app.spec.ts', 'describe("app", () => {})')
  await setContent(r, 'config.json', '{}')
  
  await stage(r, 'src/app.js')
  await stage(r, 'test/app.spec.ts')
  await stage(r, 'config.json')
  
  const { stderr } = await formatStagedCaptureError(r, '--debug')
  
  // prettier should match all three files
  // src/app.js from 'common', test/app.spec.ts from 'tests', config.json from its own patterns
  t.regex(stderr, /Processing staged file: src\/app\.js[\s\S]*?Formatter 'prettier' matches/)
  t.regex(stderr, /Processing staged file: test\/app\.spec\.ts[\s\S]*?Formatter 'prettier' matches/)
  t.regex(stderr, /Processing staged file: config\.json[\s\S]*?Formatter 'prettier' matches/)
})

test('pattern sets work with TOML config', async t => {
  const r = repo(t)
  
  await setContent(r, '.git-format-staged.toml', await loadFixture('pattern-sets.toml'))
  
  // Create test files - same as YAML test
  const fse = require('fs-extra')
  await fse.mkdirp(path.join(r.path, 'src'))
  await fse.mkdirp(path.join(r.path, 'test'))
  
  await setContent(r, 'src/app.js', 'const app = 1')
  await setContent(r, 'test/app.spec.ts', 'describe("app", () => {})')
  await setContent(r, 'config.json', '{}')
  
  await stage(r, 'src/app.js')
  await stage(r, 'test/app.spec.ts')
  await stage(r, 'config.json')
  
  const { stderr } = await formatStagedCaptureError(r, '--debug')
  
  // Should work exactly like YAML
  t.regex(stderr, /Processing staged file: src\/app\.js[\s\S]*?Formatter 'prettier' matches/)
  t.regex(stderr, /Processing staged file: test\/app\.spec\.ts[\s\S]*?Formatter 'prettier' matches/)
  t.regex(stderr, /Processing staged file: config\.json[\s\S]*?Formatter 'prettier' matches/)
})

test('extends with string vs array', async t => {
  const r = repo(t)
  
  await setContent(r, '.git-format-staged.yml', await loadFixture('extends-string-array.yml'))
  
  await setContent(r, 'test.txt', 'text')
  await setContent(r, 'test.md', 'markdown')
  
  await stage(r, 'test.txt')
  await stage(r, 'test.md')
  
  const { stderr } = await formatStagedCaptureError(r, '--debug')
  
  // formatter1 should only match .txt
  t.regex(stderr, /Processing staged file: test\.txt[\s\S]*?Formatter 'formatter1' matches/)
  // formatter1 should NOT match .md files
  const formatter1Lines = stderr.split('\n')
  const mdFileIdx = formatter1Lines.findIndex(l => l.includes('test.md'))
  const formatter1MatchesMd = formatter1Lines.slice(mdFileIdx, mdFileIdx + 5).find(l => l.includes("Formatter 'formatter1' matches"))
  t.falsy(formatter1MatchesMd, 'formatter1 should not match .md files')
  
  // formatter2 should match both
  t.regex(stderr, /Processing staged file: test\.txt[\s\S]*?Formatter 'formatter2' matches/)
  t.regex(stderr, /Processing staged file: test\.md[\s\S]*?Formatter 'formatter2' matches/)
})

test('undefined pattern set reference fails gracefully', async t => {
  const r = repo(t)
  
  await setContent(r, '.git-format-staged.yml', await loadFixture('invalid-undefined-pattern-set.yml'))
  
  const { exitCode, stderr } = await formatStagedCaptureError(r, '')
  
  t.true(exitCode > 0)
  t.regex(stderr, /Pattern set 'nonexistent' not found|Invalid configuration/i)
})

test('pattern sets with only extends (no additional patterns)', async t => {
  const r = repo(t)
  
  await setContent(r, '.git-format-staged.yml', await loadFixture('pattern-sets.yml'))
  
  // Create markdown files
  const fse = require('fs-extra')
  await fse.mkdirp(path.join(r.path, 'docs'))
  await fse.mkdirp(path.join(r.path, 'src'))
  
  await setContent(r, 'README.md', '# Test')
  await setContent(r, 'docs/guide.md', '# Guide')
  await setContent(r, 'src/code.js', 'const x = 1')
  
  await stage(r, 'README.md')
  await stage(r, 'docs/guide.md')
  await stage(r, 'src/code.js')
  
  const { stderr } = await formatStagedCaptureError(r, '--debug')
  
  // markdownlint should only match markdown files
  t.regex(stderr, /Processing staged file: README\.md[\s\S]*?Formatter 'markdownlint' matches/)
  t.regex(stderr, /Processing staged file: docs\/guide\.md[\s\S]*?Formatter 'markdownlint' matches/)
  // Should not match JS files
  const lines = stderr.split('\n')
  const jsFileIdx = lines.findIndex(l => l.includes('src/code.js'))
  const markdownlintMatch = lines.slice(jsFileIdx, jsFileIdx + 5).find(l => l.includes("markdownlint"))
  t.falsy(markdownlintMatch, 'markdownlint should not match JS files')
})

// Helpers for working with context
function setRepo (repo: Repo, t: any) {
  t.context.repo = repo
}

function repo (t: any): Repo {
  return t.context.repo
}