import type { Logger } from 'koishi'

type VerboseSwitch = boolean | (() => boolean)

function isVerboseEnabled(verboseConsoleLog: VerboseSwitch): boolean {
  return typeof verboseConsoleLog === 'function'
    ? verboseConsoleLog()
    : verboseConsoleLog
}

export function writeConsoleLog(
  logger: Logger,
  verboseConsoleLog: VerboseSwitch,
  infoMessage = '',
  debugMessage = '',
): void {
  if (infoMessage) {
    logger.info(infoMessage)
  }
  if (debugMessage && isVerboseEnabled(verboseConsoleLog)) {
    logger.info(debugMessage)
  }
}

export function createConsoleLogger(logger: Logger, verboseConsoleLog: VerboseSwitch) {
  return {
    info(infoMessage = '', debugMessage = '') {
      writeConsoleLog(logger, verboseConsoleLog, infoMessage, debugMessage)
    },
    debug(debugMessage = '') {
      writeConsoleLog(logger, verboseConsoleLog, '', debugMessage)
    },
  }
}
