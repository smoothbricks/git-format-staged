import test from 'ava'
import {
  Repo,
  cleanup,
  formatStagedCaptureError,
  git,
  setContent,
  stage,
  testRepo,
  setupConfigAndFiles
} from './helpers/git'

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

test('YAML anchors and aliases work correctly', async t => {
  const r = repo(t)
  
  await setupConfigAndFiles(r, 'yaml-anchors-test.yml', {
    'test.js': 'const x = 1',
    'test.py': 'x = 1',
    'myfile': 'content',  // Should match "*myfile" pattern
    'test_file.js': 'test',  // Should NOT match "!*test*" pattern
    'data.json': '{}'
  })
  
  const { exitCode, stderr } = await formatStagedCaptureError(r, '--debug')
  
  // Should succeed
  t.is(exitCode, 0)
  
  // Check debug output
  // formatter1 should have the common patterns via alias
  t.regex(stderr, /Formatter 'formatter1':.*\n.*Patterns: \['.*\.js', '.*\.ts', '!node_modules\/\*\*'\]/)
  
  // formatter3 should match myfile with "*myfile" pattern
  t.regex(stderr, /Processing staged file: myfile/)
  t.regex(stderr, /Formatter 'formatter3' matches/)
  
  // formatter3 should NOT match test_file.js due to "!*test*" pattern
  const lines = stderr.split('\n')
  const testFileIdx = lines.findIndex(l => l.includes('test_file.js'))
  if (testFileIdx >= 0) {
    const formatter3Match = lines.slice(testFileIdx, testFileIdx + 5).find(l => l.includes("Formatter 'formatter3' matches"))
    t.falsy(formatter3Match, 'formatter3 should not match test_file.js due to exclusion pattern')
  }
  
  // formatter4 and formatter5 should have identical patterns
  t.regex(stderr, /Formatter 'formatter4':.*\n.*Patterns: \['.*\.py', '.*\.pyx'\]/)
  t.regex(stderr, /Formatter 'formatter5':.*\n.*Patterns: \['.*\.py', '.*\.pyx'\]/)
})

test('patterns like *myfile work without anchor definition', async t => {
  const r = repo(t)
  
  await setupConfigAndFiles(r, 'glob-patterns-test.yml', {
    'somemyfile': 'content',
    'testignore': 'content',
    'regular.txt': 'content'
  })
  
  const { exitCode, stderr } = await formatStagedCaptureError(r, '--debug')
  
  t.is(exitCode, 0)
  
  // somemyfile should match
  t.regex(stderr, /Processing staged file: somemyfile/)
  const lines = stderr.split('\n')
  const myFileIdx = lines.findIndex(l => l.includes('somemyfile'))
  const myFileMatch = lines.slice(myFileIdx, myFileIdx + 5).find(l => l.includes("Formatter 'test' matches"))
  t.truthy(myFileMatch, 'somemyfile should match *myfile pattern')
  
  // testignore should not match
  const ignoreIdx = lines.findIndex(l => l.includes('testignore'))
  if (ignoreIdx >= 0) {
    const ignoreMatch = lines.slice(ignoreIdx, ignoreIdx + 5).find(l => l.includes("Formatter 'test' matches"))
    t.falsy(ignoreMatch, 'testignore should not match due to !*ignore pattern')
  }
})

test('file patterns starting with * are handled correctly', async t => {
  const r = repo(t)
  
  await setupConfigAndFiles(r, 'pattern-types-test.yml', {
    'myfile': 'content',
    'yourfile': 'content',
    'tempfile': 'content',
    'test.js': 'js content'
  })
  
  const { stderr } = await formatStagedCaptureError(r, '--debug')
  
  // Check what matched
  const matched = ['myfile', 'yourfile', 'test.js'].every(file => {
    return stderr.includes(`Processing staged file: ${file}`) &&
           stderr.includes("Formatter 'test' matches")
  })
  t.true(matched, 'Expected files should match')
  
  // tempfile should not match due to exclusion
  const lines = stderr.split('\n')
  const tempFileIdx = lines.findIndex(l => l.includes('tempfile'))
  if (tempFileIdx >= 0) {
    const formatterMatch = lines.slice(tempFileIdx, tempFileIdx + 5).find(l => l.includes("Formatter 'test' matches"))
    t.falsy(formatterMatch, 'tempfile should not match due to exclusion pattern')
  }
})

// Helpers for working with context
function setRepo (repo: Repo, t: any) {
  t.context.repo = repo
}

function repo (t: any): Repo {
  return t.context.repo
}