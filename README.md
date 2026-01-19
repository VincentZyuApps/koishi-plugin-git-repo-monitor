# koishi-plugin-git-repo-monitor

监控 Git 仓库变化并推送通知到指定频道，支持 Typst 渲染精美卡片。

## 功能特性

- 🔄 **多仓库监控**: 支持同时监控多个 Git 仓库的提交和发布
- ⏰ **灵活定时**: 独立配置轮询间隔和推送间隔
- 🎨 **精美渲染**: 使用 Typst 渲染精美的更新通知卡片
- 📢 **多平台推送**: 支持推送到多个平台和频道
- 🔧 **高度可配置**: 灵活的配置项满足各种需求
- 📦 **模块化设计**: 清晰的代码结构，易于扩展和维护

## 依赖插件

- `typst-to-image-service` - Typst 渲染服务
- `to-image-service` - 图片转换服务
- `w-node` - Node.js 模块加载支持

## 配置说明

### 基础配置

- **fontPath**: 字体文件绝对路径（推荐使用 LXGW WenKai Mono）
- **maxCommitsPerPush**: 单次推送最大显示提交数（默认 10）

### 监控组配置

每个监控组包含：

- **name**: 监控组名称（用于标识）
- **platform**: 推送平台（如 `onebot`）
- **channelId**: 推送频道 ID
- **repos**: 仓库列表
  - **url**: 仓库地址（支持 GitHub、Gitee 等）
  - **branch**: 分支名称（默认 `main`）
  - **type**: 监听类型（`commits` 或 `releases`）
- **pollCron**: 轮询 Cron 表达式（检查更新频率）
- **pushCron**: 推送 Cron 表达式（推送通知频率）

## 使用示例

```yaml
plugins:
  git-repo-monitor:
    fontPath: /path/to/LXGWWenKaiMono-Regular.ttf
    maxCommitsPerPush: 10
    monitorGroups:
      - name: Koishi 生态监控
        platform: onebot
        channelId: '123456789'
        repos:
          - url: https://github.com/koishijs/koishi
            branch: main
            type: commits
          - url: https://github.com/koishijs/koishi-plugin-puppeteer
            branch: main
            type: releases
        pollCron: '*/10 * * * *'  # 每 10 分钟检查一次
        pushCron: '0 */2 * * *'   # 每 2 小时推送一次
```

## 命令

- `git-monitor` - 查看监控状态
- `git-monitor.check` - 手动触发检查
- `git-monitor.list` - 列出所有监控仓库

## 架构设计

```
src/
├── index.ts           # 插件入口
├── config.ts          # 配置定义
├── types.ts           # 类型定义
├── services/
│   ├── git.ts         # Git 服务
│   └── renderer.ts    # Typst 渲染服务
├── scheduler/
│   ├── poller.ts      # 轮询调度器
│   └── pusher.ts      # 推送调度器
└── utils/
    ├── formatter.ts   # 数据格式化
    └── storage.ts     # 数据存储
```

## License

MIT
