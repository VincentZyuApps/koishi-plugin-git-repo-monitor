import { Context, Logger, h } from 'koishi'
import * as cron from 'node-cron'
import { Config, OutputMode } from '../config'
import { MonitorGroup, RepoUpdate } from '../types'
import { PollScheduler } from './poller'
import { TypstRenderer } from '../services/renderer-typst'
import { StorageManager } from '../utils/storage'
import { renderTextSummary } from '../services/render-text'
import { renderPuppeteerImage } from '../services/render-puppeteer'
import { buildForwardNodes } from '../services/render-forward'

/**
 * 推送任务
 */
interface PushJob {
  group: MonitorGroup
  job: cron.ScheduledTask
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
  private async pushUpdates(group: MonitorGroup, trigger: 'passive' | 'active'): Promise<void> {
    this.logger.debug(`执行推送任务: ${group.name}`)
    
    // 获取待推送的更新
    const updates = this.pollScheduler.getPendingUpdates(group.name)
    
    if (updates.length === 0) {
      this.logger.debug(`没有待推送的更新: ${group.name}`)
      return
    }
    
    // 获取启用的推送目标
    const enabledTargets = group.pushTargets.filter(target => target.enabled !== false)
    
    if (enabledTargets.length === 0) {
      this.logger.warn(`监控组 ${group.name} 没有启用的推送目标`)
      return
    }
    
    this.logger.info(`准备推送 ${updates.length} 个更新到 ${enabledTargets.length} 个目标`)
    
    try {
      const modes = this.resolveOutputModes(trigger)

      // 构建消息
      const messages: h[] = []

      if (modes.includes('text')) {
        const summary = renderTextSummary(updates, group.name, this.config)
        messages.push(h.text(summary))
      }

      if (modes.includes('typst-image')) {
        const image = await this.renderer.renderBatchUpdates(updates, group.name)
        if (image) {
          messages.push(h.image(image, 'image/png'))
        } else {
          this.logger.warn(`Typst 图片渲染失败: ${group.name}`)
        }
      }

      if (modes.includes('puppeteer-image')) {
        const image = await renderPuppeteerImage(this.ctx, this.config, updates, group.name)
        if (image) {
          messages.push(h.image(image, 'image/png'))
        } else {
          this.logger.warn(`Puppeteer 图片渲染失败: ${group.name}`)
        }
      }

      // 推送到所有启用的目标
      for (const target of enabledTargets) {
        try {
          this.logger.info(`推送到 ${target.name} (${target.platform}:${target.channelId})`)
          
          // 发送合并转发（仅支持 OneBot）
          if (modes.includes('forward')) {
            await this.sendForwardMessage(target.platform, target.channelId, updates, group.name)
          }

          // 发送普通消息
          if (messages.length > 0) {
            await this.sendMessage(target.platform, target.channelId, messages)
          } else if (!modes.includes('forward')) {
            this.logger.warn(`无可发送的消息内容: ${group.name}`)
          }
          
          // 保存推送记录
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
      this.logger.warn('未找到 OneBot 适配器，无法发送合并转发')
      return
    }

    const bot = bots[0] as any
    if (!bot.internal?._request) {
      this.logger.warn('当前 OneBot 适配器不支持 internal._request，无法发送合并转发')
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
  async triggerPush(groupName: string): Promise<void> {
    const job = this.jobs.get(groupName)
    if (!job) {
      throw new Error(`未找到监控组: ${groupName}`)
    }
    
    await this.pushUpdates(job.group, 'active')
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
