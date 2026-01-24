import { Context } from 'koishi'
import fs from 'node:fs'
import path from 'node:path'
import { Config } from '../config'
import { RepoUpdate } from '../types'

function escapeHtml(text: string) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function formatRelativeTime(date: Date) {
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

type IconMap = {
  github?: string
  gitee?: string
}

function getProviderIconHtml(url: string, icons: IconMap) {
  if (url.includes('gitee') && icons.gitee) {
    return `<img src="${icons.gitee}" alt="gitee" />`
  }
  if (icons.github) {
    return `<img src="${icons.github}" alt="github" />`
  }
  if (url.includes('gitee')) return '<span class="icon-emoji">🅖</span>'
  if (url.includes('gitlab')) return '<span class="icon-emoji">🦊</span>'
  if (url.includes('gitcode')) return '<span class="icon-emoji">🅒</span>'
  return '<span class="icon-emoji">🐙</span>'
}

const BRANCH_SVG = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 3a2 2 0 1 0 0 4a2 2 0 0 0 0-4Zm0 7a2 2 0 1 0 0 4a2 2 0 0 0 0-4Zm10 4a2 2 0 1 0 0 4a2 2 0 0 0 0-4ZM7 7v3a3 3 0 0 0 3 3h4.5a2.5 2.5 0 0 1 2.5 2.5V14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>`
const SHA_SVG = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 6h10M7 12h10M7 18h6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`

function formatCommitMessage(msg: string): string {
  const match = msg.match(/^([a-z]+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/)
  if (!match) return escapeHtml(msg)

  const [_, type, scope, breaking, subject] = match
  const typeLower = type.toLowerCase()
  
  const colors: Record<string, { bg: string, color: string }> = {
    feat: { bg: '#28a745', color: '#fff' },
    fix: { bg: '#fd7e14', color: '#fff' },
    docs: { bg: '#3b82f6', color: '#fff' },
    style: { bg: '#a855f7', color: '#fff' },
    refactor: { bg: '#ff9800', color: '#1f2937' },
    perf: { bg: '#dc2626', color: '#fff' },
    test: { bg: '#ec4899', color: '#ffa3a3' },
    build: { bg: '#06b6d4', color: '#1f2937' },
    ci: { bg: '#60a5fa', color: '#1e3a8a' },
    chore: { bg: '#9ca3af', color: '#1f2937' },
    revert: { bg: '#1f2937', color: '#fff' },
  }

  const style = colors[typeLower] || { bg: '#737373', color: '#fff' }
  const scopeHtml = scope ? `<span class="scope">(${escapeHtml(scope)})</span>` : ''
  const breakingHtml = breaking ? '<span class="breaking">!</span>' : ''

  return `<span class="commit-prefix" style="background-color: ${style.bg}; color: ${style.color}">${escapeHtml(type)}${breakingHtml}</span>${scopeHtml}: ${escapeHtml(subject)}`
}

function buildHtml(updates: RepoUpdate[], groupName: string, config: Config, icons: IconMap, fontCss: string) {
  const dark = config.puppeteerDarkMode
  const theme = dark ? {
    pageBg: '#050505',
    pageOverlay: 'rgba(35, 35, 35, 0.70)',
    cardBg1: 'rgba(112, 112, 112, 0.20)',
    cardBg2: 'rgba(255, 255, 255, 0.05)',
    cardBorder: 'rgba(255, 255, 255, 0.15)',
    textPrimary: '#faf8fc',
    textSecondary: '#c4c3c8',
    accent: '#90d0e4',
    badge: '#c4c3c8',
    branchIcon: '#e0af68',
    branchText: '#e0af68',
    hashText: '#bb9af7',
    tagText: '#7dcfff',
    scopeColor: '#8dcff8',
    shadow: '0 4px 20px rgba(0, 0, 0, 0.40), inset 0 1px 1px rgba(255, 255, 255, 0.18)',
  } : {
    pageBg: '#eef1f4',
    pageOverlay: 'rgba(255, 255, 255, 0.95)',
    cardBg1: 'rgba(0, 0, 0, 0.04)',
    cardBg2: 'rgba(0, 0, 0, 0.02)',
    cardBorder: 'rgba(0, 0, 0, 0.08)',
    textPrimary: '#1f2328',
    textSecondary: '#6b7280',
    accent: '#0969da',
    badge: '#6b7280',
    branchIcon: '#d97706',
    branchText: '#b45309',
    hashText: '#7c3aed',
    tagText: '#0284c7',
    scopeColor: '#0369a1',
    shadow: '0 4px 16px rgba(0, 0, 0, 0.08)',
  }

  const cards: string[] = []

  for (const update of updates) {
    const repo = `${update.repoOwner}/${update.repoName}`
    const icon = getProviderIconHtml(update.repo.url, icons)

    if (update.type === 'commits') {
      const branch = update.repo.branch || 'main'
      const commits = (update.commits || []).slice(0, Math.max(1, config.maxCommitsPerPush || 5))

      if (commits.length === 0) {
        cards.push(`
          <div class="item">
            <div class="title">
              <div class="text">
                <span class="icon">${icon}</span>
                <span class="repo">${escapeHtml(repo)}</span>
              </div>
              <div class="branch">
                <span class="chip">${BRANCH_SVG} ${escapeHtml(branch)}</span>
              </div>
              <div class="desc">暂无提交</div>
            </div>
          </div>
        `)
        continue
      }

      for (const commit of commits) {
        const rawMessage = commit.message.split('\n')[0]
        const messageHtml = formatCommitMessage(rawMessage)
        const body = commit.message.split('\n').slice(1).join(' ').trim()
        const bodyText = body ? escapeHtml(body.slice(0, 260)) : ''
        const time = formatRelativeTime(commit.date)

        cards.push(`
          <div class="item">
            <div class="title">
              <div class="text">
                <span class="icon">${icon}</span>
                <span class="repo">${escapeHtml(repo)}</span>
              </div>
              <div class="branch">
                <span class="chip type-branch">${BRANCH_SVG} ${escapeHtml(branch)}</span>
                <span class="chip type-hash">${SHA_SVG} ${escapeHtml(commit.shortSha.toUpperCase())}</span>
              </div>
              <div class="dec">
                <span class="author-name">${escapeHtml(commit.author)}</span>
                <span class="author-time">提交于 ${escapeHtml(time)}</span>
              </div>
              <div class="desc">
                <div class="head">${messageHtml}</div>
                ${bodyText ? `<div class="body">${bodyText}</div>` : ''}
              </div>
            </div>
          </div>
        `)
      }
      continue
    }

    const releases = (update.releases || []).slice(0, 3)
    if (releases.length === 0) {
        cards.push(`
        <div class="item">
          <div class="title">
            <div class="text">
              <span class="icon">${icon}</span>
              <span class="repo">${escapeHtml(repo)}</span>
              <div class="release">Releases</div>
            </div>
            <div class="desc">暂无发布</div>
          </div>
        </div>
      `)
      continue
    }

    for (const release of releases) {
      const name = escapeHtml(release.name || release.tagName)
      const body = escapeHtml((release.body || '').trim().slice(0, 260))
      const time = formatRelativeTime(release.publishedAt)
      const badge = release.prerelease ? 'Pre-release' : 'Release'

      cards.push(`
        <div class="item">
          <div class="title">
            <div class="text">
              <span class="icon">${icon}</span>
              <span class="repo">${escapeHtml(repo)}</span>
              <div class="release">${badge}</div>
            </div>
              <div class="branch">
                <span class="chip type-tag">🏷️ ${escapeHtml(release.tagName)}</span>
              </div>
            <div class="dec">
              <span class="author-name">${escapeHtml(release.author)}</span>
              <span class="author-time">发布于 ${escapeHtml(time)}</span>
            </div>
            <div class="desc">
              <div class="head">${name}</div>
              ${body ? `<div class="body">${body}</div>` : ''}
            </div>
          </div>
        </div>
      `)
    }
  }

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  ${fontCss}
  :root { color-scheme: ${dark ? 'dark' : 'light'}; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: "LXGW WenKai Mono", "Inconsolata", "Noto Sans CJK SC", "Noto Sans", "Segoe UI", sans-serif; background: ${theme.pageBg}; color: ${theme.textPrimary}; letter-spacing: 0.05em; }
  .container {
    max-width: 630px;
    min-width: 500px;
    width: max-content;
    padding: 22px 18px 12px 18px;
    background: ${theme.pageOverlay};
    border-radius: 18px;
    border: 1px solid ${theme.cardBorder};
    box-shadow: 0 16px 50px rgba(0, 0, 0, 0.35);
  }
  .head_box { padding: 10px; text-align: left; }
  .id_text { font-size: 30px; font-weight: 900; letter-spacing: 0.6px; text-shadow: 0 1px 2px rgba(0,0,0,0.35); }
  .subline { color: ${theme.textSecondary}; font-size: 12px; margin-top: 8px; letter-spacing: 0.04em; }
  .data_box { border-radius: 12px; margin-top: -4px; padding: 6px; }
  .list { display: flex; flex-direction: column; gap: 15px; }
  .item {
    display: flex;
    align-items: center;
    background: linear-gradient(135deg, ${theme.cardBg1}, ${theme.cardBg2});
    backdrop-filter: blur(12px) saturate(150%);
    border-radius: 16px;
    padding: 15px;
    box-shadow: ${theme.shadow};
    border: 1px solid ${theme.cardBorder};
  }
  .title { font-size: 16px; width: 100%; }
  .title .text { font-weight: 900; display: flex; align-items: center; gap: 10px; color: ${theme.textPrimary}; }
  .title .text .repo { font-size: 18px; font-weight: 900; letter-spacing: 0.05em; color: ${theme.textPrimary}; text-shadow: 0 2px 4px rgba(0,0,0,0.25); }
  .title .text .icon { width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2)); }
  .title .text .icon img { width: 22px; height: 22px; display: block; }
  .title .text .icon-emoji { font-size: 20px; }
  .title .text .release {
    font-size: 11px;
    margin-left: 10px;
    color: ${theme.tagText};
    border: 2px solid ${theme.tagText};
    border-radius: 999px;
    padding: 3px 10px;
    font-weight: 800;
    box-shadow: 0 0 10px ${theme.tagText}20;
  }
  .branch { display: flex; align-items: center; font-size: 13px; margin-top: 10px; color: ${theme.textSecondary}; gap: 8px; flex-wrap: wrap; }
  .branch .chip { 
    display: inline-flex; align-items: center; gap: 6px; padding: 5px 10px; 
    border-radius: 8px; 
    letter-spacing: 0.02em; font-weight: 700;
    box-shadow: 0 2px 6px rgba(0,0,0,0.1);
  }
  .branch svg { transition: color 0.3s; width: 13px; height: 13px; }
  .type-branch { color: ${theme.branchText}; border: 1px solid ${theme.branchText}40; background: ${theme.branchText}15; }
  .type-branch svg { color: ${theme.branchIcon}; }
  .type-hash { color: ${theme.hashText}; border: 1px solid ${theme.hashText}40; background: ${theme.hashText}15; font-family: inherit; }
  .type-hash svg { color: ${theme.hashText}; }
  .type-tag { color: ${theme.tagText}; border: 1px solid ${theme.tagText}40; background: ${theme.tagText}15; }
  .dec {
    font-size: 13px;
    color: ${theme.textSecondary};
    margin-top: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding-bottom: 4px;
    border-bottom: 1px dashed ${theme.cardBorder};
    margin-bottom: 10px;
  }
  .dec .author-name { color: ${theme.accent}; font-weight: 800; letter-spacing: 0.03em; font-size: 14px; }
  .dec .author-time { color: ${theme.textSecondary}; font-size: 12px; opacity: 0.8; }
  .desc { font-size: 13px; color: ${theme.textSecondary}; line-height: 1.6; }
  .desc .head { 
    font-size: 16px; color: ${theme.textPrimary}; font-weight: 700; 
    letter-spacing: 0.02em; display: flex; align-items: baseline; flex-wrap: wrap; gap: 8px; 
    margin-bottom: 6px;
  }
  .desc .body { 
    margin-top: 8px; line-height: 1.7; font-size: 14px; color: ${theme.textSecondary}; 
    background: rgba(0,0,0,0.1); padding: 10px; border-radius: 8px; border-left: 3px solid ${theme.cardBorder};
  }
  .commit-prefix {
    display: inline-block;
    padding: 3px 8px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 800;
    text-transform: uppercase;
    line-height: 1.2;
    letter-spacing: 0.5px;
    box-shadow: 0 3px 6px rgba(0,0,0,0.2);
    transform: translateY(-1px);
    border: 1px solid rgba(255,255,255,0.1);
  }
  .scope { font-weight: 800; color: ${theme.scopeColor}; opacity: 1; font-size: 90%; text-transform: uppercase; letter-spacing: 0.5px; }
  .footer { font-size: 12px; text-align: center; color: ${theme.textSecondary}; margin-top: 15px; letter-spacing: 0.05em; opacity: 0.6; }
</style>
</head>
<body>
  <div class="container">
    <div class="head_box">
      <div class="id_text">Git仓库更新推送</div>
      <div class="subline">${escapeHtml(groupName)} · ${escapeHtml(new Date().toLocaleString('zh-CN'))}</div>
    </div>
    <div class="data_box">
      <div class="list">
        ${cards.join('')}
      </div>
    </div>
    <div class="footer">Created By Koishi Git Monitor</div>
  </div>
</body>
</html>`
}

export async function renderPuppeteerImage(ctx: Context, config: Config, updates: RepoUpdate[], groupName: string): Promise<Buffer | null> {
  if (!ctx.puppeteer) {
    ctx.logger('git-monitor').warn('Puppeteer 不可用，跳过 Puppeteer 图片渲染')
    return null
  }

  const assetsDir = path.resolve(__dirname, '../../assets')
  const icons: IconMap = {}
  try {
    const githubSvg = fs.readFileSync(path.join(assetsDir, 'github.svg'), 'utf-8')
    icons.github = `data:image/svg+xml;base64,${Buffer.from(githubSvg).toString('base64')}`
  } catch {}
  try {
    const giteeSvg = fs.readFileSync(path.join(assetsDir, 'gitee.svg'), 'utf-8')
    icons.gitee = `data:image/svg+xml;base64,${Buffer.from(giteeSvg).toString('base64')}`
  } catch {}

  let fontCss = ''
  if (config.puppeteerFontPath && fs.existsSync(config.puppeteerFontPath)) {
    try {
      const fontData = fs.readFileSync(config.puppeteerFontPath)
      const fontBase64 = fontData.toString('base64')
      const ext = path.extname(config.puppeteerFontPath).replace('.', '').toLowerCase()
      const formatMap: Record<string, string> = {
        ttf: 'truetype',
        ttc: 'truetype',
        otf: 'opentype',
        woff: 'woff',
        woff2: 'woff2',
      }
      const mimeMap: Record<string, string> = {
        ttf: 'font/ttf',
        ttc: 'font/ttf',
        otf: 'font/otf',
        woff: 'font/woff',
        woff2: 'font/woff2',
      }
      const fontFormat = formatMap[ext] || 'truetype'
      const fontMime = mimeMap[ext] || 'font/ttf'
      fontCss = `@font-face { font-family: "LXGW WenKai Mono"; src: url(data:${fontMime};base64,${fontBase64}) format("${fontFormat}"); font-display: swap; font-weight: 400; font-style: normal; }`
    } catch {}
  }

  const page = await ctx.puppeteer.page()
  const html = buildHtml(updates, groupName, config, icons, fontCss)

  try {
    const viewportWidth = 820
    const viewportScale = Math.max(0.5, config.puppeteerRenderScale || 1.3)

    await page.setViewport({
      width: viewportWidth,
      height: 800,
      deviceScaleFactor: viewportScale,
    })

    await page.setContent(html, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    })

    const container = await page.$('.container')
    if (!container) {
      throw new Error('Puppeteer 渲染失败：未找到 .container')
    }

    const box = await container.boundingBox()
    if (!box) {
      throw new Error('Puppeteer 渲染失败：无法获取 .container 尺寸')
    }

    const clip = {
      x: Math.max(0, Math.floor(box.x)),
      y: Math.max(0, Math.floor(box.y)),
      width: Math.ceil(box.width),
      height: Math.ceil(box.height),
    }

    await page.setViewport({
      width: Math.ceil(clip.x + clip.width),
      height: Math.ceil(clip.y + clip.height),
      deviceScaleFactor: viewportScale,
    })

    const buffer = await page.screenshot({
      type: 'png',
      clip,
    })

    return Buffer.from(buffer as unknown as ArrayBuffer)
  } finally {
    await page.close().catch(() => undefined)
  }
}
