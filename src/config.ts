import { Schema } from 'koishi'

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
    .description('监控组名称（用于标识）'),
  pushTargets: Schema.array(PushTargetSchema)
    .required()
    .role('table')
    .description('推送目标列表（可以推送到多个频道）'),
  repos: Schema.array(RepoConfigSchema)
    .required()
    .role('table')
    .description('监听的仓库列表'),
  pollCron: Schema.string()
    .default('*/10 * * * *')
    .description('轮询 Cron 表达式（检查更新频率）'),
  pushCron: Schema.string()
    .default('0 */2 * * *')
    .description('推送 Cron 表达式（推送通知频率）'),
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
  /** 单次推送最大显示提交数 */
  maxCommitsPerPush: number
  /** 监控组列表 */
  monitorGroups: any[]
  /** GitHub API Token（可选，用于提高请求限制） */
  githubToken?: string
  /** Gitee API Token（可选） */
  giteeToken?: string
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
  /** 启用调试日志 */
  debug: boolean
  /** 被动消息触发的输出形式 */
  passiveOutputModes: OutputMode[]
  /** 主动推送触发的输出形式 */
  activeOutputModes: OutputMode[]
  /** Typst 字体路径 */
  typstFontPath: string
  /** Typst 是否启用深色模式 */
  typstDarkMode: boolean
  /** Typst 图片渲染倍率（清晰度） */
  typstRenderScale: number
  /** Puppeteer 字体路径 */
  puppeteerFontPath: string
  /** Puppeteer 是否启用深色模式 */
  puppeteerDarkMode: boolean
  /** Puppeteer 图片渲染倍率（清晰度） */
  puppeteerRenderScale: number
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
      .description('单次推送最大显示提交数'),
  }).description('基础配置'),

  Schema.object({
    monitorGroups: Schema.array(MonitorGroupSchema)
      .role('table')
      .default([])
      .description('监控组列表'),
  }).description('监控配置'),

  Schema.object({
    typstFontPath: Schema.string()
      .default('/home/bawuyinguo/SSoftwareFiles/fonts/LXGWWenKaiMono-Medium.ttf')
      .description('Typst 字体文件绝对路径（推荐使用 LXGW WenKai Mono）'),
    typstDarkMode: Schema.boolean()
      .default(true)
      .description('Typst 启用深色模式（推荐，视觉效果更佳）'),
    typstRenderScale: Schema.number()
      .default(1.3)
      .step(0.1)
      .min(0.5)
      .max(3.0)
      .description('Typst 图片渲染倍率（清晰度/大小），倍率越高图片越大，如果发送失败请调低此值'),
  }).description('Typst 渲染配置（依赖：to-image-service + w-node）'),

  Schema.object({
    puppeteerFontPath: Schema.string()
      .default('/home/bawuyinguo/SSoftwareFiles/fonts/LXGWWenKaiMono-Medium.ttf')
      .description('Puppeteer 字体文件绝对路径（可选，留空则使用默认字体）'),
    puppeteerDarkMode: Schema.boolean()
      .default(true)
      .description('Puppeteer 启用深色模式（推荐，视觉效果更佳）'),
    puppeteerRenderScale: Schema.number()
      .default(1.3)
      .step(0.1)
      .min(0.5)
      .max(3.0)
      .description('Puppeteer 图片渲染倍率（清晰度/大小），倍率越高图片越大，如果发送失败请调低此值'),
  }).description('Puppeteer 渲染配置（依赖：puppeteer）'),

  Schema.object({
    passiveOutputModes: createOutputModeSchema(['text', 'puppeteer-image', 'typst-image', 'forward'])
      .default(['typst-image'])
      .description('被动消息触发：定时推送时的输出形式（可多选）'),
    activeOutputModes: createOutputModeSchema(['text', 'puppeteer-image', 'typst-image', 'forward'])
      .default(['typst-image'])
      .description('主动推送触发：手动指令推送时的输出形式（可多选）'),
  }).description('输出形式配置（可选依赖：puppeteer / to-image-service + w-node / OneBot）'),

  Schema.object({
    githubToken: Schema.string()
      .role('secret')
      .description(`<b>GitHub API Token</b>（<i>强烈建议配置，否则会遇到 403 错误</i>）<br/><br/>
<b>📖 获取步骤：</b><br/>
<b>1.</b> 登录 GitHub → 点击右上角头像<br/>
<b>2.</b> <b>Settings</b> → 左侧菜单最底部 <b>Developer settings</b><br/>
<b>3.</b> <b>Personal access tokens</b> → <b>Tokens (classic)</b><br/>
<b>4.</b> 点击 <b>Generate new token</b> → <b>Generate new token (classic)</b><br/>
<b>5.</b> 填写 Note（如 "Koishi Git Monitor"）<br/>
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
<b>5.</b> 填写描述（如 "Koishi Git Monitor"）<br/>
<b>6.</b> 勾选权限：<b>✓ projects</b>（读取仓库信息）<br/>
<b>7.</b> 点击 <b>「提交」</b><br/>
<b>8.</b> <b>⚠️ 复制生成的 token（只显示一次！）</b><br/>
<b>9.</b> 粘贴到此配置项<br/><br/>
<i>🔗 直达链接：</i> <a href="https://gitee.com/profile/personal_access_tokens" target="_blank">https://gitee.com/profile/personal_access_tokens</a><br/>
<i>💡 访问私有仓库必须配置此 Token，公开仓库可选</i>`),
  }).description('API 配置'),

  Schema.object({
    enableProxy: Schema.boolean()
      .default(false)
      .description('是否启用代理'),
    proxyProtocol: Schema.union([
      Schema.const('http' as const).description('HTTP 代理'),
      Schema.const('https' as const).description('HTTPS 代理'),
      Schema.const('socks4' as const).description('SOCKS4 代理'),
      Schema.const('socks5' as const).description('SOCKS5 代理'),
      Schema.const('socks5h' as const).description('SOCKS5h 代理 (支持远程DNS)'),
    ])
      .role('radio')
      .default('socks5h' as const)
      .description('代理协议'),
    proxyIp: Schema.string()
      .default('127.0.0.1')
      .description('代理的地址，IP 或域名'),
    proxyPort: Schema.number()
      .min(0)
      .max(65535)
      .step(1)
      .default(7891)
      .description('代理的端口 [0, 65535]'),
    userAgent: Schema.string()
      .role('textarea', { rows: [2, 4] })
      .default('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36')
      .description('User-Agent / 用户代理'),
  }).description('网络代理配置'),

  Schema.object({
    debug: Schema.boolean()
      .default(false)
      .description('启用调试日志'),
  }).description('调试选项'),
])
