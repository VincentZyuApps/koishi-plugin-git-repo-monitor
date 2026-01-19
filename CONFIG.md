# Git 仓库监控插件 - 配置示例

## 基础配置示例

```yaml
plugins:
  git-repo-monitor:
    fontPath: /path/to/LXGWWenKaiMono-Regular.ttf
    maxCommitsPerPush: 10
    debug: false
    
    # 可选：提高 API 请求限制
    githubToken: ghp_xxxxxxxxxxxxxxxxxxxx
    giteeToken: xxxxxxxxxxxxxxxxxxxxxx
    
    # 监控组配置
    monitorGroups:
      - name: Koishi 核心监控
        platform: onebot
        channelId: '123456789'
        enabled: true
        repos:
          - url: https://github.com/koishijs/koishi
            branch: main
            type: commits
          - url: https://github.com/koishijs/koishi
            branch: main
            type: releases
        pollCron: '*/10 * * * *'    # 每 10 分钟检查一次
        pushCron: '0 */2 * * *'     # 每 2 小时推送一次
      
      - name: 插件生态监控
        platform: onebot
        channelId: '987654321'
        enabled: true
        repos:
          - url: https://github.com/koishijs/koishi-plugin-puppeteer
            type: commits
          - url: https://github.com/koishijs/koishi-plugin-markdown
            type: releases
          - url: https://gitee.com/your-org/your-repo
            branch: develop
            type: commits
        pollCron: '0 */1 * * *'     # 每小时检查一次
        pushCron: '0 9,18 * * *'    # 每天 9:00 和 18:00 推送
```

## 详细配置说明

### 基础配置项

| 配置项 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| fontPath | string | ✅ | - | 字体文件绝对路径 |
| maxCommitsPerPush | number | ❌ | 10 | 单次推送最大显示提交数 |
| githubToken | string | ❌ | - | GitHub API Token |
| giteeToken | string | ❌ | - | Gitee API Token |
| debug | boolean | ❌ | false | 是否启用调试日志 |

### 监控组配置项

| 配置项 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| name | string | ✅ | - | 监控组名称（用于标识） |
| platform | string | ✅ | - | 推送平台（如 onebot、discord 等） |
| channelId | string | ✅ | - | 频道/群组 ID |
| enabled | boolean | ❌ | true | 是否启用此监控组 |
| repos | array | ✅ | - | 仓库列表 |
| pollCron | string | ❌ | */10 * * * * | 轮询 Cron 表达式 |
| pushCron | string | ❌ | 0 */2 * * * | 推送 Cron 表达式 |

### 仓库配置项

| 配置项 | 类型 | 必填 | 默认值 | 说明 |
|--------|------|------|--------|------|
| url | string | ✅ | - | 仓库 URL |
| branch | string | ❌ | main | 分支名称 |
| type | 'commits' \| 'releases' | ✅ | - | 监听类型 |

## Cron 表达式指南

格式：`分 时 日 月 星期`

### 常用示例

```
*/5 * * * *      # 每 5 分钟
*/10 * * * *     # 每 10 分钟
0 * * * *        # 每小时整点
0 */2 * * *      # 每 2 小时
0 0 * * *        # 每天 0:00
0 9,12,18 * * *  # 每天 9:00、12:00、18:00
0 9 * * 1-5      # 工作日 9:00
0 0 1 * *        # 每月 1 号 0:00
```

### 字段说明

- **分钟**: 0-59
- **小时**: 0-23
- **日**: 1-31
- **月**: 1-12
- **星期**: 0-7（0 和 7 都代表周日）

### 特殊字符

- `*` - 所有值
- `,` - 列举多个值（如 1,3,5）
- `-` - 范围（如 1-5）
- `/` - 步长（如 */10）

## 配置建议

### 轮询间隔 (pollCron)

- **高频监控**（活跃项目）：`*/5 * * * *` 或 `*/10 * * * *`
- **正常监控**（一般项目）：`0 */1 * * *` 或 `*/30 * * * *`
- **低频监控**（稳定项目）：`0 */4 * * *` 或 `0 0 * * *`

### 推送间隔 (pushCron)

- **及时推送**：`0 */1 * * *`（每小时）
- **常规推送**：`0 */2 * * *` 或 `0 9,12,18 * * *`
- **汇总推送**：`0 9 * * *` 或 `0 0 * * *`（每天一次）

### 性能优化建议

1. **避免过于频繁的轮询**：推荐至少 5 分钟间隔
2. **推送频率应低于轮询频率**：让更新积累后再推送
3. **监控组不宜过多**：建议不超过 10 个
4. **每组仓库数量适中**：建议每组不超过 20 个仓库

## 使用 API Token 的好处

### GitHub Token

- 未认证：60 次/小时
- 已认证：5000 次/小时

**获取方式**：https://github.com/settings/tokens

### Gitee Token

- 未认证：部分接口受限
- 已认证：更高的请求频率

**获取方式**：https://gitee.com/profile/personal_access_tokens

## 完整示例

```yaml
plugins:
  git-repo-monitor:
    fontPath: /home/user/.local/share/fonts/LXGWWenKaiMono-Regular.ttf
    maxCommitsPerPush: 15
    debug: false
    githubToken: ghp_1234567890abcdefghijklmnopqrstuvwxyz
    
    monitorGroups:
      # 核心项目监控 - 高频
      - name: 核心项目
        platform: onebot
        channelId: '111111111'
        repos:
          - url: https://github.com/koishijs/koishi
            type: commits
          - url: https://github.com/koishijs/koishi
            type: releases
        pollCron: '*/10 * * * *'
        pushCron: '0 */2 * * *'
      
      # 社区插件监控 - 中频
      - name: 社区插件
        platform: onebot
        channelId: '222222222'
        repos:
          - url: https://github.com/koishijs/koishi-plugin-puppeteer
            type: commits
          - url: https://github.com/koishijs/koishi-plugin-markdown
            type: commits
        pollCron: '0 */1 * * *'
        pushCron: '0 9,18 * * *'
      
      # 自己的项目监控 - 低频
      - name: 我的项目
        platform: onebot
        channelId: '333333333'
        repos:
          - url: https://gitee.com/myorg/my-project
            branch: develop
            type: commits
        pollCron: '0 */4 * * *'
        pushCron: '0 9 * * *'
```
