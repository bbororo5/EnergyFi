import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');
const sourcePath = path.join(
  repoRoot,
  'contracts',
  'artifacts',
  'contracts',
  'interfaces',
  'ops',
  'IReputationRegistry.sol',
  'IReputationRegistry.json',
);
const targetDir = path.join(repoRoot, 'mobile', 'generated');
const targetPath = path.join(targetDir, 'reputation-registry.ts');

if (!fs.existsSync(sourcePath)) {
  throw new Error(`ABI source not found: ${sourcePath}`);
}

const artifact = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
const file = `/* eslint-disable */
// AUTO-GENERATED from contracts/artifacts/contracts/interfaces/ops/IReputationRegistry.sol/IReputationRegistry.json
// Do not edit manually. Run \`npm run sync:contracts\` in mobile after contract ABI changes.

export const reputationRegistryAbi = ${JSON.stringify(artifact.abi, null, 2)} as const;
`;

fs.mkdirSync(targetDir, { recursive: true });
fs.writeFileSync(targetPath, file);

console.log(`Synced ABI to ${path.relative(repoRoot, targetPath)}`);
