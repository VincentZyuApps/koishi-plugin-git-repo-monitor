import { Context, Logger, h } from 'koishi'
import * as cron from 'node-cron'
import * as path from 'path'
import { Config, OutputMode } from '../config'
import { MonitorGroup, RepoUpdate, GitCommit, GitRelease, RepoConfig } from '../types'
import { PollScheduler } from './poller'
import { TypstRenderer } from '../services/renderer-typst'
import { StorageManager } from '../utils/storage'
import { writeRepoUpdatesToJson } from '../utils/file-logger'
import { RepoDiscoverer } from '../services/discover'
import { renderTextSummary } from '../services/render-text'
import { renderPuppeteerImage } from '../services/render-puppeteer'
import { buildForwardNodes } from '../services/render-forward'

const MOCK_COMMIT_SUBJECTS = [
  '【测试提交 1】极短占位：修复演示 Bug。',
  '【测试提交 2】这里是一段稍长的演示描述，用于展示行宽效果，包含占位符 >>> lorem-test-002。',
  '【测试提交 3】非常非常长的测试文案，故意堆叠多个片段：加入更多演示数据、同步 mock 依赖、更新截图模板、校准动画时间、添加“这仅是演示”提示，以便瀑布流高度差更明显。',
  '【测试提交 4】中等长度的说明：补齐日志并注入假统计值。',
  '【测试提交 5】短句：简化配置项。',
]

const MOCK_RELEASE_NOTES = [
  '《测试发行版 1》——纯占位：只有一行，验证卡片最小高度。',
  '《测试发行版 2》——中等长度：新增截图占位符、附带 5 条 bullet，用于 forward 卡片排版演示。',
  '《测试发行版 3》——超长文本：此段会连续描述多个“仅供测试”的行为，包括 Dry-run 环境、假数据统计、固定告警文案、演示中的假链接、预设的行高与段落，从而让 Masonry 布局出现明显高低差异。',
]

const HARD_CODED_REPOS: Array<{ displayName: string; owner: string; config: RepoConfig }> = [
  { displayName: '测试仓库 1', owner: '测试组织 · Alpha', config: { url: 'https://example.com/mock/test-repo-1', branch: 'main', type: 'commits' } },
  { displayName: '测试仓库 2', owner: '测试组织 · Beta', config: { url: 'https://example.com/mock/test-repo-2', branch: 'develop', type: 'commits' } },
  { displayName: '测试仓库 3', owner: '测试团队 · Gamma', config: { url: 'https://example.com/mock/test-repo-3', branch: 'main', type: 'commits' } },
  { displayName: '测试仓库 4', owner: '测试团队 · Delta', config: { url: 'https://example.com/mock/test-repo-4', branch: 'release', type: 'commits' } },
  { displayName: '测试仓库 5', owner: '测试发行组 · Echo', config: { url: 'https://example.com/mock/test-repo-5', branch: 'main', type: 'releases' } },
  { displayName: '测试仓库 6', owner: '测试发行组 · Foxtrot', config: { url: 'https://example.com/mock/test-repo-6', branch: 'main', type: 'releases' } },
]

/**
 * 推送任务
 */
interface PushJob {
  group: MonitorGroup
  job: cron.ScheduledTask
}

interface QuoteContext {
  platform: string
  channelId: string
  messageId: string
}

interface PushOptions {
  dryRun?: boolean
  quoteContext?: QuoteContext
  sessionChannel?: { platform: string; channelId: string }
}

/**
 * 推送调度器
 */
export class PushScheduler {
  private jobs: Map<string, PushJob> = new Map()
  private logger: Logger
  
  constructor(
    private ctx: Context,
    private pollScheduler: PollScheduler,
    private renderer: TypstRenderer,
    private storage: StorageManager,
    private config: Config,
    private discoverer?: RepoDiscoverer,
  ) {
    this.logger = ctx.logger('git-monitor:push')
  }

  /**
   * 启动监控组的推送任务
   */
  start(group: MonitorGroup): void {
    if (!group.enabled) {
      return
    }
    
    // 如果已存在任务，先停止
    this.stop(group.name)
    
    this.logger.info(`启动监控组 ${group.name} 的推送任务，Cron: ${group.pushCron}`)
    
    const job = cron.schedule(group.pushCron, async () => {
      await this.pushUpdates(group, 'passive')
    })
    
    this.jobs.set(group.name, {
      group,
      job,
    })
  }

  /**
   * 停止监控组的推送任务
   */
  stop(groupName: string): void {
    const job = this.jobs.get(groupName)
    if (job) {
      job.job.stop()
      this.jobs.delete(groupName)
      this.logger.info(`停止监控组 ${groupName} 的推送任务`)
    }
  }

  /**
   * 停止所有推送任务
   */
  stopAll(): void {
    for (const [name] of this.jobs) {
      this.stop(name)
    }
  }

  /**
   * 推送更新
   */
  private async pushUpdates(
    group: MonitorGroup,
    trigger: 'passive' | 'active',
    specificUpdates?: RepoUpdate[],
    options: PushOptions = {},
  ): Promise<void> {
    const { dryRun = false, quoteContext } = options
    this.logger.debug(`执行推送任务: ${group.name}`)
    
    // 获取待推送的更新
    const updates = specificUpdates || this.pollScheduler.getPendingUpdates(group.name)
    
    if (updates.length === 0) {
      this.logger.debug(`${dryRun ? 'Dry-run 没有可推送的假数据' : '没有待推送的更新'}: ${group.name}`)
      return
    }
    
    if (dryRun) {
      this.logger.info(`Dry-run: 使用 ${updates.length} 条假数据推送 ${group.name}`)
    }

    // 如果是动态发现组，先同步仓库列表
    if (this.discoverer && this.config.discoverGroups?.some((dg: any) => dg.name === group.name && dg.syncRepos !== false)) {
      await this.discoverer.syncDiscoverGroup(group.name)
    }
    
    // 输出仓库信息到 JSON 文件（如果启用了 verboseFileLog）
    if (this.config.verboseFileLog) {
      const logDir = path.join(__dirname, '../../log')
      writeRepoUpdatesToJson(updates, group, this.logger, logDir)
    }
    
    // 获取启用的推送目标
    let enabledTargets = group.pushTargets.filter(target => target.enabled !== false)
    
    // 根据配置决定推送目标（仅对主动触发生效）
    if (trigger === 'active' && options.sessionChannel) {
      const pushTargetMode = this.config.pushCommandTarget || 'both'
      
      if (pushTargetMode === 'current') {
        // 仅推送到当前触发指令的频道
        const currentChannel = options.sessionChannel
        enabledTargets = [{
          name: '当前频道',
          platform: currentChannel.platform,
          channelId: currentChannel.channelId,
          enabled: true
        }]
        this.logger.info(`推送目标模式: current，仅推送到当前频道 ${currentChannel.platform}:${currentChannel.channelId}`)
      } else if (pushTargetMode === 'both') {
        // 同时推送到配置目标和当前频道
        const currentChannel = options.sessionChannel
        const hasCurrentChannel = enabledTargets.some(
          target => target.platform === currentChannel.platform && target.channelId === currentChannel.channelId
        )
        
        if (!hasCurrentChannel) {
          enabledTargets.push({
            name: '当前频道',
            platform: currentChannel.platform,
            channelId: currentChannel.channelId,
            enabled: true
          })
          this.logger.info(`推送目标模式: both，推送到配置目标和当前频道 ${currentChannel.platform}:${currentChannel.channelId}`)
        } else {
          this.logger.info(`推送目标模式: both，当前频道已在配置目标中`)
        }
      } else {
        // configured：仅推送到配置的推送目标
        this.logger.info(`推送目标模式: configured，仅推送到配置目标`)
      }
    }
    
    if (enabledTargets.length === 0) {
      this.logger.warn(`监控组 ${group.name} 没有启用的推送目标`)
      return
    }
    
    this.logger.info(`准备推送 ${updates.length} 个更新到 ${enabledTargets.length} 个目标`)

    // 按配置排序
    const sortedUpdates = [...updates].sort((a, b) => {
      switch (this.config.repoSortOrder) {
        case 'alpha-asc': return a.repo.url.localeCompare(b.repo.url)
        case 'alpha-desc': return b.repo.url.localeCompare(a.repo.url)
        case 'time-asc': return a.updateTime.getTime() - b.updateTime.getTime()
        case 'time-desc':
        default: return b.updateTime.getTime() - a.updateTime.getTime()
      }
    })
    this.logger.debug(`排序方式: ${this.config.repoSortOrder || 'time-desc'}`)

    try {
      const modes = this.resolveOutputModes(trigger)
      this.logger.info(`解析输出模式: ${JSON.stringify({ trigger, selected: trigger === 'active' ? this.config.activeOutputModes : this.config.passiveOutputModes, resolved: modes })}`)

      // 构建消息组（图片分开发送）
      const messageGroups: h[][] = []

      this.logger.info(`开始构建消息，更新数: ${sortedUpdates.length}, 输出模式: ${modes.join(', ')}`)

      // 文字消息（如果有）
      if (modes.includes('text')) {
        const summary = renderTextSummary(sortedUpdates, group.name, this.config)
        messageGroups.push([h.text(summary)])
        this.logger.info(`添加文字消息，长度: ${summary.length}`)
      }

      // Typst 图片（单独一条消息）
      if (modes.includes('typst-image')) {
        try {
          this.logger.info(`开始渲染 Typst 图片，更新数: ${sortedUpdates.length}`)
          const image = await this.renderer.renderBatchUpdates(sortedUpdates, group.name)
          if (image) {
            messageGroups.push([h.image(image, 'image/png')])
            this.logger.info(`Typst 图片渲染成功，大小: ${image.length} bytes`)
          } else {
            this.logger.warn(`Typst 图片渲染返回 null，跳过此输出`)
          }
        } catch (error) {
          this.logger.error(`Typst 渲染异常: ${(error as Error).message}`)
        }
      }

      // Puppeteer 图片（单独一条消息）
      if (modes.includes('puppeteer-image')) {
        try {
          this.logger.info(`开始渲染 Puppeteer 图片，更新数: ${sortedUpdates.length}`)
          const image = await renderPuppeteerImage(this.ctx, this.config, sortedUpdates, group.name)
          if (image) {
            messageGroups.push([h.image(image, 'image/png')])
            this.logger.info(`Puppeteer 图片渲染成功，大小: ${image.length} bytes`)
          } else {
            this.logger.warn(`Puppeteer 图片渲染返回 null，跳过此输出`)
          }
        } catch (error) {
          this.logger.error(`Puppeteer 渲染异常: ${(error as Error).message}`)
        }
      }

      this.logger.info(`消息组构建完成，数量: ${messageGroups.length}`)

      // 推送到所有启用的目标
      for (const target of enabledTargets) {
        const shouldQuoteTarget =
          trigger === 'active'
          && quoteContext
          && quoteContext.platform === target.platform
          && quoteContext.channelId === target.channelId

        try {
          this.logger.info(`推送到 ${target.name} (${target.platform}:${target.channelId})`)
          
          // 发送合并转发（仅支持 OneBot）
          if (modes.includes('forward')) {
            try {
              await this.sendForwardMessage(target.platform, target.channelId, sortedUpdates, group.name)
            } catch (error) {
              this.logger.error(`合并转发异常: ${(error as Error).message}`)
            }
          }

          // 发送普通消息（图片分开发送）
          if (messageGroups.length > 0) {
            for (const messages of messageGroups) {
              // 如果是主动触发且开启了引用，每条消息都引用原消息
              const outboundMessages = shouldQuoteTarget && quoteContext
                ? [h.quote(quoteContext.messageId), ...messages]
                : messages
              await this.sendMessage(target.platform, target.channelId, outboundMessages)
            }
          } else if (!modes.includes('forward')) {
            this.logger.warn(`无可发送的消息内容: ${group.name}`)
          }
          
          // 保存推送记录
          if (!dryRun) {
            for (const update of updates) {
              await this.storage.savePushRecord(
                group.name,
                target.platform,
                target.channelId,
                update.repo.url,
                JSON.stringify({
                  type: update.type,
                  count: update.commits?.length || update.releases?.length || 0,
                  time: update.updateTime.toISOString(),
                }),
              )
            }
          } else {
            this.logger.debug('Dry-run: 跳过推送记录持久化')
          }
          
          this.logger.info(`推送成功: ${target.name}`)
        } catch (error) {
          this.logger.error(`推送失败 ${target.name}:`, error)
        }
      }
      
    } catch (error) {
      this.logger.error(`推送失败 ${group.name}:`, error)
    }
  }

  /**
   * 发送消息到指定平台和频道
   */
  private async sendMessage(platform: string, channelId: string, messages: h[]): Promise<void> {
    // 查找对应的 bot
    const bots = this.ctx.bots.filter(bot => bot.platform === platform)
    
    if (bots.length === 0) {
      throw new Error(`未找到平台 ${platform} 的 bot`)
    }
    
    // 使用第一个可用的 bot
    const bot = bots[0]
    
    // 发送消息
    await bot.sendMessage(channelId, messages)
  }

  private resolveOutputModes(trigger: 'passive' | 'active'): OutputMode[] {
    const selected = trigger === 'active' ? this.config.activeOutputModes : this.config.passiveOutputModes
    const modes: OutputMode[] = []

    if (selected.includes('text')) modes.push('text')

    if (selected.includes('typst-image')) {
      if (!this.ctx.toImageService || !this.ctx.node) {
        this.logger.warn('未启用 to-image-service 或 w-node，无法使用 Typst 图片渲染')
      } else {
        modes.push('typst-image')
      }
    }

    if (selected.includes('puppeteer-image')) {
      if (!this.ctx.puppeteer) {
        this.logger.warn('未启用 puppeteer，无法使用 Puppeteer 图片渲染')
      } else {
        modes.push('puppeteer-image')
      }
    }

    if (selected.includes('forward')) modes.push('forward')

    if (modes.length === 0) {
      this.logger.warn('未配置可用的输出形式，自动回退为文字消息')
      return ['text']
    }

    return modes
  }

  private async sendForwardMessage(platform: string, channelId: string, updates: RepoUpdate[], groupName: string): Promise<void> {
    if (platform !== 'onebot') {
      this.logger.warn(`合并转发仅支持 OneBot，已跳过平台 ${platform}`)
      return
    }

    const bots = this.ctx.bots.filter(bot => bot.platform === platform)
    if (bots.length === 0) {
      this.logger.warn('未找到 OneBot 平台，无法发送合并转发')
      return
    }

    const bot = bots[0] as any
    if (!bot.internal?._request) {
      this.logger.warn('当前 OneBot 适配器不支持 internal._request，发送合并转发失败捏')
      return
    }

    const groupId = parseInt(channelId, 10)
    if (Number.isNaN(groupId)) {
      this.logger.warn(`无法解析 OneBot 群号: ${channelId}`)
      return
    }

    const nodes = buildForwardNodes(updates, groupName, this.config)
    const messages = nodes.map(node => ({
      type: 'node',
      data: {
        name: node.name,
        uin: String(bot.selfId ?? '0'),
        content: node.content,
      },
    }))

    await bot.internal._request('send_group_forward_msg', {
      group_id: groupId,
      messages,
    })
  }

  /**
   * 手动触发推送
   */
  async triggerPush(groupName: string, mode: 'new' | 'last' = 'new', options: PushOptions = {}): Promise<void> {
    const job = this.jobs.get(groupName)
    if (!job) {
      throw new Error(`未找到监控组: ${groupName}`)
    }
    
    if (mode === 'last') {
      this.logger.info(`last 模式: 获取 ${job.group.name} 的所有仓库最新状态`)
      const updates = await this.pollScheduler.fetchLatestUpdates(job.group, this.ctx.logger('git-monitor:指令触发:push'))
      this.logger.info(`last 模式: 获取到 ${updates.length} 个更新`)
      await this.pushUpdates(job.group, 'active', updates, options)
    } else {
      await this.pushUpdates(job.group, 'active', undefined, options)
    }
  }

  async triggerDryRun(repoCount = 15, options: PushOptions = {}): Promise<void> {
    const jobs = Array.from(this.jobs.values())
    if (jobs.length === 0) {
      throw new Error('当前没有运行中的监控组，无法执行 Dry-run')
    }

    const count = Math.max(1, Math.min(repoCount, 30))
    const updates = this.buildMockUpdates(count)
    for (const { group } of jobs) {
      this.logger.info(`Dry-run: 向监控组 ${group.name} 推送 ${updates.length} 条硬编码示例`)
      await this.pushUpdates(group, 'active', updates, { ...options, dryRun: true })
    }
  }

  private buildMockUpdates(count: number): RepoUpdate[] {
    const updates: RepoUpdate[] = []
    const now = Date.now()
    const maxCommits = Math.max(1, Math.min(this.config.maxCommitsPerPush || 5, 3))

    for (let i = 0; i < count; i++) {
      const repoMeta = HARD_CODED_REPOS[i % HARD_CODED_REPOS.length]
      const repoConfig = repoMeta.config
      const repoName = repoMeta.displayName
      const repoOwner = repoMeta.owner

      if (repoConfig.type === 'commits') {
        const commits: GitCommit[] = []
        for (let c = 0; c < maxCommits; c++) {
          const subject = MOCK_COMMIT_SUBJECTS[(i + c) % MOCK_COMMIT_SUBJECTS.length]
          const date = new Date(now - ((i * 3) + c) * 60 * 1000)
          const shaBase = `${i.toString(16).padStart(4, '0')}${c.toString(16).padStart(3, '0')}`
          const commit: GitCommit = {
            sha: `dryrun-${shaBase}-${Date.now()}`,
            shortSha: `dry${shaBase}`.slice(0, 7),
            message: subject,
            author: `测试开发者 #${((i + c) % 5) + 1}`,
            authorEmail: `tester${((i + c) % 5) + 1}@example.com`,
            date,
            url: `${repoConfig.url.replace(/\/$/, '')}/commit/dryrun-${shaBase}`,
          }

          if (this.config.showStats) {
            commit.stats = {
              files: 1 + ((i + c) % 5),
              additions: 20 + (c * 5),
              deletions: 5 + (c * 3),
            }
          }

          commits.push(commit)
        }

        updates.push({
          repo: repoConfig,
          repoName,
          repoOwner,
          type: 'commits',
          commits,
          updateTime: commits[0].date,
        })
      } else {
        const note = MOCK_RELEASE_NOTES[i % MOCK_RELEASE_NOTES.length]
        const publishedAt = new Date(now - i * 120 * 1000)
        const tag = `test-v${1 + Math.floor(i / 2)}.${i % 4}.${(i + 1) % 3}`
        const release: GitRelease = {
          tagName: tag,
          name: `测试发行版 ${i + 1}`,
          body: `${note}\n\n· 测试字段 A：演示用途\n· 测试字段 B：仅供截图\n· 测试字段 C：不会推送到 GitHub`,
          author: '测试发布机器人',
          publishedAt,
          url: `${repoConfig.url.replace(/\/$/, '')}/releases/${tag}`,
          prerelease: i % 2 === 0,
        }

        updates.push({
          repo: repoConfig,
          repoName,
          repoOwner,
          type: 'releases',
          releases: [release],
          updateTime: release.publishedAt,
        })
      }
    }

    return updates
  }

  /**
   * 获取推送任务状态
   */
  getStatus(): Array<{ name: string; enabled: boolean; pushCron: string }> {
    return Array.from(this.jobs.values()).map(job => ({
      name: job.group.name,
      enabled: job.group.enabled ?? true,
      pushCron: job.group.pushCron,
    }))
  }
}
