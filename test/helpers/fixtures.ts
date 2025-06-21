import { promises as fs } from 'fs'
import { join, resolve } from 'path'

/**
 * Helper to load fixture content from test/fixtures directory
 */
export async function loadFixture(filename: string): Promise<string> {
  const fixturePath = resolve(join(__dirname, '..', 'fixtures', filename))
  return fs.readFile(fixturePath, 'utf8')
}