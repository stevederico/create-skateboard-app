import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLI = join(ROOT, 'bin', 'cli.js');
const TEMPLATE_REF = '5.6.0';
const UI_PACKAGE = '@stevederico/skateboard-ui';

function readCliPackage() {
  return JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
}

function runCli(args, { cwd, env } = {}) {
  return spawnSync(process.execPath, [CLI, ...args], {
    cwd,
    env: { ...process.env, ...env },
    encoding: 'utf8'
  });
}

function ensureLocalTemplate() {
  const cached = join(tmpdir(), `csa-skateboard-${TEMPLATE_REF}`);
  if (existsSync(join(cached, 'package.json')) && existsSync(join(cached, 'backend', 'Cargo.toml'))) {
    return cached;
  }
  rmSync(cached, { recursive: true, force: true });
  const clone = spawnSync(
    'git',
    ['clone', '--depth', '1', '--branch', TEMPLATE_REF, 'https://github.com/stevederico/skateboard.git', cached],
    { encoding: 'utf8' }
  );
  if (clone.status !== 0) {
    throw new Error(`Failed to clone skateboard ${TEMPLATE_REF}: ${clone.stderr || clone.stdout}`);
  }
  return cached;
}

function assertScaffoldShape(appDir, { projectName, appName, appColor } = {}) {
  const pkgPath = join(appDir, 'package.json');
  assert.ok(existsSync(pkgPath), 'generated package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));

  assert.equal(pkg.dependencies?.[UI_PACKAGE], '5.1.0', `${UI_PACKAGE} must be pinned to 5.1.0`);
  assert.equal(pkg.skateboardVersion, TEMPLATE_REF, 'skateboardVersion must stay 5.6.0');
  assert.match(pkg.engines?.node || '', /24/, 'engines.node must require Node 24+');
  if (projectName) {
    assert.equal(pkg.name, projectName);
  }

  const serializedPkg = JSON.stringify(pkg);
  assert.doesNotMatch(serializedPkg, /"pg"/);
  assert.doesNotMatch(serializedPkg, /"mongodb"/);
  assert.doesNotMatch(serializedPkg, /"hono"/i);

  const cargoPath = join(appDir, 'backend', 'Cargo.toml');
  assert.ok(existsSync(cargoPath), 'backend/Cargo.toml (Rust)');
  const cargo = readFileSync(cargoPath, 'utf8');
  assert.match(cargo, /\[package\]/);
  assert.match(cargo, /libsqlite3|sqlite|zero-crate/i);

  assert.ok(existsSync(join(appDir, 'backend', 'src', 'main.rs')), 'backend/src/main.rs');
  assert.ok(existsSync(join(appDir, 'src', 'main.tsx')), 'src/main.tsx');
  assert.ok(existsSync(join(appDir, 'src', 'legal.json')), 'src/legal.json');
  assert.ok(existsSync(join(appDir, 'src', 'constants.json')), 'src/constants.json');
  assert.ok(existsSync(join(appDir, 'scripts', 'update-skateboard.js')), 'scripts/update-skateboard.js');
  assert.equal(existsSync(join(appDir, 'backend', 'package.json')), false, 'no Hono backend/package.json');

  const backendConfig = JSON.parse(readFileSync(join(appDir, 'backend', 'config.json'), 'utf8'));
  assert.equal(backendConfig.database.dbType, 'sqlite');
  assert.doesNotMatch(JSON.stringify(backendConfig), /postgres|mongodb/i);

  const constants = JSON.parse(readFileSync(join(appDir, 'src', 'constants.json'), 'utf8'));
  if (appName) {
    assert.equal(constants.appName, appName);
  }

  if (appColor) {
    const styles = readFileSync(join(appDir, 'src', 'assets', 'styles.css'), 'utf8');
    assert.match(styles, new RegExp(`--color-app:\\s*var\\(--color-${appColor}-500\\)`));
  }
}

test('CLI package metadata drops Hono and multi-DB claims', () => {
  const pkg = readCliPackage();
  assert.equal(pkg.version, '2.0.0');
  assert.match(pkg.engines.node, /24/);
  assert.equal(pkg.keywords.includes('hono'), false);
  assert.equal(pkg.keywords.includes('postgresql'), false);
  assert.equal(pkg.keywords.includes('mongodb'), false);
  assert.ok(pkg.keywords.includes('rust'));
  assert.ok(pkg.keywords.includes('sqlite'));
  assert.doesNotMatch(pkg.description, /hono/i);
  assert.match(pkg.description, /rust/i);
});

test('README matches the skateboard 5.6 run story', () => {
  const readme = readFileSync(join(ROOT, 'README.md'), 'utf8');
  assert.doesNotMatch(readme, /Hono/);
  assert.doesNotMatch(readme, /npm run server/);
  assert.match(readme, /npm start/);
  assert.match(readme, /cargo run/);
  assert.match(readme, /\.env\.example/);
  assert.match(readme, /Node\.js 24/);
  assert.match(readme, /SQLite/);
  assert.match(readme, /Rust/);
});

test('--help describes Rust + SQLite and named/interactive flows', () => {
  const result = runCli(['--help']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /create-skateboard-app/);
  assert.match(result.stdout, /Interactive mode/);
  assert.match(result.stdout, /With project name/);
  assert.match(result.stdout, /cargo run/);
  assert.match(result.stdout, /SQLite/);
  assert.doesNotMatch(result.stdout, /Hono/);
  assert.doesNotMatch(result.stdout, /--database/);
});

test('--version prints the package version', () => {
  const result = runCli(['--version']);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /v2\.0\.0/);
});

test('rejects leftover --database flags', () => {
  const result = runCli(['demo', '--database', 'postgresql', '-y']);
  assert.notEqual(result.status, 0);
  assert.match(`${result.stdout}\n${result.stderr}`, /SQLite only/);
});

test('named and default -y flows scaffold skateboard 5.6', () => {
  const template = ensureLocalTemplate();
  const cwd = mkdtempSync(join(tmpdir(), 'csa-smoke-'));

  try {
    const named = runCli(
      ['my-app', '-y', '--skip-install', '--quiet', '--name', 'Harbor', '--color', 'red'],
      { cwd, env: { SKATEBOARD_REPO: template } }
    );
    assert.equal(named.status, 0, named.stderr || named.stdout);
    const namedPayload = JSON.parse(named.stdout.trim().split('\n').at(-1));
    assert.equal(namedPayload.success, true);
    assertScaffoldShape(join(cwd, 'my-app'), {
      projectName: 'my-app',
      appName: 'Harbor',
      appColor: 'red'
    });

    const unnamed = runCli(
      ['-y', '--skip-install', '--quiet'],
      { cwd, env: { SKATEBOARD_REPO: template } }
    );
    assert.equal(unnamed.status, 0, unnamed.stderr || unnamed.stdout);
    const unnamedPayload = JSON.parse(unnamed.stdout.trim().split('\n').at(-1));
    assert.equal(unnamedPayload.success, true);
    assert.ok(existsSync(join(cwd, 'my-skateboard-app', 'backend', 'Cargo.toml')));
    assertScaffoldShape(join(cwd, 'my-skateboard-app'), {
      projectName: 'my-skateboard-app',
      appName: 'My Skateboard App'
    });
  } finally {
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('scaffold fails closed if the template is not skateboard 5.6', () => {
  const fake = mkdtempSync(join(tmpdir(), 'csa-fake-'));
  writeFileSync(join(fake, 'package.json'), JSON.stringify({
    name: 'not-skateboard',
    version: '0.0.0',
    dependencies: { [UI_PACKAGE]: '1.0.0' },
    engines: { node: '>=18' }
  }, null, 2));

  const cwd = mkdtempSync(join(tmpdir(), 'csa-bad-'));
  try {
    const result = runCli(['broken-app', '-y', '--skip-install', '--quiet'], {
      cwd,
      env: { SKATEBOARD_REPO: fake }
    });
    assert.notEqual(result.status, 0);
    const payload = JSON.parse(result.stdout.trim().split('\n').at(-1));
    assert.equal(payload.success, false);
    assert.match(payload.error, /5\.1\.0|Node 24|Cargo.toml/);
  } finally {
    rmSync(cwd, { recursive: true, force: true });
    rmSync(fake, { recursive: true, force: true });
  }
});
