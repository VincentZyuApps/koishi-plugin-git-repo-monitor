/**
 * Git 仓库监控插件 - 格式化工具函数
 */

/**
 * 生成时间戳字符串
 * @param date 日期对象，默认为当前时间
 * @returns 格式化的时间戳字符串 (YYYY-MM-DD HH:MM:SS)
 */
export function formatTimestamp(date: Date = new Date()): string {
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).replace(/\//g, '-')
}

/**
 * 生成简短时间字符串（用于显示）
 * @param date 日期对象，默认为当前时间
 * @returns 格式化的时间字符串
 */
export function formatDateTime(date: Date = new Date()): string {
  return date.toLocaleString('zh-CN')
}
