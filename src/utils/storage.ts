import { Context } from 'koishi'
import { RepoUpdate } from '../types'
import { parseRepoUrl } from '../services/git'

/**
 * 数据存储工具
 */
export class StorageManager {
  constructor(private ctx: Context) {}

  /**
   * 获取仓库的最后检查点
   */
  async getLastCheckpoint(repoUrl: string, branch: string): Promise<string | null> {
    const states = await this.ctx.database.get('git_repo_state', {
      repoUrl,
      branch,
    })
    
    return states[0]?.lastCheckpoint || null
  }

  /**
   * 更新仓库的检查点
   */
  async updateCheckpoint(repoUrl: string, branch: string, checkpoint: string): Promise<void> {
    const states = await this.ctx.database.get('git_repo_state', {
      repoUrl,
      branch,
    })
    
    if (states.length > 0) {
      await this.ctx.database.set('git_repo_state', {
        repoUrl,
        branch,
      }, {
        lastCheckpoint: checkpoint,
        lastUpdated: new Date(),
      })
    } else {
      await this.ctx.database.create('git_repo_state', {
        repoUrl,
        branch,
        lastCheckpoint: checkpoint,
        lastUpdated: new Date(),
      })
    }
  }

  /**
   * 保存推送记录
   */
  async savePushRecord(
    groupName: string,
    platform: string,
    channelId: string,
    repoUrl: string,
    content: string,
  ): Promise<void> {
    await this.ctx.database.create('git_push_record', {
      groupName,
      platform,
      channelId,
      repoUrl,
      content,
      pushedAt: new Date(),
    })
  }

  /**
   * 获取待推送任务
   * @param _groupName - 监控组名称（保留用于未来扩展）
   */
  async getPendingTasks(_groupName: string): Promise<any[]> {
    // 这里可以实现更复杂的任务队列逻辑
    // 简单起见，暂时返回空数组
    return []
  }

  /**
   * 清理旧记录
   */
  async cleanOldRecords(daysToKeep: number = 30): Promise<void> {
    const cutoffDate = new Date()
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)
    
    // 清理旧的推送记录
    await this.ctx.database.remove('git_push_record', {
      pushedAt: { $lt: cutoffDate },
    })
  }
}

/**
 * 数据格式化工具
 */
export class Formatter {
  /**
   * 格式化仓库名称
   */
  static formatRepoName(repoUrl: string): string {
    const { owner, repo } = parseRepoUrl(repoUrl)
    return `${owner}/${repo}`
  }

  /**
   * 格式化提交信息（纯文本）
   */
  static formatCommitText(update: RepoUpdate): string {
    const { repoName, commits } = update
    if (!commits || commits.length === 0) return ''
    
    const lines = [
      `📦 ${repoName} - 发现 ${commits.length} 个新提交`,
      '',
    ]
    
    commits.forEach((commit, index) => {
      if (index < 10) {
        lines.push(`${commit.shortSha} ${commit.message.split('\n')[0]}`)
        lines.push(`  👤 ${commit.author} · ${commit.date.toLocaleString('zh-CN')}`)
        lines.push('')
      }
    })
    
    if (commits.length > 10) {
      lines.push(`... 还有 ${commits.length - 10} 个提交`)
    }
    
    return lines.join('\n')
  }

  /**
   * 格式化 Release 信息（纯文本）
   */
  static formatReleaseText(update: RepoUpdate): string {
    const { repoName, releases } = update
    if (!releases || releases.length === 0) return ''
    
    const lines = [
      `🎉 ${repoName} - 发现 ${releases.length} 个新发布`,
      '',
    ]
    
    releases.forEach((release) => {
      const tag = release.prerelease ? '[预发布]' : '[正式]'
      lines.push(`${tag} ${release.tagName} - ${release.name}`)
      lines.push(`  👤 ${release.author} · ${release.publishedAt.toLocaleString('zh-CN')}`)
      
      if (release.body) {
        const body = release.body.split('\n').slice(0, 3).join(' ').substring(0, 100)
        lines.push(`  📝 ${body}...`)
      }
      
      lines.push('')
    })
    
    return lines.join('\n')
  }
}
