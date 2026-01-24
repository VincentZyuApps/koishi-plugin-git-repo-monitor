import { Config } from '../config'
import { RepoUpdate } from '../types'
import { renderTextPerRepo, renderTextSummary } from './render-text'

export interface ForwardNode {
  name: string
  content: string
}

export function buildForwardNodes(updates: RepoUpdate[], groupName: string, config: Config): ForwardNode[] {
  const nodes: ForwardNode[] = []
  const header = renderTextSummary(updates, groupName, config)

  nodes.push({
    name: 'Git Monitor',
    content: header,
  })

  for (const update of updates) {
    nodes.push({
      name: 'Git Monitor',
      content: renderTextPerRepo(update, config),
    })
  }

  return nodes
}
