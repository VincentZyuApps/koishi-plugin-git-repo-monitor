import { Context, Logger } from 'koishi'
import * as cron from 'node-cron'
import * as path from 'path'
import { MonitorGroup, RepoUpdate } from '../types'
import { GitService, parseRepoUrl } from '../services/git'
import { StorageManager } from '../utils/storage'
import { writeRepoUpdatesToJson } from '../utils/file-logger'
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
  async fetchLatestUpdates(group: MonitorGroup, customLogger?: Logger): Promise<RepoUpdate[]> {
    const logger = customLogger || this.logger
    const totalRepos = group.repos.length
    const parallelCount = Math.max(1, this.config.parallelFetchCount || 1)

    const processRepo = async (repo: MonitorGroup['repos'][0], index: number): Promise<RepoUpdate | null> => {
      const progress = ((index + 1) / totalRepos) * 100
      const startTime = Date.now()
      logger.info(`【指令触发】[${progress.toFixed(2)}%] 正在获取仓库信息: ${repo.url} (${index + 1}/${totalRepos})`)
      try {
        const timeoutMs = this.config.repoFetchTimeout || 300000
        const update = await Promise.race([
          this.getRepoLatestUpdate(repo),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`请求超时 (${timeoutMs}ms)`)), timeoutMs)
          ),
        ])
        const elapsed = Date.now() - startTime
        if (update) {
          logger.info(`✅ [${progress.toFixed(2)}%] 获取完成: ${repo.url} (${elapsed}ms)`)
        } else {
          logger.warn(`⚠️ [${progress.toFixed(2)}%] 无返回数据: ${repo.url} (${elapsed}ms)`)
        }
        return update
      } catch (error) {
        const elapsed = Date.now() - startTime
        logger.error(`获取仓库最新状态失败 ${repo.url} (${elapsed}ms):`, error)
        return null
      }
    }

    let results: RepoUpdate[] = []

    if (parallelCount === 1) {
      for (let i = 0; i < group.repos.length; i++) {
        const update = await processRepo(group.repos[i], i)
        if (update) results.push(update)
      }
    } else {
      for (let batchStart = 0; batchStart < group.repos.length; batchStart += parallelCount) {
        const batch = group.repos.slice(batchStart, batchStart + parallelCount)
        const batchResults = await Promise.all(
          batch.map((repo, idx) => processRepo(repo, batchStart + idx))
        )
        results = results.concat(batchResults.filter((u): u is RepoUpdate => u !== null))
      }
    }

    // 输出仓库信息到 JSON 文件（如果启用了 verboseFileLog）
    if (this.config.verboseFileLog) {
      const logDir = path.join(__dirname, '../../log')
      writeRepoUpdatesToJson(results, group, logger, logDir)
    }
    
    return results
  }

  /**
   * 检查更新（公开方法，供手动触发）
   */
  async triggerCheck(group: MonitorGroup): Promise<number> {
    this.logger.info(`手动触发检查: ${group.name}`)
    const task = this.tasks.get(group.name)
    if (!task) {
      this.logger.warn(`监控组 ${group.name} 未启动，无法检查`)
      return 0
    }
    
    const beforeCount = task.pendingUpdates.length
    await this.checkUpdates(group)
    const newCount = task.pendingUpdates.length - beforeCount
    this.logger.info(`检查完成: ${group.name}，发现 ${newCount} 个新更新`)
    return newCount
  }

  /**
   * 检查更新
    */
  private async checkUpdates(group: MonitorGroup): Promise<void> {
    this.logger.debug(`检查更新: ${group.name}`)
    
    const task = this.tasks.get(group.name)
    if (!task) return
    
    const totalRepos = group.repos.length
    const parallelCount = Math.max(1, this.config.parallelFetchCount || 1)
    
    const processRepo = async (repo: MonitorGroup['repos'][0], index: number): Promise<RepoUpdate | null> => {
      const progress = ((index + 1) / totalRepos) * 100
      const startTime = Date.now()
      this.logger.info(`获取仓库: ${repo.url} (${index + 1}/${totalRepos}, ${progress.toFixed(2)}%)`)
      try {
        const timeoutMs = this.config.repoFetchTimeout || 300000
        const update = await Promise.race([
          this.checkRepoUpdate(repo),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`请求超时 (${timeoutMs}ms)`)), timeoutMs)
          ),
        ])
        const elapsed = Date.now() - startTime
        if (update) {
          this.logger.info(`✅ 发现新更新: ${update.repoName} (${update.type}) (${elapsed}ms)`)
        } else {
          this.logger.info(`⏭️ 无新更新: ${repo.url} (${elapsed}ms)`)
        }
        return update
      } catch (error) {
        const elapsed = Date.now() - startTime
        this.logger.error(`检查仓库失败 ${repo.url} (${elapsed}ms):`, error)
        return null
      }
    }

    if (parallelCount === 1) {
      for (let i = 0; i < group.repos.length; i++) {
        const update = await processRepo(group.repos[i], i)
        if (update) {
          task.pendingUpdates.push(update)
        }
      }
    } else {
      for (let batchStart = 0; batchStart < group.repos.length; batchStart += parallelCount) {
        const batch = group.repos.slice(batchStart, batchStart + parallelCount)
        const results = await Promise.all(
          batch.map((repo, idx) => processRepo(repo, batchStart + idx))
        )
        for (const update of results) {
          if (update) {
            task.pendingUpdates.push(update)
          }
        }
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
      const commits = await this.gitService.getCommits(repo.url, branch)
      if (commits.length === 0) return null
      
      return {
        repo: repo,
        repoName,
        repoOwner: owner,
        type: 'commits',
        commits: [commits[0]],
        updateTime: new Date(),
      }
    } else {
      const releases = await this.gitService.getReleases(repo.url, 1)
      if (releases.length === 0) return null
      
      return {
        repo: repo,
        repoName,
        repoOwner: owner,
        type: 'releases',
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
    
    const rawUpdates = [...task.pendingUpdates]
    task.pendingUpdates = []
    
    // 先按仓库 URL 合并同一仓库的多次更新
    const mergedByRepo = new Map<string, RepoUpdate>()
    
    for (const update of rawUpdates) {
      const key = update.repo.url
      const existing = mergedByRepo.get(key)
      
      if (!existing) {
        mergedByRepo.set(key, { ...update })
      } else {
        // 合并同类型的更新
        if (update.type === 'commits' && existing.type === 'commits') {
          // 合并 commits，按时间降序排列（最新的在前）
          const allCommits = [...(existing.commits || []), ...(update.commits || [])]
          allCommits.sort((a, b) => b.date.getTime() - a.date.getTime())
          // 去重（按 sha）
          const seen = new Set<string>()
          existing.commits = allCommits.filter(c => {
            if (seen.has(c.sha)) return false
            seen.add(c.sha)
            return true
          })
        } else if (update.type === 'releases' && existing.type === 'releases') {
          // 合并 releases，按发布时间降序排列
          const allReleases = [...(existing.releases || []), ...(update.releases || [])]
          allReleases.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
          // 去重（按 tagName）
          const seen = new Set<string>()
          existing.releases = allReleases.filter(r => {
            if (seen.has(r.tagName)) return false
            seen.add(r.tagName)
            return true
          })
        }
        // 更新时间取最新的
        if (update.updateTime > existing.updateTime) {
          existing.updateTime = update.updateTime
        }
      }
    }
    
    // 应用 maxUpdatesPerRepo 限制：每个仓库最多保留最新的 n 条更新
    const maxPerRepo = this.config.maxUpdatesPerRepo ?? 1
    return Array.from(mergedByRepo.values()).map(update => {
      if (update.type === 'commits' && update.commits && update.commits.length > maxPerRepo) {
        return {
          ...update,
          commits: update.commits.slice(0, maxPerRepo),
        }
      }
      if (update.type === 'releases' && update.releases && update.releases.length > maxPerRepo) {
        return {
          ...update,
          releases: update.releases.slice(0, maxPerRepo),
        }
      }
      return update
    })
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
