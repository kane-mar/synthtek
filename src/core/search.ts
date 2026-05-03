/**
 * Search service using glob package for file discovery and grep
 */

import { SearcherService, GlobOptions, GlobResult, GrepOptions, GrepResult, GrepMatch } from './types.js';
import { glob } from 'glob';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';

export class SearchService implements SearcherService {
  async glob(options: GlobOptions): Promise<GlobResult> {
    const { pattern, path = '.', headLimit, offset = 0, entryType = 'files' } = options;

    try {
      const matches = await glob(pattern, {
        cwd: path,
        absolute: false,
        withFileTypes: entryType === 'dirs' ? false : undefined,
        dot: true,
        ignore: ['**/node_modules/**', '**/.git/**'],
      });

      // Apply offset and headLimit
      const sliced = offset > 0 ? matches.slice(offset) : matches;
      const truncated = headLimit ? sliced.length > headLimit : false;
      const limited = headLimit ? sliced.slice(0, headLimit) : sliced;

      return {
        matches: limited,
        total: matches.length,
        truncated,
      };
    } catch (err) {
      return {
        matches: [],
        total: 0,
        truncated: false,
      };
    }
  }

  async grep(options: GrepOptions): Promise<GrepResult> {
    const {
      pattern,
      path = '.',
      glob: globPattern,
      caseInsensitive = false,
      fixedStrings = false,
      outputMode = 'files_with_matches',
      contextBefore = 0,
      contextAfter = 0,
      headLimit = 250,
      offset = 0,
    } = options;

    const flags = caseInsensitive ? 'i' : '';
    const regex = fixedStrings
      ? new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags)
      : new RegExp(pattern, flags);

    const result: GrepResult = {
      matches: [],
      filesWithMatches: [],
      counts: {},
      totalMatches: 0,
      truncated: false,
    };

    // Find files to search
    let files: string[] = [];

    if (globPattern) {
      const globResult = await this.glob({ pattern: globPattern, path, headLimit: 10000 });
      files = globResult.matches.map(f => resolve(path, f));
    } else if (path) {
      // If path is a directory, glob for all files in it
      if (existsSync(path)) {
        if (statSync(path).isDirectory()) {
          const globResult = await this.glob({ pattern: '**/*', path, headLimit: 10000 });
          files = globResult.matches.map(f => resolve(path, f));
        } else {
          files = [path];
        }
      }
    } else {
      return result;
    }

    for (const file of files) {
      if (!existsSync(file)) continue;

      try {
        const content = readFileSync(file, 'utf-8');
        const lines = content.split('\n');
        const fileMatches: GrepMatch[] = [];

        for (let i = 0; i < lines.length; i++) {
          if (regex.test(lines[i])) {
            const match: GrepMatch = {
              file,
              line: i + 1,
              content: lines[i],
            };

            if (contextBefore > 0 || contextAfter > 0) {
              match.contextBefore = [];
              match.contextAfter = [];
              for (let j = Math.max(0, i - contextBefore); j < i; j++) {
                match.contextBefore.push(lines[j]);
              }
              for (let j = i + 1; j <= Math.min(lines.length - 1, i + contextAfter); j++) {
                match.contextAfter.push(lines[j]);
              }
            }

            fileMatches.push(match);
            result.totalMatches++;
          }
        }

        if (fileMatches.length > 0) {
          result.filesWithMatches.push(file);
          result.counts[file] = fileMatches.length;

          if (outputMode === 'content') {
            result.matches.push(...fileMatches);
          }
        }
      } catch {
        // Skip unreadable files
      }
    }

    // Apply headLimit
    if (outputMode === 'content') {
      const sliced = offset > 0 ? result.matches.slice(offset) : result.matches;
      result.truncated = sliced.length > headLimit;
      result.matches = headLimit ? sliced.slice(0, headLimit) : sliced;
    } else if (outputMode === 'count') {
      const sliced = offset > 0 ? Object.entries(result.counts).slice(offset) : Object.entries(result.counts);
      result.truncated = sliced.length > headLimit;
      result.counts = Object.fromEntries(headLimit ? sliced.slice(0, headLimit) : sliced);
    }

    return result;
  }
}
