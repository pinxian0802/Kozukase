import { promises as fs } from 'fs'
import path from 'path'

const DOC_DIR = path.join(process.cwd(), 'docs')

export async function loadLegalDoc(filename: string): Promise<string> {
  const filePath = path.join(DOC_DIR, filename)
  return fs.readFile(filePath, 'utf-8')
}
