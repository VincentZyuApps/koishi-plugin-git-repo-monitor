export const usage = `
## 📦 Git 仓库监控插件

监控 Git 仓库的提交和发布，并通过精美的 Typst 渲染卡片推送到指定频道。

> ⚠️ **注意：每个监控组的名称（name）必须唯一！** 监控组名称是系统内部的唯一标识符，用于任务调度、指令查找和数据库存储。若存在重名，插件启动时将仅保留第一个，后续同名监控组会被忽略。

### ⚠️ 前置依赖

必须先安装并启用以下插件：

- **database** - 数据库服务

可选依赖（按需使用）：

- **to-image-service + w-node** - Typst 图片渲染
- **puppeteer** - Puppeteer 图片渲染
- **onebot** - 合并转发（forward）

### 🎯 功能特性

- 🔄 多仓库监控（支持 GitHub、Gitee 等）
- ⏰ 灵活的定时任务（独立配置轮询和推送间隔）
- 🎨 精美的 Typst 渲染卡片
- 📢 多平台推送支持
- 💾 自动保存检查点和推送记录

### 📝 使用说明

1. 配置字体路径（推荐使用 LXGW WenKai Mono）
2. 添加监控组，配置仓库列表和 Cron 表达式
3. 启用插件后会自动开始监控和推送

<p><b>🤖 Bot 选择：</b>推送目标目前不单独配置 <code>selfId</code>。默认 <code>useFirstBotWhenSelfIdEmpty=true</code>，同平台 Bot 会逐个尝试，首个成功即停止；关闭后会对所有同平台 Bot 发送，可能造成重复通知。</p>

### 🔧 命令列表

<table>
<thead>
<tr><th>指令</th><th>说明</th><th>示例</th></tr>
</thead>
<tbody>
<tr>
  <td><code>git-monitor</code></td>
  <td>查看监控状态</td>
  <td><code>git-monitor</code></td>
</tr>
<tr>
  <td><code>git-monitor.check &lt;组名&gt;</code></td>
  <td>手动触发检查</td>
  <td><code>git-monitor.check qwq</code></td>
</tr>
<tr>
  <td><code>git-monitor.discover &lt;urls&gt; [-n name] [--no-sync]</code></td>
  <td>从 GitHub/Gitee 用户或组织创建动态监控组<br>
  • <code>-n &lt;名称&gt;</code>: 指定组名<br>
  • <code>--no-sync</code>: 创建后不同步仓库列表</td>
  <td><code>git-monitor.discover https://github.com/owner1</code><br><code>git-monitor.discover https://github.com/owner1 -n my-group</code></td>
</tr>
<tr>
  <td><code>git-monitor.dryrun [-n count]</code></td>
  <td>使用硬编码假数据测试推送<br>
  • <code>-n &lt;数量&gt;</code>: 指定仓库数量 (1-30)<br>
  • 默认 15 个仓库</td>
  <td><code>git-monitor.dryrun</code><br><code>git-monitor.dryrun -n 20</code></td>
</tr>
<tr>
  <td><code>git-monitor.inspect &lt;组名&gt; [-p page] [-l limit] [-s sort] [-v]</code></td>
  <td>查看监控组仓库详情<br>
  • <code>-p &lt;页码&gt;</code>: 页码 (默认1)<br>
  • <code>-l &lt;数量&gt;</code>: 每页条数 (默认10)<br>
  • <code>-s &lt;方式&gt;</code>: time-desc(默认)/time-asc/alpha-asc/alpha-desc<br>
  • <code>-v</code>: 显示最新 commit 详情</td>
  <td><code>git-monitor.inspect qwq</code><br><code>git-monitor.inspect qwq -p 2 -l 20 -s alpha-asc</code></td>
</tr>
<tr>
  <td><code>git-monitor.list [--verbose]</code></td>
  <td>列出所有监控组概要<br>
  • <code>--verbose</code>: 显示全部仓库详情（⚠️可能超限）</td>
  <td><code>git-monitor.list</code><br><code>git-monitor.list --verbose</code></td>
</tr>
<tr>
  <td><code>git-monitor.push &lt;组名&gt; [-m mode]</code></td>
  <td>手动触发推送<br>
  • <code>-m new</code> (默认): 仅推送新更新<br>
  • <code>-m last</code>: 强制推送最新状态</td>
  <td><code>git-monitor.push qwq</code><br><code>git-monitor.push qwq -m last</code></td>
</tr>
</tbody>
</table>

### 💾 数据库表结构

<h4>1. git_repo_state (仓库状态表)</h4>
<table>
<thead>
<tr><th>字段</th><th>类型</th><th>说明</th></tr>
</thead>
<tbody>
<tr><td>id</td><td>unsigned</td><td>主键自增</td></tr>
<tr><td>repoUrl</td><td>string</td><td>仓库地址</td></tr>
<tr><td>branch</td><td>string</td><td>分支名</td></tr>
<tr><td>lastCheckpoint</td><td>string</td><td>上次检查点 (ISO 时间戳)</td></tr>
<tr><td>lastUpdated</td><td>timestamp</td><td>上次更新时间</td></tr>
</tbody>
</table>
<p><b>⚠️ 注意：</b> <code>repoUrl</code> + <code>branch</code> 组合唯一</p>

<h4>2. git_push_record (推送记录表)</h4>
<table>
<thead>
<tr><th>字段</th><th>类型</th><th>说明</th></tr>
</thead>
<tbody>
<tr><td>id</td><td>unsigned</td><td>主键自增</td></tr>
<tr><td>groupName</td><td>string</td><td>监控组名</td></tr>
<tr><td>platform</td><td>string</td><td>推送平台</td></tr>
<tr><td>channelId</td><td>string</td><td>频道 ID</td></tr>
<tr><td>repoUrl</td><td>string</td><td>仓库地址</td></tr>
<tr><td>content</td><td>text</td><td>推送内容摘要</td></tr>
<tr><td>pushedAt</td><td>timestamp</td><td>推送时间</td></tr>
</tbody>
</table>

### 🔄 更新检测机制 (New 模式)

<ol>
<li><b>基准获取</b>：从 <code>git_repo_state</code> 表读取 <code>lastCheckpoint</code></li>
<li><b>API 请求</b>：向 GitHub/Gitee API 传递 <code>since</code> 参数</li>
<li><b>精准过滤</b>：过滤掉时间 &lt;= 检查点的提交</li>
<li><b>状态更新</b>：推送后更新最新 Commit 时间戳到数据库</li>
<li><b>Silent Start</b>：首次运行默认不推送，仅记录 Checkpoint</li>
</ol>


### 📖 Cron 表达式示例

- \`*/10 * * * *\` - 每 10 分钟执行一次
- \`0 */2 * * *\` - 每 2 小时执行一次
- \`0 9,12,18 * * *\` - 每天 9:00、12:00、18:00 执行
- \`0 0 * * *\` - 每天 0:00 执行

**🔗 相关资源：**

- [【Crontab Guru】 - https://crontab.guru/](https://crontab.guru/) - 在线 Cron 表达式编辑器和可视化工具
- [【Cronitor Cron Jobs Guide】 - https://cronitor.io/guides/cron-jobs](https://cronitor.io/guides/cron-jobs) - Cron 任务完整指南
- [【Man Page: crontab(5)】 - https://man7.org/linux/man-pages/man5/crontab.5.html](https://man7.org/linux/man-pages/man5/crontab.5.html) - Crontab 官方文档
- [【Wikipedia: Cron】 - https://en.wikipedia.org/wiki/Cron](https://en.wikipedia.org/wiki/Cron) - Cron 维基百科
`
