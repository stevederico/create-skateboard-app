#!/usr/bin/env node

import { execSync } from 'child_process';
import {
  readFileSync,
  writeFileSync,
  existsSync,
  cpSync,
  rmSync,
  readdirSync
} from 'fs';
import { join, resolve, relative, sep } from 'path';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';

// Pin to skateboard 5.6.0 so a published CLI version always scaffolds a known tree.
// Override with SKATEBOARD_REPO (git URL or local path) and/or SKATEBOARD_REF.
const DEFAULT_TEMPLATE_REPO = 'https://github.com/stevederico/skateboard.git';
const DEFAULT_TEMPLATE_REF = '5.6.0';
const UI_PACKAGE = '@stevederico/skateboard-ui';

const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

let log = (message, color = 'reset') => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

let error = (message) => {
  log(`❌ ${message}`, 'red');
};

let success = (message) => {
  log(`✅ ${message}`, 'green');
};

let info = (message) => {
  log(`ℹ️  ${message}`, 'blue');
};

function checkCommand(command) {
  try {
    execSync(`which ${command}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

const VALID_COLORS = ['blue', 'green', 'purple', 'red', 'orange', 'yellow', 'pink', 'cyan', 'black'];
const VALID_ICONS = ['command', 'house', 'zap', 'rocket', 'diamond', 'target', 'flame', 'star'];

function parseFlags(argv) {
  const args = argv.slice(2);
  const flags = { positional: null };
  let i = 0;

  while (i < args.length) {
    const arg = args[i];
    if (arg === '-y' || arg === '--yes') {
      flags.yes = true;
    } else if (arg === '--quiet' || arg === '-q') {
      flags.quiet = true;
    } else if (arg === '--help' || arg === '-h') {
      flags.help = true;
    } else if (arg === '--version' || arg === '-v') {
      flags.version = true;
    } else if (arg === '--skip-install') {
      flags.skipInstall = true;
    } else if (arg === '--install') {
      flags.install = true;
    } else if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const knownValueFlags = ['name', 'tagline', 'color', 'icon', 'database', 'connection-string'];
      if (knownValueFlags.includes(key) && i + 1 < args.length) {
        i++;
        const val = args[i];
        if (key === 'name') flags.name = val;
        else if (key === 'tagline') flags.tagline = val;
        else if (key === 'color') flags.color = val;
        else if (key === 'icon') flags.icon = val;
        else if (key === 'database') flags.database = val;
        else if (key === 'connection-string') flags.connectionString = val;
      }
    } else if (!arg.startsWith('-') && !flags.positional) {
      flags.positional = arg;
    }
    i++;
  }

  return flags;
}

function validateFlags(flags) {
  if (flags.color && !VALID_COLORS.includes(flags.color)) {
    console.error(`Error: Invalid color "${flags.color}". Must be one of: ${VALID_COLORS.join(', ')}`);
    process.exit(1);
  }
  if (flags.icon && !VALID_ICONS.includes(flags.icon)) {
    console.error(`Error: Invalid icon "${flags.icon}". Must be one of: ${VALID_ICONS.join(', ')}`);
    process.exit(1);
  }
  if (flags.database || flags.connectionString) {
    console.error('Error: Database selection was removed in 2.0. Skateboard uses SQLite only.');
    process.exit(1);
  }
}

function templateRef() {
  return process.env.SKATEBOARD_REF || DEFAULT_TEMPLATE_REF;
}

function templateRepo() {
  return process.env.SKATEBOARD_REPO || DEFAULT_TEMPLATE_REPO;
}

function isRemoteRepo(repo) {
  return /^(https?:\/\/|git@|git:\/\/)/.test(repo);
}

function copyTemplateTree(src, dest) {
  const filter = (source) => {
    if (source === src) return true;
    const parts = relative(src, source).split(sep);
    return !parts.includes('.git') && !parts.includes('node_modules');
  };

  try {
    cpSync(src, dest, { recursive: true, verbatimSymlinks: true, filter });
  } catch (err) {
    if (err?.code === 'ERR_INVALID_ARG_VALUE' || /verbatimSymlinks/.test(err?.message || '')) {
      cpSync(src, dest, { recursive: true, filter });
      return;
    }
    throw err;
  }
}

function downloadTemplate(projectName) {
  const repo = templateRepo();
  const ref = templateRef();

  if (!isRemoteRepo(repo)) {
    if (!existsSync(repo)) {
      throw new Error(`Template path not found: ${repo}`);
    }
    info(`Copying template from ${repo}...`);
    copyTemplateTree(repo, projectName);
    success('Template copied successfully');
    return;
  }

  const methods = [
    {
      name: 'git clone',
      check: () => checkCommand('git'),
      execute: () => {
        execSync(
          `git clone --depth 1 --branch ${JSON.stringify(ref)} ${JSON.stringify(repo)} ${JSON.stringify(projectName)}`,
          { stdio: 'pipe', timeout: 60000 }
        );
        rmSync(join(projectName, '.git'), { recursive: true, force: true });
      }
    },
    {
      name: 'curl + tar',
      check: () => checkCommand('curl') && checkCommand('tar'),
      execute: () => {
        const archiveUrl = `https://github.com/stevederico/skateboard/archive/refs/tags/${encodeURIComponent(ref)}.tar.gz`;
        execSync(`curl -L ${JSON.stringify(archiveUrl)} | tar -xz`, {
          stdio: 'pipe',
          timeout: 60000
        });
        const extracted = findExtractedArchive(ref);
        execSync(`mv ${JSON.stringify(extracted)} ${JSON.stringify(projectName)}`, { stdio: 'pipe' });
      }
    },
    {
      name: 'curl + unzip',
      check: () => checkCommand('curl') && checkCommand('unzip'),
      execute: () => {
        const zipUrl = `https://github.com/stevederico/skateboard/archive/refs/tags/${encodeURIComponent(ref)}.zip`;
        execSync(`curl -L ${JSON.stringify(zipUrl)} -o temp-skateboard.zip`, {
          stdio: 'pipe',
          timeout: 60000
        });
        execSync('unzip -q temp-skateboard.zip', { stdio: 'pipe' });
        rmSync('temp-skateboard.zip', { force: true });
        const extracted = findExtractedArchive(ref);
        execSync(`mv ${JSON.stringify(extracted)} ${JSON.stringify(projectName)}`, { stdio: 'pipe' });
      }
    }
  ];

  for (const method of methods) {
    if (!method.check()) {
      log(`${method.name} not available, skipping...`, 'yellow');
      continue;
    }

    try {
      info(`Downloading skateboard ${ref} with ${method.name}...`);
      method.execute();
      success('Template downloaded successfully');
      return;
    } catch {
      log(`${method.name} failed, trying next method...`, 'yellow');
      rmSync(projectName, { recursive: true, force: true });
      rmSync('temp-skateboard.zip', { force: true });
    }
  }

  throw new Error(
    `Failed to download skateboard ${ref}. Ensure git or curl is available and check your internet connection.`
  );
}

function findExtractedArchive(ref) {
  const expected = `skateboard-${ref}`;
  if (existsSync(expected)) return expected;
  const match = readdirSync('.').find((name) => name.startsWith('skateboard-') && existsSync(join(name, 'package.json')));
  if (match) return match;
  throw new Error(`Could not find extracted skateboard archive for ref ${ref}`);
}

function ask(question, defaultValue = '') {
  if (!process.stdin.isTTY) {
    return Promise.resolve(defaultValue);
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolveAnswer) => {
    const prompt = defaultValue
      ? `${colors.cyan}${question}${colors.reset} ${colors.yellow}(${defaultValue})${colors.reset}: `
      : `${colors.cyan}${question}${colors.reset}: `;

    rl.question(prompt, (answer) => {
      rl.close();
      resolveAnswer(answer.trim() || defaultValue);
    });
  });
}

function askChoice(question, choices, defaultChoice = 0) {
  if (!process.stdin.isTTY) {
    return choices[defaultChoice];
  }

  return new Promise((resolveChoice) => {
    let currentChoice = defaultChoice;

    const displayMenu = () => {
      console.clear();
      log(`\n${colors.cyan}${question}${colors.reset}\n`);
      choices.forEach((choice, index) => {
        const marker = index === currentChoice ? '●' : '○';
        const color = index === currentChoice ? 'green' : 'reset';
        const highlight = index === currentChoice ? colors.bold : '';
        log(`  ${colors[color]}${highlight}${marker} ${choice.label}${colors.reset}`);
      });
      log(`\n${colors.yellow}Use ↑/↓ arrows to navigate, Enter to select${colors.reset}`);
    };

    displayMenu();

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    const handleKeypress = (key) => {
      switch (key) {
        case '\u001b[A':
          currentChoice = currentChoice > 0 ? currentChoice - 1 : choices.length - 1;
          displayMenu();
          break;
        case '\u001b[B':
          currentChoice = currentChoice < choices.length - 1 ? currentChoice + 1 : 0;
          displayMenu();
          break;
        case '\r':
        case '\n':
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', handleKeypress);
          resolveChoice(choices[currentChoice]);
          break;
        case '\u0003':
          process.exit(0);
          break;
      }
    };

    process.stdin.on('data', handleKeypress);
  });
}

async function collectProjectConfig(projectName, flags = {}) {
  const nonInteractive = flags.yes;

  if (!nonInteractive && !process.stdin.isTTY) {
    info('Non-interactive mode detected, using defaults. Use --flags to customize.');
  }

  if (!nonInteractive) {
    log(`\n${colors.bold}Let's configure your Skateboard app!${colors.reset}\n`);
  }

  const defaultAppName = projectName.split('-').map((word) =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
  const appName = flags.name || (nonInteractive ? defaultAppName : await ask('App display name', defaultAppName));
  const tagline = flags.tagline || (nonInteractive ? 'Try Something New' : await ask('App tagline', 'Try Something New'));

  const colorChoices = [
    { label: '🔵 Blue', value: 'blue' },
    { label: '💚 Green', value: 'green' },
    { label: '🟣 Purple', value: 'purple' },
    { label: '🔴 Red', value: 'red' },
    { label: '🟠 Orange', value: 'orange' },
    { label: '🟡 Yellow', value: 'yellow' },
    { label: '🩷 Pink', value: 'pink' },
    { label: '🩵 Cyan', value: 'cyan' },
    { label: '⚫ Black', value: 'black' }
  ];

  const selectedColor = flags.color
    ? colorChoices.find((c) => c.value === flags.color)
    : (nonInteractive ? colorChoices[0] : await askChoice('Choose your app color:', colorChoices));

  const iconChoices = [
    { label: '⌘ Command', value: 'command' },
    { label: '🏠 House', value: 'house' },
    { label: '⚡ Zap', value: 'zap' },
    { label: '🚀 Rocket', value: 'rocket' },
    { label: '💎 Diamond', value: 'diamond' },
    { label: '🎯 Target', value: 'target' },
    { label: '🔥 Flame', value: 'flame' },
    { label: '⭐ Star', value: 'star' }
  ];

  const selectedIcon = flags.icon
    ? iconChoices.find((c) => c.value === flags.icon)
    : (nonInteractive ? iconChoices[0] : await askChoice('Choose an app icon:', iconChoices));

  let pages = [
    { title: 'Dashboard', url: 'home', icon: 'layout-dashboard' }
  ];

  try {
    const templateConstantsPath = join(projectName, 'src', 'constants.json');
    if (existsSync(templateConstantsPath)) {
      const templateConstants = JSON.parse(readFileSync(templateConstantsPath, 'utf8'));
      if (templateConstants.pages && Array.isArray(templateConstants.pages)) {
        pages = templateConstants.pages;
      }
    }
  } catch {
    // Use fallback pages if reading fails
  }

  return {
    companyName: 'Your Company',
    appName,
    tagline,
    appColor: selectedColor.value,
    appIcon: selectedIcon.value,
    backendURL: '/api',
    devBackendURL: 'http://localhost:8000/api',
    pages,
    installDeps: flags.skipInstall ? false : true,
    initGit: true
  };
}

function writeJson(path, data, spaces) {
  writeFileSync(path, `${JSON.stringify(data, null, spaces)}\n`);
}

function applyBranding(projectName, config) {
  const packageJsonPath = join(projectName, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  packageJson.name = projectName;
  packageJson.version = '0.1.0';
  writeJson(packageJsonPath, packageJson, 2);
  success('Package.json updated');

  const constantsPath = join(projectName, 'src', 'constants.json');
  if (existsSync(constantsPath)) {
    const constants = JSON.parse(readFileSync(constantsPath, 'utf8'));
    constants.companyName = config.companyName;
    constants.appName = config.appName;
    constants.tagline = config.tagline;
    constants.appIcon = config.appIcon;
    constants.backendURL = config.backendURL;
    constants.devBackendURL = config.devBackendURL;
    constants.pages = config.pages;
    writeJson(constantsPath, constants, 4);
    success('App configuration updated');
  }

  const backendConfigPath = join(projectName, 'backend', 'config.json');
  if (existsSync(backendConfigPath)) {
    const backendConfig = JSON.parse(readFileSync(backendConfigPath, 'utf8'));
    const dbName = config.appName.replace(/\s+/g, '') || 'MyApp';
    backendConfig.database = {
      db: dbName,
      dbType: 'sqlite',
      connectionString: `./databases/${dbName}.db`
    };
    writeJson(backendConfigPath, backendConfig, 2);
    success('Database configured: sqlite');
  }

  const envExamplePath = join(projectName, 'backend', '.env.example');
  const envPath = join(projectName, 'backend', '.env');
  if (existsSync(envExamplePath) && !existsSync(envPath)) {
    writeFileSync(envPath, readFileSync(envExamplePath, 'utf8'));
    success('.env file created from .env.example');
  }

  const stylesPath = join(projectName, 'src', 'assets', 'styles.css');
  if (existsSync(stylesPath)) {
    let stylesContent = readFileSync(stylesPath, 'utf8');
    stylesContent = stylesContent.replace(
      /--color-app:\s*var\(--color-[^)]+\);/,
      `--color-app: var(--color-${config.appColor}-500);`
    );
    writeFileSync(stylesPath, stylesContent);
    success(`App color set to ${config.appColor}`);
  }
}

function showHelp() {
  log(`
${colors.bold}🛹 Create Skateboard App${colors.reset}

Scaffolds a React + Rust + SQLite SaaS app from skateboard ${DEFAULT_TEMPLATE_REF}.

${colors.cyan}Usage:${colors.reset}
  npx create-skateboard-app [project-name] [options]

${colors.cyan}Arguments:${colors.reset}
  project-name              Optional project directory name (will prompt if not provided)

${colors.cyan}Options:${colors.reset}
  --help, -h                Show this help message
  --version, -v             Show version number
  -y, --yes                 Accept all defaults, skip prompts
  --quiet, -q               Suppress decorative output, print JSON on success
  --name <value>            App display name
  --tagline <value>         App tagline
  --color <value>           App color (${VALID_COLORS.join(', ')})
  --icon <value>            App icon (${VALID_ICONS.join(', ')})
  --skip-install            Skip npm install (CI / smoke tests)
  --install                 Install frontend dependencies (default)

${colors.cyan}Examples:${colors.reset}
  npx create-skateboard-app                                        # Interactive mode
  npx create-skateboard-app my-app                                 # With project name
  npx create-skateboard-app my-app -y                              # All defaults, no prompts
  npx create-skateboard-app my-app --color red --icon rocket -y    # Custom values
  npx create-skateboard-app my-app -y --quiet                      # CI/agent-friendly

${colors.cyan}After scaffolding:${colors.reset}
  cd my-app
  npm install
  npm start                 # frontend  http://localhost:5173
  cd backend && cargo run   # backend   http://localhost:8000

Frontend is Vite. Backend is Rust. There is no npm run server.
Database is SQLite only.
`, 'reset');
}

function showVersion() {
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  log(`v${packageJson.version}`, 'green');
}

function assertScaffoldShape(projectName) {
  const packageJson = JSON.parse(readFileSync(join(projectName, 'package.json'), 'utf8'));
  if (packageJson.dependencies?.[UI_PACKAGE] !== '5.1.0') {
    throw new Error(`Expected ${UI_PACKAGE} to be pinned to 5.1.0`);
  }
  const engines = packageJson.engines?.node || '';
  if (!engines.includes('24')) {
    throw new Error(`Expected engines.node to require Node 24+, got ${engines}`);
  }
  if (!existsSync(join(projectName, 'backend', 'Cargo.toml'))) {
    throw new Error('Expected backend/Cargo.toml (Rust backend)');
  }
  if (!existsSync(join(projectName, 'src', 'legal.json'))) {
    throw new Error('Expected src/legal.json');
  }
  if (existsSync(join(projectName, 'backend', 'package.json'))) {
    throw new Error('Unexpected backend/package.json — skateboard 5.6 is Rust, not Node/Hono');
  }
}

async function main() {
  const flags = parseFlags(process.argv);
  validateFlags(flags);

  if (flags.help) {
    showHelp();
    process.exit(0);
  }

  if (flags.version) {
    showVersion();
    process.exit(0);
  }

  const quiet = flags.quiet;
  if (quiet) {
    const noop = () => {};
    log = noop;
    error = (msg) => console.error(msg);
    success = noop;
    info = noop;
  }

  let projectName = flags.positional;

  if (!projectName) {
    if (flags.yes) {
      projectName = 'my-skateboard-app';
    } else {
      log(`\n${colors.bold}🛹 Welcome to Skateboard App Creator!${colors.reset}\n`);
      projectName = await ask('Project directory name', 'my-skateboard-app');
    }
  }

  if (!/^[a-zA-Z0-9-_]+$/.test(projectName)) {
    error('Project name can only contain letters, numbers, hyphens, and underscores');
    process.exit(1);
  }

  if (existsSync(projectName)) {
    error(`Directory '${projectName}' already exists`);
    process.exit(1);
  }

  try {
    log(`\n${colors.bold}🛹 Creating Skateboard app: ${projectName}${colors.reset}\n`);

    info(`Fetching skateboard ${templateRef()}...`);
    downloadTemplate(projectName);

    const config = await collectProjectConfig(projectName, flags);

    info('Applying project branding...');
    applyBranding(projectName, config);
    assertScaffoldShape(projectName);

    if (config.installDeps) {
      info('Installing dependencies...');
      execSync(`cd ${JSON.stringify(projectName)} && npm install`, { stdio: quiet ? 'pipe' : 'inherit' });
      success('Dependencies installed');
    }

    if (config.initGit && checkCommand('git')) {
      info('Initializing git repository...');
      execSync(`cd ${JSON.stringify(projectName)} && git init`, { stdio: 'pipe' });
      success('Git repository initialized');
    }

    if (quiet) {
      console.log(JSON.stringify({ success: true, path: resolve(projectName) }));
    } else {
      log(`\n${colors.bold}${colors.green}🎉 Success! Created ${config.appName}${colors.reset}\n`);

      log(`\n${colors.yellow}💳 Stripe Setup:${colors.reset}`);
      log(`  Copy ${colors.cyan}backend/.env.example${colors.reset} to ${colors.cyan}backend/.env${colors.reset} and set:`);
      log(`  ${colors.green}JWT_SECRET=your-secret-key${colors.reset}`);
      log(`  ${colors.green}STRIPE_KEY=sk_test_your_stripe_secret_key_here${colors.reset}`);
      log(`  ${colors.green}STRIPE_ENDPOINT_SECRET=whsec_your_webhook_endpoint_secret_here${colors.reset}`);
      log(`  Step by Step Guide: ${colors.blue}https://github.com/stevederico/skateboard#-stripe-setup${colors.reset}`);

      log(`\n${colors.bold}Get started with:${colors.reset}`, 'yellow');
      log(`\n  ${colors.cyan}cd ${projectName}${colors.reset}`);
      log(`  ${colors.cyan}npm install${colors.reset}`);
      log(`  ${colors.cyan}npm start${colors.reset}                 ${colors.yellow}# frontend  http://localhost:5173${colors.reset}`);
      log(`  ${colors.cyan}cd backend && cargo run${colors.reset}   ${colors.yellow}# backend   http://localhost:8000${colors.reset}`);
      log(`\n${colors.yellow}Frontend is Vite. Backend is Rust. There is no npm run server.${colors.reset}`);
      log(`${colors.yellow}Happy skating! 🛹${colors.reset}\n`);
    }
  } catch (err) {
    if (quiet) {
      console.log(JSON.stringify({ success: false, error: err.message }));
    } else {
      error(`Failed to create project: ${err.message}`);
    }
    process.exit(1);
  }
}

const isDirectRun = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

export {
  parseFlags,
  validateFlags,
  applyBranding,
  DEFAULT_TEMPLATE_REF,
  DEFAULT_TEMPLATE_REPO
};

if (isDirectRun) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
