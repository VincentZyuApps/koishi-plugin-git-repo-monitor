/**
 * Git 仓库监控插件 - 类型定义
 */

/**
 * 插件仓库地址
 */
export const PLUGIN_REPO_URL = 'https://github.com/VincentZyuApps/koishi-plugin-git-repo-monitor'

/**
 * 仓库配置
 */
export interface RepoConfig {
  /** 仓库 URL */
  url: string
  /** 分支名称 */
  branch?: string
  /** 监听类型 */
  type: 'commits' | 'releases'
}

/**
 * 推送目标配置
 */
export interface PushTarget {
  /** 目标名称 */
  name: string
  /** 推送平台 */
  platform: string
  /** 频道 ID */
  channelId: string
  /** 是否启用 */
  enabled?: boolean
}

/**
 * 监控组配置
 */
export interface MonitorGroup {
  /** 监控组名称 */
  name: string
  /** 推送目标列表 */
  pushTargets: PushTarget[]
  /** 仓库列表 */
  repos: RepoConfig[]
  /** 轮询 Cron 表达式（检查更新频率） */
  pollCron: string
  /** 推送 Cron 表达式（推送通知频率） */
  pushCron: string
  /** 是否启用 */
  enabled?: boolean
}

/**
 * Git 提交信息
 */
export interface GitCommit {
  /** 提交哈希 */
  sha: string
  /** 提交短哈希 */
  shortSha: string
  /** 提交信息 */
  message: string
  /** 提交者 */
  author: string
  /** 提交者邮箱 */
  authorEmail: string
  /** 提交时间 */
  date: Date
  /** 提交 URL */
  url: string
  /** 统计信息 */
  stats?: {
    files: number
    additions: number
    deletions: number
  }
}

/**
 * Git Release 信息
 */
export interface GitRelease {
  /** 标签名称 */
  tagName: string
  /** Release 名称 */
  name: string
  /** 描述 */
  body: string
  /** 作者 */
  author: string
  /** 发布时间 */
  publishedAt: Date
  /** Release URL */
  url: string
  /** 是否为预发布 */
  prerelease: boolean
}

/**
 * 仓库更新数据
 */
export interface RepoUpdate {
  /** 仓库信息 */
  repo: RepoConfig
  /** 仓库名称（从 URL 解析） */
  repoName: string
  /** 仓库所有者 */
  repoOwner: string
  /** 更新类型 */
  type: 'commits' | 'releases'
  /** 提交列表（当 type 为 commits 时） */
  commits?: GitCommit[]
  /** Release 列表（当 type 为 releases 时） */
  releases?: GitRelease[]
  /** 更新时间 */
  updateTime: Date
}

/**
 * 推送任务
 */
export interface PushTask {
  /** 监控组 */
  group: MonitorGroup
  /** 更新列表 */
  updates: RepoUpdate[]
  /** 创建时间 */
  createdAt: Date
}

/**
 * 仓库状态（用于数据库存储）
 */
export interface RepoState {
  id: number
  /** 仓库 URL */
  repoUrl: string
  /** 分支 */
  branch: string
  /** 最后检查的提交 SHA / Release 标签 */
  lastCheckpoint: string
  /** 最后更新时间 */
  lastUpdated: Date
}

/**
 * 推送记录（用于数据库存储）
 */
export interface PushRecord {
  id: number
  /** 监控组名称 */
  groupName: string
  /** 推送平台 */
  platform: string
  /** 频道 ID */
  channelId: string
  /** 仓库 URL */
  repoUrl: string
  /** 更新内容（JSON 格式） */
  content: string
  /** 推送时间 */
  pushedAt: Date
}

/**
 * Git 提供商接口
 */
export interface GitProvider {
  /** 提供商名称 */
  name: string
  /** 获取最新提交 */
  getCommits(owner: string, repo: string, branch: string, since?: string): Promise<GitCommit[]>
  /** 获取最新 Release */
  getReleases(owner: string, repo: string, limit?: number): Promise<GitRelease[]>
}

/**
 * Typst 渲染配置
 */
export interface TypstRenderConfig {
  /** 字体路径 */
  fontPath: string
  /** 最大提交数 */
  maxCommits: number
}
