import fsp from 'node:fs/promises';
import path from 'node:path';
import { BOGUS_TITLES } from './dialogue.js';

export async function parseMapFile(filePath) {
  try {
    const text = await fsp.readFile(filePath, 'utf8');
    const mData = JSON.parse(text);
    if (!mData || !Array.isArray(mData.events)) return [];

    const matches = [];
    for (const ev of mData.events) {
      if (!ev || !Array.isArray(ev.pages)) continue;
      for (const page of ev.pages) {
        if (!page || !Array.isArray(page.list)) continue;
        let pendingTitle = null;

        for (const cmd of page.list) {
          if (!cmd) continue;

          if (cmd.code === 102) {
            const choices = cmd.parameters?.[0];
            if (Array.isArray(choices) && choices.length > 0) {
              const cleaned = String(choices[0])
                .replace(/\\[A-Za-z]+(?:\[[\d\w]+\])?/g, '')
                .replace(/<[^>]+>/g, '')
                .trim();
              if (cleaned && !BOGUS_TITLES.has(cleaned.toLowerCase()) && cleaned.length < 35) {
                pendingTitle = cleaned;
              } else {
                pendingTitle = null;
              }
            } else {
              pendingTitle = null;
            }
          }

          let vid = null;
          if (cmd.code === 355 || cmd.code === 655) {
            const script = cmd.parameters?.[0] || '';
            const vm = /(?:loadVideo|newVideo|playVideo)\('([^']+)'\)/.exec(script);
            if (vm) vid = vm[1];
          } else if (cmd.code === 357) {
            const param = cmd.parameters?.[3];
            if (param && param.id) vid = String(param.id);
          }

          if (vid && pendingTitle) {
            matches.push({ vid, title: pendingTitle });
          }
        }
      }
    }
    return matches;
  } catch {
    return [];
  }
}

export async function parseMapFilesBatch(dataDir, mapFiles, { batchSize = 16, onProgress } = {}) {
  const titlesByVid = {};
  const total = mapFiles.length;
  if (total === 0) return titlesByVid;

  let completed = 0;

  for (let i = 0; i < total; i += batchSize) {
    const chunk = mapFiles.slice(i, i + batchSize);
    const chunkPromises = chunk.map(async (fileName) => {
      const fullPath = path.join(dataDir, fileName);
      return parseMapFile(fullPath);
    });

    const results = await Promise.all(chunkPromises);
    for (const fileMatches of results) {
      for (const { vid, title } of fileMatches) {
        if (!titlesByVid[vid]) {
          titlesByVid[vid] = [];
        }
        if (!titlesByVid[vid].includes(title)) {
          titlesByVid[vid].push(title);
        }
      }
    }

    completed += chunk.length;
    if (typeof onProgress === 'function') {
      const percent = Math.min(100, Math.round((completed / total) * 100));
      onProgress({
        step: 'maps',
        current: completed,
        total,
        percent,
        message: `Parsing game maps (${completed}/${total})…`,
      });
    }
  }

  return titlesByVid;
}
