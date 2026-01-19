import { Context } from 'koishi'
import { RepoUpdate } from '../types'

/**
 * Typst 渲染器服务
 */
export class TypstRenderer {
  constructor(
    private ctx: Context,
    private _fontPath: string, // Reserved for future font configuration
  ) {}

  /**
   * 转义 Typst 字符串字面量中的特殊字符
   * 注意：在 Typst 字符串字面量中，# 不需要转义，只有 \\ 和 \" 需要转义
   */
  private escapeTypstString(str: string): string {
    return str
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')
      .replace(/\n/g, ' ')
      .replace(/\r/g, '')
      .replace(/\t/g, ' ')
  }

  /**
   * 生成单个仓库提交更新的 Typst 代码片段
   */
  private generateCommitsSection(update: RepoUpdate): string {
    const { repoName, repoOwner, commits } = update
    const totalCommits = commits?.length || 0
    
    // 转义文本
    const ownerStr = this.escapeTypstString(repoOwner)
    const nameStr = this.escapeTypstString(repoName)
    const branchStr = this.escapeTypstString(update.repo.branch || 'main')
    
    // 构建提交列表（限制显示前10个）
    const commitsList = commits?.slice(0, 10).map((commit, index) => {
      const message = this.escapeTypstString(commit.message.split('\n')[0].substring(0, 60))
      const author = this.escapeTypstString(commit.author.substring(0, 20))
      const sha = this.escapeTypstString(commit.shortSha)
      const date = commit.date.toLocaleString('zh-CN', { 
        month: '2-digit', 
        day: '2-digit', 
        hour: '2-digit', 
        minute: '2-digit' 
      })
      const bgColor = index % 2 === 0 ? 'white' : 'rgb("#f8f9fa")'
      
      return `    #box(
      width: 100%,
      fill: ${bgColor},
      inset: 6pt,
    )[
      #grid(
        columns: (60pt, 1fr, 120pt),
        column-gutter: 8pt,
        align: (left, left, right),
        
        #text(
          "${sha}",
          size: 9pt,
          font: "monospace",
          fill: rgb("#0969da"),
          weight: "bold",
        ),
        
        #text("${message}", size: 9pt),
        
        #text(
          "${author} ${date}",
          size: 8pt,
          fill: rgb("#666"),
        ),
      )
    ],`
    }).join('\n')

    const moreInfo = totalCommits > 10 ? `\n    #text("... 还有 ${totalCommits - 10} 个提交", size: 8pt, fill: rgb("#666")),` : ''

    return `
// 仓库: ${ownerStr}/${nameStr}
#box(
  width: 100%,
  fill: rgb("#f6f8fa"),
  radius: 4pt,
  inset: 12pt,
)[
  #stack(
    dir: ttb,
    spacing: 8pt,
    
    // 仓库标题
    #grid(
      columns: (auto, 1fr, auto),
      column-gutter: 8pt,
      align: (left, left, right),
      
      #text(size: 18pt)[📦],
      
      #text(
        "${ownerStr}/${nameStr}",
        size: 14pt,
        weight: "bold",
        fill: rgb("#0969da"),
      ),
      
      #text(
        "${totalCommits} commits · ${branchStr}",
        size: 9pt,
        fill: rgb("#666"),
      ),
    ),
    
    // 分隔线
    #line(length: 100%, stroke: 0.5pt + rgb("#d0d7de")),
    
    // 提交列表
${commitsList}${moreInfo}
  )
]
`
  }

  /**
   * 生成单个仓库 Release 更新的 Typst 代码片段
   */
  private generateReleasesSection(update: RepoUpdate): string {
    const { repoName, repoOwner, releases } = update
    const totalReleases = releases?.length || 0
    
    const ownerStr = this.escapeTypstString(repoOwner)
    const nameStr = this.escapeTypstString(repoName)
    
    const releasesList = releases?.slice(0, 5).map((release) => {
      const name = this.escapeTypstString(release.name.substring(0, 50))
      const body = this.escapeTypstString((release.body || 'No description').substring(0, 100))
      const tagName = this.escapeTypstString(release.tagName)
      const author = this.escapeTypstString(release.author)
      const date = release.publishedAt.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })
      const tag = release.prerelease ? '🔶 Pre-release' : '✅ Release'
      const bgColor = release.prerelease ? 'rgb("#fff8e1")' : 'rgb("#e8f5e9")'
      const tagColor = release.prerelease ? 'rgb("#f57c00")' : 'rgb("#2e7d32")'
      
      return `    #box(
      width: 100%,
      fill: ${bgColor},
      radius: 4pt,
      inset: 8pt,
    )[
      #stack(
        dir: ttb,
        spacing: 4pt,
        
        #grid(
          columns: (auto, 1fr, auto),
          column-gutter: 8pt,
          align: (left, left, right),
          
          #text(
            "${tagName}",
            size: 11pt,
            weight: "bold",
            fill: rgb("#0969da"),
            font: "monospace",
          ),
          
          #text("${name}", size: 10pt),
          
          #text(
            "${tag}",
            size: 8pt,
            fill: ${tagColor},
            weight: "medium",
          ),
        ),
        
        #text("${body}", size: 8pt, fill: rgb("#666")),
        
        #text("${author} · ${date}", size: 7pt, fill: rgb("#666")),
      )
    ],`
    }).join('\n')

    const moreInfo = totalReleases > 5 ? `\n    #text("... 还有 ${totalReleases - 5} 个发布", size: 8pt, fill: rgb("#666")),` : ''

    return `
// 仓库: ${ownerStr}/${nameStr}
#box(
  width: 100%,
  fill: rgb("#f6f8fa"),
  radius: 4pt,
  inset: 12pt,
)[
  #stack(
    dir: ttb,
    spacing: 8pt,
    
    // 仓库标题
    #grid(
      columns: (auto, 1fr, auto),
      column-gutter: 8pt,
      align: (left, left, right),
      
      #text(size: 18pt)[🎉],
      
      #text(
        "${ownerStr}/${nameStr}",
        size: 14pt,
        weight: "bold",
        fill: rgb("#0969da"),
      ),
      
      #text(
        "${totalReleases} releases",
        size: 9pt,
        fill: rgb("#666"),
      ),
    ),
    
    // 分隔线
    #line(length: 100%, stroke: 0.5pt + rgb("#d0d7de")),
    
    // Release 列表
${releasesList}${moreInfo}
  )
]
`
  }

  /**
   * 生成合并多个仓库更新的 Typst 代码
   * @param updates 多个仓库的更新列表
   * @param groupName 监控组名称
   */
  private generateBatchTypst(updates: RepoUpdate[], groupName: string): string {
    const updateTime = new Date().toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    })

    const groupNameStr = this.escapeTypstString(groupName)

    // 生成所有仓库的内容
    const repoSections = updates.map(update => {
      if (update.type === 'commits') {
        return this.generateCommitsSection(update)
      } else {
        return this.generateReleasesSection(update)
      }
    }).join('\n#v(12pt)\n')

    return `#set page(
  width: 750pt,
  height: auto,
  margin: (x: 16pt, y: 16pt),
  fill: white,
)

#set text(
  font: ("LXGW WenKai Mono", "Noto Sans CJK SC", "Noto Sans"),
  size: 10pt,
  lang: "zh",
)

// 总标题
#align(center)[
  #box(
    fill: gradient.linear(
      rgb("#667eea"),
      rgb("#764ba2"),
    ),
    radius: 6pt,
    inset: 10pt,
  )[
    #text(
      size: 18pt,
      weight: "bold",
      fill: white,
    )[📢 Git 仓库更新推送]
  ]
]

#v(8pt)

#align(center)[
  #text(
    "监控组: ${groupNameStr}",
    size: 11pt,
    weight: "medium",
    fill: rgb("#0969da"),
  )
]

#v(12pt)

// 仓库更新列表
${repoSections}

#v(16pt)

// 底部信息
#align(center)[
  #text(
    "🕒 ${updateTime} · Powered by Koishi",
    size: 8pt,
    fill: rgb("#666"),
  )
]
`
  }

  /**
   * 渲染多个更新到一张图片（用于监控组推送）
   * @param updates 更新列表
   * @param groupName 监控组名称
   */
  async renderBatchUpdates(updates: RepoUpdate[], groupName: string): Promise<Buffer | null> {
    if (updates.length === 0) {
      return null
    }

    const typstCode = this.generateBatchTypst(updates, groupName)
    
    // 输出生成的 Typst 代码用于调试
    this.ctx.logger('git-monitor').debug('生成的 Typst 代码:\n' + typstCode.substring(0, 1000) + '\n...')
    
    try {
      const buffer = await this.ctx.typstToImageService.toPng(typstCode)
      return Buffer.from(buffer)
    } catch (error) {
      this.ctx.logger('git-monitor').error('批量渲染失败:', error)
      this.ctx.logger('git-monitor').error('Typst 代码片段:\n' + typstCode.substring(0, 500))
      throw error
    }
  }

  /**
   * 渲染单个更新为图片（保留用于单独测试）
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
   * 批量渲染多个更新（每个仓库单独一张图）
   * @deprecated 建议使用 renderBatchUpdates 将同组仓库合并到一张图
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
