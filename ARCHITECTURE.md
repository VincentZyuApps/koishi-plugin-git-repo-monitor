# 项目架构说明

## 目录结构

```
git-repo-monitor/
├── src/                      # 源代码目录
│   ├── index.ts             # 插件入口，注册命令和启动服务
│   ├── config.ts            # 配置定义和 Schema
│   ├── types.ts             # TypeScript 类型定义
│   │
│   ├── services/            # 服务层
│   │   ├── git.ts          # Git API 服务（GitHub、Gitee 等）
│   │   └── renderer.ts     # Typst 渲染服务
│   │
│   ├── scheduler/           # 调度器
│   │   ├── poller.ts       # 轮询调度器（检查更新）
│   │   └── pusher.ts       # 推送调度器（发送消息）
│   │
│   └── utils/               # 工具函数
│       └── storage.ts       # 数据存储和格式化
│
├── lib/                      # 编译输出目录
├── package.json             # 项目配置
├── tsconfig.json            # TypeScript 配置
├── README.md                # 项目说明
├── CONFIG.md                # 配置文档
├── QUICKSTART.md            # 快速开始指南
└── ARCHITECTURE.md          # 本文件

```

## 核心模块

### 1. 入口模块 (index.ts)

**职责**：
- 插件注册和初始化
- 数据库表扩展
- 命令注册
- 服务协调

**关键功能**：
- 启动轮询和推送调度器
- 注册 `git-monitor` 命令系列
- 定期清理旧记录

### 2. 配置模块 (config.ts)

**职责**：
- 定义插件配置接口
- 提供配置验证 Schema

**配置层次**：
```
Config
├── 基础配置（字体路径、最大提交数等）
├── API 配置（GitHub Token、Gitee Token）
└── 监控组列表
    └── MonitorGroup
        ├── 推送目标（platform、channelId）
        ├── 仓库列表
        └── Cron 表达式
```

### 3. 类型定义 (types.ts)

**核心类型**：

```typescript
// 配置相关
- RepoConfig        # 仓库配置
- MonitorGroup      # 监控组配置

// 数据模型
- GitCommit         # Git 提交信息
- GitRelease        # Git Release 信息
- RepoUpdate        # 仓库更新数据
- PushTask          # 推送任务

// 数据库模型
- RepoState         # 仓库状态
- PushRecord        # 推送记录

// 接口
- GitProvider       # Git 提供商接口
```

### 4. Git 服务 (services/git.ts)

**职责**：
- 封装不同 Git 平台的 API 调用
- 提供统一的仓库信息获取接口

**架构**：
```
GitService (工厂类)
├── GitHubProvider
│   ├── getCommits()
│   └── getReleases()
├── GiteeProvider
│   ├── getCommits()
│   └── getReleases()
└── (可扩展其他 Provider)
```

**设计模式**：
- **策略模式**：不同平台实现 `GitProvider` 接口
- **工厂模式**：`GitService` 根据 URL 选择对应 Provider

### 5. 渲染服务 (services/renderer.ts)

**职责**：
- 生成 Typst 代码
- 调用 typst-to-image-service 渲染图片

**渲染流程**：
```
RepoUpdate → generateTypst() → Typst Code → toPng() → PNG Buffer
```

**特点**：
- 支持提交和 Release 两种样式
- 自动转义特殊字符
- 自适应高度的页面布局

### 6. 轮询调度器 (scheduler/poller.ts)

**职责**：
- 管理轮询任务的生命周期
- 定期检查仓库更新
- 缓存待推送的更新

**工作流程**：
```
启动 → 创建 Cron 任务 → 定期执行
  ↓
检查仓库更新
  ↓
与上次检查点对比
  ↓
发现新更新 → 加入待推送队列
  ↓
更新检查点
```

**数据流**：
```
MonitorGroup → RepoConfig → Git API → GitCommit/GitRelease → RepoUpdate → pendingUpdates
```

### 7. 推送调度器 (scheduler/pusher.ts)

**职责**：
- 管理推送任务的生命周期
- 定期获取待推送更新
- 渲染并发送消息

**工作流程**：
```
启动 → 创建 Cron 任务 → 定期执行
  ↓
获取待推送更新
  ↓
批量渲染图片
  ↓
构建消息
  ↓
发送到目标频道
  ↓
保存推送记录
```

### 8. 存储工具 (utils/storage.ts)

**职责**：
- 数据库操作封装
- 数据格式化

**StorageManager**：
- `getLastCheckpoint()` - 获取检查点
- `updateCheckpoint()` - 更新检查点
- `savePushRecord()` - 保存推送记录
- `cleanOldRecords()` - 清理旧记录

**Formatter**：
- `formatRepoName()` - 格式化仓库名
- `formatCommitText()` - 格式化提交信息
- `formatReleaseText()` - 格式化发布信息

## 数据流

### 完整数据流

```
1. 配置加载
   Config → MonitorGroup → RepoConfig

2. 轮询检查
   Cron 触发 → PollScheduler
   ↓
   遍历 repos → GitService.getCommits/getReleases()
   ↓
   对比 lastCheckpoint
   ↓
   发现新更新 → RepoUpdate
   ↓
   存入 pendingUpdates
   ↓
   更新数据库 checkpoint

3. 推送通知
   Cron 触发 → PushScheduler
   ↓
   获取 pendingUpdates
   ↓
   TypstRenderer.renderUpdates()
   ↓
   生成 PNG 图片
   ↓
   构建消息 (文字 + 图片)
   ↓
   bot.sendMessage()
   ↓
   保存 PushRecord
```

## 时序图

### 启动流程

```
用户启动 Koishi
    ↓
加载插件配置
    ↓
初始化服务
    ├─ GitService
    ├─ TypstRenderer
    ├─ StorageManager
    ├─ PollScheduler
    └─ PushScheduler
    ↓
注册数据库表
    ├─ git_repo_state
    └─ git_push_record
    ↓
启动监控组
    ├─ PollScheduler.start(group)
    └─ PushScheduler.start(group)
    ↓
注册命令
    ├─ git-monitor
    ├─ git-monitor.check
    ├─ git-monitor.push
    └─ git-monitor.list
    ↓
就绪
```

### 轮询流程

```
Cron 任务触发
    ↓
PollScheduler.checkUpdates(group)
    ↓
遍历 repos
    ├─ 解析 URL
    ├─ 选择 GitProvider
    ├─ 获取 lastCheckpoint
    ├─ 调用 API 获取更新
    ├─ 过滤新更新
    ├─ 创建 RepoUpdate
    ├─ 加入 pendingUpdates
    └─ 更新 checkpoint
    ↓
等待下次触发
```

### 推送流程

```
Cron 任务触发
    ↓
PushScheduler.pushUpdates(group)
    ↓
获取 pendingUpdates
    ↓
TypstRenderer.renderUpdates()
    ├─ 生成 Typst 代码
    ├─ 调用 typstToImageService
    └─ 返回 PNG Buffer
    ↓
构建消息
    ├─ 文字摘要
    └─ 图片列表
    ↓
发送消息
    ├─ 查找 bot
    ├─ bot.sendMessage()
    └─ 保存 PushRecord
    ↓
清空 pendingUpdates
    ↓
等待下次触发
```

## 设计模式

### 1. 策略模式 (Strategy Pattern)

**应用场景**：Git 提供商

```typescript
interface GitProvider {
  getCommits(): Promise<GitCommit[]>
  getReleases(): Promise<GitRelease[]>
}

class GitHubProvider implements GitProvider { ... }
class GiteeProvider implements GitProvider { ... }
```

### 2. 工厂模式 (Factory Pattern)

**应用场景**：Git 服务创建

```typescript
class GitService {
  getProvider(name: string): GitProvider {
    return this.providers.get(name)
  }
}
```

### 3. 观察者模式 (Observer Pattern)

**应用场景**：Cron 任务调度

- Cron 任务作为"观察者"
- 时间到达时触发回调

### 4. 建造者模式 (Builder Pattern)

**应用场景**：Typst 代码生成

- 逐步构建复杂的 Typst 文档结构

## 扩展点

### 1. 添加新的 Git 提供商

```typescript
// 1. 实现 GitProvider 接口
class GitLabProvider implements GitProvider {
  async getCommits() { ... }
  async getReleases() { ... }
}

// 2. 在 GitService 中注册
this.providers.set('gitlab', new GitLabProvider(ctx, token))
```

### 2. 自定义渲染样式

```typescript
// 在 TypstRenderer 中添加新方法
generateCustomTypst(update: RepoUpdate): string {
  // 自定义 Typst 模板
}
```

### 3. 添加过滤器

```typescript
// 在 PollScheduler 中添加过滤逻辑
private filterUpdates(updates: RepoUpdate[]): RepoUpdate[] {
  return updates.filter(update => {
    // 自定义过滤条件
  })
}
```

### 4. 支持更多推送目标

插件已支持任何实现了 `bot.sendMessage()` 的平台

### 5. 添加通知模板

可以在 config.ts 中添加模板配置，在 renderer.ts 中实现

## 性能优化

### 1. 缓存机制

- 使用数据库缓存最后检查点
- 避免重复获取相同的提交

### 2. 批量处理

- 批量渲染多个更新
- 一次性发送多张图片

### 3. 错误处理

- 单个仓库失败不影响其他仓库
- 推送失败会记录日志但不中断流程

### 4. 资源管理

- 定期清理旧记录
- 控制单次推送的图片数量

## 安全考虑

### 1. API Token 保护

- 使用 `role: 'secret'` 隐藏敏感信息
- 不在日志中输出 Token

### 2. 输入验证

- URL 格式验证
- Cron 表达式验证
- 配置项类型检查

### 3. 错误边界

- 所有异步操作都有 try-catch
- 错误不会导致插件崩溃

## 测试建议

### 1. 单元测试

```typescript
// 测试 Git Provider
test('GitHubProvider.getCommits', async () => {
  const commits = await provider.getCommits('owner', 'repo', 'main')
  expect(commits).toBeArray()
})

// 测试解析 URL
test('parseRepoUrl', () => {
  const result = parseRepoUrl('https://github.com/owner/repo')
  expect(result).toEqual({ owner: 'owner', repo: 'repo', provider: 'github' })
})
```

### 2. 集成测试

```typescript
// 测试完整流程
test('poll and push workflow', async () => {
  // 启动轮询
  pollScheduler.start(group)
  
  // 等待检查完成
  await sleep(1000)
  
  // 验证待推送队列
  const updates = pollScheduler.getPendingUpdates(group.name)
  expect(updates.length).toBeGreaterThan(0)
  
  // 触发推送
  await pushScheduler.triggerPush(group.name)
  
  // 验证消息已发送
  expect(mockBot.sendMessage).toHaveBeenCalled()
})
```

### 3. 端到端测试

- 配置真实仓库
- 触发实际的 API 调用
- 验证消息发送

## 常见问题排查

### 问题 1：轮询任务不执行

**检查清单**：
1. Cron 表达式是否正确
2. 监控组是否启用 (`enabled: true`)
3. 查看日志是否有错误

### 问题 2：渲染失败

**检查清单**：
1. typst-to-image-service 是否已安装
2. 字体路径是否正确
3. Typst 代码是否有语法错误

### 问题 3：推送失败

**检查清单**：
1. Bot 是否在线
2. 频道 ID 是否正确
3. Bot 是否有发送消息权限

## 未来计划

- [ ] 支持 Webhook 触发（即时推送）
- [ ] 添加更多 Git 平台支持（GitLab、Bitbucket）
- [ ] 支持自定义渲染模板
- [ ] 添加数据统计和分析功能
- [ ] 支持过滤条件（作者、文件路径等）
- [ ] 支持多语言
