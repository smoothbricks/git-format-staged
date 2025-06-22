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

test('single formatter pipes content correctly', async t => {
  const r = repo(t)
  await setContent(r, 'test.txt', 'hello world')
  await stage(r, 'test.txt')
  
  const { stdout } = await formatStaged(r, '-f "sed \'s/hello/HELLO/g\'" "*.txt"')
  
  t.regex(stdout, /Reformatted test\.txt/)
  const content = await getStagedContent(r, 'test.txt')
  t.is(content.trim(), 'HELLO world')
})

test('multiple formatters pipe in sequence', async t => {
  const r = repo(t)
  
  // Create config file with two formatters
  await setContent(r, '.git-format-staged.yml', await loadFixture('multiple-formatters.yml'))
  
  await setContent(r, 'test.txt', 'hello world')
  await stage(r, 'test.txt')
  
  await formatStaged(r, '--debug')
  
  const content = await getStagedContent(r, 'test.txt')
  t.is(content.trim(), 'HELLO WORLD !!')
})

test('pattern exclusions work correctly in config', async t => {
  const r = repo(t)
  
  // Create config with exclusion pattern
  await setContent(r, '.git-format-staged.yml', await loadFixture('pattern-exclusions.yml'))
  
  await setContent(r, 'format_me.txt', 'lowercase text')
  await setContent(r, 'ignore_me.txt', 'also lowercase')
  await stage(r, 'format_me.txt')
  await stage(r, 'ignore_me.txt')
  
  await formatStaged(r, '--debug')
  
  // Only format_me.txt should be uppercase
  t.is((await getStagedContent(r, 'format_me.txt')).trim(), 'LOWERCASE TEXT')
  t.is((await getStagedContent(r, 'ignore_me.txt')).trim(), 'also lowercase')
})

test('formatter order is preserved in pipeline', async t => {
  const r = repo(t)
  
  // Create config where order matters
  await setContent(r, '.git-format-staged.yml', await loadFixture('formatter-order.yml'))
  
  await setContent(r, 'test.txt', '123')
  await stage(r, 'test.txt')
  
  await formatStaged(r, '')
  
  const content = await getStagedContent(r, 'test.txt')
  t.is(content.trim(), 'PREFIX-123-SUFFIX')
})

test('no changes means no update', async t => {
  const r = repo(t)
  
  await setContent(r, '.git-format-staged.yml', await loadFixture('noop-formatter.yml'))
  
  await setContent(r, 'test.txt', 'unchanged content')
  await stage(r, 'test.txt')
  
  // Get original hash
  const { stdout: beforeHash } = await git(r, 'ls-files', '-s', 'test.txt')
  
  const { stdout, stderr } = await formatStaged(r, '')
  
  // Should not report reformatting
  t.notRegex(stdout, /Reformatted/)
  t.is(stderr, '')
  
  // Hash should be unchanged
  const { stdout: afterHash } = await git(r, 'ls-files', '-s', 'test.txt')
  t.is(afterHash, beforeHash)
})

test('working tree is updated with formatted content', async t => {
  const r = repo(t)
  
  await setContent(r, '.git-format-staged.yml', await loadFixture('uppercase-formatter.yml'))
  
  await setContent(r, 'test.txt', 'hello world')
  await stage(r, 'test.txt')
  
  await formatStaged(r, '')
  
  // Both staged and working tree should be updated
  const stagedContent = await getStagedContent(r, 'test.txt')
  const workingContent = await getContent(r, 'test.txt')
  
  t.is(stagedContent.trim(), 'HELLO WORLD')
  t.is(workingContent.trim(), 'HELLO WORLD')
})

test('handles working tree conflicts gracefully', async t => {
  const r = repo(t)
  
  await setContent(r, '.git-format-staged.yml', await loadFixture('uppercase-formatter.yml'))
  
  // Stage one version
  await setContent(r, 'test.txt', 'hello world')
  await stage(r, 'test.txt')
  
  // Modify working tree differently
  await setContent(r, 'test.txt', 'completely different content')
  
  const { stderr } = await formatStaged(r, '')
  
  // Should warn but not fail
  t.regex(stderr, /warning: could not apply formatting changes/)
  
  // Staged content should be formatted
  const stagedContent = await getStagedContent(r, 'test.txt')
  t.is(stagedContent.trim(), 'HELLO WORLD')
  
  // Working tree should remain unchanged
  const workingContent = await getContent(r, 'test.txt')
  t.is(workingContent.trim(), 'completely different content')
})

test('formatter stderr is preserved when pipeline errors', async t => {
  const r = repo(t)
  
  // Create a config with a formatter that writes to stderr and fails
  await setContent(r, '.git-format-staged.yml', await loadFixture('error-formatter.yml'))
  
  await setContent(r, 'test.js', 'const x = 1;')
  await stage(r, 'test.js')
  
  const { exitCode, stderr } = await formatStagedCaptureError(r, '')
  
  // Should fail with non-zero exit code
  t.true(exitCode > 0)
  
  // Should preserve the formatter's stderr output
  t.regex(stderr, /ERROR: Invalid syntax found/)
})

test('multiple formatter pipeline preserves all stderr outputs', async t => {
  const r = repo(t)
  
  // Create a config with multiple formatters in a pipeline where one writes to stderr
  await setContent(r, '.git-format-staged.yml', await loadFixture('multiple-formatter-pipeline.yml'))
  
  await setContent(r, 'test.txt', 'hello world')
  await stage(r, 'test.txt')
  
  const { stderr } = await formatStaged(r, '')
  
  // Should preserve stderr from all formatters in the pipeline
  t.regex(stderr, /Warning from first formatter/)
  t.regex(stderr, /Info from second formatter/)
  
  // Content should still be transformed by all formatters
  const content = await getStagedContent(r, 'test.txt')
  t.is(content.trim(), 'HELLO WORLD')
})

test('eslint-like formatter with stderr warnings still outputs fixed code', async t => {
  const r = repo(t)
  
  // Simulate an eslint-stdout-like formatter that:
  // 1. Outputs fixed code to stdout
  // 2. Outputs warnings/errors to stderr
  // 3. Returns 0 exit code for warnings
  await setContent(r, '.git-format-staged.yml', await loadFixture('eslint-like-formatter.yml'))
  
  await setContent(r, 'test.js', 'const x = 1')
  await stage(r, 'test.js')
  
  const { exitCode, stderr } = await formatStaged(r, '')
  
  // Should succeed even with warnings
  t.is(exitCode, 0)
  
  // Should preserve the warning in stderr
  t.regex(stderr, /\[WARN\] Missing semicolon/)
  
  // Content should be the fixed version
  const content = await getStagedContent(r, 'test.js')
  t.is(content.trim(), 'const x = 1')
})

// Helpers for working with context
function setRepo (repo: Repo, t: any) {
  t.context.repo = repo
}

function repo (t: any): Repo {
  return t.context.repo
}