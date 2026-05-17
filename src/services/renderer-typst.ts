import { Context } from 'koishi'
import { RepoUpdate, PLUGIN_REPO_URL } from '../types'
import { formatTimestamp } from '../utils/format'
import { Config } from '../config'
import path from 'node:path'
import fs from 'node:fs'
import type { NodeCompiler, NodeAddFontBlobs } from '@myriaddreamin/typst-ts-node-compiler'
// 导入类型声明
import {} from 'koishi-plugin-to-image-service'
import {} from 'koishi-plugin-w-node'

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
 * 使用 typst-to-image-service 进行渲染
 */
export class TypstRenderer {
  private typst: typeof import('@myriaddreamin/typst-ts-node-compiler') | null = null
  private compiler: NodeCompiler | null = null
  private readonly typstModuleName = '@myriaddreamin/typst-ts-node-compiler'
  private initialized = false

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
   * 生成 Typst 中平台图标的代码
   * 根据配置选择使用 SVG Logo 或 Emoji Logo
   */
  private generateIconTypst(provider: string, size: string = '14pt'): string {
    // 调试日志：显示当前配置
    if (this.config.typstLogoType === undefined) {
      this.ctx.logger('git-monitor').warn(`typstLogoType 配置未定义，使用默认值: emoji`)
    } else {
      this.ctx.logger('git-monitor').debug(`typstLogoType 配置: ${this.config.typstLogoType}`)
    }
    
    // 暂时强制使用 Emoji Logo，避免 SVG 导致的 Typst 语法错误
    this.ctx.logger('git-monitor').debug(`使用 Emoji Logo 渲染 ${provider}`)
    const iconMap: Record<string, string> = {
      github: '🐙',
      gitee: '🏮',
      gitlab: '🦊',
      gitcode: '💻'
    }
    const icon = iconMap[provider] || '📦'
    // 确保 size 参数是有效的 Typst 尺寸格式
    const validSize = size.endsWith('pt') ? size : '14pt'
    return `#box(baseline: 2pt)[#text(size: ${validSize})[${icon}]]`
  }

  /**
   * 检查渲染器是否已初始化
   */
  isReady(): boolean {
    return this.initialized && !!this.typst
  }

  /**
   * 初始化 Typst 编译器（需要在 ready 事件后调用）
   */
  async init(): Promise<void> {
    if (!this.ctx.node) {
      throw new Error('w-node 服务未启用，无法使用 Typst 渲染')
    }
    if (!this.ctx.toImageService) {
      throw new Error('to-image-service 服务未启用，无法使用 Typst 渲染')
    }
    this.typst = await this.ctx.node.safeImport(this.typstModuleName)
    this.initialized = true
    this.ctx.logger('git-monitor').info('Typst 模块加载成功')
  }

  /**
   * 获取或创建编译器实例
   */
  private getCompiler(): NodeCompiler {
    if (!this.typst) {
      throw new Error('Typst 模块未初始化，请先调用 init()')
    }

    // 尝试加载自定义字体
    const fontArgs: NodeAddFontBlobs[] = []
    const customFontPath = this.config.typstFontPath
    if (customFontPath && fs.existsSync(customFontPath)) {
      try {
        const customFontBuffer = fs.readFileSync(customFontPath)
        fontArgs.push({
          fontBlobs: [customFontBuffer],
        })
        this.ctx.logger('git-monitor').info(`已加载字体: ${customFontPath}`)
      } catch (error) {
        this.ctx.logger('git-monitor').error('加载字体失败:', error)
      }
    } else if (customFontPath) {
      this.ctx.logger('git-monitor').warn(`字体文件不存在: ${customFontPath}`)
    }
    
    // 创建编译器
    if (!this.compiler) {
      this.compiler = this.typst.NodeCompiler.create({
        fontArgs: fontArgs,
      })
      this.ctx.logger('git-monitor').debug(`Typst 编译器已创建，加载了 ${fontArgs.length} 个字体`)
    }
    
    return this.compiler
  }

  /**
   * 修复 Typst 生成的 SVG 以兼容 resvg
   * 
   * Typst 的 SVG 输出使用 CSS 变量和 <use> 元素，resvg 不支持 CSS 变量。
   * 解决方案：移除 CSS 变量样式规则，让颜色通过父元素的 fill 属性继承。
   */
  private fixSvgForResvg(svg: string): string {
    // 移除 .outline_glyph 的 fill: var(--glyph_fill) 样式规则
    // 这样颜色会从父元素 <g class="typst-text" fill="#color"> 继承
    let fixed = svg.replace(
      /\.outline_glyph\s+path,\s*\npath\.outline_glyph\s*{\s*\n\s*fill:\s*var\(--glyph_fill\);\s*\n\s*stroke:\s*var\(--glyph_stroke\);\s*\n}/g,
      ''
    )
    // 备用匹配：更宽松的模式
    fixed = fixed.replace(
      /\.outline_glyph[^}]*fill:\s*var\(--glyph_fill\)[^}]*}/g,
      ''
    )
    // 移除 transition 样式（resvg 不支持）
    fixed = fixed.replace(
      /\.outline_glyph[^}]*transition[^}]*}/g,
      ''
    )
    // 移除 hover 样式（静态图片不需要）
    fixed = fixed.replace(
      /\.hover\s+\.typst-text\s*{[^}]*}/g,
      ''
    )
    return fixed
  }

  /**
   * 将 Typst 代码编译为 SVG
   */
  private toSvg(content: string): string {
    const compiler = this.getCompiler()
    try {
      let result = compiler.svg({ mainFileContent: content })
      // 修复 SVG 以兼容 resvg
      result = this.fixSvgForResvg(result)
      return result
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
    
    // 使用类型断言绕过 TypeScript 检查
    const toImageService = this.ctx.toImageService as any
    if (!toImageService?.resvgRenderer) {
      throw new Error('toImageService.resvgRenderer 尚未就绪')
    }
    
    const result = await toImageService.resvgRenderer.render({
      svg: svg,
      options: {
        fitTo: { mode: 'zoom', value: this.config.typstRenderScale || 1.3 },
      },
    })
    return Buffer.from(result)
  }

  /**
   * 转义 Typst 内容中的特殊字符
   * 在方括号语法 #text[...] 中，只有 \ [ ] # $ ` 是特殊字符需要转义
   * * _ < > @ 在方括号内容中不是特殊字符，不需要转义
   */
  private escapeTypstContent(str: string): string {
    return str
      .replace(/\\/g, '\\\\')    // 转义反斜杠（必须在其他转义之前）
      .replace(/\[/g, '\\[')
      .replace(/\]/g, '\\]')
      .replace(/#/g, '\\#')
      .replace(/\$/g, '\\$')
      .replace(/`/g, '\\`')
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
   * 确保渲染器已初始化
   */
  private async ensureTypstReady(): Promise<void> {
    if (!this.isReady()) {
      await this.init()
    }
  }

  /**
   * 渲染多个更新到一张图片
   */
  async renderBatchUpdates(updates: RepoUpdate[], groupName: string): Promise<Buffer | null> {
    if (updates.length === 0) {
      return null
    }

    // 确保渲染器已初始化
    await this.ensureTypstReady()

    const typstCode = this.generateBatchTypst(updates, groupName)
    
    this.ctx.logger('git-monitor').debug('生成的 Typst 代码:\n' + typstCode.substring(0, 1000) + '\n...')
    
    // 文件日志输出：保存 Typst 代码文件
    if (this.config.verboseFileLog) {
      await this.saveTypstCodeToFile(typstCode, groupName)
    }
    
    try {
      const buffer = await this.toPng(typstCode)
      
      // 文件日志输出：保存图片文件
      if (this.config.verboseFileLog) {
        await this.saveImageToFile(buffer, 'typst.latest.png', groupName)
      }
      
      return Buffer.from(buffer)
    } catch (error) {
      this.ctx.logger('git-monitor').error('批量渲染失败:', error)
      this.ctx.logger('git-monitor').error('Typst 代码片段:\n' + typstCode.substring(0, 500))
      return null
    }
  }

  /**
   * 保存图片到文件（用于调试）
   */
  private async saveImageToFile(buffer: Buffer, filename: string, groupName: string): Promise<void> {
    try {
      // 导入 fs 模块
      const fs = await import('fs/promises')
      const path = await import('path')
      
      // 创建日志目录
      const logDir = path.join(__dirname, '..', '..', 'log')
      try {
        await fs.mkdir(logDir, { recursive: true })
      } catch (error) {
        // 目录可能已存在，忽略错误
      }
      
      // 保存文件
      const filePath = path.join(logDir, filename)
      await fs.writeFile(filePath, buffer)
      
      this.ctx.logger('git-monitor').info(`已保存 ${groupName} 的图片到: ${filePath}`)
    } catch (error) {
      this.ctx.logger('git-monitor').warn(`保存图片文件失败: ${(error as Error).message}`)
    }
  }

  /**
   * 保存 Typst 代码到文件（用于调试）
   */
  private async saveTypstCodeToFile(typstCode: string, groupName: string): Promise<void> {
    try {
      // 导入 fs 模块
      const fs = await import('fs/promises')
      const path = await import('path')
      
      // 创建日志目录
      const logDir = path.join(__dirname, '..', '..', 'log')
      try {
        await fs.mkdir(logDir, { recursive: true })
      } catch (error) {
        // 目录可能已存在，忽略错误
      }
      
      // 保存 Typst 代码文件
      const filePath = path.join(logDir, 'typst.latest.typ')
      await fs.writeFile(filePath, typstCode, 'utf-8')
      
      this.ctx.logger('git-monitor').info(`已保存 ${groupName} 的 Typst 代码到: ${filePath}`)
      this.ctx.logger('git-monitor').debug(`Typst 代码长度: ${typstCode.length} 字符`)
    } catch (error) {
      this.ctx.logger('git-monitor').warn(`保存 Typst 代码文件失败: ${(error as Error).message}`)
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
