import { Context } from 'koishi'
import fs from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { createConsoleLogger } from './logger'

export const LXGW_WENKAI_FILE_NAME = 'LXGWWenKaiMono-Regular.ttf'

const GITEE_RELEASE_BASE = 'https://gitee.com/vincent-zyu/koishi-plugin-awa-quote-image/releases/download/fonts'
const GITHUB_RELEASE_BASE = 'https://github.com/VincentZyuApps/koishi-plugin-awa-quote-image/releases/download/fonts'

interface FontIntegrity {
  size: number
  md5: string
  sha1: string
  sha256: string
  sha512: string
}

const LXGW_WENKAI_INTEGRITY: FontIntegrity = {
  size: 24755236,
  md5: '90e75a25cca0e8868977b880352c6a53',
  sha1: '7f018ad4a181e4d2df4f972f357e612885d6c24a',
  sha256: 'ee9faa6479c5b2434f9bceca8e2e7b643f699f4f3d067aac9609261e07c6be61',
  sha512: '793dc4357d311dba539c50b0ae38ff247af066f141ffea54ff0cc51e274453671e736989cee4998fd89211035ecfe52ad38aa828ba7f1739bcf107b94a023be5',
}

const LXGW_WENKAI_DOWNLOAD_URLS = [
  { source: 'Gitee', url: `${GITEE_RELEASE_BASE}/${LXGW_WENKAI_FILE_NAME}` },
  { source: 'GitHub', url: `${GITHUB_RELEASE_BASE}/${LXGW_WENKAI_FILE_NAME}` },
]

export function getFontDirByBaseDir(baseDir: string) {
  return path.join(baseDir, 'data', 'fonts')
}

export function getLxgwWenKaiPathByBaseDir(baseDir: string) {
  return path.join(getFontDirByBaseDir(baseDir), LXGW_WENKAI_FILE_NAME)
}

// Schema 默认值无法拿到 ctx.baseDir，只能用 cwd 作为配置页展示 fallback。
// 运行时必须通过 resolveRuntimeFontPath() 重新映射到 ctx.baseDir。
export const DEFAULT_LXGW_WENKAI_PATH = getLxgwWenKaiPathByBaseDir(process.cwd())

function normalizePath(filePath: string) {
  return path.normalize(filePath)
}

function calculateHashes(buffer: Buffer) {
  return {
    md5: createHash('md5').update(buffer).digest('hex'),
    sha1: createHash('sha1').update(buffer).digest('hex'),
    sha256: createHash('sha256').update(buffer).digest('hex'),
    sha512: createHash('sha512').update(buffer).digest('hex'),
  }
}

function verifyBuffer(buffer: Buffer, expected: FontIntegrity) {
  if (buffer.length !== expected.size) return false
  const hashes = calculateHashes(buffer)
  return hashes.md5 === expected.md5
    && hashes.sha1 === expected.sha1
    && hashes.sha256 === expected.sha256
    && hashes.sha512 === expected.sha512
}

export async function verifyLxgwWenKaiFont(filePath: string): Promise<boolean> {
  if (!fs.existsSync(filePath)) return false
  const buffer = await readFile(filePath)
  return verifyBuffer(buffer, LXGW_WENKAI_INTEGRITY)
}

export function resolveRuntimeFontPath(ctx: Context, configuredPath = '') {
  const runtimeDefaultPath = getLxgwWenKaiPathByBaseDir(ctx.baseDir)
  const configured = configuredPath.trim()

  if (!configured) return runtimeDefaultPath

  if (normalizePath(configured) === normalizePath(DEFAULT_LXGW_WENKAI_PATH)) {
    return runtimeDefaultPath
  }

  if (normalizePath(configured) === normalizePath(runtimeDefaultPath)) {
    return runtimeDefaultPath
  }

  return path.isAbsolute(configured)
    ? configured
    : path.join(ctx.baseDir, configured)
}

export async function ensureDefaultFont(
  ctx: Context,
  enableFontDownload: boolean,
  verboseConsoleLog = false,
): Promise<boolean> {
  const logger = ctx.logger('git-monitor:🔡fonts')
  const log = createConsoleLogger(logger, verboseConsoleLog)
  const fontDir = getFontDirByBaseDir(ctx.baseDir)
  const fontPath = getLxgwWenKaiPathByBaseDir(ctx.baseDir)

  if (!enableFontDownload) {
    log.debug(`🔡 自动字体下载已关闭，默认字体路径: ${fontPath}`)
    return fs.existsSync(fontPath)
  }

  if (await verifyLxgwWenKaiFont(fontPath)) {
    log.debug(`✅ 默认字体已存在且校验通过: ${fontPath}`)
    return true
  }

  if (fs.existsSync(fontPath)) {
    logger.warn(`⚠️ 默认字体校验失败，将重新下载: ${fontPath}`)
  }

  if (!ctx.http) {
    logger.error('❌ 无法自动下载字体：Koishi http 服务不可用')
    return false
  }

  try {
    await mkdir(fontDir, { recursive: true })
  } catch (error) {
    logger.error(`❌ 创建字体目录失败: ${(error as Error).message}`)
    return false
  }

  let lastError: unknown = null
  for (const candidate of LXGW_WENKAI_DOWNLOAD_URLS) {
    try {
      logger.info(`📥 开始下载默认字体 ${LXGW_WENKAI_FILE_NAME} (${candidate.source})`)
      const response = await ctx.http.get(candidate.url, {
        responseType: 'arraybuffer',
        timeout: 60000,
      })
      const buffer = Buffer.from(response)

      if (!verifyBuffer(buffer, LXGW_WENKAI_INTEGRITY)) {
        throw new Error('size/hash 校验失败')
      }

      await writeFile(fontPath, buffer)
      if (!(await verifyLxgwWenKaiFont(fontPath))) {
        throw new Error('写入后 size/hash 校验失败')
      }

      logger.info(`✅ 默认字体下载成功且校验通过: ${fontPath}`)
      return true
    } catch (error) {
      lastError = error
      logger.warn(`⚠️ ${candidate.source} 下载默认字体失败: ${(error as Error).message || String(error)}`)
    }
  }

  logger.error(`❌ 默认字体下载失败，Gitee / GitHub release 均不可用或校验失败: ${lastError instanceof Error ? lastError.message : String(lastError)}`)
  return false
}
