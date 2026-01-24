import { Context } from 'koishi'
import axios, { AxiosInstance } from 'axios'
import { SocksProxyAgent } from 'socks-proxy-agent'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { GitCommit, GitRelease, GitProvider } from '../types'
import type { Config } from '../config'

/**
 * 创建带代理的 axios 实例
 */
function createAxiosInstance(config: Config): AxiosInstance {
  const axiosConfig: any = {
    headers: {
      'User-Agent': config.userAgent || 'Koishi-Git-Monitor',
    },
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

/**
 * 从仓库 URL 解析所有者和仓库名
 */
export function parseRepoUrl(url: string): { owner: string; repo: string; provider: string } {
  // 如果 URL 不包含协议，自动添加 https://
  let normalizedUrl = url
  if (!url.match(/^(https?:\/\/|git@)/)) {
    normalizedUrl = `https://${url}`
  }
  
  // 支持 https://github.com/owner/repo 和 https://github.com/owner/repo.git
  const match = normalizedUrl.match(/(?:https?:\/\/|git@)([^\/]+)[:/]([^\/]+)\/([^\/]+?)(?:\.git)?$/)
  if (!match) {
    throw new Error(`Invalid repo URL: ${url}`)
  }
  
  const [, domain, owner, repo] = match
  let provider = 'github'
  
  if (domain.includes('gitee')) provider = 'gitee'
  else if (domain.includes('gitlab')) provider = 'gitlab'
  else if (domain.includes('gitcode')) provider = 'gitcode'
  
  return { owner, repo, provider }
}

/**
 * GitHub Provider
 */
export class GitHubProvider implements GitProvider {
  name = 'github'
  private baseUrl = 'https://api.github.com'
  private axios: AxiosInstance
  
  constructor(
    private ctx: Context,
    private config: Config,
    private token?: string,
  ) {
    this.axios = createAxiosInstance(config)
  }

  private async fetch(endpoint: string): Promise<any> {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': this.config.userAgent || 'Koishi-Git-Monitor',
    }
    
    if (this.token) {
      headers['Authorization'] = `token ${this.token}`
    }
    
    const response = await this.axios.get(`${this.baseUrl}${endpoint}`, { headers })
    return response.data
  }

  async getCommits(owner: string, repo: string, branch: string, since?: string): Promise<GitCommit[]> {
    const params: Record<string, string> = { sha: branch }
    if (since) params.since = since
    
    // 只有 main/master 才有备用分支
    const fallbackBranches = branch === 'main' ? ['master'] : 
                             branch === 'master' ? ['main'] : []
    
    try {
      const commits = await this.fetch(`/repos/${owner}/${repo}/commits?${new URLSearchParams(params)}`)
      
      return commits.map((c: any) => ({
        sha: c.sha,
        shortSha: c.sha.substring(0, 7),
        message: c.commit.message,
        author: c.commit.author.name,
        authorEmail: c.commit.author.email,
        date: new Date(c.commit.author.date),
        url: c.html_url,
      }))
    } catch (error: any) {
      // 如果是 404 错误，尝试备用分支
      if (error.response?.status === 404) {
        if (fallbackBranches.length > 0) {
          for (const fallbackBranch of fallbackBranches) {
            try {
              this.ctx.logger('git-monitor').warn(`⚠️ 分支 "${branch}" 不存在，尝试 "${fallbackBranch}": ${owner}/${repo}`)
              const fallbackParams: Record<string, string> = { sha: fallbackBranch }
              if (since) fallbackParams.since = since
              
              const commits = await this.fetch(`/repos/${owner}/${repo}/commits?${new URLSearchParams(fallbackParams)}`)
              
              this.ctx.logger('git-monitor').success(`✅ 使用备用分支 "${fallbackBranch}": ${owner}/${repo}`)
              return commits.map((c: any) => ({
                sha: c.sha,
                shortSha: c.sha.substring(0, 7),
                message: c.commit.message,
                author: c.commit.author.name,
                authorEmail: c.commit.author.email,
                date: new Date(c.commit.author.date),
                url: c.html_url,
              }))
            } catch (fallbackError: any) {
              // 继续尝试下一个分支
              continue
            }
          }
          // main/master 都失败了
          const errorMsg = `分支 "${branch}" 和备用分支 "${fallbackBranches[0]}" 均不存在`
          this.ctx.logger('git-monitor').error(`❌ ${errorMsg}: ${owner}/${repo}`)
          throw new Error(errorMsg)
        } else {
          // 用户配置的不是 main/master，直接报错
          const errorMsg = `分支 "${branch}" 不存在（仅 main/master 支持自动回退）`
          this.ctx.logger('git-monitor').error(`❌ ${errorMsg}: ${owner}/${repo}`)
          throw new Error(errorMsg)
        }
      }
      
      // 其他错误，格式化输出
      const errorMsg = error.response?.status 
        ? `HTTP ${error.response.status}: ${error.response.statusText || error.message}` 
        : error.message
      throw new Error(errorMsg)
    }
  }

  async getReleases(owner: string, repo: string, limit = 10): Promise<GitRelease[]> {
    const releases = await this.fetch(`/repos/${owner}/${repo}/releases?per_page=${limit}`)
    
    return releases.map((r: any) => ({
      tagName: r.tag_name,
      name: r.name || r.tag_name,
      body: r.body || '',
      author: r.author?.login || 'Unknown',
      publishedAt: new Date(r.published_at),
      url: r.html_url,
      prerelease: r.prerelease,
    }))
  }
}

/**
 * Gitee Provider
 */
export class GiteeProvider implements GitProvider {
  name = 'gitee'
  private baseUrl = 'https://gitee.com/api/v5'
  private axios: AxiosInstance
  
  constructor(
    private ctx: Context,
    private config: Config,
    private token?: string,
  ) {
    this.axios = createAxiosInstance(config)
  }

  private async fetch(endpoint: string): Promise<any> {
    const url = `${this.baseUrl}${endpoint}${endpoint.includes('?') ? '&' : '?'}access_token=${this.token || ''}`
    const response = await this.axios.get(url)
    return response.data
  }

  async getCommits(owner: string, repo: string, branch: string, since?: string): Promise<GitCommit[]> {
    const params: Record<string, string> = { sha: branch }
    if (since) params.since = since
    
    try {
      const commits = await this.fetch(`/repos/${owner}/${repo}/commits?${new URLSearchParams(params)}`)
      
      return commits.map((c: any) => ({
        sha: c.sha,
        shortSha: c.sha.substring(0, 7),
        message: c.commit.message,
        author: c.commit.author.name,
        authorEmail: c.commit.author.email,
        date: new Date(c.commit.author.date),
        url: c.html_url,
      }))
    } catch (error: any) {
      // 如果是 404 错误，尝试回退到其他常见分支
      if (error.response?.status === 404) {
        // 只有 main/master 才有备用分支
        const fallbackBranches = branch === 'main' ? ['master'] : 
                                 branch === 'master' ? ['main'] : []
        
        if (fallbackBranches.length > 0) {
          for (const fallbackBranch of fallbackBranches) {
            try {
              this.ctx.logger('git-monitor').warn(`⚠️ 分支 "${branch}" 不存在，尝试 "${fallbackBranch}": ${owner}/${repo}`)
              const fallbackParams: Record<string, string> = { sha: fallbackBranch }
              if (since) fallbackParams.since = since
              
              const commits = await this.fetch(`/repos/${owner}/${repo}/commits?${new URLSearchParams(fallbackParams)}`)
              
              this.ctx.logger('git-monitor').success(`✅ 使用备用分支 "${fallbackBranch}": ${owner}/${repo}`)
              return commits.map((c: any) => ({
                sha: c.sha,
                shortSha: c.sha.substring(0, 7),
                message: c.commit.message,
                author: c.commit.author.name,
                authorEmail: c.commit.author.email,
                date: new Date(c.commit.author.date),
                url: c.html_url,
              }))
            } catch (fallbackError: any) {
              continue // 尝试下一个分支
            }
          }
          // main/master 都失败了
          const errorMsg = `分支 "${branch}" 和备用分支 "${fallbackBranches[0]}" 均不存在`
          this.ctx.logger('git-monitor').error(`❌ ${errorMsg}: ${owner}/${repo}`)
          throw new Error(errorMsg)
        } else {
          // 用户配置的不是 main/master，直接报错
          const errorMsg = `分支 "${branch}" 不存在（仅 main/master 支持自动回退）`
          this.ctx.logger('git-monitor').error(`❌ ${errorMsg}: ${owner}/${repo}`)
          throw new Error(errorMsg)
        }
      }
      
      // 格式化错误信息，避免输出大量堆栈信息
      const errorMsg = error.response?.status 
        ? `HTTP ${error.response.status}: ${error.response.statusText || error.message}` 
        : error.message
      this.ctx.logger('git-monitor').error(`❌ 获取提交失败 ${owner}/${repo}:`, errorMsg)
      throw new Error(errorMsg)
    }
  }

  async getReleases(owner: string, repo: string, limit = 10): Promise<GitRelease[]> {
    const releases = await this.fetch(`/repos/${owner}/${repo}/releases?page=1&per_page=${limit}`)
    
    return releases.map((r: any) => ({
      tagName: r.tag_name,
      name: r.name || r.tag_name,
      body: r.body || '',
      author: r.author?.login || 'Unknown',
      publishedAt: new Date(r.created_at),
      url: r.html_url,
      prerelease: r.prerelease,
    }))
  }
}

/**
 * Git 服务工厂
 */
export class GitService {
  private providers: Map<string, GitProvider> = new Map()
  
  constructor(
    private ctx: Context,
    private config: Config,
    githubToken?: string,
    giteeToken?: string,
  ) {
    this.providers.set('github', new GitHubProvider(ctx, config, githubToken))
    this.providers.set('gitee', new GiteeProvider(ctx, config, giteeToken))
  }
  
  getProvider(providerName: string): GitProvider {
    const provider = this.providers.get(providerName)
    if (!provider) {
      throw new Error(`Unknown git provider: ${providerName}`)
    }
    return provider
  }
  
  async getCommits(repoUrl: string, branch: string, since?: string): Promise<GitCommit[]> {
    const { owner, repo, provider } = parseRepoUrl(repoUrl)
    return this.getProvider(provider).getCommits(owner, repo, branch, since)
  }
  
  async getReleases(repoUrl: string, limit = 10): Promise<GitRelease[]> {
    const { owner, repo, provider } = parseRepoUrl(repoUrl)
    return this.getProvider(provider).getReleases(owner, repo, limit)
  }
}
