import { Context } from 'koishi'
import fs from 'node:fs'
import path from 'node:path'
import { createConsoleLogger } from './logger'

const DATA_ASSETS_DIR_PARTS = ['data', 'assets', 'git-repo-monitor']

export function getPluginAssetsDir(ctx: Context): string {
  return path.join(ctx.baseDir, ...DATA_ASSETS_DIR_PARTS)
}

export function getBundledAssetsDir(): string {
  return path.resolve(__dirname, '../../assets')
}

function filesAreEqual(sourcePath: string, targetPath: string): boolean {
  if (!fs.existsSync(targetPath)) return false

  const sourceStat = fs.statSync(sourcePath)
  const targetStat = fs.statSync(targetPath)
  if (sourceStat.size !== targetStat.size) return false

  return fs.readFileSync(sourcePath).equals(fs.readFileSync(targetPath))
}

function copyDirIfNeeded(sourceDir: string, targetDir: string): number {
  fs.mkdirSync(targetDir, { recursive: true })

  let copiedCount = 0
  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name)
    const targetPath = path.join(targetDir, entry.name)

    if (entry.isDirectory()) {
      copiedCount += copyDirIfNeeded(sourcePath, targetPath)
      continue
    }

    if (!entry.isFile()) continue
    if (filesAreEqual(sourcePath, targetPath)) continue

    fs.copyFileSync(sourcePath, targetPath)
    copiedCount += 1
  }

  return copiedCount
}

export function ensurePluginAssets(ctx: Context, verboseConsoleLog = false): string {
  const bundledAssetsDir = getBundledAssetsDir()
  const pluginAssetsDir = getPluginAssetsDir(ctx)
  const logger = ctx.logger('git-monitor:📦assets')
  const log = createConsoleLogger(logger, verboseConsoleLog)

  log.debug(`📦 准备同步内置 assets: ${bundledAssetsDir} -> ${pluginAssetsDir}`)

  if (!fs.existsSync(bundledAssetsDir)) {
    logger.warn(`⚠️ 内置 assets 目录不存在，回退到插件目录路径: ${bundledAssetsDir}`)
    return bundledAssetsDir
  }

  try {
    const copiedCount = copyDirIfNeeded(bundledAssetsDir, pluginAssetsDir)
    if (copiedCount > 0) {
      logger.info(`✅ 已同步 ${copiedCount} 个内置 assets 文件到: ${pluginAssetsDir}`)
    } else {
      log.debug(`✅ 内置 assets 已是最新: ${pluginAssetsDir}`)
    }
    return pluginAssetsDir
  } catch (error) {
    logger.warn(`⚠️ 同步内置 assets 到 data/assets 目录失败，回退到插件目录: ${(error as Error).message}`)
    return bundledAssetsDir
  }
}
