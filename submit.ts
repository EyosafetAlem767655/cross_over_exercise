import axios from 'axios';
import prompts from 'prompts';
import * as fs from 'fs/promises';
import * as path from 'path';
import JSZip from 'jszip';
import FormData from 'form-data';
import { execSync } from 'child_process';

const SUBMISSION_DIR = 'submission';
const ASSESSMENT_TYPE = 'event-ticketing';
const ASSESSMENT_VERSION = 'v1';
const ASSESSMENT_BRANCH = 'rwa/feature-development-v1';
const API_URL = 'iyuja327ulc6hq3xsypufut7bh0lygdq.ynzoqn-hey.hf-rnfg-1.ba.njf';
const REPO_GIT_URL = 'https://github.com/trilogy-group/ws-eng-event-ticketing-assessment.git';

if (process.argv.length !== 3) {
  console.error('❌ Please use the command from the instructions to submit!');
  process.exit(1);
}

const asr = process.argv[2];

function decode(s: string): string {
  const input = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
  const output = 'NOPQRSTUVWXYZABCDEFGHIJKLMnopqrstuvwxyzabcdefghijklm';
  const index = (x: string) => input.indexOf(x);
  const translate = (x: string) => (index(x) > -1 ? output[index(x)] : x);
  return s.split('').map(translate).join('');
}

function execCommand(command: string, { throwOnError = false } = {}): string {
  try {
    return execSync(command, { maxBuffer: 50 * 1024 * 1024 }).toString().trim();
  } catch (error) {
    if (throwOnError) throw error;
    console.error(`❌ Error executing command: ${command}`, error);
    return '';
  }
}

async function getInputs(): Promise<{ name: string; email: string }> {
  const gitConfigName = execCommand('git config user.name');
  const gitConfigEmail = execCommand('git config user.email');

  const response = await prompts([
    {
      type: 'text',
      name: 'name',
      message: 'Enter your name:',
      initial: gitConfigName,
    },
    {
      type: 'text',
      name: 'email',
      message: 'Enter your email:',
      initial: gitConfigEmail,
    },
  ]);

  return response;
}

async function countFilesByExtension(extensions = ['.json']): Promise<number> {
  try {
    return (await fs.readdir(SUBMISSION_DIR))
      .filter((file) => extensions.includes(path.extname(file).toLowerCase()))
      .map((file) => path.join(SUBMISSION_DIR, file)).length;
  } catch {
    return 0;
  }
}

function ensureCorrectOrigin(): string {
  const remoteName = execCommand('git remote').split('\n')[0]?.trim() || 'origin';
  const currentUrl = execCommand(`git remote get-url ${remoteName}`).trim();
  const expectedUrls = [
    REPO_GIT_URL,
    REPO_GIT_URL.replace('.git', ''),
    REPO_GIT_URL.replace('https://github.com/', 'git@github.com:'),
  ];
  if (!expectedUrls.some((url) => currentUrl.startsWith(url))) {
    console.log(`⚠️ Origin remote points to '${currentUrl}' instead of the assessment repo.`);
    console.log(`Fixing: setting ${remoteName} URL to '${REPO_GIT_URL}'...`);
    execCommand(`git remote set-url ${remoteName} ${REPO_GIT_URL}`);
    execCommand(`git fetch ${remoteName} ${ASSESSMENT_BRANCH}`);
    console.log('✅ Origin corrected and assessment branch fetched.');
  }
  return remoteName;
}

async function createGitDiff(): Promise<string> {
  try {
    console.log("Disabling GPG signing - this is safe because we're not pushing our commits.");
    execCommand('git config commit.gpgsign false');
  } catch {
    console.log("⚠️ Unable to disable signing. If you get errors about GPG signing, please disable signing in your git config.");
  }
  const remoteName = ensureCorrectOrigin();
  execCommand('git add --all');
  execCommand(`git commit --allow-empty -am "chore(event-ticketing): Generates patch."`);

  let diffOutput = '';
  try {
    diffOutput = execCommand(
      `git diff ${remoteName}/${ASSESSMENT_BRANCH}...HEAD -- . ":!DECISIONS.md" ":!*.patch" ":!yarn.lock" ":!**/package-lock.json" ":!**/tsconfig*.json" ":!**/node_modules/**"`,
      { throwOnError: true },
    );
  } catch (error) {
    console.error('❌ Failed to generate code diff. Retrying...');
    execCommand(`git fetch ${remoteName} ${ASSESSMENT_BRANCH}`);
    try {
      diffOutput = execCommand(
        `git diff ${remoteName}/${ASSESSMENT_BRANCH}...HEAD -- . ":!DECISIONS.md" ":!*.patch" ":!yarn.lock" ":!**/package-lock.json" ":!**/tsconfig*.json" ":!**/node_modules/**"`,
        { throwOnError: true },
      );
    } catch (retryError) {
      console.error('❌ Failed to generate code diff after retry. Your submission will have an empty patch.');
      console.error('   Please ensure you have committed your changes and try submitting again.');
    }
  }

  const diffPath = path.join(SUBMISSION_DIR, 'submission.patch');
  if (!diffOutput?.trim()) {
    console.log("⚠️ No code changes were detected. Please ensure you have committed your changes.");
  }
  await fs.writeFile(diffPath, diffOutput || '');
  return diffPath;
}

async function getSubmissionWarnings(diffPath: string): Promise<string[]> {
  const warnings: string[] = [];
  const diffSize = (await fs.stat(diffPath)).size;

  if (diffSize < 100) {
    warnings.push('⚠️ WARNING: Your code submission is likely incomplete (patch file is very small). This will affect your evaluation.');
  }

  if (await countFilesByExtension(['.jpg', '.jpeg', '.png', '.gif', '.bmp']) === 0) {
    warnings.push('⚠️ WARNING: Completeness - No screenshots found in submission/ folder. Without screenshots, you will get 0 stars on completeness.');
  }

  const clineHistoryPath = await getClineHistoryPath();
  if (clineHistoryPath) {
    try {
      const tasks = await fs.readdir(clineHistoryPath);
      const validTasks = [];
      for (const taskId of tasks) {
        const taskPath = path.join(clineHistoryPath, taskId);
        const stat = await fs.stat(taskPath);
        if (stat.isDirectory()) {
          const apiHistoryPath = path.join(taskPath, 'api_conversation_history.json');
          try {
            const stats = await fs.stat(apiHistoryPath);
            if (stats.size > 0) {
              validTasks.push(taskId);
            }
          } catch (error) {
            // Expected for task dirs without conversation history — skip silently
          }
        }
      }
      if (validTasks.length === 0) {
        warnings.push('⚠️ WARNING: No Cline chat history found. Missing AI interaction history will result in 0 stars.');
      }
    } catch {
      warnings.push('⚠️ WARNING: Cannot access Cline history directory. Missing AI interaction history will result in 0 stars.');
    }
  } else {
    warnings.push('⚠️ WARNING: Cline history directory not found. Missing AI interaction history will result in 0 stars.');
  }

  try {
    const decisionsStats = await fs.stat('DECISIONS.md');
    if (decisionsStats.size < 100) {
      warnings.push('⚠️ WARNING: DECISIONS.md is very small. A thorough planning document with reasoning is required for a good evaluation.');
    }
  } catch {
    warnings.push('⚠️ WARNING: No DECISIONS.md found. Missing planning document will hurt your Engineering Judgment score.');
  }

  return warnings;
}

async function getClineHistoryPath(): Promise<string | null> {
  const possiblePaths = [
    process.env.HOME && path.join(process.env.HOME, '.vscode-remote', 'data', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'tasks'),
    process.env.APPDATA && path.join(process.env.APPDATA, 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'tasks'),
    process.env.HOME && path.join(process.env.HOME, 'Library', 'Application Support', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'tasks'),
    process.env.HOME && path.join(process.env.HOME, '.config', 'Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'tasks'),
    process.env.HOME && path.join(process.env.HOME, '.vscode-server', 'data', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'tasks'),
  ].filter(Boolean) as string[];

  for (const basePath of possiblePaths) {
    try {
      await fs.access(basePath);
      const tasks = await fs.readdir(basePath);
      for (const taskId of tasks) {
        const taskPath = path.join(basePath, taskId);
        const stat = await fs.stat(taskPath);
        if (stat.isDirectory()) {
          const apiHistoryPath = path.join(taskPath, 'api_conversation_history.json');
          try {
            const stats = await fs.stat(apiHistoryPath);
            if (stats.size > 0) {
              return basePath;
            }
          } catch (error) {
            // Expected for task dirs without conversation history — skip silently
          }
        }
      }
    } catch {
      // no op - this will fail for non existent folders
    }
  }

  return null;
}

async function confirmSubmission({ name, email, diffPath }: { name: string; email: string; diffPath: string }) {
  console.log('');
  console.log('Submission Contents:');
  console.log(` Name:          ${name}`);
  console.log(` Email:         ${email}`);
  console.log(` Code:          ${diffPath} (size = ${(await fs.stat(diffPath)).size})`);
  console.log(` Screenshots:   ${await countFilesByExtension(['.jpg', '.jpeg', '.png', '.gif', '.bmp'])} files`);
  console.log(` DECISIONS.md:  included`);
  console.log('');
  console.log('Please ensure that all your changes are reflected in the patch file.');

  const warnings = await getSubmissionWarnings(diffPath);
  if (warnings.length > 0) {
    console.log('\nWarnings:');
    warnings.forEach(warning => console.warn(warning));
    console.log('');
  }

  const confirm = await prompts({
    type: 'confirm',
    name: 'value',
    message: 'Do you want to proceed with your submission?',
    initial: true,
  });

  if (!confirm.value) {
    console.log('Submission canceled. You can perform the submission later.');
    process.exit(0);
  }
}

async function addFileToZip(zip: JSZip, filePath: string, zipPath: string): Promise<void> {
  const fileContent = await fs.readFile(filePath);
  console.log(`Adding "${zipPath}" (size = ${fileContent.byteLength}) to submission...`);
  zip.file(zipPath, fileContent as unknown as ArrayBuffer);
}

async function addSubmissionFiles(zip: JSZip): Promise<void> {
  const files = await fs.readdir(SUBMISSION_DIR);
  for (const file of files) {
    await addFileToZip(zip, path.join(SUBMISSION_DIR, file), file);
  }
  await addDecisionsMd(zip);
}

async function addDecisionsMd(zip: JSZip): Promise<void> {
  try {
    await addFileToZip(zip, 'DECISIONS.md', 'DECISIONS.md');
  } catch {
    console.warn('⚠️ WARNING: No DECISIONS.md file found in root directory');
  }
}

async function addClineHistory(zip: JSZip): Promise<void> {
  const historyPath = await getClineHistoryPath();
  if (!historyPath) {
    console.warn('⚠️ WARNING: Cline history directory not found');
    return;
  }

  let savedFiles = 0;
  try {
    const tasks = await fs.readdir(historyPath);
    for (const taskId of tasks) {
      const taskPath = path.join(historyPath, taskId);
      const stat = await fs.stat(taskPath);
      if (!stat.isDirectory()) continue;

      const apiHistoryPath = path.join(taskPath, 'api_conversation_history.json');
      const uiMessagesPath = path.join(taskPath, 'ui_messages.json');

      try {
        await addFileToZip(zip, apiHistoryPath, `cline_history/${taskId}/api_conversation_history.json`);
        savedFiles++;
      } catch (error) {
        // Task dir without api history — skip
      }

      try {
        await addFileToZip(zip, uiMessagesPath, `cline_history/${taskId}/ui_messages.json`);
        savedFiles++;
      } catch (error) {
        // Task dir without ui messages — skip
      }
    }
  } catch (error) {
    console.warn('⚠️ WARNING: Error reading Cline history:', error);
  }
  console.info(`Added ${savedFiles} cline files to the submission.`);
}

async function createZip(): Promise<Buffer> {
  console.log('');
  const zip = new JSZip();
  await addSubmissionFiles(zip);
  await addClineHistory(zip);
  const result = await zip.generateAsync({ type: 'nodebuffer' });
  console.log(`Submission archive size: ${result.byteLength} bytes`);
  console.log('');
  return result;
}

async function uploadSubmission(zip: Buffer, name: string, email: string): Promise<void> {
  const apiUrl = `https://${decode(API_URL)}/`;
  const jsonBody = { name, email, size: zip.byteLength, type: ASSESSMENT_TYPE, asr };

  try {
    const { data } = await axios.post(apiUrl, jsonBody, { headers: { 'Content-Type': 'application/json' } });
    const form = new FormData();
    Object.entries(data.upload.fields || {}).forEach(([key, value]) => form.append(key, value));
    form.append('file', zip);
    await axios.post(data.upload.url, form, { headers: form.getHeaders() });

    console.log('Submission successful, ID:', data.submissionId);
    console.log(
      'Please copy-paste this ID into the Crossover assessment page. You may resubmit as many times as needed, but only the submission with the ID recorded on the Crossover page will be graded.',
    );
  } catch (error) {
    console.error('❌ Failed to upload submission. If you cannot resolve the issue, please contact support.', error);
    process.exit(1);
  }
}

async function handleSubmission() {
  const { name, email } = await getInputs();
  const diffPath = await createGitDiff();
  await confirmSubmission({ name, email, diffPath });
  const zip = await createZip();
  await uploadSubmission(zip, name, email);
}

handleSubmission().catch(console.error);
