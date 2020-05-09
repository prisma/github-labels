import ml from 'multilines'
import os from 'os'

import { LabelSyncReport } from '../handlers/labels'
import { GithubLabel } from '../github'
import { withDefault } from '../utils'

/**
 * Concatenates multiple reports into a human readable string.
 *
 * @param reports
 */
export function generateHumanReadableReport(
  reports: LabelSyncReport[],
): string {
  const body = joinReports(reports.map(parseLabelSyncReport))

  return ml`
  | ## LabelSync Overview 
  |
  | ${body}
  `
}

function parseLabelSyncReport(report: LabelSyncReport): string {
  switch (report.status) {
    case 'Success': {
      const removeUnconfiguredLabels = withDefault(
        false,
        report.config?.config.removeUnconfiguredLabels,
      )
      switch (removeUnconfiguredLabels) {
        case true: {
          return ml`
          | ### ${parseRepoName(report.repo)}
          |
          | __New labels:__
          | ${ulOfLabels(report.additions, `No new labels created.`)}
          |
          | __Changed labels:__
          | ${ulOfLabels(report.updates, `No changed labels.`)}
          |
          | __Aliased labels:__
          | ${ulOfLabels(report.aliases, `No aliases.`)}
          |
          | __Removed labels:__
          | ${ulOfLabels(report.removals, `You haven't removed any label.`)}
        `
        }
        case false: {
          return ml`
          | ### ${parseRepoName(report.repo)}
          |
          | __New labels:__
          | ${ulOfLabels(report.additions, `No new labels created.`)}
          |
          | __Changed labels:__
          | ${ulOfLabels(report.updates, `No changed labels.`)}
          |
          | __Aliased labels:__
          | ${ulOfLabels(report.aliases, `No aliases.`)}
          |
          | __Unconfigured labels.__
          | ${ulOfLabels(
            report.removals,
            'You have no unconfigured labels - you could make this repository `strict`.',
          )}
          `
        }
      }
    }
    case 'Failure': {
      return ml`
      | #### \`${report.repo}\`
      |
      | ${report.message}
      `
    }
  }
}

/**
 * Parses the repo name with backticks.
 *
 * @param name
 */
function parseRepoName(name: string): string {
  return ['`', name, '`'].join('')
}

/**
 * Creates a human readable list of labels.
 *
 * @param labels
 */
function ulOfLabels(labels: GithubLabel[], empty: string): string {
  if (labels.length === 0) return empty
  return labels.map(label).join(os.EOL)
}

/**
 * Creates a label out of abstract object.
 */
function label(label: GithubLabel): string {
  if (label.old_name) {
    /* prettier-ignore */
    return ` * ${badge({ name: label.old_name, color: "inactive" })}  &#x2192 ${badge(label)}`
  }
  return ` * ${badge(label)}`
}

/**
 * Creates a colorful badge for the label.
 */
function badge(props: { name: string; color: string }): string {
  /* prettier-ignore */
  return `![${props.name}](https://img.shields.io/static/v1?label=&message=${props.name}&color=${props.color} "${props.name}")`
}

/**
 * Joins reports with a separator.
 * @param reports
 */
function joinReports(reports: string[]): string {
  const separator = ['', '---', ''].join(os.EOL)
  return reports.join(separator)
}
