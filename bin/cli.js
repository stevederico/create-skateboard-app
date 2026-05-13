#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, resolve } from 'path';
import https from 'https';
import { createWriteStream } from 'fs';
import { createInterface } from 'readline';

// Simple colors using ANSI codes
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
const VALID_DATABASES = ['sqlite', 'postgresql', 'mongodb'];

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
  if (flags.database && !VALID_DATABASES.includes(flags.database)) {
    console.error(`Error: Invalid database "${flags.database}". Must be one of: ${VALID_DATABASES.join(', ')}`);
    process.exit(1);
  }
  if (flags.connectionString && (!flags.database || flags.database === 'sqlite')) {
    console.error('Warning: --connection-string is ignored when database is sqlite. Use --database postgresql or --database mongodb.');
  }
}

async function downloadTemplate(projectName) {
  // Try multiple methods in order of preference
  const methods = [
    {
      name: 'git clone',
      check: () => checkCommand('git'),
      execute: () => {
        execSync(`git clone --depth 1 --single-branch https://github.com/stevederico/skateboard.git ${projectName}`, { 
          stdio: 'pipe',
          timeout: 15000
        });
        // Remove .git directory to avoid including git history
        execSync(`rm -rf ${projectName}/.git`, { stdio: 'pipe' });
      }
    },
    {
      name: 'curl + tar',
      check: () => checkCommand('curl') && checkCommand('tar'),
      execute: () => {
        // Download and extract in one step, avoiding the skateboard-master folder issue
        execSync(`curl -L https://github.com/stevederico/skateboard/archive/refs/heads/master.tar.gz | tar -xz`, { 
          stdio: 'pipe',
          timeout: 15000
        });
        // Move contents from skateboard-master to the project directory
        execSync(`mv skateboard-master ${projectName}`, { stdio: 'pipe' });
      }
    },
    {
      name: 'curl + unzip',
      check: () => checkCommand('curl') && checkCommand('unzip'),
      execute: () => {
        execSync(`curl -L https://github.com/stevederico/skateboard/archive/refs/heads/master.zip -o temp.zip`, { 
          stdio: 'pipe',
          timeout: 15000
        });
        execSync(`unzip -q temp.zip`, { stdio: 'pipe' });
        // Move the extracted skateboard-master folder to the project name
        execSync(`mv skateboard-master ${projectName}`, { stdio: 'pipe' });
        execSync(`rm temp.zip`, { stdio: 'pipe' });
      }
    }
  ];

  for (const method of methods) {
    if (!method.check()) {
      log(`${method.name} not available, skipping...`, 'yellow');
      continue;
    }
    
    try {
      info(`Downloading template with ${method.name}...`);
      method.execute();
      success(`Template downloaded successfully`);
      return;
    } catch (err) {
      log(`${method.name} failed, trying next method...`, 'yellow');
    }
  }

  throw new Error('All download methods failed. Please ensure you have git or curl available and check your internet connection.');
}

// Interactive prompt functions
function ask(question, defaultValue = '') {
  // When stdin is not a TTY (piped input, CI, agents), use default value
  if (!process.stdin.isTTY) {
    return Promise.resolve(defaultValue);
  }

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    const prompt = defaultValue
      ? `${colors.cyan}${question}${colors.reset} ${colors.yellow}(${defaultValue})${colors.reset}: `
      : `${colors.cyan}${question}${colors.reset}: `;

    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

function askChoice(question, choices, defaultChoice = 0) {
  // When stdin is not a TTY (piped input, CI, agents), use default choice
  if (!process.stdin.isTTY) {
    return choices[defaultChoice];
  }

  return new Promise((resolve) => {
    let currentChoice = defaultChoice;

    const displayMenu = () => {
      // Clear screen and show menu
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

    // Enable raw mode to capture arrow keys
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    const handleKeypress = (key) => {
      switch (key) {
        case '\u001b[A': // Up arrow
          currentChoice = currentChoice > 0 ? currentChoice - 1 : choices.length - 1;
          displayMenu();
          break;
        case '\u001b[B': // Down arrow
          currentChoice = currentChoice < choices.length - 1 ? currentChoice + 1 : 0;
          displayMenu();
          break;
        case '\r': // Enter
        case '\n':
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdin.removeListener('data', handleKeypress);
          resolve(choices[currentChoice]);
          break;
        case '\u0003': // Ctrl+C
          process.exit(0);
          break;
      }
    };

    process.stdin.on('data', handleKeypress);
  });
}

async function askYesNo(question, defaultYes = true) {
  const defaultText = defaultYes ? 'Y/n' : 'y/N';
  const answer = await ask(`${question} (${defaultText})`, defaultYes ? 'y' : 'n');
  return answer.toLowerCase().startsWith('y');
}

async function collectProjectConfig(projectName, flags = {}) {
  const nonInteractive = flags.yes;

  if (!nonInteractive && !process.stdin.isTTY) {
    info('Non-interactive mode detected, using defaults. Use --flags to customize.');
  }

  if (!nonInteractive) {
    log(`\n${colors.bold}Let's configure your Skateboard app!${colors.reset}\n`);
  }

  // App name
  const defaultAppName = projectName.split('-').map(word =>
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' ');
  const appName = flags.name || (nonInteractive ? defaultAppName : await ask('App display name', defaultAppName));

  // Tagline
  const tagline = flags.tagline || (nonInteractive ? 'Try Something New' : await ask('App tagline', 'Try Something New'));

  // App color selection
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
    ? colorChoices.find(c => c.value === flags.color)
    : (nonInteractive ? colorChoices[0] : await askChoice('Choose your app color:', colorChoices));

  // App icon
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
    ? iconChoices.find(c => c.value === flags.icon)
    : (nonInteractive ? iconChoices[0] : await askChoice('Choose an app icon:', iconChoices));

  // Database selection
  const databaseChoices = [
    { label: '🗃️  SQLite (default)', value: 'sqlite', connectionString: `./databases/${appName.replace(/\s+/g, '')}.db` },
    { label: '🐘 PostgreSQL', value: 'postgresql', connectionString: 'postgresql://user:password@localhost:5432/dbname' },
    { label: '🍃 MongoDB', value: 'mongodb', connectionString: 'mongodb://localhost:27017/dbname' }
  ];

  const selectedDatabase = flags.database
    ? databaseChoices.find(c => c.value === flags.database)
    : (nonInteractive ? databaseChoices[0] : await askChoice('Choose your database:', databaseChoices, 0));

  // Get connection string for non-SQLite databases
  let connectionString = flags.connectionString || '';
  if (!connectionString && !nonInteractive) {
    if (selectedDatabase.value === 'postgresql') {
      connectionString = await ask('PostgreSQL connection string (optional)', '');
    } else if (selectedDatabase.value === 'mongodb') {
      connectionString = await ask('MongoDB connection string (optional)', '');
    }
  }

  // Default values for removed questions
  const backendURL = '/api';
  const devBackendURL = 'http://localhost:8000/api';
  const companyName = 'Your Company';
  
  // Read pages from the downloaded template's constants.json
  let pages = [
    { title: 'Home', url: 'home', icon: 'house' },
    { title: 'Other', url: 'other', icon: 'inbox' }
  ];
  
  try {
    const templateConstantsPath = join(projectName, 'src', 'constants.json');
    if (existsSync(templateConstantsPath)) {
      const templateConstants = JSON.parse(readFileSync(templateConstantsPath, 'utf8'));
      if (templateConstants.pages && Array.isArray(templateConstants.pages)) {
        pages = templateConstants.pages;
      }
    }
  } catch (err) {
    // Use fallback pages if reading fails
  }

  // Installation preferences
  const installDeps = true; // Always install dependencies
  const initGit = true; // Always initialize git repository

  return {
    companyName,
    appName,
    tagline,
    appColor: selectedColor.value,
    appIcon: selectedIcon.value,
    database: selectedDatabase,
    connectionString,
    backendURL,
    devBackendURL,
    pages,
    installDeps,
    initGit
  };
}

function showHelp() {
  log(`
${colors.bold}🛹 Create Skateboard App${colors.reset}

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
  --database <value>        Database type (${VALID_DATABASES.join(', ')})
  --connection-string <v>   Database connection string

${colors.cyan}Examples:${colors.reset}
  npx create-skateboard-app                                        # Interactive mode
  npx create-skateboard-app my-app                                 # With project name
  npx create-skateboard-app my-app -y                              # All defaults, no prompts
  npx create-skateboard-app my-app --color red --icon rocket -y    # Custom values
  npx create-skateboard-app my-app -y --quiet                      # CI/agent-friendly
`, 'reset');
}

function showVersion() {
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  log(`v${packageJson.version}`, 'green');
}

async function main() {
  // Parse flags from argv
  const flags = parseFlags(process.argv);
  validateFlags(flags);

  // Handle help and version flags
  if (flags.help) {
    showHelp();
    process.exit(0);
  }

  if (flags.version) {
    showVersion();
    process.exit(0);
  }

  // Quiet mode: override log functions to suppress output
  const quiet = flags.quiet;
  if (quiet) {
    const noop = () => {};
    log = noop;
    error = (msg) => console.error(msg);
    success = noop;
    info = noop;
  }

  let projectName = flags.positional;

  // If no project name provided, ask for it or use default
  if (!projectName) {
    if (flags.yes) {
      projectName = 'my-skateboard-app';
    } else {
      log(`\n${colors.bold}🛹 Welcome to Skateboard App Creator!${colors.reset}\n`);
      projectName = await ask('Project directory name', 'my-skateboard-app');
    }
  }

  // Validate project name
  if (!/^[a-zA-Z0-9-_]+$/.test(projectName)) {
    error('Project name can only contain letters, numbers, hyphens, and underscores');
    process.exit(1);
  }

  // Check if directory already exists
  if (existsSync(projectName)) {
    error(`Directory '${projectName}' already exists`);
    process.exit(1);
  }

  try {
    log(`\n${colors.bold}🛹 Creating Skateboard app: ${projectName}${colors.reset}\n`);

    // Step 1: Download the template with fallback methods
    info('Downloading template...');
    await downloadTemplate(projectName);

    // Step 2: Collect user configuration
    const config = await collectProjectConfig(projectName, flags);

    // Step 3: Update package.json
    info('Updating package.json...');
    const packageJsonPath = join(projectName, 'package.json');
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    packageJson.name = projectName;
    packageJson.version = '0.1.0';
    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    success('Package.json updated');

    // Step 4: Update constants.json with user configuration
    info('Configuring app settings...');
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
      writeFileSync(constantsPath, JSON.stringify(constants, null, 4));
      success('App configuration updated');
    }

    // Step 5: Configure database settings
    info('Configuring database...');
    const backendConfigPath = join(projectName, 'backend', 'config.json');
    if (existsSync(backendConfigPath)) {
      const backendConfig = JSON.parse(readFileSync(backendConfigPath, 'utf8'));
      
      // Update the database configuration
      if (backendConfig.database) {
        backendConfig.database.dbType = config.database.value;
        backendConfig.database.db = config.appName.replace(/\s+/g, '');

        if (config.database.value === 'sqlite') {
          backendConfig.database.connectionString = config.database.connectionString;
        } else if (config.database.value === 'postgresql') {
          backendConfig.database.connectionString = '${POSTGRES_URL}';
        } else if (config.database.value === 'mongodb') {
          backendConfig.database.connectionString = '${MONGODB_URL}';
        }
      }
      
      writeFileSync(backendConfigPath, JSON.stringify(backendConfig, null, 2));
      success(`Database configured: ${config.database.value}`);
    }

    // Step 5b: Inject database driver into backend deps (sqlite uses node:sqlite, no driver needed)
    const driverMap = {
      postgresql: { pg: '^8.20.0' },
      mongodb: { mongodb: '^6.19.0' }
    };
    const driver = driverMap[config.database.value];
    if (driver) {
      const backendPkgPath = join(projectName, 'backend', 'package.json');
      const backendPkg = JSON.parse(readFileSync(backendPkgPath, 'utf8'));
      backendPkg.dependencies = { ...backendPkg.dependencies, ...driver };
      writeFileSync(backendPkgPath, JSON.stringify(backendPkg, null, 4));
      success(`Added ${Object.keys(driver)[0]} driver`);
    }

    // Create .env file from .env.example
    info('Creating .env file...');
    const backendDir = join(projectName, 'backend');
    const envExamplePath = join(backendDir, '.env.example');
    const envPath = join(backendDir, '.env');

    if (existsSync(envExamplePath)) {
      let envContent = readFileSync(envExamplePath, 'utf8');

      // Uncomment the relevant database line
      if (config.database.value === 'mongodb') {
        if (config.connectionString) {
          envContent = envContent.replace(/# MONGODB_URL=.*/, `MONGODB_URL=${config.connectionString}`);
        } else {
          envContent = envContent.replace(/# MONGODB_URL=/, 'MONGODB_URL=');
        }
      } else if (config.database.value === 'postgresql') {
        if (config.connectionString) {
          envContent = envContent.replace(/# POSTGRES_URL=.*/, `POSTGRES_URL=${config.connectionString}`);
        } else {
          envContent = envContent.replace(/# POSTGRES_URL=/, 'POSTGRES_URL=');
        }
      }

      writeFileSync(envPath, envContent);
      success('.env file created');
    }

    // Step 6: Update app color in styles.css
    info('Setting app color...');
    const stylesPath = join(projectName, 'src', 'assets', 'styles.css');
    if (existsSync(stylesPath)) {
      let stylesContent = readFileSync(stylesPath, 'utf8');
      // Replace the app color in the @theme block
      stylesContent = stylesContent.replace(
        /--color-app:\s*var\(--color-[^)]+\);/,
        `--color-app: var(--color-${config.appColor}-500);`
      );
      writeFileSync(stylesPath, stylesContent);
      success(`App color set to ${config.appColor}`);
    }

    // Step 7: Install dependencies
    info('Installing dependencies...');
    execSync(`cd ${projectName} && npm install`, { stdio: quiet ? 'pipe' : 'inherit' });
    success('Dependencies installed');

    // Step 8: Initialize git (if requested)
    if (config.initGit) {
      info('Initializing git repository...');
      execSync(`cd ${projectName} && git init`, { stdio: 'pipe' });
      success('Git repository initialized');
    }

    // Success message
    if (quiet) {
      const absolutePath = resolve(projectName);
      console.log(JSON.stringify({ success: true, path: absolutePath }));
    } else {
      log(`\n${colors.bold}${colors.green}🎉 Success! Created ${config.appName}${colors.reset}\n`);

      // Database-specific instructions (only if connection string not provided)
      if (config.database.value === 'postgresql' && !config.connectionString) {
        log(`\n${colors.yellow}📝 PostgreSQL Setup:${colors.reset}`);
        log(`  Update the ${colors.cyan}backend/.env${colors.reset} file with:`);
        log(`  ${colors.green}POSTGRES_URL=postgresql://username:password@localhost:5432/dbname${colors.reset}`);
      } else if (config.database.value === 'mongodb' && !config.connectionString) {
        log(`\n${colors.yellow}📝 MongoDB Setup:${colors.reset}`);
        log(`  Update the ${colors.cyan}backend/.env${colors.reset} file with:`);
        log(`  ${colors.green}MONGODB_URL=mongodb://localhost:27017/dbname${colors.reset}`);
      }

      // Stripe setup instructions
      log(`\n${colors.yellow}💳 Stripe Setup:${colors.reset}`);
      log(`  Update the ${colors.cyan}backend/.env${colors.reset} file with:`);
      log(`  ${colors.green}STRIPE_KEY=sk_test_your_stripe_secret_key_here${colors.reset}`);
      log(`  ${colors.green}STRIPE_ENDPOINT_SECRET=whsec_your_webhook_endpoint_secret_here${colors.reset}`);
      log(`  Step by Step Guide: ${colors.blue}https://github.com/stevederico/skateboard#-stripe-setup${colors.reset}`);

      log(`\n${colors.bold}Get started with:${colors.reset}`, 'yellow');
      log(`\n  ${colors.cyan}cd ${projectName}${colors.reset}`);
      log(`  ${colors.cyan}npm run start${colors.reset}`);
      log(`\n${colors.yellow}Happy skating! 🛹${colors.reset}\n`);
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

main().catch(console.error);
