import test from 'ava'
import {
  Repo,
  cleanup,
  formatStaged,
  formatStagedCaptureError,
  getStagedContent,
  getContent,
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

test('loads YAML config file and respects patterns', async t => {
  const r = repo(t)
  
  await setContent(r, '.git-format-staged.yml', await loadFixture('basic-config.yml'))
  
  await setContent(r, 'test.py', 'hello world')
  await setContent(r, 'test.js', 'hello world')
  await stage(r, 'test.py')
  await stage(r, 'test.js')
  
  const { stdout } = await formatStaged(r, '--verbose')
  
  // Should only format .py file
  t.regex(stdout, /sed 's\/hello\/goodbye\/g'/)
  t.regex(stdout, /Reformatted test\.py/)
  t.notRegex(stdout, /test\.js/)
  
  const pyContent = await getStagedContent(r, 'test.py')
  const jsContent = await getStagedContent(r, 'test.js')
  
  t.is(pyContent.trim(), 'goodbye world')
  t.is(jsContent.trim(), 'hello world')
})

test('loads TOML config file and respects patterns', async t => {
  const r = repo(t)
  
  await setContent(r, '.git-format-staged.toml', await loadFixture('basic-config.toml'))
  
  await setContent(r, 'test.py', 'hello world')
  await setContent(r, 'test.js', 'hello world')
  await stage(r, 'test.py')
  await stage(r, 'test.js')
  
  const { stdout } = await formatStaged(r, '--verbose')
  
  // Should only format .py file
  t.regex(stdout, /sed 's\/hello\/goodbye\/g'/)
  t.regex(stdout, /Reformatted test\.py/)
  t.notRegex(stdout, /test\.js/)
  
  const pyContent = await getStagedContent(r, 'test.py')
  const jsContent = await getStagedContent(r, 'test.js')
  
  t.is(pyContent.trim(), 'goodbye world')
  t.is(jsContent.trim(), 'hello world')
})

test('formats unstaged files with --unstaged flag', async t => {
  const r = repo(t)
  
  await setContent(r, '.git-format-staged.yml', await loadFixture('uppercase-formatter.yml'))
  
  // Create and stage a file
  await setContent(r, 'test.txt', 'staged content')
  await stage(r, 'test.txt')
  
  // Modify it (unstaged changes)
  await setContent(r, 'test.txt', 'unstaged content')
  
  // Also create a previously tracked file with unstaged changes
  await setContent(r, 'tracked.txt', 'original content')
  await stage(r, 'tracked.txt')
  await git(r, 'commit', '-m', 'add tracked.txt')
  await setContent(r, 'tracked.txt', 'new unstaged content')
  
  await formatStaged(r, '--unstaged "*.txt"')
  
  // Working tree files should be formatted
  const testContent = await getContent(r, 'test.txt')
  const trackedContent = await getContent(r, 'tracked.txt')
  
  t.is(testContent.trim(), 'UNSTAGED CONTENT')
  t.is(trackedContent.trim(), 'NEW UNSTAGED CONTENT')
  
  // Staged content should remain unchanged
  const stagedContent = await getStagedContent(r, 'test.txt')
  t.is(stagedContent.trim(), 'staged content')
})

test('debug output shows pattern matching decisions', async t => {
  const r = repo(t)
  
  await setContent(r, '.git-format-staged.yml', await loadFixture('debug-patterns.yml'))
  
  // Create directories first
  const fs2 = require('fs-extra')
  const path2 = require('path')
  
  await fs2.mkdirp(path2.join(r.path, 'src'))
  await fs2.mkdirp(path2.join(r.path, 'src/vendor'))
  
  await setContent(r, 'src/app.js', 'app code')
  await setContent(r, 'src/vendor/lib.js', 'vendor code')
  await setContent(r, 'test.js', 'test code')
  
  await stage(r, 'src/app.js')
  await stage(r, 'src/vendor/lib.js')
  await stage(r, 'test.js')
  
  const { stdout, stderr } = await formatStaged(r, '--debug')
  
  // Debug output should show pattern matching decisions
  const output = stdout + stderr
  t.regex(output, /Processing staged file: src\/app\.js/)
  t.regex(output, /Formatter 'test' matches|Decision: INCLUDE/)
  t.regex(output, /Processing staged file: src\/vendor\/lib\.js/)
  t.regex(output, /No formatters match|Decision: EXCLUDE/)
  t.regex(output, /Processing staged file: test\.js/)
  t.regex(output, /No formatters match|Decision: EXCLUDE/)
})

test('validates config file and reports errors', async t => {
  const r = repo(t)
  
  // Missing command
  await setContent(r, '.git-format-staged.yml', await loadFixture('invalid-missing-command.yml'))
  
  const { exitCode, stderr } = await formatStagedCaptureError(r, '')
  
  t.true(exitCode > 0)
  t.regex(stderr, /missing required 'command' field/)
})

test('validates invalid patterns type', async t => {
  const r = repo(t)
  
  await setContent(r, '.git-format-staged.yml', await loadFixture('invalid-patterns-type.yml'))
  
  const { exitCode, stderr } = await formatStagedCaptureError(r, '')
  
  t.true(exitCode > 0)
  t.regex(stderr, /patterns must be a list/)
})

test('handles invalid YAML syntax', async t => {
  const r = repo(t)
  
  await setContent(r, '.git-format-staged.yml', await loadFixture('invalid-syntax.yml'))
  
  const { exitCode, stderr } = await formatStagedCaptureError(r, '')
  
  t.true(exitCode > 0)
  t.regex(stderr, /Error parsing config file/)
})

test('pathspec patterns work correctly', async t => {
  const r = repo(t)
  
  await setContent(r, '.git-format-staged.yml', await loadFixture('pathspec-patterns.yml'))
  
  // Create test files - need to create directories first
  const fs = require('fs-extra')
  const path = require('path')
  
  await fs.mkdirp(path.join(r.path, 'src'))
  await fs.mkdirp(path.join(r.path, 'src/components'))
  await fs.mkdirp(path.join(r.path, 'src/vendor'))
  await fs.mkdirp(path.join(r.path, 'tests'))
  
  await setContent(r, 'src/app.js', 'app')
  await setContent(r, 'src/components/Button.js', 'button')
  await setContent(r, 'src/vendor/lib.js', 'vendor')
  await setContent(r, 'tests/test.js', 'test')
  await setContent(r, 'README.md', 'readme')
  
  // Stage all files
  await stage(r, 'src/app.js')
  await stage(r, 'src/components/Button.js')
  await stage(r, 'src/vendor/lib.js')
  await stage(r, 'tests/test.js')
  await stage(r, 'README.md')
  
  await formatStaged(r, '')
  
  // Check what got formatted
  t.is((await getStagedContent(r, 'src/app.js')).trim(), 'app FORMATTED')
  t.is((await getStagedContent(r, 'src/components/Button.js')).trim(), 'button FORMATTED')
  t.is((await getStagedContent(r, 'src/vendor/lib.js')).trim(), 'vendor')  // excluded
  t.is((await getStagedContent(r, 'tests/test.js')).trim(), 'test')  // not matched
  t.is((await getStagedContent(r, 'README.md')).trim(), 'readme')  // excluded
})

test('YAML anchors and aliases work correctly', async t => {
  const r = repo(t)
  
  await setContent(r, '.git-format-staged.yml', await loadFixture('yaml-anchors.yml'))
  
  // Create test files
  const fs = require('fs-extra')
  const path = require('path')
  await fs.mkdirp(path.join(r.path, 'src'))
  await fs.mkdirp(path.join(r.path, 'node_modules'))
  
  await setContent(r, 'src/app.js', 'const x = 1')
  await setContent(r, 'node_modules/lib.js', 'const y = 2')
  
  await stage(r, 'src/app.js')
  await stage(r, 'node_modules/lib.js')
  
  const { stdout } = await formatStaged(r, '--verbose')
  
  // Both formatters should process src/app.js
  t.regex(stdout, /Piping through: tr/)
  t.regex(stdout, /Piping through: sed/)
  t.regex(stdout, /Reformatted src\/app\.js with uppercase, exclaim/)
  
  // node_modules should be excluded by the patterns
  t.notRegex(stdout, /node_modules/)
})

test('YAML and TOML configs produce identical results', async t => {
  // Test with YAML
  const yamlRepo = await testRepo()
  await setContent(yamlRepo, 'dummy.txt', 'dummy content')
  await stage(yamlRepo, 'dummy.txt')
  await git(yamlRepo, 'commit', '-m', 'initial commit')
  
  await setContent(yamlRepo, '.git-format-staged.yml', await loadFixture('multiple-formatters.yml'))
  await setContent(yamlRepo, 'test.txt', 'hello world')
  await stage(yamlRepo, 'test.txt')
  await formatStaged(yamlRepo, '')
  const yamlContent = await getStagedContent(yamlRepo, 'test.txt')
  
  // Test with TOML
  const tomlRepo = await testRepo()
  await setContent(tomlRepo, 'dummy.txt', 'dummy content')
  await stage(tomlRepo, 'dummy.txt')
  await git(tomlRepo, 'commit', '-m', 'initial commit')
  
  await setContent(tomlRepo, '.git-format-staged.toml', await loadFixture('multiple-formatters.toml'))
  await setContent(tomlRepo, 'test.txt', 'hello world')
  await stage(tomlRepo, 'test.txt')
  await formatStaged(tomlRepo, '')
  const tomlContent = await getStagedContent(tomlRepo, 'test.txt')
  
  // Both should produce the same result
  t.is(yamlContent, tomlContent)
  t.is(yamlContent.trim(), 'HELLO WORLD !!')
  
  // Cleanup
  cleanup(yamlRepo)
  cleanup(tomlRepo)
})

// Helpers for working with context
function setRepo (repo: Repo, t: any) {
  t.context.repo = repo
}

function repo (t: any): Repo {
  return t.context.repo
}