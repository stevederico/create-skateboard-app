#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
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

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function error(message) {
  log(`❌ ${message}`, 'red');
}

function success(message) {
  log(`✅ ${message}`, 'green');
}

function info(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function checkCommand(command) {
  try {
    execSync(`which ${command}`, { stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

async function downloadTemplate(projectName) {
  // Try multiple methods in order of preference
  const methods = [
    {
      name: 'degit',
      check: () => checkCommand('npx'),
      execute: () => execSync(`npx degit stevederico/skateboard ${projectName}`, { 
        stdio: 'pipe',
        timeout: 30000
      })
    },
    {
      name: 'git clone',
      check: () => checkCommand('git'),
      execute: () => {
        execSync(`git clone --depth 1 https://github.com/stevederico/skateboard.git ${projectName}`, { 
          stdio: 'pipe',
          timeout: 30000
        });
        // Remove .git directory to avoid including git history
        execSync(`rm -rf ${projectName}/.git`, { stdio: 'pipe' });
      }
    },
    {
      name: 'curl + unzip',
      check: () => checkCommand('curl') && checkCommand('unzip'),
      execute: () => {
        execSync(`curl -L https://github.com/stevederico/skateboard/archive/refs/heads/master.zip -o temp.zip`, { 
          stdio: 'pipe',
          timeout: 30000
        });
        execSync(`unzip -q temp.zip`, { stdio: 'pipe' });
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
      info(`Trying ${method.name}...`);
      method.execute();
      success(`Template downloaded via ${method.name}`);
      return;
    } catch (err) {
      log(`${method.name} failed, trying next method...`, 'yellow');
    }
  }

  throw new Error('All download methods failed. Please ensure you have git, curl, or npx available and check your internet connection.');
}

// Interactive prompt functions
function ask(question, defaultValue = '') {
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

async function collectProjectConfig(projectName) {
  log(`\n${colors.bold}Let's configure your Skateboard app!${colors.reset}\n`);

  // App name
  const appName = await ask('App name', projectName.split('-').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1)
  ).join(' '));

  // Tagline
  const tagline = await ask('App tagline', 'Try Something New');

  // App color selection
  const colorChoices = [
    { label: '🔵 Blue', value: 'blue' },
    { label: '💚 Green', value: 'green' },
    { label: '🟣 Purple', value: 'purple' },
    { label: '🔴 Red', value: 'red' },
    { label: '🟠 Orange', value: 'orange' },
    { label: '🟡 Yellow', value: 'yellow' },
    { label: '🩷 Pink', value: 'pink' },
    { label: '🩵 Cyan', value: 'cyan' }
  ];
  
  const selectedColor = await askChoice('Choose your app color:', colorChoices);

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
  
  const selectedIcon = await askChoice('Choose an app icon:', iconChoices);

  // Backend URLs
  const backendURL = await ask('Production backend URL', 'https://api.example.com');
  const devBackendURL = await ask('Development backend URL', 'http://localhost:8000');

  // App pages configuration
  log(`\n${colors.cyan}Configure your app pages:${colors.reset}`);
  const pages = [];
  
  const addDefaultPages = await askYesNo('Add default pages (Home, Other)?', true);
  if (addDefaultPages) {
    pages.push(
      { title: 'Home', url: 'home', icon: 'house' },
      { title: 'Other', url: 'other', icon: 'inbox' }
    );
  }

  const addMorePages = await askYesNo('Add more custom pages?', false);
  if (addMorePages) {
    let addAnother = true;
    while (addAnother) {
      const pageTitle = await ask('Page title');
      const pageUrl = await ask('Page URL', pageTitle.toLowerCase().replace(/\s+/g, '-'));
      const pageIcon = await ask('Page icon (lucide icon name)', 'circle');
      
      pages.push({
        title: pageTitle,
        url: pageUrl,
        icon: pageIcon
      });

      addAnother = await askYesNo('Add another page?', false);
    }
  }

  // Company name (after pages configuration)
  const companyName = await ask('Company name', 'Your Company');

  // Installation preferences
  const installDeps = await askYesNo('Install dependencies automatically?', true);
  const initGit = await askYesNo('Initialize git repository?', true);

  return {
    companyName,
    appName,
    tagline,
    appColor: selectedColor.value,
    appIcon: selectedIcon.value,
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
  npx create-skateboard-app

${colors.cyan}Arguments:${colors.reset}
  project-name    Optional project directory name (will prompt if not provided)

${colors.cyan}Options:${colors.reset}
  --help, -h      Show this help message
  --version, -v   Show version number

${colors.cyan}Examples:${colors.reset}
  npx create-skateboard-app                    # Interactive mode
  npx create-skateboard-app my-app             # With project name
  npx create-skateboard-app awesome-project    # With custom name
`, 'reset');
}

function showVersion() {
  const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  log(`v${packageJson.version}`, 'green');
}

async function main() {
  // Get project name from command line
  const args = process.argv.slice(2);
  let projectName = args[0];

  // Handle help and version flags
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }

  if (args.includes('--version') || args.includes('-v')) {
    showVersion();
    process.exit(0);
  }

  // If no project name provided, ask for it
  if (!projectName) {
    log(`\n${colors.bold}🛹 Welcome to Skateboard App Creator!${colors.reset}\n`);
    projectName = await ask('What is the name of your project?', 'my-skateboard-app');
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
    const config = await collectProjectConfig(projectName);

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

    // Step 5: Update app color in styles.css
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

    // Step 6: Install dependencies (if requested)
    if (config.installDeps) {
      info('Installing dependencies...');
      execSync(`cd ${projectName} && npm install`, { stdio: 'inherit' });
      success('Dependencies installed');
    }

    // Step 7: Initialize git (if requested)
    if (config.initGit) {
      info('Initializing git repository...');
      execSync(`cd ${projectName} && git init`, { stdio: 'pipe' });
      success('Git repository initialized');
    }

    // Success message
    log(`\n${colors.bold}${colors.green}🎉 Success! Created ${config.appName}${colors.reset}\n`);
    
    // Change to the new project directory
    process.chdir(projectName);
    info(`Switched to ${projectName} directory`);
    
    log('Next steps:', 'yellow');
    if (!config.installDeps) {
      log(`  npm install`);
    }
    log(`  npm run dev`);
    log(`\n${colors.cyan}Your app is configured with:${colors.reset}`);
    log(`  🏢 Company: ${config.companyName}`);
    log(`  📱 App: ${config.appName}`);
    log(`  💬 Tagline: ${config.tagline}`);
    log(`  🎨 Color: ${config.appColor}`);
    log(`  🎯 Icon: ${config.appIcon}`);
    log(`  📄 Pages: ${config.pages.map(p => p.title).join(', ')}`);
    log(`  🌐 Backend: ${config.backendURL}`);
    log(`\n${colors.magenta}You're now in the ${projectName} directory!${colors.reset}`);
    log(`${colors.yellow}Run 'npm run dev' to begin development 🛹${colors.reset}\n`);

  } catch (err) {
    error(`Failed to create project: ${err.message}`);
    process.exit(1);
  }
}

main().catch(console.error);
