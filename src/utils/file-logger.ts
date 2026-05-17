import * as fs from 'fs'
import * as path from 'path'
import { Logger } from 'koishi'
import { RepoUpdate, MonitorGroup } from '../types'

/**
 * 输出仓库信息到 JSON 文件
 * @param updates 仓库更新信息
 * @param group 监控组
 * @param logger 日志记录器
 * @param logDir 日志目录路径
 */
export function writeRepoUpdatesToJson(
  updates: RepoUpdate[],
  group: MonitorGroup,
  logger: Logger,
  logDir: string
): void {
  try {
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true })
    }
    
    const jsonPath = path.join(logDir, 'data.latest.json')
    const dataToSave = {
      timestamp: new Date().toISOString(),
      groupName: group.name,
      updateCount: updates.length,
      updates: updates.map(update => ({
        repoName: update.repoName,
        repoOwner: update.repoOwner,
        repoUrl: update.repo.url,
        branch: update.repo.branch,
        type: update.type,
        ...(update.type === 'commits' && update.commits ? {
          commitCount: update.commits.length,
          latestCommit: update.commits[0]
        } : {}),
        ...(update.type === 'releases' && update.releases ? {
          releaseCount: update.releases.length,
          latestRelease: update.releases[0]
        } : {}),
        updateTime: update.updateTime
      }))
    }
    
    fs.writeFileSync(jsonPath, JSON.stringify(dataToSave, null, 2), 'utf8')
    logger.info(`已保存仓库信息到: ${jsonPath}`)
  } catch (error) {
    logger.error('保存仓库信息到 JSON 文件失败:', error)
  }
}
