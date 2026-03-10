import { Context } from 'koishi'
import { RepoUpdate, PLUGIN_REPO_URL } from '../types'
import { formatTimestamp } from '../utils/format'
import { Config } from '../config'
import type { NodeCompiler, NodeAddFontBlobs } from '@myriaddreamin/typst-ts-node-compiler'
import type { Font, FontFormat } from 'koishi-plugin-to-image-service'

/**
 * GitHub SVG 图标 (白色版本，用于深色主题)
 */
const GITHUB_SVG_WHITE = `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width="16" height="16"><path d="M20.48 503.72608c0 214.4256 137.4208 396.73856 328.94976 463.6672 25.8048 6.5536 21.87264-11.8784 21.87264-24.33024v-85.07392c-148.93056 17.44896-154.86976-81.1008-164.94592-97.52576-20.23424-34.52928-67.91168-43.33568-53.69856-59.76064 33.91488-17.44896 68.48512 4.42368 108.46208 63.61088 28.95872 42.88512 85.44256 35.6352 114.15552 28.4672a138.8544 138.8544 0 0 1 38.0928-66.7648c-154.25536-27.60704-218.60352-121.77408-218.60352-233.79968 0-54.31296 17.94048-104.2432 53.0432-144.54784-22.36416-66.43712 2.08896-123.24864 5.3248-131.6864 63.81568-5.7344 130.00704 45.6704 135.168 49.68448 36.2496-9.78944 77.57824-14.9504 123.82208-14.9504 46.4896 0 88.064 5.3248 124.5184 15.23712 12.288-9.4208 73.80992-53.53472 133.12-48.128 3.15392 8.43776 27.0336 63.93856 6.02112 129.4336 35.59424 40.38656 53.69856 90.76736 53.69856 145.24416 0 112.18944-64.7168 206.4384-219.42272 233.71776a140.0832 140.0832 0 0 1 41.7792 99.9424v123.4944c0.86016 9.87136 0 19.6608 16.50688 19.6608 194.31424-65.49504 334.2336-249.15968 334.2336-465.5104C1002.57792 232.48896 782.66368 12.77952 511.5904 12.77952 240.18944 12.65664 20.48 232.40704 20.48 503.72608z" fill="#ffffff"/></svg>`

/**
 * GitHub SVG 图标 (黑色版本，用于浅色主题)
 */
const GITHUB_SVG_BLACK = `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width="16" height="16"><path d="M20.48 503.72608c0 214.4256 137.4208 396.73856 328.94976 463.6672 25.8048 6.5536 21.87264-11.8784 21.87264-24.33024v-85.07392c-148.93056 17.44896-154.86976-81.1008-164.94592-97.52576-20.23424-34.52928-67.91168-43.33568-53.69856-59.76064 33.91488-17.44896 68.48512 4.42368 108.46208 63.61088 28.95872 42.88512 85.44256 35.6352 114.15552 28.4672a138.8544 138.8544 0 0 1 38.0928-66.7648c-154.25536-27.60704-218.60352-121.77408-218.60352-233.79968 0-54.31296 17.94048-104.2432 53.0432-144.54784-22.36416-66.43712 2.08896-123.24864 5.3248-131.6864 63.81568-5.7344 130.00704 45.6704 135.168 49.68448 36.2496-9.78944 77.57824-14.9504 123.82208-14.9504 46.4896 0 88.064 5.3248 124.5184 15.23712 12.288-9.4208 73.80992-53.53472 133.12-48.128 3.15392 8.43776 27.0336 63.93856 6.02112 129.4336 35.59424 40.38656 53.69856 90.76736 53.69856 145.24416 0 112.18944-64.7168 206.4384-219.42272 233.71776a140.0832 140.0832 0 0 1 41.7792 99.9424v123.4944c0.86016 9.87136 0 19.6608 16.50688 19.6608 194.31424-65.49504 334.2336-249.15968 334.2336-465.5104C1002.57792 232.48896 782.66368 12.77952 511.5904 12.77952 240.18944 12.65664 20.48 232.40704 20.48 503.72608z" fill="#24292f"/></svg>`

/**
 * Gitee SVG 图标 (红色版本)
 */
const GITEE_SVG = `<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width="16" height="16"><path d="M512 1024C229.222 1024 0 794.778 0 512S229.222 0 512 0s512 229.222 512 512-229.222 512-512 512z m259.149-568.883h-290.74a25.293 25.293 0 0 0-25.292 25.293l-0.026 63.206c0 13.952 11.315 25.293 25.267 25.293h177.024c13.978 0 25.293 11.315 25.293 25.267v12.646a75.853 75.853 0 0 1-75.853 75.853h-240.23a25.293 25.293 0 0 1-25.267-25.293V417.203a75.853 75.853 0 0 1 75.827-75.853h353.946a25.293 25.293 0 0 0 25.267-25.292l0.077-63.207a25.293 25.293 0 0 0-25.268-25.293H417.152a189.62 189.62 0 0 0-189.62 189.645V771.15c0 13.977 11.316 25.293 25.294 25.293h372.94a170.65 170.65 0 0 0 170.65-170.65V480.384a25.293 25.293 0 0 0-25.293-25.267z" fill="#C71D23"/></svg>`

/**
 * 主题颜色配置
 */
interface ThemeColors {
  // 页面背景
  pageBg: string
  // 卡片背景
  cardBg: string
  // 卡片边框
  cardBorder: string
  // 主文字颜色
  textPrimary: string
  // 次要文字颜色
  textSecondary: string
  // 第三级文字颜色
  textTertiary: string
  // 强调色（链接、仓库名等）
  accent: string
  // commit hash 颜色
  hashColor: string
  // 分隔线颜色
  dividerColor: string
  // 代码背景
  codeBg: string
  // 添加行颜色
  addColor: string
  // 删除行颜色
  delColor: string
}

const toTypstRgb = (hex: string) => {
  const clean = hex.replace('#', '')
  const normalized = clean.length === 3
    ? clean.split('').map(ch => ch + ch).join('')
    : clean
  const r = parseInt(normalized.slice(0, 2), 16)
  const g = parseInt(normalized.slice(2, 4), 16)
  const b = parseInt(normalized.slice(4, 6), 16)
  return `rgb(${r}, ${g}, ${b})`
}

const DARK_THEME: ThemeColors = {
  pageBg: toTypstRgb('#1a1a2e'),
  cardBg: toTypstRgb('#16213e'),
  cardBorder: toTypstRgb('#0f3460'),
  textPrimary: toTypstRgb('#ffffff'),
  textSecondary: toTypstRgb('#b0b0b0'),
  textTertiary: toTypstRgb('#888888'),
  accent: toTypstRgb('#64b5f6'),
  hashColor: toTypstRgb('#e1bee7'),
  dividerColor: toTypstRgb('#444444'),
  codeBg: toTypstRgb('#0d1117'),
  addColor: toTypstRgb('#81c784'),
  delColor: toTypstRgb('#ef5350'),
}

const LIGHT_THEME: ThemeColors = {
  pageBg: toTypstRgb('#ffffff'),
  cardBg: toTypstRgb('#f6f8fa'),
  cardBorder: toTypstRgb('#d0d7de'),
  textPrimary: toTypstRgb('#1f2328'),
  textSecondary: toTypstRgb('#656d76'),
  textTertiary: toTypstRgb('#8b949e'),
  accent: toTypstRgb('#0969da'),
  hashColor: toTypstRgb('#8250df'),
  dividerColor: toTypstRgb('#d0d7de'),
  codeBg: toTypstRgb('#f6f8fa'),
  addColor: toTypstRgb('#1a7f37'),
  delColor: toTypstRgb('#cf222e'),
}

/**
 * Typst 渲染器服务
 * 直接使用 w-node 和 to-image-service，不依赖 typst-to-image-service
 */
export class TypstRenderer {
  private typst: typeof import('@myriaddreamin/typst-ts-node-compiler') | null = null
  private compiler: NodeCompiler | null = null
  private lastFonts: Font[] = []
  private readonly fontFormats: FontFormat[] = ['ttf', 'otf']
  private readonly typstModuleName = '@myriaddreamin/typst-ts-node-compiler'

  constructor(
    private ctx: Context,
    private config: Config,
  ) {}

  /**
   * 获取当前主题
   */
  private get theme(): ThemeColors {
    return this.config.typstDarkMode ? DARK_THEME : LIGHT_THEME
  }

  /**
   * 获取平台对应的 SVG 图标（根据主题自动选择颜色）
   */
  private getPlatformIcon(provider: string): string {
    if (provider === 'gitee') {
      return GITEE_SVG
    }
    // 默认使用 GitHub 图标，根据主题选择颜色
    return this.config.typstDarkMode ? GITHUB_SVG_WHITE : GITHUB_SVG_BLACK
  }

  /**
   * 生成 Typst 中嵌入 SVG 图标的代码
   * 使用 bytes() 函数直接传入字节数组
   */
  private generateIconTypst(provider: string, size: string = '14pt'): string {
    const svg = this.getPlatformIcon(provider)
    // 将 SVG 转换为字节数组格式
    const bytes = Buffer.from(svg, 'utf-8')
    const bytesArray = Array.from(bytes).join(', ')
    return `#box(baseline: 2pt)[#image.decode(bytes((${bytesArray})), width: ${size}, height: ${size})]`
  }

  /**
   * 初始化 Typst 编译器（需要在 ready 事件后调用）
   */
  async init(): Promise<void> {
    this.typst = await this.ctx.node.safeImport(this.typstModuleName)
    this.ctx.logger('git-monitor').info('Typst 模块加载成功')
  }

  /**
   * 获取或创建编译器实例
   */
  private getCompiler(): NodeCompiler {
    if (!this.typst) {
      throw new Error('Typst 模块未初始化，请先调用 init()')
    }

    const fonts = this.ctx.toImageService.fontManagement.getFonts(this.fontFormats)
    
    // 检查字体是否变化，如果变化则重新创建编译器
    if (
      !this.compiler ||
      fonts.length !== this.lastFonts.length ||
      (fonts.length > 0 && fonts.some(f => !this.lastFonts.some(lf => lf.data === f.data)))
    ) {
      this.compiler = this.typst.NodeCompiler.create({
        fontArgs: fonts.map(font => ({
          fontBlobs: [font.data],
        }) as NodeAddFontBlobs),
      })
      this.lastFonts = fonts
      this.ctx.logger('git-monitor').debug(`Typst 编译器已创建，加载了 ${fonts.length} 个字体`)
    }
    
    return this.compiler
  }

  /**
   * 将 Typst 代码编译为 SVG
   */
  private toSvg(content: string): string {
    const compiler = this.getCompiler()
    try {
      return compiler.svg({ mainFileContent: content })
    } finally {
      compiler.evictCache(10)
    }
  }

  /**
   * 将 Typst 代码编译为 PNG
   * 使用配置中的倍率缩放
   */
  private async toPng(content: string): Promise<Buffer> {
    const svg = this.toSvg(content)
    const result = await this.ctx.toImageService.svgToImage.resvg(svg, {
      options: {
        fitTo: { mode: 'zoom', value: this.config.typstRenderScale || 1.3 },
      },
    })
    return Buffer.from(result)
  }

  /**
   * 转义 Typst 内容中的特殊字符
   */
  private escapeTypstContent(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .replace(/#/g, '\\#')
      .replace(/\$/g, '\\$')
      .replace(/`/g, '\\`')
      .replace(/\*/g, '\\*')
      .replace(/_/g, '\\_')
      .replace(/</g, '\\<')      // 转义左尖括号（标签语法）
      .replace(/>/g, '\\>')      // 转义右尖括号（标签语法）
      .replace(/@/g, '\\@')      // 转义 @ 符号（引用语法）
      .replace(/\n/g, ' ')
      .replace(/\r/g, '')
      .replace(/\t/g, ' ')
  }

  /**
   * 格式化相对时间
   */
  private formatRelativeTime(date: Date): string {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return '刚刚'
    if (diffMins < 60) return `${diffMins}分钟前`
    if (diffHours < 24) return `${diffHours}小时前`
    if (diffDays < 7) return `${diffDays}天前`
    
    return date.toLocaleDateString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  /**
   * 从仓库 URL 解析 provider（github/gitee/gitlab 等）
   */
  private getProviderFromUrl(url: string): string {
    if (url.includes('gitee')) return 'gitee'
    if (url.includes('gitlab')) return 'gitlab'
    if (url.includes('gitcode')) return 'gitcode'
    return 'github'
  }

  /**
   * 生成单个仓库提交更新的 Typst 代码片段
   * 参考 TRSS-Yunzai 风格优化
   */
  private generateCommitsSection(update: RepoUpdate): string {
    const { repoName, repoOwner, commits, repo } = update
    const t = this.theme
    const provider = this.getProviderFromUrl(repo.url)
    const iconTypst = this.generateIconTypst(provider, '14pt')
    
    const ownerStr = this.escapeTypstContent(repoOwner)
    const nameStr = this.escapeTypstContent(repoName)
    const branchStr = this.escapeTypstContent(update.repo.branch || 'main')
    
    // 生成每个 commit 的卡片
    const commitCards = commits?.slice(0, 5).map((commit, index) => {
      const message = this.escapeTypstContent(commit.message.split('\n')[0])
      const body = commit.message.split('\n').slice(1).join(' ').trim()
      const bodyStr = body ? this.escapeTypstContent(body.substring(0, 300)) : ''
      const author = this.escapeTypstContent(commit.author)
      const sha = this.escapeTypstContent(commit.shortSha.toUpperCase())
      const timeAgo = this.formatRelativeTime(commit.date)
      
      // 使用真实的 stats 数据（如果存在且 showStats 启用）
      const hasStats = this.config.showStats && commit.stats
      const statsSection = hasStats
        ? `#v(10pt)
  
  // 第五行：文件变化统计
  #text(size: 10pt, fill: ${t.textSecondary})[${commit.stats!.files} 个文件发生了变化，影响行数：]
  #text(size: 10pt, weight: "bold", fill: ${t.addColor})[+${commit.stats!.additions}]
  #h(4pt)
  #text(size: 10pt, weight: "bold", fill: ${t.delColor})[-${commit.stats!.deletions}]`
        : ''
      
      return `// Commit ${index + 1}: ${sha}
#block(width: 100%, fill: ${t.cardBg}, radius: 10pt, inset: (x: 16pt, y: 14pt), stroke: 1pt + ${t.cardBorder})[
  // 第一行：平台图标 + 仓库名
  ${iconTypst}
  #h(6pt)
  #text(size: 12pt, weight: "bold")[${ownerStr}/${nameStr}]
  
  #v(4pt)
  
  // 第二行：分支 + commit hash
  #text(size: 10pt, fill: ${t.textSecondary})[⎇ ${branchStr}]
  #h(12pt)
  #text(size: 10pt, fill: ${t.hashColor})[↓ ${sha}]
  
  #v(10pt)
  
  // 第三行：作者信息
  #text(size: 10pt, weight: "medium", fill: ${t.accent})[${author}]
  #text(size: 10pt, fill: ${t.textSecondary})[ 提交于 ]
  #text(size: 10pt)[${timeAgo}]
  
  #v(8pt)
  
  // 第四行：Commit 标题（加粗加大）
  #text(size: 13pt, weight: "bold")[${message}]
  
  ${bodyStr ? `#v(6pt)\n  #text(size: 10pt, fill: ${t.textSecondary})[${bodyStr}]` : ''}
  ${statsSection}
]`
    }).join('\n\n#v(12pt)\n\n')

    const moreInfo = (commits?.length || 0) > 5 
      ? `\n#v(10pt)\n#align(center)[#text(size: 10pt, fill: ${t.textTertiary})[... 还有 ${(commits?.length || 0) - 5} 个提交]]` 
      : ''

    return commitCards + moreInfo
  }

  /**
   * 生成单个仓库 Release 更新的 Typst 代码片段
   * 参考 TRSS-Yunzai 风格优化
   */
  private generateReleasesSection(update: RepoUpdate): string {
    const { repoName, repoOwner, releases, repo } = update
    const t = this.theme
    const provider = this.getProviderFromUrl(repo.url)
    const iconTypst = this.generateIconTypst(provider, '14pt')
    
    const ownerStr = this.escapeTypstContent(repoOwner)
    const nameStr = this.escapeTypstContent(repoName)
    
    const releaseCards = releases?.slice(0, 3).map((release, index) => {
      const name = this.escapeTypstContent(release.name)
      const body = this.escapeTypstContent((release.body || '').substring(0, 400))
      const tagName = this.escapeTypstContent(release.tagName)
      const author = this.escapeTypstContent(release.author)
      const timeAgo = this.formatRelativeTime(release.publishedAt)
      const tagEmoji = release.prerelease ? '🔶' : '🎉'
      const tagLabel = release.prerelease ? 'Pre-release' : 'Release'
      
      return `// Release ${index + 1}: ${tagName}
#block(width: 100%, fill: ${t.cardBg}, radius: 10pt, inset: (x: 16pt, y: 14pt), stroke: 1pt + ${t.cardBorder})[
  // 第一行：平台图标 + 仓库名 + Release 标签
  ${iconTypst}
  #h(6pt)
  #text(size: 12pt, weight: "bold")[${ownerStr}/${nameStr}]
  #h(1fr)
  #text(size: 10pt, weight: "medium", fill: ${t.accent})[${tagEmoji} ${tagLabel}]
  
  #v(10pt)
  
  // 第二行：版本号（大号加粗）
  #text(size: 14pt, weight: "bold", fill: ${t.hashColor})[${tagName}]
  
  #v(6pt)
  
  // 第三行：作者信息
  #text(size: 10pt, fill: ${t.textSecondary})[by ]
  #text(size: 10pt, weight: "medium", fill: ${t.accent})[${author}]
  #text(size: 10pt, fill: ${t.textSecondary})[ · ${timeAgo}]
  
  #v(8pt)
  
  // 第四行：Release 名称（加粗）
  #text(size: 13pt, weight: "bold")[${name}]
  
  ${body ? `#v(8pt)\n  #text(size: 10pt, fill: ${t.textSecondary})[${body}]` : ''}
]`
    }).join('\n\n#v(12pt)\n\n')

    const moreInfo = (releases?.length || 0) > 3 
      ? `\n#v(10pt)\n#align(center)[#text(size: 10pt, fill: ${t.textTertiary})[... 还有 ${(releases?.length || 0) - 3} 个发布]]` 
      : ''

    return releaseCards + moreInfo
  }

  /**
   * 生成合并多个仓库更新的 Typst 代码
   */
  private generateBatchTypst(updates: RepoUpdate[], groupName: string): string {
    const t = this.theme
    const updateTime = new Date().toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })

    const groupNameStr = this.escapeTypstContent(groupName)

    // 生成所有仓库的内容
    const repoSections = updates.map(update => {
      if (update.type === 'commits') {
        return this.generateCommitsSection(update)
      } else {
        return this.generateReleasesSection(update)
      }
    }).join('\n\n#v(16pt)\n\n')

    return `#set page(
  width: 720pt,
  height: auto,
  margin: (x: 24pt, y: 28pt),
  fill: ${t.pageBg},
)

#set text(
  font: ("LXGW WenKai Mono", "Noto Sans CJK SC", "Noto Sans"),
  size: 10pt,
  fill: ${t.textPrimary},
  lang: "zh",
)

// 大标题
#text(size: 32pt, weight: "black")[Git仓库更新推送]

#v(20pt)

// 仓库更新列表
${repoSections}

#v(24pt)

// 底部信息
#align(center)[
  #text(size: 9pt, fill: ${t.textTertiary})[${this.config.typstFooterText}]
  #v(4pt)
  #text(size: 8pt, fill: ${t.textTertiary})[${PLUGIN_REPO_URL}]
  #v(2pt)
  #text(size: 8pt, fill: ${t.textTertiary})[${formatTimestamp()}]
]
`
  }

  /**
   * 渲染多个更新到一张图片
   */
  async renderBatchUpdates(updates: RepoUpdate[], groupName: string): Promise<Buffer | null> {
    if (updates.length === 0) {
      return null
    }

    const typstCode = this.generateBatchTypst(updates, groupName)
    
    this.ctx.logger('git-monitor').debug('生成的 Typst 代码:\n' + typstCode.substring(0, 1000) + '\n...')
    
    try {
      const buffer = await this.toPng(typstCode)
      return Buffer.from(buffer)
    } catch (error) {
      this.ctx.logger('git-monitor').error('批量渲染失败:', error)
      this.ctx.logger('git-monitor').error('Typst 代码片段:\n' + typstCode.substring(0, 500))
      throw error
    }
  }

  /**
   * 渲染单个更新为图片
   * @deprecated 建议使用 renderBatchUpdates
   */
  async renderUpdate(update: RepoUpdate): Promise<Buffer> {
    const result = await this.renderBatchUpdates([update], update.repoName)
    if (!result) {
      throw new Error('渲染失败：返回结果为空')
    }
    return result
  }

  /**
   * 批量渲染多个更新
   * @deprecated 建议使用 renderBatchUpdates
   */
  async renderUpdates(updates: RepoUpdate[]): Promise<Buffer[]> {
    const results: Buffer[] = []
    
    for (const update of updates) {
      try {
        const buffer = await this.renderUpdate(update)
        results.push(buffer)
      } catch (error) {
        this.ctx.logger('git-monitor').error(`渲染失败 ${update.repoName}:`, error)
      }
    }
    
    return results
  }
}
