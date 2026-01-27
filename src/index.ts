import { Context, Session, h } from 'koishi'
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

<table>
<thead>
<tr><th>指令</th><th>说明</th><th>示例</th></tr>
</thead>
<tbody>
<tr>
  <td><code>git-monitor</code></td>
  <td>查看监控状态</td>
  <td><code>git-monitor</code></td>
</tr>
<tr>
  <td><code>git-monitor.check &lt;组名&gt;</code></td>
  <td>手动触发检查</td>
  <td><code>git-monitor.check qwq</code></td>
</tr>
<tr>
  <td><code>git-monitor.push &lt;组名&gt; [-m mode]</code></td>
  <td>手动触发推送<br>
  • <code>-m new</code> (默认): 仅推送新更新<br>
  • <code>-m last</code>: 强制推送最新状态</td>
  <td><code>git-monitor.push qwq</code><br><code>git-monitor.push qwq -m last</code></td>
</tr>
<tr>
  <td><code>git-monitor.list</code></td>
  <td>列出所有监控仓库</td>
  <td><code>git-monitor.list</code></td>
</tr>
</tbody>
</table>

### 💾 数据库表结构

<h4>1. git_repo_state (仓库状态表)</h4>
<table>
<thead>
<tr><th>字段</th><th>类型</th><th>说明</th></tr>
</thead>
<tbody>
<tr><td>id</td><td>unsigned</td><td>主键自增</td></tr>
<tr><td>repoUrl</td><td>string</td><td>仓库地址</td></tr>
<tr><td>branch</td><td>string</td><td>分支名</td></tr>
<tr><td>lastCheckpoint</td><td>string</td><td>上次检查点 (ISO 时间戳)</td></tr>
<tr><td>lastUpdated</td><td>timestamp</td><td>上次更新时间</td></tr>
</tbody>
</table>
<p><b>⚠️ 注意：</b> <code>repoUrl</code> + <code>branch</code> 组合唯一</p>

<h4>2. git_push_record (推送记录表)</h4>
<table>
<thead>
<tr><th>字段</th><th>类型</th><th>说明</th></tr>
</thead>
<tbody>
<tr><td>id</td><td>unsigned</td><td>主键自增</td></tr>
<tr><td>groupName</td><td>string</td><td>监控组名</td></tr>
<tr><td>platform</td><td>string</td><td>推送平台</td></tr>
<tr><td>channelId</td><td>string</td><td>频道 ID</td></tr>
<tr><td>repoUrl</td><td>string</td><td>仓库地址</td></tr>
<tr><td>content</td><td>text</td><td>推送内容摘要</td></tr>
<tr><td>pushedAt</td><td>timestamp</td><td>推送时间</td></tr>
</tbody>
</table>

### 🔄 更新检测机制 (New 模式)

<ol>
<li><b>基准获取</b>：从 <code>git_repo_state</code> 表读取 <code>lastCheckpoint</code></li>
<li><b>API 请求</b>：向 GitHub/Gitee API 传递 <code>since</code> 参数</li>
<li><b>精准过滤</b>：过滤掉时间 &lt;= 检查点的提交</li>
<li><b>状态更新</b>：推送后更新最新 Commit 时间戳到数据库</li>
<li><b>Silent Start</b>：首次运行默认不推送，仅记录 Checkpoint</li>
</ol>


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
  const pollScheduler = new PollScheduler(ctx, gitService, storage, config)
  const pushScheduler = new PushScheduler(ctx, pollScheduler, renderer, storage, config)

  const formatCommandReply = (session: Session | undefined, content: string) => {
    if (config.quoteCommandReplies && session?.messageId) {
      return `${h.quote(session.messageId)}${content}`
    }
    return content
  }

  const buildQuoteContext = (session: Session | undefined) => {
    if (!config.quoteCommandReplies || !session?.messageId || !session.channelId) {
      return undefined
    }
    return {
      platform: session.platform,
      channelId: String(session.channelId),
      messageId: session.messageId,
    }
  }

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
    .action(({ session }) => {
      const pollStatus = pollScheduler.getStatus()
      const pushStatus = pushScheduler.getStatus()
      
      if (pollStatus.length === 0) {
        return formatCommandReply(session, '当前没有运行的监控任务')
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
      
      return formatCommandReply(session, lines.join('\n'))
    })

  ctx.command('git-monitor.check <group:string>', '手动触发检查')
    .action(async ({ session }, group) => {
      if (!group) {
        return formatCommandReply(session, '请指定监控组名称')
      }
      
      const monitorGroup = config.monitorGroups.find(g => g.name === group)
      if (!monitorGroup) {
        return formatCommandReply(session, `未找到监控组: ${group}`)
      }
      
      try {
        if (session) await session.send(formatCommandReply(session, `🔍 开始检查 ${group}...`))
        // 手动触发检查的逻辑可以在这里实现
        return formatCommandReply(session, '✅ 检查完成')
      } catch (error) {
        logger.error(`手动检查失败:`, error)
        return formatCommandReply(session, `❌ 检查失败: ${(error as Error).message || String(error)}`)
      }
    })

  ctx.command('git-monitor.push <group:string>', '手动触发推送')
    .option('mode', '-m <mode:string> 推送模式：last (最新一条) 或 new (新增)', { fallback: 'new' })
    .action(async ({ session, options }, group) => {
      if (!group) {
        return formatCommandReply(session, '请指定监控组名称')
      }
      
      const verboseLog = config.verboseSessionLog
      const quoteContext = buildQuoteContext(session)
      try {
        if (verboseLog && session) {
          await session.send(formatCommandReply(session, `📤 开始推送 ${group}...`))
        }
        await pushScheduler.triggerPush(group, options?.mode as 'new' | 'last', { quoteContext })
        return formatCommandReply(session, verboseLog ? '✅ 推送完成' : '✅ 完成')
      } catch (error) {
        logger.error(`手动推送失败:`, error)
        return formatCommandReply(session, `❌ 推送失败: ${(error as Error).message || String(error)}`)
      }
    })

  ctx.command('git-monitor.dryrun', '使用硬编码假数据推送用于调试渲染')
    .option('count', '-n <count:number> 假数据仓库数量（1-30）', { fallback: 15 })
    .action(async ({ session, options }) => {
      const rawCount = typeof options?.count === 'number' ? options.count : Number(options?.count)
      const count = Math.max(1, Math.min(Number.isFinite(rawCount) ? rawCount : 15, 30))
      const verboseLog = config.verboseSessionLog
      const quoteContext = buildQuoteContext(session)

      try {
        if (verboseLog && session) {
          await session.send(formatCommandReply(session, `🧪 Dry-run: 使用硬编码示例推送（${count} 个仓库）...`))
        }
        await pushScheduler.triggerDryRun(count, { quoteContext })
        return formatCommandReply(session, verboseLog ? `✅ Dry-run 推送完成（${count} 个示例仓库）` : '✅ 完成')
      } catch (error) {
        logger.error(`Dry-run 推送失败:`, error)
        return formatCommandReply(session, `❌ Dry-run 推送失败: ${(error as Error).message || String(error)}`)
      }
    })

  ctx.command('git-monitor.list', '列出所有监控仓库')
    .action(({ session }) => {
      if (!config.monitorGroups || config.monitorGroups.length === 0) {
        return formatCommandReply(session, '未配置监控组')
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
      
      return formatCommandReply(session, lines.join('\n'))
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
