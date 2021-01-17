const core = require('@actions/core');
const github = require('@actions/github');
const fs = require('fs');
const xmljs = require('xml-js');

let action = async function (name, path, githubToken, failOnFailedTests = false, failIfNoTests = true) {
    const {meta, report} = await getReport(path, failIfNoTests);

    let results = `${meta.result}: tests: ${meta.total}, skipped: ${meta.skipped}, failed: ${meta.failed}`;
    const conclusion = meta.failed === 0 && (meta.total > 0 || !failIfNoTests) ? 'success' : 'failure';
    core.info(results);

    let annotations = convertToAnnotations(report);
    await createCheck(githubToken, results, failIfNoTests, conclusion, annotations);

    if (failOnFailedTests && conclusion !== 'success') {
        core.setFailed(`There were ${meta.failed} failed tests`);
    }
};

let getReport = async function (path, failIfNoTests) {
    core.info(`Try to open ${path}`);
    const file = await fs.promises.readFile(path);
    const report = xmljs.xml2js(file, {compact: true});

    // Process results
    core.info(`File ${path} parsed...`);
    const meta = report['test-run']._attributes;
    if (!meta) {
        core.error('No metadata found in the file');
        if (failIfNoTests) {
            core.setFailed(`Not tests found in the report!`);
        }
    }

    return {meta, report};
}

let createCheck = async function (githubToken, title, failIfNoTests, conclusion, annotations) {
    const pullRequest = github.context.payload.pull_request;
    const link = (pullRequest && pullRequest.html_url) || github.context.ref;
    const status = 'completed';
    const head_sha = (pullRequest && pullRequest.head.sha) || github.context.sha;
    core.info(
        `Posting status '${status}' with conclusion '${conclusion}' to ${link} (sha: ${head_sha})`
    );

    const createCheckRequest = {
        ...github.context.repo,
        name,
        head_sha,
        status,
        conclusion,
        output: {
            title: title,
            summary: '',
            annotations: annotations.slice(0, 50)
        }
    };

    core.debug(JSON.stringify(createCheckRequest, null, 2));

    // make conclusion consumable by downstream actions
    core.setOutput('conclusion', conclusion);

    const octokit = github.getOctokit(githubToken);
    await octokit.checks.create(createCheckRequest);
}

let convertToAnnotations = function (report) {
    // ToDo
    const annotations = [];
    annotations.push({
        path: 'unity-project/Assets/Tests/SamplePlayModeTest.cs',
        start_line: 7,
        end_line: 9,
        annotation_level: 'failure',
        title: 'Test failed stuff',
        message: 'Test failed message',
        raw_details: 'RAW ME PLS'
    });
    return annotations;
}

module.exports = action;