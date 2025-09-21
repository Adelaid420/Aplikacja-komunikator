#!/usr/bin/env node
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import https from 'node:https';
import { spawn } from 'node:child_process';

const ROOT = path.dirname(fileURLToPath(new URL('../package.json', import.meta.url)));
const WRAPPER_PATH = path.join(ROOT, 'android', 'gradle', 'wrapper', 'gradle-wrapper.jar');
const DEFAULT_URL = 'https://raw.githubusercontent.com/gradle/gradle/v8.2.1/gradle/wrapper/gradle-wrapper.jar';
const jarUrl = process.env.GRADLE_WRAPPER_JAR_URL ?? DEFAULT_URL;
const allowFailure = process.argv.includes('--allow-failure');

if (existsSync(WRAPPER_PATH)) {
  console.log('Gradle wrapper JAR already present, skipping download.');
  process.exit(0);
}

console.log(`Downloading Gradle wrapper from ${jarUrl} ...`);

try {
  const buffer = await download(jarUrl);
  mkdirSync(path.dirname(WRAPPER_PATH), { recursive: true });
  writeFileSync(WRAPPER_PATH, buffer);
  console.log('Gradle wrapper downloaded to', WRAPPER_PATH);
} catch (error) {
  console.error('Failed to download Gradle wrapper JAR:', error instanceof Error ? error.message : String(error));
  console.error('You can set GRADLE_WRAPPER_JAR_URL to override the source.');
  if (allowFailure) {
    console.error('Continuing without the wrapper JAR — run "npm run fetch:gradle-wrapper" later or retry.');
  } else {
    process.exitCode = 1;
  }
}

async function download(url) {
  try {
    return await downloadViaHttps(url);
  } catch (error) {
    console.error('Direct HTTPS download failed, trying curl fallback...');
    return await downloadViaCurl(url);
  }
}

async function downloadViaHttps(url) {
  const visited = new Set();
  let currentUrl = url;
  while (true) {
    if (visited.has(currentUrl)) {
      throw new Error('Redirect loop while downloading Gradle wrapper.');
    }
    visited.add(currentUrl);
    const result = await requestOnce(currentUrl);
    if (result.redirect) {
      currentUrl = result.redirect;
      continue;
    }
    return result.buffer;
  }
}

function requestOnce(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400 && res.headers.location) {
        res.resume();
        const nextUrl = new URL(res.headers.location, url).toString();
        resolve({ redirect: nextUrl });
        return;
      }
      if (status !== 200) {
        reject(new Error(`Unexpected response ${status}`));
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        resolve({ buffer: Buffer.concat(chunks) });
      });
    });
    req.on('error', reject);
  });
}

async function downloadViaCurl(url) {
  const command = process.platform === 'win32' ? 'curl.exe' : 'curl';
  return new Promise((resolve, reject) => {
    const child = spawn(command, ['-fsSL', url], { stdio: ['ignore', 'pipe', 'pipe'] });
    const chunks = [];
    const errors = [];
    child.stdout.on('data', (chunk) => chunks.push(chunk));
    child.stderr.on('data', (chunk) => errors.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve(Buffer.concat(chunks));
      } else {
        reject(new Error(`curl exited with code ${code}: ${Buffer.concat(errors).toString('utf-8')}`));
      }
    });
  });
}
