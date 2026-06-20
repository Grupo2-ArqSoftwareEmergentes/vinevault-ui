import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const apiBaseUrl = process.env.API_BASE_URL?.trim() || 'http://localhost:8000';
const targetPath = resolve('src/environments/environment.generated.ts');
const targetDir = dirname(targetPath);

const contents = `export const environment = {
  production: true,
  apiBaseUrl: '${apiBaseUrl}',
} as const;
`;

await mkdir(targetDir, { recursive: true });
await writeFile(targetPath, contents, 'utf8');
