import { Context, Session, h } from 'koishi'
import fs from 'node:fs'
import { Config } from './config'
import { RepoState, PushRecord, DiscoverSource, GitCommit } from './types'
import { GitService } from './services/git'
import { TypstRenderer } from './services/renderer-typst'
import { PollScheduler } from './scheduler/poller'
import { PushScheduler } from './scheduler/pusher'
import { StorageManager } from './utils/storage'
import { RepoDiscoverer } from './services/discover'

// 导入类型声明
import {} from 'koishi-plugin-to-image-service'
// import {} from 'koishi-plugin-typst-to-image-service'  // 暂时注释掉，模块不存在
import {} from 'koishi-plugin-w-node'
import {} from 'koishi-plugin-puppeteer'

export const name = 'git-repo-monitor'

// 声明插件依赖的服务
export const inject = {
  required: ['database'],
  optional: ['http', 'toImageService', 'typstToImageService', 'node', 'puppeteer'],
}

export { Config }


export const usage = `
## 📦 Git 仓库监控插件

监控 Git 仓库的提交和发布，并通过精美的 Typst 渲染卡片推送到指定频道。

> ⚠️ **注意：每个监控组的名称（name）必须唯一！** 监控组名称是系统内部的唯一标识符，用于任务调度、指令查找和数据库存储。若存在重名，插件启动时将仅保留第一个，后续同名监控组会被忽略。

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
  <td><code>git-monitor.discover &lt;urls&gt; [-n name] [--no-sync]</code></td>
  <td>从 GitHub/Gitee 用户或组织创建动态监控组<br>
  • <code>-n &lt;名称&gt;</code>: 指定组名<br>
  • <code>--no-sync</code>: 创建后不同步仓库列表</td>
  <td><code>git-monitor.discover https://github.com/owner1</code><br><code>git-monitor.discover https://github.com/owner1 -n my-group</code></td>
</tr>
<tr>
  <td><code>git-monitor.dryrun [-n count]</code></td>
  <td>使用硬编码假数据测试推送<br>
  • <code>-n &lt;数量&gt;</code>: 指定仓库数量 (1-30)<br>
  • 默认 15 个仓库</td>
  <td><code>git-monitor.dryrun</code><br><code>git-monitor.dryrun -n 20</code></td>
</tr>
<tr>
  <td><code>git-monitor.inspect &lt;组名&gt; [-p page] [-l limit] [-s sort] [-v]</code></td>
  <td>查看监控组仓库详情<br>
  • <code>-p &lt;页码&gt;</code>: 页码 (默认1)<br>
  • <code>-l &lt;数量&gt;</code>: 每页条数 (默认10)<br>
  • <code>-s &lt;方式&gt;</code>: time-desc(默认)/time-asc/alpha-asc/alpha-desc<br>
  • <code>-v</code>: 显示最新 commit 详情</td>
  <td><code>git-monitor.inspect qwq</code><br><code>git-monitor.inspect qwq -p 2 -l 20 -s alpha-asc</code></td>
</tr>
<tr>
  <td><code>git-monitor.list [--verbose]</code></td>
  <td>列出所有监控组概要<br>
  • <code>--verbose</code>: 显示全部仓库详情（⚠️可能超限）</td>
  <td><code>git-monitor.list</code><br><code>git-monitor.list --verbose</code></td>
</tr>
<tr>
  <td><code>git-monitor.push &lt;组名&gt; [-m mode]</code></td>
  <td>手动触发推送<br>
  • <code>-m new</code> (默认): 仅推送新更新<br>
  • <code>-m last</code>: 强制推送最新状态</td>
  <td><code>git-monitor.push qwq</code><br><code>git-monitor.push qwq -m last</code></td>
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

**🔗 相关资源：**

- [【Crontab Guru】 - https://crontab.guru/](https://crontab.guru/) - 在线 Cron 表达式编辑器和可视化工具
- [【Cronitor Cron Jobs Guide】 - https://cronitor.io/guides/cron-jobs](https://cronitor.io/guides/cron-jobs) - Cron 任务完整指南
- [【Man Page: crontab(5)】 - https://man7.org/linux/man-pages/man5/crontab.5.html](https://man7.org/linux/man-pages/man5/crontab.5.html) - Crontab 官方文档
- [【Wikipedia: Cron】 - https://en.wikipedia.org/wiki/Cron](https://en.wikipedia.org/wiki/Cron) - Cron 维基百科
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
  const pollLogger = ctx.logger('git-monitor:轮询触发:poll')
  const pushLogger = ctx.logger('git-monitor:指令触发:push')

  // ============ 监控组名称去重检查 ============
  {
    const seen = new Set<string>()
    const duplicates: string[] = []
    const deduped: typeof config.monitorGroups = []
    for (const group of config.monitorGroups ?? []) {
      if (seen.has(group.name)) {
        duplicates.push(group.name)
      } else {
        seen.add(group.name)
        deduped.push(group)
      }
    }
    if (duplicates.length > 0) {
      logger.warn(`⚠️ 检测到重复的监控组名称: [${duplicates.join(', ')}]，重复的监控组已被忽略，仅保留首次出现的配置。请确保每个监控组名称唯一！`)
      config.monitorGroups = deduped
    }
  }

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
  const discoverer = new RepoDiscoverer(ctx, config)
  const pollScheduler = new PollScheduler(ctx, gitService, storage, config, discoverer)
  const pushScheduler = new PushScheduler(ctx, pollScheduler, renderer, storage, config, discoverer)

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

  // ============ 动态发现组校验 ============
  if (config.discoverGroups?.length) {
    const mgNames = new Set((config.monitorGroups || []).map((g: any) => g.name))
    for (const dg of config.discoverGroups) {
      if (!mgNames.has(dg.name)) {
        logger.error(`❌ 动态发现组 "${dg.name}" 未找到同名的监控组！请确保「动态发现组配置」中的 name 与「监控组列表」中的某个 name 完全一致`)
      }
    }
  }

  // ============ 启动监控任务 ============
  ctx.on('ready', async () => {
    logger.info('Git 仓库监控插件启动')

    // 同步动态发现组
    if (config.discoverGroups?.length) {
      logger.info(`检测到 ${config.discoverGroups.length} 个动态发现组，开始同步仓库列表...`)
      await discoverer.syncAllDiscoverGroups()
    }
    
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
        const newCount = await pollScheduler.triggerCheck(monitorGroup)
        return formatCommandReply(session, `✅ 检查完成，发现 ${newCount} 个新更新`)
      } catch (error) {
        logger.error(`手动检查失败:`, error)
        return formatCommandReply(session, `❌ 检查失败: ${(error as Error).message || String(error)}`)
      }
    })

  ctx.command('git-monitor.push <group:string>', '手动触发推送')
    .option('mode', '-m <mode:string> 推送模式：last (最新状态) 或 new (新增)')
    .action(async ({ session, options }, group) => {
      if (!group) {
        return formatCommandReply(session, '请指定监控组名称')
      }
      
      const verboseLog = config.verboseSessionLog
      const quoteContext = buildQuoteContext(session)
      const sessionChannel = session ? {
        platform: session.platform,
        channelId: String(session.channelId)
      } : undefined
      const mode = (options?.mode as 'new' | 'last') || config.defaultPushMode
      try {
        if (verboseLog && session) {
          await session.send(formatCommandReply(session, `📤 开始推送 ${group} (模式: ${mode})...`))
        }
        await pushScheduler.triggerPush(group, mode, { quoteContext, sessionChannel })
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

  ctx.command('git-monitor.list', '列出所有监控仓库（不建议使用--verbose参数，可能超出平台消息长度限制）')
    .option('verbose', '--verbose 显示完整仓库列表')
    .action(({ session, options }) => {
      if (!config.monitorGroups || config.monitorGroups.length === 0) {
        return formatCommandReply(session, '未配置监控组')
      }
      
      const verbose = options?.verbose
      const lines = ['📋 监控仓库列表\n']
      
      for (const group of config.monitorGroups) {
        const targets = group.pushTargets
          .filter((t: any) => t.enabled !== false)
          .map((t: any) => `{${t.platform}:${t.channelId}}`)
          .join(', ')
        lines.push(`📦 ${group.name} → [${targets || '无推送目标'}]`)
        
        if (verbose) {
          for (const repo of group.repos) {
            const typeIcon = repo.type === 'commits' ? '📝' : '🎉'
            const branch = repo.branch || 'main'
            lines.push(`  ${typeIcon} ${repo.url} [${branch}] - ${repo.type}`)
          }
        }
        
        lines.push(`  📊 仓库总数: ${group.repos.length}`)
        lines.push(`  ⏰ 轮询: ${group.pollCron} | 推送: ${group.pushCron}\n`)
      }
      
      return formatCommandReply(session, lines.join('\n'))
    })

  ctx.command('git-monitor.inspect <group:string>', '查看监控组仓库详细信息')
    .option('page', '-p <page:number> 页码', { fallback: 1 })
    .option('limit', '-l <limit:number> 每页显示数量', { fallback: 10 })
    .option('sort', '-s <sort:string> 排序方式：time-desc(默认)/time-asc/alpha-asc/alpha-desc')
    .option('verbose', '-v 显示最新 commit 详情（时间/hash/作者/统计/消息）')
    .action(async ({ session, options }, group) => {
      if (!group) {
        return formatCommandReply(session, '请指定监控组名称')
      }

      const monitorGroup = config.monitorGroups.find((g: any) => g.name === group)
      if (!monitorGroup) {
        return formatCommandReply(session, `❌ 未找到监控组: ${group}`)
      }

      const sortOrder = (options?.sort as string) || 'time-desc'
      const sortedRepos = [...monitorGroup.repos].sort((a: any, b: any) => {
        switch (sortOrder) {
          case 'alpha-asc':  return a.url.localeCompare(b.url)
          case 'alpha-desc': return b.url.localeCompare(a.url)
          case 'time-asc':   return 1
          case 'time-desc':
          default:           return -1
        }
      })

      const page = Math.max(1, Number(options?.page) || 1)
      const limit = Math.max(1, Math.min(100, Number(options?.limit) || 10))
      const totalRepos = sortedRepos.length
      const totalPages = Math.ceil(totalRepos / limit) || 1
      const clampedPage = Math.min(page, totalPages)
      const startIdx = (clampedPage - 1) * limit
      const pagedRepos = sortedRepos.slice(startIdx, startIdx + limit)

      const verbose = options?.verbose
      let latestCommits: (GitCommit | null)[] = []
      if (verbose) {
        latestCommits = await Promise.all(
          pagedRepos.map(async (repo: any) => {
            try {
              const commits = await gitService.getCommits(repo.url, repo.branch || 'main')
              return commits[0] || null
            } catch {
              return null
            }
          })
        )
      }

      const targets = monitorGroup.pushTargets
        .filter((t: any) => t.enabled !== false)
        .map((t: any) => `{${t.platform}:${t.channelId}}`)
        .join(', ')

      const lines = [`📋 监控组详情: ${group}\n`]
      lines.push(`📦 ${group} → [${targets || '无推送目标'}]`)
      lines.push(`✅ 状态: ${monitorGroup.enabled !== false ? '启用' : '已禁用'}`)
      lines.push(`📊 仓库总数: ${totalRepos}`)
      lines.push(`⏰ 轮询: ${monitorGroup.pollCron} | 推送: ${monitorGroup.pushCron}\n`)

      lines.push(`📂 仓库列表 (第 ${clampedPage}/${totalPages} 页):`)
      for (let i = 0; i < pagedRepos.length; i++) {
        const repo = pagedRepos[i]
        const typeIcon = repo.type === 'commits' ? '📝' : '🎉'
        const branch = repo.branch || 'main'
        let line = `  ${typeIcon} 🔗${repo.url}🔗 🌿${branch}🌿 ${typeIcon}${repo.type}${typeIcon}`
        if (verbose) {
          const c = latestCommits[i]
          if (c) {
            const time = c.date.toLocaleString('zh-CN', { hour12: false })
            const msg = c.message.length > 30 ? c.message.substring(0, 30) + '…' : c.message
            const stats = c.stats
              ? ` 📊+${c.stats.additions}/-${c.stats.deletions} (${c.stats.files}f)📊`
              : ''
            line += `\n     🕐${time}🕐 #️⃣${c.shortSha}#️⃣ 👤${c.author}👤${stats}`
            line += `\n     💬${msg}💬`
          } else {
            line += '\n     🕐N/A🕐'
          }
        }
        lines.push(line)
      }

      if (totalPages > 1) {
        lines.push(`\n💡 使用 -p <页码> 翻页，-l <数量> 调整每页显示数量`)
      }

      return formatCommandReply(session, lines.join('\n'))
    })

  ctx.command('git-monitor.discover <urls:text>', '从 GitHub/Gitee 用户或组织创建动态监控组')
    .option('name', '-n <name> 指定监控组名称（默认自动生成）')
    .option('no-sync', '--no-sync 创建后不同步仓库列表（下次轮询自动同步）')
    .usage('传入一个或多个 GitHub/Gitee 个人主页或组织主页 URL，用空格隔开\n'
      + '示例：git-monitor.discover https://github.com/owner1 https://gitee.com/owner2')
    .action(async ({ session, options }, urls) => {
      if (!urls) {
        return formatCommandReply(session, '请提供至少一个 GitHub/Gitee 用户或组织 URL')
      }

      const urlList = urls.split(/\s+/).filter(Boolean)
      const sources: { platform: 'github' | 'gitee'; owner: string; url: string }[] = []

      for (const url of urlList) {
        const match = url.match(/(?:https?:\/\/)?(github|gitee)\.(?:com|cn)\/([^\/\s]+)/)
        if (!match) {
          return formatCommandReply(session, `❌ 无法识别的 URL: ${url}\n支持的格式：https://github.com/owner 或 https://gitee.com/owner`)
        }
        const platform = match[1] === 'gitee' ? 'gitee' : 'github'
        sources.push({ platform, owner: match[2], url })
      }

      const ownerNames = sources.map(s => s.owner)
      const groupName = options?.name || ownerNames.join('+')

      if (config.monitorGroups?.some((g: any) => g.name === groupName)) {
        return formatCommandReply(session, `❌ 监控组 "${groupName}" 已存在，请使用不同的名称或删除现有组`)
      }

      // 创建 DiscoverGroup
      const dg: any = {
        name: groupName,
        sources: sources.map(s => ({ platform: s.platform, owner: s.owner })),
        syncRepos: !options?.['no-sync'],
      }

      config.discoverGroups = config.discoverGroups || []
      config.discoverGroups.push(dg)

      // 创建对应的 MonitorGroup
      const mg: any = {
        name: groupName,
        pushTargets: [],
        repos: [],
        pollCron: '0 * * * *',
        pushCron: '0 */12 * * *',
        enabled: true,
      }
      config.monitorGroups = config.monitorGroups || []
      config.monitorGroups.push(mg)

      const sourceSummary = sources.map(s => `${s.platform}/${s.owner}`).join(', ')

      let syncMsg = ''
      if (dg.syncRepos) {
        if (session) await session.send(formatCommandReply(session, `🔍 正在发现 ${sourceSummary} 的仓库...`))
        try {
          const result = await discoverer.syncDiscoverGroup(groupName)
          syncMsg = `\n已同步仓库列表: 新增 ${result.added} 个仓库`
        } catch (error) {
          logger.error(`同步失败:`, error)
          syncMsg = `\n⚠️ 首次同步失败: ${(error as Error).message}`
        }
      }

      ctx.scope.update(config, false)

      try {
        pollScheduler.start(mg)
        pushScheduler.start(mg)
      } catch (error) {
        logger.error(`启动新监控组调度器失败 ${groupName}:`, error)
      }

      return formatCommandReply(session,
        `✅ 已创建动态监控组 "${groupName}"`
        + `\n└─ 🌐 来源: ${sourceSummary}`
        + (syncMsg ? `\n└─ 📦 ${syncMsg.replace(/^[\s\n]*/, '')}` : '')
        + `\n\n使用:`
        + `\n  🚀 \`git-monitor.push ${groupName} -m last\`  → 立即推送查看效果`
        + `\n  📋 \`git-monitor.discover ... --no-sync\`  → 仅创建，不同步`)
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
