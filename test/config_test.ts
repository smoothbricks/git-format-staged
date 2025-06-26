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
  testRepo,
  setupConfigAndFiles,
  createAndStageFiles
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
  
  await setupConfigAndFiles(r, 'basic-config.yml', {
    'test.py': 'hello world',
    'test.js': 'hello world'
  })
  
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
  
  await createAndStageFiles(r, {
    'test.py': 'hello world',
    'test.js': 'hello world'
  })
  
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
  
  await createAndStageFiles(r, {
    'src/app.js': 'app code',
    'src/vendor/lib.js': 'vendor code',
    'test.js': 'test code'
  })
  
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
  await testConfigError(t, 'invalid-missing-command.yml', /missing required 'command' field/)
})

test('validates invalid patterns type', async t => {
  await testConfigError(t, 'invalid-patterns-type.yml', /patterns must be a list/)
})

test('handles invalid YAML syntax', async t => {
  await testConfigError(t, 'invalid-syntax.yml', /Error parsing config file/)
})

test('pathspec patterns work correctly', async t => {
  const r = repo(t)
  
  await setContent(r, '.git-format-staged.yml', await loadFixture('pathspec-patterns.yml'))
  
  await createAndStageFiles(r, {
    'src/app.js': 'app',
    'src/components/Button.js': 'button',
    'src/vendor/lib.js': 'vendor',
    'tests/test.js': 'test',
    'README.md': 'readme'
  })
  
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
  
  await createAndStageFiles(r, {
    'src/app.js': 'const x = 1',
    'node_modules/lib.js': 'const y = 2'
  })
  
  const { stdout } = await formatStaged(r, '--verbose')
  
  // Both formatters should process src/app.js
  t.regex(stdout, /Piping through: tr/)
  t.regex(stdout, /Piping through: sed/)
  t.regex(stdout, /Reformatted src\/app\.js with uppercase, exclaim/)
  
  // node_modules should be excluded by the patterns
  t.notRegex(stdout, /node_modules/)
})

test('config file patterns work with --also-unstaged flag', async t => {
  const r = repo(t)
  
  await setContent(r, '.git-format-staged.yml', await loadFixture('uppercase-formatter.yml'))
  
  // Create a mix of staged and unstaged files
  await setContent(r, 'staged.txt', 'staged content')
  await stage(r, 'staged.txt')
  
  await setContent(r, 'unstaged.txt', 'unstaged content')
  
  // The config file contains pattern '*.txt', so it should format both files
  // when using --also-unstaged without specifying patterns
  await formatStaged(r, '--also-unstaged')
  
  // Both files should be formatted according to config patterns
  const stagedContent = await getStagedContent(r, 'staged.txt')
  const unstagedContent = await getContent(r, 'unstaged.txt')
  
  t.is(stagedContent.trim(), 'STAGED CONTENT')
  t.is(unstagedContent.trim(), 'UNSTAGED CONTENT')
})

test('YAML and TOML configs produce identical results', async t => {
  // Helper to test a config format
  async function testConfigFormat(configFixture: string): Promise<string> {
    const r = await testRepo()
    
    // Create initial commit
    await setContent(r, 'dummy.txt', 'dummy content')
    await stage(r, 'dummy.txt')
    await git(r, 'commit', '-m', 'initial commit')
    
    // Set up config and test file
    const configFile = configFixture.endsWith('.yml') ? '.git-format-staged.yml' : '.git-format-staged.toml'
    await setContent(r, configFile, await loadFixture(configFixture))
    await setContent(r, 'test.txt', 'hello world')
    await stage(r, 'test.txt')
    
    // Run formatter
    await formatStaged(r, '')
    const content = await getStagedContent(r, 'test.txt')
    
    cleanup(r)
    return content
  }
  
  const yamlContent = await testConfigFormat('multiple-formatters.yml')
  const tomlContent = await testConfigFormat('multiple-formatters.toml')
  
  // Both should produce the same result
  t.is(yamlContent, tomlContent)
  t.is(yamlContent.trim(), 'HELLO WORLD !!')
})

// Test that readonly formatters work correctly
async function testReadonlyFormatter(t: any, fixtureName: string) {
  const r = repo(t)
  
  await setupConfigAndFiles(r, fixtureName, {
    'test.txt': 'hello world'
  })
  
  await formatStaged(r, '')
  
  // File should be modified by formatter but not by checker
  const content = await getStagedContent(r, 'test.txt')
  t.is(content.trim(), 'goodbye world')
}

test('readonly formatter checks but does not modify files', async t => {
  await testReadonlyFormatter(t, 'readonly-formatter.yml')
})

test('no_write alias works the same as readonly', async t => {
  await testReadonlyFormatter(t, 'no-write-formatter.yml')
})

test('readonly formatter fails commit when check fails', async t => {
  const r = repo(t)
  
  await setupConfigAndFiles(r, 'readonly-formatter-fail.yml', {
    'test.txt': 'hello world'
  })
  
  const { exitCode, stderr } = await formatStagedCaptureError(r, '')
  
  t.true(exitCode > 0)
  t.regex(stderr, /failed|exited with non-zero status/)
})

// Helpers for working with context
function setRepo (repo: Repo, t: any) {
  t.context.repo = repo
}

function repo (t: any): Repo {
  return t.context.repo
}


// Helper to test formatter validation errors
async function testConfigError(t: any, configFixture: string, expectedError: RegExp) {
  const r = repo(t)
  await setContent(r, '.git-format-staged.yml', await loadFixture(configFixture))
  
  const { exitCode, stderr } = await formatStagedCaptureError(r, '')
  
  t.true(exitCode > 0)
  t.regex(stderr, expectedError)
}