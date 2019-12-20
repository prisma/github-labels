import chalk from 'chalk'
import ml from 'multilines'

import { GithubLabel, GithubIssue, GithubRepository } from '../../github'
import { RepositoryManifest } from '../../manifest'

import { SiblingSyncOptions } from './sync'

export type SiblingSyncReport = {
  repository: GithubRepository
  manifest: RepositoryManifest
  options: SiblingSyncOptions
  issues: SiblingSyncIssueReport[]
}

export type SiblingSyncIssueReport = {
  issue: GithubIssue
  siblings: GithubLabel[]
}

/**
 *
 * Creates a human readable terminal report of Sibling Sync.
 * (Uses chalk to make report more lively.)
 *
 * @param report
 */
export function createTerminalReport(report: SiblingSyncReport): string {
  const issues = report.issues.filter(issue => issue.siblings.length > 0)

  /* Clean the report. */
  if (issues.length === 0) {
    return ml`
    | No changes to siblings in the repository.
    `
  }

  return ml`
    | ${chalk.gray('This is an autogenerated report for your project.')}
    | (dry run: "${report.options.dryRun}")
    |
    | ${chalk.bgMagenta('Created siblings:')}
    | ${issuesList(issues)}
  `

  function issuesList(issues: SiblingSyncIssueReport[]): string {
    return issues
      .map(
        issue => ml`
          | - "${issue.issue.title}" (#${issue.issue.number})
          | Added ${issue.siblings.map(l => l.name).join(', ')}.
        `,
      )
      .join('\n')
  }
}