import { Config } from '../config'
import { RepoUpdate } from '../types'

function trimLine(text: string, maxLength: number) {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 1) + '…'
}

export function renderTextSummary(updates: RepoUpdate[], groupName: string, config: Config): string {
  const lines: string[] = []
  const totalCommits = updates.filter(u => u.type === 'commits').reduce((sum, u) => sum + (u.commits?.length || 0), 0)
  const totalReleases = updates.filter(u => u.type === 'releases').reduce((sum, u) => sum + (u.releases?.length || 0), 0)

  lines.push(`📢 ${groupName} 监控组更新`)

  const summaryParts: string[] = []
  if (totalCommits > 0) summaryParts.push(`📦 ${totalCommits} 个新提交`)
  if (totalReleases > 0) summaryParts.push(`🎉 ${totalReleases} 个新发布`)
  if (summaryParts.length) lines.push(summaryParts.join(' | '))

  const maxCommits = Math.max(1, config.maxCommitsPerPush || 5)

  for (const update of updates) {
    const repoLine = `${update.repoOwner}/${update.repoName}`
    if (update.type === 'commits') {
      const branch = update.repo.branch || 'main'
      lines.push(`\n📦 ${repoLine} (${branch})`)

      const commits = update.commits || []
      const displayCommits = commits.slice(0, maxCommits)
      for (const commit of displayCommits) {
        const title = trimLine(commit.message.split('\n')[0], 80)
        let commitLine = `- ${commit.shortSha.toUpperCase()} ${title}`
        if (config.showStats && commit.stats) {
          const { files, additions, deletions } = commit.stats
          commitLine += ` [${files}文件 +${additions} -${deletions}]`
        }
        lines.push(commitLine)
      }
      if (commits.length > displayCommits.length) {
        lines.push(`… 还有 ${commits.length - displayCommits.length} 个提交`)
      }
    } else {
      lines.push(`\n🎉 ${repoLine}`)
      const releases = update.releases || []
      const displayReleases = releases.slice(0, 3)
      for (const release of displayReleases) {
        const title = trimLine(release.name || release.tagName, 80)
        lines.push(`- ${release.tagName} ${title}`)
      }
      if (releases.length > displayReleases.length) {
        lines.push(`… 还有 ${releases.length - displayReleases.length} 个发布`)
      }
    }
  }

  return lines.join('\n')
}

export function renderTextPerRepo(update: RepoUpdate, config: Config): string {
  const lines: string[] = []
  const repoLine = `${update.repoOwner}/${update.repoName}`
  if (update.type === 'commits') {
    const branch = update.repo.branch || 'main'
    lines.push(`📦 ${repoLine} (${branch})`)

    const maxCommits = Math.max(1, config.maxCommitsPerPush || 5)
    const commits = update.commits || []
    const displayCommits = commits.slice(0, maxCommits)
    for (const commit of displayCommits) {
      const title = trimLine(commit.message.split('\n')[0], 80)
      let commitLine = `- ${commit.shortSha.toUpperCase()} ${title}`
      if (config.showStats && commit.stats) {
        const { files, additions, deletions } = commit.stats
        commitLine += ` [${files}文件 +${additions} -${deletions}]`
      }
      lines.push(commitLine)
    }
    if (commits.length > displayCommits.length) {
      lines.push(`… 还有 ${commits.length - displayCommits.length} 个提交`)
    }
  } else {
    lines.push(`🎉 ${repoLine}`)
    const releases = update.releases || []
    const displayReleases = releases.slice(0, 3)
    for (const release of displayReleases) {
      const title = trimLine(release.name || release.tagName, 80)
      lines.push(`- ${release.tagName} ${title}`)
    }
    if (releases.length > displayReleases.length) {
      lines.push(`… 还有 ${releases.length - displayReleases.length} 个发布`)
    }
  }

  return lines.join('\n')
}
