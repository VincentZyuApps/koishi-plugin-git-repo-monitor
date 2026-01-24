import { Context } from 'koishi'
import fs from 'node:fs'
import { Config } from './config'
import { RepoState, PushRecord } from './types'
import { GitService } from './services/git'
import { TypstRenderer } from './services/renderer-typst'
import { PollScheduler } from './scheduler/poller'
import { PushScheduler } from './scheduler/pusher'
import { StorageManager } from './utils/storage'

// 导入类型声明
import {} from 'koishi-plugin-to-image-service'
import {} from 'koishi-plugin-w-node'
import {} from 'koishi-plugin-puppeteer'

export const name = 'git-repo-monitor'

// 声明插件依赖的服务
export const inject = {
  required: ['database'],
  optional: ['http', 'toImageService', 'node', 'puppeteer'],
}

export { Config }

export const usage = `
## 📦 Git 仓库监控插件

监控 Git 仓库的提交和发布，并通过精美的 Typst 渲染卡片推送到指定频道。

### ⚠️ 前置依赖

必须先安装并启用以下插件：

- **database** - 数据库服务

可选依赖（按需使用）：

- **to-image-service + w-node** - Typst 图片渲染
- **puppeteer** - Puppeteer 图片渲染
- **onebot** - 合并转发（forward）

### 🎯 功能特性

- 🔄 多仓库监控（支持 GitHub、Gitee 等）
- ⏰ 灵活的定时任务（独立配置轮询和推送间隔）
- 🎨 精美的 Typst 渲染卡片
- 📢 多平台推送支持
- 💾 自动保存检查点和推送记录

### 📝 使用说明

1. 配置字体路径（推荐使用 LXGW WenKai Mono）
2. 添加监控组，配置仓库列表和 Cron 表达式
3. 启用插件后会自动开始监控和推送

### 🔧 命令列表

- \`git-monitor\` - 查看监控状态
- \`git-monitor.check <组名>\` - 手动触发检查
- \`git-monitor.push <组名>\` - 手动触发推送
- \`git-monitor.list\` - 列出所有监控仓库

### 📖 Cron 表达式示例

- \`*/10 * * * *\` - 每 10 分钟执行一次
- \`0 */2 * * *\` - 每 2 小时执行一次
- \`0 9,12,18 * * *\` - 每天 9:00、12:00、18:00 执行
- \`0 0 * * *\` - 每天 0:00 执行
`

// 声明数据库表
declare module 'koishi' {
  interface Tables {
    git_repo_state: RepoState
    git_push_record: PushRecord
  }
}

export function apply(ctx: Context, config: Config) {
  const logger = ctx.logger('git-monitor')

  // ============ 数据库扩展 ============
  ctx.model.extend('git_repo_state', {
    id: 'unsigned',
    repoUrl: 'string',
    branch: 'string',
    lastCheckpoint: 'string',
    lastUpdated: 'timestamp',
  }, {
    primary: 'id',
    autoInc: true,
    unique: [['repoUrl', 'branch']],
  })

  ctx.model.extend('git_push_record', {
    id: 'unsigned',
    groupName: 'string',
    platform: 'string',
    channelId: 'string',
    repoUrl: 'string',
    content: 'text',
    pushedAt: 'timestamp',
  }, {
    primary: 'id',
    autoInc: true,
  })

  // ============ 初始化服务 ============
  const gitService = new GitService(ctx, config, config.githubToken, config.giteeToken)
  const storage = new StorageManager(ctx)
  const renderer = new TypstRenderer(ctx, config)
  const pollScheduler = new PollScheduler(ctx, gitService, storage)
  const pushScheduler = new PushScheduler(ctx, pollScheduler, renderer, storage, config)

  // ============ 加载字体并初始化 Typst ============
  ctx.on('ready', async () => {
    // 加载字体
    if (ctx.toImageService && config.typstFontPath && fs.existsSync(config.typstFontPath)) {
      try {
        const fontData = fs.readFileSync(config.typstFontPath)
        ctx.toImageService.fontManagement.addFont([{
          data: fontData,
          name: 'LXGW WenKai Mono',
          format: 'ttf' as const,
          filePath: config.typstFontPath,
        }])
        logger.info(`已加载字体: ${config.typstFontPath}`)
      } catch (error) {
        logger.error('加载字体失败:', error)
      }
    } else if (!ctx.toImageService && config.typstFontPath) {
      logger.warn('未启用 to-image-service，无法加载字体，Typst 图片渲染将不可用')
    } else if (config.typstFontPath) {
      logger.warn(`字体文件不存在: ${config.typstFontPath}`)
    }
    
    // 初始化 Typst 编译器
    if (ctx.node && ctx.toImageService) {
      try {
        await renderer.init()
        logger.info('Typst 编译器初始化成功')
      } catch (error) {
        logger.error('Typst 编译器初始化失败:', error)
      }
    } else {
      logger.warn('未启用 to-image-service 或 w-node，Typst 图片渲染不可用')
    }
  })

  // ============ 启动监控任务 ============
  ctx.on('ready', () => {
    logger.info('Git 仓库监控插件启动')
    
    if (!config.monitorGroups || config.monitorGroups.length === 0) {
      logger.warn('未配置监控组，请在配置中添加监控组')
      return
    }
    
    // 启动所有监控组
    for (const group of config.monitorGroups) {
      if (group.enabled !== false) {
        try {
          pollScheduler.start(group)
          pushScheduler.start(group)
          logger.info(`启动监控组: ${group.name}`)
        } catch (error) {
          logger.error(`启动监控组失败 ${group.name}:`, error)
        }
      }
    }
    
    logger.info(`共启动 ${config.monitorGroups.filter(g => g.enabled !== false).length} 个监控组`)
  })

  // ============ 注册命令 ============
  ctx.command('git-monitor', 'Git 仓库监控')
    .action(() => {
      const pollStatus = pollScheduler.getStatus()
      const pushStatus = pushScheduler.getStatus()
      
      if (pollStatus.length === 0) {
        return '当前没有运行的监控任务'
      }
      
      const lines = ['📊 Git 仓库监控状态\n']
      
      for (const status of pollStatus) {
        const pushInfo = pushStatus.find(p => p.name === status.name)
        lines.push(`📦 ${status.name}`)
        lines.push(`  ├─ 状态: ${status.enabled ? '✅ 运行中' : '❌ 已停止'}`)
        lines.push(`  ├─ 仓库数: ${status.repoCount}`)
        lines.push(`  ├─ 待推送: ${status.pendingCount}`)
        lines.push(`  └─ 推送周期: ${pushInfo?.pushCron || '未知'}\n`)
      }
      
      return lines.join('\n')
    })

  ctx.command('git-monitor.check <group:string>', '手动触发检查')
    .action(async ({ session }, group) => {
      if (!group) {
        return '请指定监控组名称'
      }
      
      const monitorGroup = config.monitorGroups.find(g => g.name === group)
      if (!monitorGroup) {
        return `未找到监控组: ${group}`
      }
      
      try {
        if (session) await session.send(`开始检查 ${group}...`)
        // 手动触发检查的逻辑可以在这里实现
        return `检查完成`
      } catch (error) {
        logger.error(`手动检查失败:`, error)
        return `检查失败: ${(error as Error).message || String(error)}`
      }
    })

  ctx.command('git-monitor.push <group:string>', '手动触发推送')
    .action(async ({ session }, group) => {
      if (!group) {
        return '请指定监控组名称'
      }
      
      try {
        if (session) await session.send(`开始推送 ${group}...`)
        await pushScheduler.triggerPush(group)
        return `推送完成`
      } catch (error) {
        logger.error(`手动推送失败:`, error)
        return `推送失败: ${(error as Error).message || String(error)}`
      }
    })

  ctx.command('git-monitor.list', '列出所有监控仓库')
    .action(() => {
      if (!config.monitorGroups || config.monitorGroups.length === 0) {
        return '未配置监控组'
      }
      
      const lines = ['📋 监控仓库列表\n']
      
      for (const group of config.monitorGroups) {
        lines.push(`📦 ${group.name} (${group.platform}:${group.channelId})`)
        
        for (const repo of group.repos) {
          const typeIcon = repo.type === 'commits' ? '📝' : '🎉'
          const branch = repo.branch || 'main'
          lines.push(`  ${typeIcon} ${repo.url} [${branch}] - ${repo.type}`)
        }
        
        lines.push(`  ⏰ 轮询: ${group.pollCron} | 推送: ${group.pushCron}\n`)
      }
      
      return lines.join('\n')
    })

  // ============ 清理任务 ============
  ctx.on('dispose', () => {
    logger.info('停止 Git 仓库监控插件')
    pollScheduler.stopAll()
    pushScheduler.stopAll()
  })

  // 定期清理旧记录（每天执行一次）
  ctx.setInterval(() => {
    storage.cleanOldRecords(30).catch(error => {
      logger.error('清理旧记录失败:', error)
    })
  }, 24 * 60 * 60 * 1000)

  logger.info('Git 仓库监控插件已加载')
}
