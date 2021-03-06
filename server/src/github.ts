import * as path from 'path'
import { Octokit } from 'probot'

import { Maybe } from './data/maybe'
import { Dict, mapEntriesAsync } from './data/dict'
import { not, withDefault } from './utils'

/**
 * Loads a file from Github.
 *
 * @param octokit
 * @param path
 */
export async function getFile(
  octokit: Octokit,
  { owner, repo, ref }: { owner: string; repo: string; ref: string },
  path: string,
): Promise<Maybe<string>> {
  try {
    const res = await octokit.repos.getContents({
      owner: owner,
      path: path,
      repo: repo,
      ref: ref,
    })

    switch (res.status) {
      case 200: {
        // expect a single file
        /* istanbul ignore if */
        if (Array.isArray(res.data) || !res.data.content) return null

        return Buffer.from(res.data.content, 'base64').toString()
      }
      /* istanbul ignore next */
      default: {
        return null
      }
    }
  } catch (err) /* istanbul ignore next */ {
    return null
  }
}

export interface GithubLabel {
  /* Naming */
  old_name?: string
  name: string
  /* Description */
  old_description?: string
  description?: string
  /* Colors */
  old_color?: string
  color: string
  default?: boolean
}

/**
 * Fetches labels in a repository.
 */
export async function getRepositoryLabels(
  github: Octokit,
  { repo, owner }: { repo: string; owner: string },
): Promise<Octokit.IssuesListLabelsForRepoResponseItem[]> {
  let labels: Octokit.IssuesListLabelsForRepoResponseItem[] = []

  /* Github paginates from page 1 */
  await handler(1)

  return labels

  /* Paginates and performs changes. */
  async function handler(page: number) {
    const repoLabels = await github.issues
      .listLabelsForRepo({
        owner,
        repo,
        per_page: 100,
        page: page,
      })
      .then((res) => res.data)

    labels.push(...repoLabels)

    /* Rerun handler if there are more labels available. */
    /* istanbul ignore next */
    if (repoLabels.length === 100) {
      await handler(page + 1)
    }
  }
}

/**
 * Create new labels in a repository.
 */
export async function addLabelsToRepository(
  github: Octokit,
  { repo, owner }: { repo: string; owner: string },
  labels: Pick<GithubLabel, 'name' | 'color'>[],
  persist: boolean,
): Promise<GithubLabel[]> {
  /* Return immediately on non-persistent sync. */
  if (!persist) return labels

  /* Perform sync on persist. */
  const actions = labels.map((label) => addLabelToRepository(label))
  await Promise.all(actions)

  return labels

  /**
   * Helper functions
   */
  async function addLabelToRepository(
    label: GithubLabel,
  ): Promise<GithubLabel> {
    try {
      const ghLabel = await github.issues.createLabel({
        owner: owner,
        repo: repo,
        name: label.name,
        description: label.description,
        color: label.color,
      })
      return ghLabel.data
    } catch (err) /* istanbul ignore next */ {
      throw new Error(
        `Couldn't create ${label.name} in ${owner}/${repo}: ${err.message}`,
      )
    }
  }
}

/**
 *
 * Updates labels in repository.
 *
 * When old_name is specified in the label, we try to rename the label.
 */
export async function updateLabelsInRepository(
  github: Octokit,
  { repo, owner }: { repo: string; owner: string },
  labels: GithubLabel[],
  persist: boolean,
): Promise<GithubLabel[]> {
  /* Return immediately on non-persistent sync. */
  if (!persist) return labels

  /* Update values on persist. */
  const actions = labels.map((label) => updateLabelInRepository(label))
  await Promise.all(actions)

  return labels

  /**
   * Helper functions
   */
  async function updateLabelInRepository(
    label: GithubLabel,
  ): Promise<GithubLabel> {
    try {
      const ghLabel = await github.issues.updateLabel({
        current_name: withDefault(label.name, label.old_name),
        owner: owner,
        repo: repo,
        name: label.name,
        description: label.description,
        color: label.color,
      })
      return ghLabel.data
    } catch (err) /* istanbul ignore next */ {
      throw new Error(
        `Couldn't update ${label.name} in ${owner}/${repo}: ${err.message}`,
      )
    }
  }
}

/**
 * Removes labels from repository.
 */
export async function removeLabelsFromRepository(
  github: Octokit,
  { repo, owner }: { repo: string; owner: string },
  labels: GithubLabel[],
  persist: boolean,
): Promise<GithubLabel[]> {
  /* Return immediately on non-persistent sync. */
  if (!persist) return labels

  const actions = labels.map((label) => removeLabelFromRepository(label))
  await Promise.all(actions)

  return labels

  /**
   * Helper functions
   */
  async function removeLabelFromRepository(
    label: GithubLabel,
  ): Promise<Octokit.IssuesDeleteLabelParams> {
    try {
      const ghLabel = await github.issues.deleteLabel({
        owner: owner,
        repo: repo,
        name: label.name,
      })

      return ghLabel.data
    } catch (err) /* istanbul ignore next */ {
      throw new Error(
        `Couldn't remove ${label.name} in ${owner}/${repo}: ${err.message}`,
      )
    }
  }
}

/**
 * Aliases labels in a repository by adding them to labels.
 */
export async function aliasLabelsInRepository(
  github: Octokit,
  { repo, owner }: { repo: string; owner: string },
  labels: GithubLabel[],
  persist: boolean,
): Promise<GithubLabel[]> {
  let page = 1

  /* Skip on no labels */
  if (labels.length === 0) return labels

  await handler()

  return labels

  /* Paginates and performs changes. */
  async function handler() {
    const issues = await github.issues
      .listForRepo({
        owner,
        repo,
        per_page: 100,
        page,
      })
      .then((res) => res.data)

    /* Process all the issues. */
    for (const issue of issues) {
      /* Filter labels that should be in this issue but are not. */
      const missingLabels = labels.filter((label) =>
        issue.labels.some((issueLabel) => issueLabel.name === label.old_name),
      )

      if (missingLabels.length === 0) continue

      /* Add all the missing labels. */
      await addLabelsToIssue(
        github,
        { repo, owner, issue: issue.number },
        missingLabels,
        persist,
      )
    }

    /* Rerun handler if there are more issues available. */
    /* istanbul ignore next */
    if (issues.length === 100) {
      page += 1
      await handler()
    }
  }
}

/**
 * Adds labels to an issue.
 */
export async function addLabelsToIssue(
  github: Octokit,
  { repo, owner, issue }: { repo: string; owner: string; issue: number },
  labels: Pick<GithubLabel, 'name'>[],
  persist: boolean,
): Promise<Pick<GithubLabel, 'name'>[]> {
  /* Return immediately on non-persistent sync. */
  /* istanbul ignore next */
  if (!persist) return labels

  const ghLabels = await github.issues
    .addLabels({
      repo,
      owner,
      issue_number: issue,
      labels: labels.map((label) => label.name),
    })
    .then((res) => res.data)

  return ghLabels
}

/**
 * Compares two labels by comparing all of their keys.
 */
export function isLabel(local: GithubLabel): (remote: GithubLabel) => boolean {
  return (remote) =>
    local.name === remote.name &&
    local.description === remote.description &&
    local.color === remote.color
}

/**
 * Determines whether the two configurations configure the same label.
 */
export function isLabelDefinition(
  local: GithubLabel,
): (remote: GithubLabel) => boolean {
  return (remote) => local.name === remote.name
}

/**
 * Opens an issue with a prescribed title and body.
 */
export async function openIssue(
  octokit: Octokit,
  owner: string,
  repo: string,
  title: string,
  body: string,
): Promise<Octokit.IssuesCreateResponse> {
  return octokit.issues
    .create({
      repo: repo,
      owner: owner,
      title: title,
      body: body,
    })
    .then(({ data }) => data)
}

// /**
//  * Closes the issue openned by the LabelSync configuration.
//  *
//  * @param octokit
//  * @param owner
//  * @param repo
//  * @param title
//  */
// export async function closeIssue(
//   octokit: Octokit,
//   owner: string,
//   repo: string,
//   title: string,
// ) {
//   const issues = await octokit.issues.listForRepo({
//     owner: owner,
//     repo: repo,
//     creator: 'labelsync-manager',
//   })
// }

/**
 * Creates a comment on a dedicated pull request.
 */
export async function createPRComment(
  octokit: Octokit,
  owner: string,
  repo: string,
  number: number,
  message: string,
): Promise<Octokit.IssuesCreateCommentResponse> {
  return octokit.issues
    .createComment({
      owner: owner,
      repo: repo,
      body: message,
      issue_number: number,
    })
    .then(({ data }) => data)
}

/**
 * Tries to fetch a repository.
 */
export async function getRepo(
  github: Octokit,
  owner: string,
  repo: string,
): Promise<
  { status: 'Exists'; repo: Octokit.ReposGetResponse } | { status: 'Unknown' }
> {
  return github.repos
    .get({
      owner: owner,
      repo: repo,
    })
    .then((res) => {
      switch (res.status) {
        case 200: {
          return { status: 'Exists' as const, repo: res.data }
        }
        /* istanbul ignore next */
        default: {
          return { status: 'Unknown' as const }
        }
      }
    })
    .catch(() => {
      return { status: 'Unknown' as const }
    })
}

type GHRepo = { owner: string; repo: string }

/**
 * Represents a Github file/folder structure.
 *
 * Files should be utf-8 strings.
 */
export type GHTree = { [path: string]: string }

/**
 * Returns the files that are not nested.
 */
function getTreeFiles(tree: GHTree): Dict<string> {
  return Object.fromEntries(
    Object.keys(tree)
      .filter(isFileInThisFolder)
      .map((name) => [name, tree[name]]),
  )
}

/**
 * Returns a dictionary of remaining subtrees.
 */
function getTreeSubTrees(tree: GHTree): Dict<GHTree> {
  return Object.keys(tree)
    .filter(not(isFileInThisFolder))
    .reduce<Dict<GHTree>>((acc, filepath) => {
      const [subTree, newFilepath] = shiftPath(filepath)
      if (!acc.hasOwnProperty(subTree)) {
        acc[subTree] = {}
      }
      acc[subTree][newFilepath] = tree[filepath]
      return acc
    }, {})
}

/**
 * Shifts path by one.
 * Returns the shifted part as first argument and remaining part as second.
 */
function shiftPath(filepath: string): [string, string] {
  const [dir, ...dirs] = filepath.split('/').filter(Boolean)
  return [dir, dirs.join('/')]
}

/**
 * Determines whether a path references a direct file
 * or a file in the nested folder.
 *
 * "/src/index.ts" -> false
 * "/index.ts" -> true
 * "index.ts" -> true
 */
function isFileInThisFolder(filePath: string): boolean {
  return ['.', '/'].includes(path.dirname(filePath))
}

/**
 * Recursively creates a tree commit by creating blobs and generating
 * trees on folders.
 */
async function createGhTree(
  github: Octokit,
  { owner, repo }: GHRepo,
  tree: GHTree,
): Promise<{ sha: string }> {
  /**
   * Uploads blobs and creates subtrees.
   */
  const blobs = await mapEntriesAsync(getTreeFiles(tree), (content) =>
    createGhBlob(github, { owner, repo }, content),
  )
  const trees = await mapEntriesAsync(getTreeSubTrees(tree), (subTree) =>
    createGhTree(github, { owner, repo }, subTree),
  )

  return github.git
    .createTree({
      owner,
      repo,
      tree: [
        ...Object.entries(trees).map(([treePath, { sha }]) => ({
          mode: '040000' as const,
          type: 'tree' as const,
          path: treePath,
          sha,
        })),
        ...Object.entries(blobs).map(([filePath, { sha }]) => ({
          mode: '100644' as const,
          type: 'blob' as const,
          path: filePath,
          sha,
        })),
      ],
    })
    .then((res) => res.data)
}

/**
 * Creates a Github Blob from a File.
 */
async function createGhBlob(
  github: Octokit,
  { owner, repo }: GHRepo,
  content: string,
): Promise<Octokit.GitCreateBlobResponse> {
  return github.git.createBlob({ owner, repo, content }).then((res) => res.data)
}

/**
 * Bootstraps a configuration repository to a prescribed destination.
 *
 * Assumes repository is empty.
 *
 * @param github
 * @param owner
 * @param repo
 */
export async function bootstrapConfigRepository(
  github: Octokit,
  { owner, repo }: GHRepo,
  tree: GHTree,
): Promise<Octokit.GitUpdateRefResponse> {
  await github.repos
    .createInOrg({
      org: owner,
      name: repo,
      description: 'LabelSync configuration repository.',
      auto_init: true,
    })
    .then((res) => res.data)

  const gitTree = await createGhTree(github, { owner, repo }, tree)
  const masterRef = await github.git
    .getRef({
      owner,
      repo,
      ref: 'heads/master',
    })
    .then((res) => res.data)

  const commit = await github.git
    .createCommit({
      owner,
      repo,
      message: ':sparkles: Scaffold configuration',
      tree: gitTree.sha,
      parents: [masterRef.object.sha],
    })
    .then((res) => res.data)

  const ref = await github.git.updateRef({
    owner,
    repo,
    ref: 'heads/master',
    sha: commit.sha,
  })

  return ref.data
}

export type InstallationAccess =
  | { status: 'Sufficient' }
  | { status: 'Insufficient'; missing: string[]; accessible: string[] }

/**
 * Determines whether LabelSync can access all requested repositories.
 * @param github
 * @param repos
 */
export async function checkInstallationAccess(
  github: Octokit,
  configRepos: string[],
): Promise<InstallationAccess> {
  /* istanbul ignore if */
  if (configRepos.length === 0) return { status: 'Sufficient' }

  /* Paginate through repos. */
  let accessRepos: string[] = []
  let page = 1

  await handler()

  const missing = configRepos.filter((repo) => !accessRepos.includes(repo))

  if (missing.length === 0) {
    return { status: 'Sufficient' }
  }

  return {
    status: 'Insufficient',
    missing: missing,
    accessible: accessRepos,
  }

  async function handler() {
    const res = await github.apps
      .listRepos({ per_page: 100, page })
      .then((res) => res.data)

    /* Push to collection */
    accessRepos.push(...res.repositories.map((repo) => repo.name.toLowerCase()))

    /* istanbul ignore if */
    if (res.repositories.length === 100) {
      page += 1
      await handler()
    }
  }
}
