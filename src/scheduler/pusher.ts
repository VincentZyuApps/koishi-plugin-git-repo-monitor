import { Context, Logger, h } from 'koishi'
import * as cron from 'node-cron'
import { MonitorGroup } from '../types'
import { PollScheduler } from './poller'
import { TypstRenderer } from '../services/renderer'
import { StorageManager } from '../utils/storage'

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
      await this.pushUpdates(group)
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
  private async pushUpdates(group: MonitorGroup): Promise<void> {
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
      // 使用新的批量渲染方法：将同组所有仓库渲染到一张图片
      const image = await this.renderer.renderBatchUpdates(updates, group.name)
      
      if (!image) {
        this.logger.warn(`没有成功渲染的图片: ${group.name}`)
        return
      }
      
      // 构建消息
      const messages: h[] = []
      
      // 添加文字摘要
      const totalCommits = updates.filter(u => u.type === 'commits').reduce((sum, u) => sum + (u.commits?.length || 0), 0)
      const totalReleases = updates.filter(u => u.type === 'releases').reduce((sum, u) => sum + (u.releases?.length || 0), 0)
      
      let summary = `📢 ${group.name} 监控组更新\n`
      if (totalCommits > 0) summary += `📦 ${totalCommits} 个新提交`
      if (totalReleases > 0) {
        if (totalCommits > 0) summary += ' | '
        summary += `🎉 ${totalReleases} 个新发布`
      }
      
      messages.push(h.text(`${summary}\n`))
      
      // 添加合并后的图片
      messages.push(h.image(image, 'image/png'))
      
      // 推送到所有启用的目标
      for (const target of enabledTargets) {
        try {
          this.logger.info(`推送到 ${target.name} (${target.platform}:${target.channelId})`)
          
          // 发送消息
          await this.sendMessage(target.platform, target.channelId, messages)
          
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

  /**
   * 手动触发推送
   */
  async triggerPush(groupName: string): Promise<void> {
    const job = this.jobs.get(groupName)
    if (!job) {
      throw new Error(`未找到监控组: ${groupName}`)
    }
    
    await this.pushUpdates(job.group)
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
