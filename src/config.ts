import { Schema } from 'koishi'

const exampleRepoList: Array<{ url: string; branch: string; type: 'commits' | 'releases' }> = [
  // 操作系统内核
  { url: 'https://github.com/torvalds/linux', branch: 'master', type: 'commits' },
  // 编程语言 & 运行时
  { url: 'https://github.com/python/cpython', branch: 'main', type: 'commits' },
  { url: 'https://github.com/nodejs/node', branch: 'main', type: 'commits' },
  { url: 'https://github.com/microsoft/TypeScript', branch: 'main', type: 'commits' },
  { url: 'https://github.com/denoland/deno', branch: 'main', type: 'commits' },
  { url: 'https://github.com/rust-lang/rust', branch: 'main', type: 'commits' },
  { url: 'https://github.com/golang/go', branch: 'master', type: 'commits' },
  { url: 'https://github.com/dotnet/runtime', branch: 'main', type: 'commits' },
  { url: 'https://github.com/openjdk/jdk', branch: 'master', type: 'commits' },
  { url: 'https://github.com/JetBrains/kotlin', branch: 'master', type: 'commits' },
  { url: 'https://github.com/apple/swift', branch: 'main', type: 'commits' },
  { url: 'https://github.com/ruby/ruby', branch: 'master', type: 'commits' },
  { url: 'https://github.com/php/php-src', branch: 'master', type: 'commits' },
  // 编译器基础设施
  { url: 'https://github.com/llvm/llvm-project', branch: 'main', type: 'commits' },
  { url: 'https://github.com/gcc-mirror/gcc', branch: 'master', type: 'commits' },
]

const exampleRepoList2: Array<{ url: string; branch: string; type: 'commits' | 'releases' }> = [
  // 浏览器
  { url: 'https://github.com/chromium/chromium', branch: 'main', type: 'commits' },
  { url: 'https://github.com/zen-browser/desktop', branch: 'dev', type: 'commits' },
  { url: 'https://github.com/brave/brave-browser', branch: 'master', type: 'commits' },
  // 前端框架 & 工具
  { url: 'https://github.com/microsoft/TypeScript', branch: 'main', type: 'commits' },
  { url: 'https://github.com/microsoft/vscode', branch: 'main', type: 'commits' },
  { url: 'https://github.com/vuejs/core', branch: 'main', type: 'commits' },
  { url: 'https://github.com/facebook/react', branch: 'main', type: 'commits' },
  { url: 'https://github.com/vercel/next.js', branch: 'canary', type: 'commits' },
  { url: 'https://github.com/vitejs/vite', branch: 'main', type: 'commits' },
  { url: 'https://github.com/webpack/webpack', branch: 'main', type: 'commits' },
  // 容器 & 云原生
  { url: 'https://github.com/docker/compose', branch: 'main', type: 'commits' },
  { url: 'https://github.com/docker/cli', branch: 'master', type: 'commits' },
  { url: 'https://github.com/moby/moby', branch: 'master', type: 'commits' },
  { url: 'https://github.com/kubernetes/kubernetes', branch: 'master', type: 'commits' },
  { url: 'https://github.com/containerd/containerd', branch: 'main', type: 'commits' },
  // 数据库
  { url: 'https://github.com/postgres/postgres', branch: 'master', type: 'commits' },
  { url: 'https://github.com/redis/redis', branch: 'unstable', type: 'commits' },
  { url: 'https://github.com/sqlite/sqlite', branch: 'master', type: 'commits' },
  { url: 'https://github.com/mongodb/mongo', branch: 'master', type: 'commits' },
  { url: 'https://github.com/mysql/mysql-server', branch: 'trunk', type: 'commits' },
  // 基础工具
  { url: 'https://github.com/git/git', branch: 'master', type: 'commits' },
  { url: 'https://github.com/curl/curl', branch: 'master', type: 'commits' },
  { url: 'https://github.com/FFmpeg/FFmpeg', branch: 'master', type: 'commits' },
  { url: 'https://github.com/nginx/nginx', branch: 'master', type: 'commits' },
  { url: 'https://github.com/openssl/openssl', branch: 'master', type: 'commits' },
  { url: 'https://github.com/systemd/systemd', branch: 'main', type: 'commits' },
  // AI & ML
  { url: 'https://github.com/tensorflow/tensorflow', branch: 'master', type: 'commits' },
  { url: 'https://github.com/pytorch/pytorch', branch: 'main', type: 'commits' },
  { url: 'https://github.com/huggingface/transformers', branch: 'main', type: 'commits' },
  { url: 'https://github.com/ggerganov/llama.cpp', branch: 'master', type: 'commits' },
  { url: 'https://github.com/ollama/ollama', branch: 'main', type: 'commits' },
  // 工具 & 面板
  { url: 'https://github.com/astral-sh/uv', branch: 'main', type: 'commits' },
  { url: 'https://github.com/AlistGo/alist', branch: 'main', type: 'commits' },
  { url: 'https://github.com/1Panel-dev/1Panel', branch: 'dev-v2', type: 'commits' },
  { url: 'https://github.com/rustdesk/rustdesk', branch: 'master', type: 'commits' },
]

/**
 * 推送目标配置 Schema
 */
export const PushTargetSchema = Schema.object({
  name: Schema.string()
    .required()
    .description('推送目标名称（用于标识）'),
  platform: Schema.string()
    .required()
    .description('推送平台（如 onebot）'),
  channelId: Schema.string()
    .required()
    .description('频道 ID'),
  enabled: Schema.boolean()
    .default(true)
    .description('是否启用此推送目标'),
}).description('推送目标配置')

/**
 * 仓库配置 Schema
 */
export const RepoConfigSchema = Schema.object({
  url: Schema.string()
    .required()
    .description('仓库 URL（如 https://github.com/owner/repo）'),
  branch: Schema.string()
    .default('main')
    .description('分支名称'),
  type: Schema.union(['commits', 'releases'] as const)
    .default('commits')
    .description('监听类型'),
}).description('仓库配置')

/**
 * 监控组配置 Schema
 */
export const MonitorGroupSchema = Schema.object({
  name: Schema.string()
    .required()
    .description('监控组名称（⚠️ 必须唯一，作为系统内部标识符，重名将导致后续同名组被忽略）'),
  // ↑ name 是核心业务主键：用于 Map 索引、指令查找（git-monitor.check <组名>）、数据库持久化等
  pushTargets: Schema.array(PushTargetSchema)
    .required()
    .role('table')
    .description('推送目标列表（可以推送到多个频道）'),
  repos: Schema.array(RepoConfigSchema)
    .required()
    .default(exampleRepoList)
    .role('table')
    .description('监听的仓库列表'),
  pollCron: Schema.string()
    .default('0 * * * *')
    .description('轮询 Cron 表达式（检查更新频率）<br/>📌 常用示例：<br/>• `* * * * *` - 每分钟<br/>• `*/5 * * * *` - 每 5 分钟<br/>• `*/10 * * * *` - 每 10 分钟<br/>• `*/30 * * * *` - 每 30 分钟<br/>• `0 * * * *` - 每小时（整点）'),
  pushCron: Schema.string()
    .default('0 */12 * * *')
    .description('推送 Cron 表达式（推送通知频率）<br/>📌 常用示例：<br/>• `0 * * * *` - 每小时（整点）<br/>• `0 */2 * * *` - 每 2 小时<br/>• `0 */6 * * *` - 每 6 小时<br/>• `0 */12 * * *` - 每 12 小时<br/>• `0 0 * * *` - 每天 0:00'),
  enabled: Schema.boolean()
    .default(true)
    .description('是否启用此监控组'),
}).description('监控组配置')

/**
 * 输出形式类型
 */
export type OutputMode = 'text' | 'puppeteer-image' | 'typst-image' | 'forward'

// 输出模式的描述映射
const ModeDescriptionMap: Record<OutputMode, string> = {
  text: '📝 文字',
  'puppeteer-image': '🖼️ Puppeteer 图片',
  'typst-image': '🧩 Typst 图片',
  forward: '📨 合并转发（仅支持 OneBot）',
}

// Schema 工厂函数：根据支持的模式列表生成对应的 Schema
function createOutputModeSchema(supportedModes: OutputMode[]) {
  const schemaUnions = supportedModes.map((mode) =>
    Schema.const(mode).description(ModeDescriptionMap[mode])
  )
  return Schema.array(Schema.union(schemaUnions)).role('checkbox')
}

/**
 * 代理协议类型
 */
export type ProxyProtocol = 'http' | 'https' | 'socks4' | 'socks5' | 'socks5h'

/**
 * 插件配置接口
 */
export interface Config {
  // ========== ⚙️ 基础配置 ==========
  /** 单次推送最大显示提交数 */
  maxCommitsPerPush: number
  /** 是否统计行数变化（适用于所有输出模式） */
  showStats: boolean
  /** 是否静默启动 */
  silentStart: boolean
  /** 并行获取仓库数量（设为 1 则串行获取） */
  parallelFetchCount: number

  // ========== ⏰ 被动定时推送配置 ==========
  /** 监控组列表 */
  monitorGroups: any[]
  /** 每个仓库每次推送最多显示的更新条数 */
  maxUpdatesPerRepo: number
  /** 被动消息触发的输出形式 */
  passiveOutputModes: OutputMode[]
  /** 插件启动时是否立即执行一次轮询检查 */
  immediatePollOnStart: boolean

  // ========== 👋 主动指令触发配置 ==========
  /** 主动推送触发的输出形式 */
  activeOutputModes: OutputMode[]
  /** 指令触发的回复是否引用原消息 */
  quoteCommandReplies: boolean
  /** 默认推送模式 */
  defaultPushMode: 'last' | 'new'

  // ========== 🧩 Typst 渲染配置 ==========
  /** Typst 字体路径 */
  typstFontPath: string
  /** Typst 是否启用深色模式 */
  typstDarkMode: boolean
  /** Typst 图片渲染倍率（清晰度） */
  typstRenderScale: number
  /** Typst 底部自定义文案 */
  typstFooterText: string

  // ========== 🖼️ Puppeteer 渲染配置 ==========
  /** Puppeteer 字体路径 */
  puppeteerFontPath: string
  /** Puppeteer 是否启用深色模式 */
  puppeteerDarkMode: boolean
  /** Puppeteer 图片渲染倍率（清晰度） */
  puppeteerRenderScale: number
  /** Puppeteer 图片类型 */
  puppeteerImageType: 'png' | 'jpeg' | 'webp'
  /** Puppeteer 图片质量 */
  puppeteerImageQuality: number
  /** Puppeteer 渲染列数 */
  puppeteerColumnCount: number
  /** Puppeteer 布局模式 */
  puppeteerLayoutMode: 'masonry' | 'equalized-row' | 'top-aligned'
  /** Puppeteer 卡片铺排顺序 */
  puppeteerFlowDirection: 'row-first' | 'column-first'
  /** Puppeteer 瀑布流贪心重排 */
  puppeteerMasonryGreedy: boolean
  /** Puppeteer 底部自定义文案 */
  puppeteerFooterText: string

  // ========== 🔑 API 配置 ==========
  /** GitHub API Token（可选，用于提高请求限制） */
  githubToken?: string
  /** Gitee API Token（可选） */
  giteeToken?: string

  // ========== 🌐 网络代理配置 ==========
  /** 是否启用代理 */
  enableProxy: boolean
  /** 代理协议 */
  proxyProtocol: ProxyProtocol
  /** 代理地址 */
  proxyIp: string
  /** 代理端口 */
  proxyPort: number
  /** User-Agent */
  userAgent: string

  // ========== 🛠️ 调试选项 ==========
  /** 启用调试日志 */
  verboseConsoleLog: boolean
  /** 是否输出会话 verbose 日志 */
  verboseSessionLog: boolean
}

/**
 * 插件配置 Schema
 */
export const Config: Schema<Config> = Schema.intersect([
  Schema.object({
    maxCommitsPerPush: Schema.number()
      .min(1)
      .max(50)
      .default(10)
      .description('🔢 单次推送最大显示提交数'),
    showStats: Schema.boolean()
      .default(true)
      .description('📊 是否显示代码行数变化统计（+/-），适用于所有输出模式（文字/图片/转发），可能会增加 API 请求耗时'),
    silentStart: Schema.boolean()
      .default(true)
      .description('🤫 静默启动（首次运行不推送）。⚠️ 若设为 false，插件启动时可能会将新添加仓库的当前状态视为更新并推送，导致消息刷屏。'),
    parallelFetchCount: Schema.number()
      .min(1)
      .max(1024)
      .default(8)
      .description('🔀 并行获取仓库数量（设为 1 则串行获取，可加快轮询速度）'),
  }).description('⚙️ 基础配置'),

  Schema.object({
    monitorGroups: Schema.array(MonitorGroupSchema)
      .role('table')
      .default([
        {
          name: 'qwq',
          pushTargets: [
            { name: 'qwq-channel-1', platform: 'onebot', channelId: '1085190201', enabled: true },
            { name: 'qwq-channel-2', platform: 'onebot', channelId: '958366323',  enabled: true },
          ],
          repos: exampleRepoList,
          pollCron: '0 * * * *',
          pushCron: '0 */12 * * *',
          enabled: true,
        },
        {
          name: 'awa',
          pushTargets: [
            { name: 'awa-channel-1', platform: 'onebot', channelId: '1085190201', enabled: true },
            { name: 'awa-channel-2', platform: 'onebot', channelId: '958366323',  enabled: true },
          ],
          repos: exampleRepoList2,
          pollCron: '0 * * * *',
          pushCron: '0 */12 * * *',
          enabled: true,
        },
      ])
      .description('📋 监控组列表'),
    maxUpdatesPerRepo: Schema.number()
      .min(1)
      .max(99)
      .default(1)
      .description('🗂️ 每个仓库每次推送最多显示的更新条数（如 Chromium 等频繁更新的仓库，可限制只推送最新的 n 条）'),
    passiveOutputModes: createOutputModeSchema(['text', 'puppeteer-image', 'typst-image', 'forward'])
      .default(['puppeteer-image', 'forward'])
      .description('📤 定时推送时的输出形式（可多选）'),
    immediatePollOnStart: Schema.boolean()
      .default(false)
      .description('⏯️ 插件启动时是否立即执行一次轮询检查'),
  }).description('⏰ 被动定时推送配置'),

  Schema.object({
    activeOutputModes: createOutputModeSchema(['text', 'puppeteer-image', 'typst-image', 'forward'])
      .default(['puppeteer-image', 'typst-image', 'forward'])
      .description('📤 指令触发时的输出形式（可多选）'),
    quoteCommandReplies: Schema.boolean()
      .default(true)
      .description('💬 是否引用触发消息发送回复（forward 输出不支持引用）'),
    defaultPushMode: Schema.union([
      Schema.const('last').description('🔄 last：强制推送所有仓库的最新状态（无论是否有新更新）'),
      Schema.const('new') .description('✨ new：仅推送自上次检查以来的新增更新'),
    ])
      .role('radio')
      .default('last')
      .description('🎯 git-monitor.push 指令的默认推送模式（未指定 -m 参数时使用）'),
  }).description('👋 主动指令触发配置'),

  Schema.object({
    typstFontPath: Schema.string()
      .default('/home/bawuyinguo/SSoftwareFiles/fonts/LXGWWenKaiMono-Medium.ttf')
      .role('textarea', { rows: [2, 5] })
      .description('🔡 Typst 字体文件绝对路径（推荐使用 LXGW WenKai Mono）'),
    typstDarkMode: Schema.boolean()
      .default(false)
      .experimental()
      .disabled()
      .description('🌓 Typst 启用深色模式（推荐，视觉效果更佳）</br> <i> 黑色模式还有些问题(</i> '),
    typstRenderScale: Schema.number()
      .default(1.3)
      .step(0.1)
      .min(0.5)
      .max(3.0)
      .description('🔍 Typst 图片渲染倍率（清晰度/大小），倍率越高图片越大，如果发送失败请调低此值'),
    typstFooterText: Schema.string()
      .default('generated by koishi-plugin-git-repo-monitor')
      .description('📝 Typst 底部自定义文案'),
  }).description('🧩 Typst 渲染配置（依赖：to-image-service + w-node）'),

  Schema.object({
    puppeteerFontPath: Schema.string()
      .default('/home/bawuyinguo/SSoftwareFiles/fonts/LXGWWenKaiMono-Medium.ttf')
      .description('🔡 Puppeteer 字体文件绝对路径（可选，留空则使用默认字体）'),
    puppeteerDarkMode: Schema.boolean()
      .default(true)
      .description('🌓 Puppeteer 启用深色模式（推荐，视觉效果更佳）'),
    puppeteerRenderScale: Schema.number()
      .default(1.3)
      .step(0.1)
      .min(0.5)
      .max(3.0)
      .description('🔍 Puppeteer 图片渲染倍率（清晰度/大小），倍率越高图片越大，如果发送失败请调低此值'),
    puppeteerImageType: Schema.union([
      Schema.const('png').description('🖼️ PNG（不支持调整质量，文件较大）'),
      Schema.const('jpeg').description('🌄 JPEG（支持调整质量，文件较小）'),
      Schema.const('webp').description('🌐 WEBP（支持调整质量，文件最小）'),
    ])
      .role('radio')
      .default('jpeg')
      .description('📤 渲染图片的输出类型'),
    puppeteerImageQuality: Schema.number()
      .min(0).max(100).step(1)
      .default(77)
      .description('📏 Puppeteer 截图质量 (0-100，数字越小文件越小)'),
    puppeteerColumnCount: Schema.number()
      .min(1).max(5).step(1)
      .default(3)
      .description('Layout Puppeteer 渲染列数（默认为1，增加列数会成倍增加图片宽度）'),
    puppeteerLayoutMode: Schema.union([
      Schema.const('masonry').description('模式 1 | 瀑布流 (Masonry)：紧凑排列，无行对齐，只在列数 ≥ 2 时生效'),
      Schema.const('equalized-row').description('模式 2 | 等高行 (Equalized Row)：每行高度与该行最高卡片一致'),
      Schema.const('top-aligned').description('模式 3 | 顶对齐 (Top Aligned)：自然高度，顶对齐排列'),
    ])
      .role('radio')
      .default('masonry')
      .description('Puppeteer 布局模式（默认瀑布流，列数为 1 时不区分效果）'),
    puppeteerFlowDirection: Schema.union([
      Schema.const('row-first').description('选项 1 | 行优先（先从左到右，再从上到下）：逐行填充'),
      Schema.const('column-first').description('选项 2 | 列优先（先从上到下，再从左到右）：逐列填充'),
    ])
      .role('radio')
      .default('row-first')
      .description('Puppeteer 渲染顺序（列数为 1 时无区别）'),
    puppeteerMasonryGreedy: Schema.boolean()
      .default(true)
      .description('🧮 瀑布流贪心重排（仅瀑布流模式生效）：先渲染获取各卡片高度，再用贪心算法重新分配到各列，使列高差最小化'),
    puppeteerFooterText: Schema.string()
      .default('generated by koishi-plugin-git-repo-monitor')
      .description('📝 Puppeteer 底部自定义文案'),
  }).description('🖼️ Puppeteer 渲染配置（依赖：puppeteer）'),

  Schema.object({
    githubToken: Schema.string()
      .role('secret')
      .description(`<b>GitHub API Token</b>（<i>强烈建议配置，否则会遇到 403 错误</i>）<br/><br/>
<b>📖 获取步骤：</b><br/>
<b>1.</b> 登录 GitHub → 点击右上角头像<br/>
<b>2.</b> <b>Settings</b> → 左侧菜单最底部 <b>Developer settings</b><br/>
<b>3.</b> <b>Personal access tokens</b> → <b>Tokens (classic)</b><br/>
<b>4.</b> 点击 <b>Generate new token</b> → <b>Generate new token (classic)</b><br/>
<b>5.</b> 填写 Note（如 "koishi-plugin-git-repo-monitor"）<br/>
<b>6.</b> 选择 Expiration（建议 <b>No expiration</b>）<br/>
<b>7.</b> 勾选权限：<b>✓ public_repo</b>（访问公开仓库）<br/>
<b>8.</b> 点击底部 <b>Generate token</b><br/>
<b>9.</b> <b>⚠️ 复制生成的 token（只显示一次！）</b><br/>
<b>10.</b> 粘贴到此配置项<br/><br/>
<i>🔗 直达链接：</i> <a href="https://github.com/settings/tokens/new" target="_blank">https://github.com/settings/tokens/new</a><br/>
<i>💡 未配置 token 时，GitHub API 限制为每小时 60 次请求；配置后提升至 5000 次</i>`),
    giteeToken: Schema.string()
      .role('secret')
      .description(`<b>Gitee API Token</b>（<i>访问私有仓库必须配置</i>）<br/><br/>
<b>📖 获取步骤：</b><br/>
<b>1.</b> 登录 Gitee → 点击右上角头像<br/>
<b>2.</b> 点击 <b>「设置」</b><br/>
<b>3.</b> 左侧菜单选择 <b>「私人令牌」</b><br/>
<b>4.</b> 点击 <b>「生成新令牌」</b><br/>
<b>5.</b> 填写描述（如 "koishi-plugin-git-repo-monitor"）<br/>
<b>6.</b> 勾选权限：<b>✓ projects</b>（读取仓库信息）<br/>
<b>7.</b> 点击 <b>「提交」</b><br/>
<b>8.</b> <b>⚠️ 复制生成的 token（只显示一次！）</b><br/>
<b>9.</b> 粘贴到此配置项<br/><br/>
<i>🔗 直达链接：</i> <a href="https://gitee.com/profile/personal_access_tokens" target="_blank">https://gitee.com/profile/personal_access_tokens</a><br/>
<i>💡 访问私有仓库必须配置此 Token，公开仓库可选</i>`),
  }).description('🔑 API 配置'),

  Schema.object({
    enableProxy: Schema.boolean()
      .default(false)
      .description('🌐 是否启用代理'),
    proxyProtocol: Schema.union([
      Schema.const('http' as const).description('HTTP 代理'),
      Schema.const('https' as const).description('HTTPS 代理'),
      Schema.const('socks4' as const).description('SOCKS4 代理'),
      Schema.const('socks5' as const).description('SOCKS5 代理'),
      Schema.const('socks5h' as const).description('SOCKS5h 代理 (支持远程DNS)'),
    ])
      .role('radio')
      .default('socks5h' as const)
      .description('🔌 代理协议'),
    proxyIp: Schema.string()
      .default('127.0.0.1')
      .description('🏠 代理的地址，IP 或域名'),
    proxyPort: Schema.number()
      .min(0)
      .max(65535)
      .step(1)
      .default(7891)
      .description('🚪 代理的端口 [0, 65535]'),
    userAgent: Schema.string()
      .role('textarea', { rows: [2, 4] })
      .default('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36')
      .description('🕵️ User-Agent / 用户代理'),
  }).description('🌐 网络代理配置'),

  Schema.object({
    verboseConsoleLog: Schema.boolean()
      .default(false)
      .description('🐛 启用调试日志'),
    verboseSessionLog: Schema.boolean()
      .default(true)
      .description('🗒️ 会话内输出详细提示（如 “开始推送”“推送完成”）'),
  }).description('🛠️ 调试选项'),
])

