import { Context, Logger } from 'koishi'
import * as cron from 'node-cron'
import { MonitorGroup, RepoUpdate } from '../types'
import { GitService, parseRepoUrl } from '../services/git'
import { StorageManager } from '../utils/storage'
import { Config } from '../config'

/**
 * 轮询任务
 */
interface PollTask {
  group: MonitorGroup
  job: cron.ScheduledTask
  pendingUpdates: RepoUpdate[]
}

/**
 * 轮询调度器
 */
export class PollScheduler {
  private tasks: Map<string, PollTask> = new Map()
  private logger: Logger
  
  constructor(
    private _ctx: Context, // Used by methods
    private gitService: GitService,
    private storage: StorageManager,
    private config: Config,
  ) {
    this.logger = _ctx.logger('git-monitor:poll')
  }

  /**
   * 启动监控组的轮询任务
   */
  start(group: MonitorGroup): void {
    if (!group.enabled) {
      this.logger.info(`监控组 ${group.name} 已禁用，跳过`)
      return
    }
    
    // 如果已存在任务，先停止
    this.stop(group.name)
    
    this.logger.info(`启动监控组 ${group.name} 的轮询任务，Cron: ${group.pollCron}`)
    
    const job = cron.schedule(group.pollCron, async () => {
      await this.checkUpdates(group)
    })
    
    this.tasks.set(group.name, {
      group,
      job,
      pendingUpdates: [],
    })
    
    // 根据配置决定是否立即执行一次检查
    if (this.config.immediatePollOnStart) {
      this.checkUpdates(group).catch(error => {
        this.logger.error(`初始检查失败 ${group.name}:`, error)
      })
    }
  }

  /**
   * 停止监控组的轮询任务
   */
  stop(groupName: string): void {
    const task = this.tasks.get(groupName)
    if (task) {
      task.job.stop()
      this.tasks.delete(groupName)
      this.logger.info(`停止监控组 ${groupName} 的轮询任务`)
    }
  }

  /**
   * 停止所有轮询任务
   */
  stopAll(): void {
    for (const [name] of this.tasks) {
      this.stop(name)
    }
  }

  /**
   * 获取监控组所有仓库的最新状态（不更新检查点）
   */
  async fetchLatestUpdates(group: MonitorGroup): Promise<RepoUpdate[]> {
    const updates: RepoUpdate[] = []
    
    for (const repo of group.repos) {
      try {
        const update = await this.getRepoLatestUpdate(repo)
        if (update) {
          updates.push(update)
        }
      } catch (error) {
        this.logger.error(`获取仓库最新状态失败 ${repo.url}:`, error)
      }
    }
    
    return updates
  }

  /**
   * 检查更新
   */
  private async checkUpdates(group: MonitorGroup): Promise<void> {
    this.logger.debug(`检查更新: ${group.name}`)
    
    const task = this.tasks.get(group.name)
    if (!task) return
    
    for (const repo of group.repos) {
      try {
        const update = await this.checkRepoUpdate(repo)
        if (update) {
          task.pendingUpdates.push(update)
          this.logger.info(`发现新更新: ${update.repoName} (${update.type})`)
        }
      } catch (error) {
        this.logger.error(`检查仓库失败 ${repo.url}:`, error)
      }
    }
  }

  /**
   * 获取单个仓库的最新状态
   */
  private async getRepoLatestUpdate(
    repo: MonitorGroup['repos'][0],
  ): Promise<RepoUpdate | null> {
    const { owner, repo: repoName } = parseRepoUrl(repo.url)
    const branch = repo.branch || 'main'
    
    if (repo.type === 'commits') {
      if (this.config.verboseConsoleLog) {
        this.logger.info(`正在获取仓库信息: ${repo.url}`)
      }
      const commits = await this.gitService.getCommits(repo.url, branch)
      if (commits.length === 0) return null
      
      return {
        type: 'commits',
        repoName,
        repoOwner: owner,
        repo: repo,
        commits: [commits[0]],
        updateTime: new Date(),
      }
    } else {
      if (this.config.verboseConsoleLog) {
        this.logger.info(`正在获取仓库信息: ${repo.url}`)
      }
      const releases = await this.gitService.getReleases(repo.url, 1)
      if (releases.length === 0) return null
      
      return {
        type: 'releases',
        repoName,
        repoOwner: owner,
        repo: repo,
        releases: [releases[0]],
        updateTime: new Date(),
      }
    }
  }

  /**
   * 检查单个仓库的更新
   */
  private async checkRepoUpdate(
    repo: MonitorGroup['repos'][0],
  ): Promise<RepoUpdate | null> {
    const { owner, repo: repoName } = parseRepoUrl(repo.url)
    const branch = repo.branch || 'main'
    
    if (this.config.verboseConsoleLog) {
      this.logger.info(`正在获取仓库信息: ${repo.url}`)
    }
    
    // 获取上次检查点
    const lastCheckpoint = await this.storage.getLastCheckpoint(repo.url, branch)
    
    if (repo.type === 'commits') {
      // 检查提交
      const rawCommits = await this.gitService.getCommits(
        repo.url,
        branch,
        lastCheckpoint ? new Date(lastCheckpoint).toISOString() : undefined,
      )
      
      let commits = rawCommits

      if (lastCheckpoint) {
        // 过滤掉旧的提交（GitHub API returns commits inclusive of 'since'）
        const checkpointTime = new Date(lastCheckpoint).getTime()
        commits = rawCommits.filter(c => c.date.getTime() > checkpointTime)
      } else {
        // 首次运行，只取最新的一个作为基准，避免刷屏
        if (rawCommits.length > 0) {
          commits = [rawCommits[0]]
        }
      }
      
      if (commits.length === 0) {
        return null
      }
      
      // 更新检查点
      await this.storage.updateCheckpoint(repo.url, branch, commits[0].date.toISOString())
      // 根据配置决定是否推送
      if (!lastCheckpoint && this.config.silentStart) {
        // 首次运行仅保存 checkpoint，不推送
        this.logger.info(`初始化检查点 ${repoName} (${branch}): ${commits[0].shortSha}`)
        return null
      }
      
      return {
        repo,
        repoName,
        repoOwner: owner,
        type: 'commits',
        commits,
        updateTime: new Date(),
      }
    } else {
      // 检查 Release
      const releases = await this.gitService.getReleases(repo.url, 10)
      
      if (releases.length === 0) {
        return null
      }
      
      // 过滤出新的 Release
      const newReleases = lastCheckpoint
        ? releases.filter(r => r.publishedAt.toISOString() > lastCheckpoint)
        : releases.slice(0, 1) // 首次只取最新的一个
      
      if (newReleases.length === 0) {
        return null
      }
      
      // 更新检查点
      await this.storage.updateCheckpoint(repo.url, branch, releases[0].publishedAt.toISOString())
      
      return {
        repo,
        repoName,
        repoOwner: owner,
        type: 'releases',
        releases: newReleases,
        updateTime: new Date(),
      }
    }
  }

  /**
   * 获取待推送的更新
   */
  getPendingUpdates(groupName: string): RepoUpdate[] {
    const task = this.tasks.get(groupName)
    if (!task) return []
    
    const updates = [...task.pendingUpdates]
    task.pendingUpdates = []
    return updates
  }

  /**
   * 获取所有监控组状态
   */
  getStatus(): Array<{ name: string; enabled: boolean; repoCount: number; pendingCount: number }> {
    return Array.from(this.tasks.values()).map(task => ({
      name: task.group.name,
      enabled: task.group.enabled ?? true,
      repoCount: task.group.repos.length,
      pendingCount: task.pendingUpdates.length,
    }))
  }
}
