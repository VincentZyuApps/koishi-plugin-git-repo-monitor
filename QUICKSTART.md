# 快速开始

## 安装步骤

### 1. 安装依赖插件

在 Koishi 控制台插件市场中搜索并安装：

1. `typst-to-image-service` - Typst 渲染服务
2. `to-image-service` - 图片转换服务  
3. `w-node` - Node.js 模块加载支持

### 2. 安装本插件

#### 方式一：通过 Koishi 控制台（推荐）

1. 打开 Koishi 控制台
2. 进入插件市场
3. 搜索 `git-repo-monitor`
4. 点击安装

#### 方式二：手动安装

```bash
# 进入 Koishi 项目目录
cd /path/to/koishi

# 使用 yarn 安装
yarn add koishi-plugin-git-repo-monitor

# 或使用 npm 安装
npm install koishi-plugin-git-repo-monitor
```

### 3. 下载字体文件

推荐使用 **LXGW WenKai Mono** 字体以获得最佳中文显示效果。

```bash
# 下载字体
wget https://github.com/lxgw/LxgwWenKai/releases/download/v1.330/LXGWWenKaiMono-Regular.ttf

# 或手动下载后放到合适的位置
# 例如：/home/user/.local/share/fonts/LXGWWenKaiMono-Regular.ttf
```

### 4. 配置插件

在 Koishi 配置文件 `koishi.yml` 中添加：

```yaml
plugins:
  # 确保依赖插件已启用
  w-node: {}
  to-image-service: {}
  typst-to-image-service: {}
  
  # 配置 git-repo-monitor
  git-repo-monitor:
    fontPath: /path/to/LXGWWenKaiMono-Regular.ttf
    maxCommitsPerPush: 10
    
    monitorGroups:
      - name: 测试监控组
        platform: onebot
        channelId: 'YOUR_CHANNEL_ID'
        repos:
          - url: https://github.com/koishijs/koishi
            branch: main
            type: commits
        pollCron: '*/10 * * * *'
        pushCron: '0 */2 * * *'
```

### 5. 启动 Koishi

```bash
yarn dev
# 或
npm run dev
```

## 验证安装

### 1. 检查插件加载

查看日志输出，应该看到：

```
[I] git-monitor Git 仓库监控插件已加载
[I] git-monitor:poll 启动监控组 测试监控组 的轮询任务，Cron: */10 * * * *
[I] git-monitor:push 启动监控组 测试监控组 的推送任务，Cron: 0 */2 * * *
```

### 2. 测试命令

在任意会话中发送命令：

```
git-monitor
```

应该看到监控状态输出。

### 3. 手动触发测试

```
git-monitor.check 测试监控组
git-monitor.push 测试监控组
```

## 常见问题

### Q: 字体加载失败

**A:** 确保字体文件路径正确，且文件有读取权限。

```bash
# 检查文件是否存在
ls -l /path/to/LXGWWenKaiMono-Regular.ttf

# 确保有读取权限
chmod 644 /path/to/LXGWWenKaiMono-Regular.ttf
```

### Q: 无法获取仓库信息

**A:** 检查网络连接，或配置 API Token 以提高请求限制。

```yaml
git-repo-monitor:
  githubToken: ghp_xxxxxxxxxxxx
  giteeToken: xxxxxxxxxxxx
```

### Q: Typst 渲染失败

**A:** 确保 `typst-to-image-service` 和 `to-image-service` 插件已正确安装并启用。

### Q: 推送消息失败

**A:** 
1. 检查 `platform` 和 `channelId` 配置是否正确
2. 确保对应平台的适配器已安装并连接
3. 确认 Bot 有发送消息的权限

### Q: Cron 任务不执行

**A:** 
1. 检查 Cron 表达式是否正确
2. 确认监控组 `enabled` 字段为 `true`
3. 查看日志是否有错误信息

## 配置示例

### 示例 1：监控单个仓库的提交

```yaml
monitorGroups:
  - name: Koishi 核心
    platform: onebot
    channelId: '123456789'
    repos:
      - url: https://github.com/koishijs/koishi
        type: commits
    pollCron: '*/5 * * * *'    # 每 5 分钟检查
    pushCron: '0 */1 * * *'    # 每小时推送
```

### 示例 2：监控多个仓库的发布

```yaml
monitorGroups:
  - name: Release 监控
    platform: onebot
    channelId: '123456789'
    repos:
      - url: https://github.com/koishijs/koishi
        type: releases
      - url: https://github.com/nodejs/node
        type: releases
    pollCron: '0 */2 * * *'    # 每 2 小时检查
    pushCron: '0 9,18 * * *'   # 每天 9:00 和 18:00 推送
```

### 示例 3：多监控组配置

```yaml
monitorGroups:
  # 高优先级 - 及时推送
  - name: 核心项目
    platform: onebot
    channelId: '111111111'
    repos:
      - url: https://github.com/koishijs/koishi
        type: commits
    pollCron: '*/10 * * * *'
    pushCron: '0 */1 * * *'
  
  # 普通优先级 - 定时汇总
  - name: 社区插件
    platform: onebot
    channelId: '222222222'
    repos:
      - url: https://github.com/koishijs/koishi-plugin-puppeteer
        type: commits
    pollCron: '0 */1 * * *'
    pushCron: '0 9,18 * * *'
```

## 下一步

- 查看 [CONFIG.md](./CONFIG.md) 了解详细配置说明
- 查看 [README.md](./README.md) 了解插件架构

## 获取帮助

如有问题，请：

1. 查看日志文件获取错误信息
2. 检查配置是否正确
3. 确认所有依赖插件已安装
4. 提交 Issue 描述问题
