import { Context, Logger } from 'koishi'
import axios, { AxiosInstance } from 'axios'
import { SocksProxyAgent } from 'socks-proxy-agent'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { RepoConfig, DiscoverSource } from '../types'
import type { Config } from '../config'

function createAxiosInstance(config: Config): AxiosInstance {
  const axiosConfig: any = {
    headers: {
      'User-Agent': config.userAgent || 'Koishi-Git-Monitor',
    },
    timeout: 30000,
  }
  if (config.enableProxy) {
    const proxyUrl = `${config.proxyProtocol}://${config.proxyIp}:${config.proxyPort}`
    if (config.proxyProtocol.startsWith('socks')) {
      axiosConfig.httpAgent = new SocksProxyAgent(proxyUrl)
      axiosConfig.httpsAgent = new SocksProxyAgent(proxyUrl)
    } else {
      axiosConfig.httpAgent = new HttpsProxyAgent(proxyUrl)
      axiosConfig.httpsAgent = new HttpsProxyAgent(proxyUrl)
    }
  }
  return axios.create(axiosConfig)
}

interface GithubRepoItem {
  html_url: string
  default_branch: string
  fork: boolean
  archived: boolean
}

interface GiteeRepoItem {
  html_url: string
  default_branch: string
  fork: boolean
}

export class RepoDiscoverer {
  private axios: AxiosInstance
  private logger: Logger

  constructor(
    private ctx: Context,
    private config: Config,
  ) {
    this.axios = createAxiosInstance(config)
    this.logger = ctx.logger('git-monitor:discover')
  }

  async listRepos(source: DiscoverSource): Promise<RepoConfig[]> {
    if (source.platform === 'github') {
      return this.listGithubRepos(source.owner)
    } else {
      return this.listGiteeRepos(source.owner)
    }
  }

  private async listGithubRepos(owner: string): Promise<RepoConfig[]> {
    const repos: RepoConfig[] = []
    let page = 1
    let hasMore = true

    while (hasMore) {
      const url = `https://api.github.com/users/${owner}/repos?per_page=100&page=${page}&type=all`
      const data = await this.githubFetch(url)
      if (!Array.isArray(data) || data.length === 0) {
        hasMore = false
        break
      }
      for (const item of data as GithubRepoItem[]) {
        repos.push({
          url: item.html_url,
          branch: item.default_branch || 'main',
          type: 'commits',
        })
      }
      hasMore = data.length === 100
      page++
    }

    return repos
  }

  private async listGiteeRepos(owner: string): Promise<RepoConfig[]> {
    const repos: RepoConfig[] = []
    const token = this.config.giteeToken || ''
    let page = 1
    let hasMore = true

    while (hasMore) {
      const url = `https://gitee.com/api/v5/users/${owner}/repos?access_token=${token}&type=all&per_page=100&page=${page}`
      const data = await this.giteeFetch(url)
      if (!Array.isArray(data) || data.length === 0) {
        hasMore = false
        break
      }
      for (const item of data as GiteeRepoItem[]) {
        repos.push({
          url: item.html_url,
          branch: item.default_branch || 'main',
          type: 'commits',
        })
      }
      hasMore = data.length === 100
      page++
    }

    return repos
  }

  private async githubFetch(url: string): Promise<any> {
    const token = this.config.githubToken
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
    }
    if (token) {
      headers['Authorization'] = `token ${token}`
    }

    const response = await this.axios.get(url, { headers })
    return response.data
  }

  private async giteeFetch(url: string): Promise<any> {
    const response = await this.axios.get(url)
    return response.data
  }

  async syncDiscoverGroup(groupName: string): Promise<{ added: number; removed: number }> {
    const dg = this.config.discoverGroups?.find((g: any) => g.name === groupName)
    if (!dg) {
      this.logger.warn(`未找到发现组: ${groupName}`)
      return { added: 0, removed: 0 }
    }

    const mg = this.config.monitorGroups?.find((g: any) => g.name === groupName)
    if (!mg) {
      this.logger.warn(`未找到对应监控组: ${groupName}`)
      return { added: 0, removed: 0 }
    }

    const allRepos: RepoConfig[] = []
    for (const source of dg.sources as DiscoverSource[]) {
      try {
        const repos = await this.listRepos(source)
        allRepos.push(...repos)
        this.logger.info(`来源 ${source.platform}/${source.owner}: 获取到 ${repos.length} 个仓库`)
      } catch (error) {
        this.logger.error(`获取来源 ${source.platform}/${source.owner} 失败:`, error)
      }
    }

    const existingUrls = new Set(mg.repos.map((r: RepoConfig) => r.url))
    const newUrls = new Set(allRepos.map(r => r.url))

    const added = allRepos.filter(r => !existingUrls.has(r.url))
    const removed = mg.repos.filter((r: RepoConfig) => !newUrls.has(r.url))

    if (added.length > 0 || removed.length > 0) {
      mg.repos = allRepos
      this.logger.info(`🔄 仓库列表已同步: 新增 ${added.length}, 移除 ${removed.length} (总计 ${allRepos.length})`)
    }

    return { added: added.length, removed: removed.length }
  }

  async syncAllDiscoverGroups(): Promise<void> {
    const groups = this.config.discoverGroups || []
    for (const dg of groups) {
      if (dg.enabled !== false && dg.syncRepos !== false) {
        await this.syncDiscoverGroup(dg.name)
      }
    }
  }
}
