import * as core from '@actions/core';
import * as github from '@actions/github';
import {Endpoints} from '@octokit/types';
import {Annotation, SuiteMeta} from './meta';

export async function createCheck(
    githubToken: string,
    checkName: string,
    meta: SuiteMeta,
    annotations: Annotation[],
    conclusion: string
): Promise<void> {
    const pullRequest = github.context.payload.pull_request;
    const link = (pullRequest && pullRequest.html_url) || github.context.ref;
    const headSha = (pullRequest && pullRequest.head.sha) || github.context.sha;
    core.info(
        `Posting status 'completed' with conclusion '${conclusion}' to ${link} (sha: ${headSha})`
    );

    const createCheckRequest = {
        ...github.context.repo,
        name: checkName,
        head_sha: headSha,
        status: 'completed',
        conclusion,
        output: {
            title: meta.getSummary(),
            summary: '',
            annotations: annotations.slice(0, 50),
        },
    } as Endpoints['POST /repos/{owner}/{repo}/check-runs']['parameters'];

    core.debug(JSON.stringify(createCheckRequest, null, 2));

    // make conclusion consumable by downstream actions
    core.setOutput('conclusion', conclusion);

    const octokit = github.getOctokit(githubToken);
    await octokit.checks.create(createCheckRequest);
}

export function cleanPaths(
    annotations: Annotation[],
    pathToClean: string
): void {
    for (const annotation of annotations) {
        annotation.path = annotation.path.replace(pathToClean, '');
    }
}

module.exports = {cleanPaths, createCheck};
