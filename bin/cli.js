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
  const appName = await ask('App display name', projectName.split('-').map(word => 
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
    { label: '🩵 Cyan', value: 'cyan' },
    { label: '⚫ Black', value: 'black' }
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

  // Database selection
  const databaseChoices = [
    { label: '🗃️  SQLite (default)', value: 'sqlite', connectionString: `./databases/${appName.replace(/\s+/g, '')}.db` },
    { label: '🐘 PostgreSQL', value: 'postgresql', connectionString: 'postgresql://user:password@localhost:5432/dbname' },
    { label: '🍃 MongoDB', value: 'mongodb', connectionString: 'mongodb://localhost:27017/dbname' }
  ];
  
  const selectedDatabase = await askChoice('Choose your database:', databaseChoices, 0);

  // Get connection string for non-SQLite databases
  let connectionString = '';
  if (selectedDatabase.value === 'postgresql') {
    connectionString = await ask('PostgreSQL connection string (optional)', '');
  } else if (selectedDatabase.value === 'mongodb') {
    connectionString = await ask('MongoDB connection string (optional)', '');
  }

  // Default values for removed questions
  const backendURL = 'https://api.example.com';
  const devBackendURL = 'http://localhost:8000';
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
    projectName = await ask('Project directory name', 'my-skateboard-app');
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

    // Step 5: Configure database settings
    info('Configuring database...');
    const backendConfigPath = join(projectName, 'backend', 'config.json');
    if (existsSync(backendConfigPath)) {
      const backendConfig = JSON.parse(readFileSync(backendConfigPath, 'utf8'));
      
      // Handle new format with databases array
      if (backendConfig.databases && Array.isArray(backendConfig.databases) && backendConfig.databases.length > 0) {
        const dbConfig = backendConfig.databases[0];
        
        // Set database configuration
        dbConfig.dbType = config.database.value;
        dbConfig.db = config.appName.replace(/\s+/g, '');
        dbConfig.origin = config.devBackendURL;
        
        if (config.database.value === 'sqlite') {
          dbConfig.connectionString = config.database.connectionString;
        } else if (config.database.value === 'postgresql') {
          dbConfig.connectionString = '${POSTGRES_URL}';
        } else if (config.database.value === 'mongodb') {
          dbConfig.connectionString = '${MONGODB_URL}';
        }
      } else {
        // Fallback for old format - handle both array and single object formats defensively
        const configArray = Array.isArray(backendConfig) ? backendConfig : [backendConfig];
        
        configArray.forEach(configObj => {
          configObj.dbType = config.database.value;
          if (config.database.value === 'sqlite') {
            configObj.connectionString = config.database.connectionString;
          } else if (config.database.value === 'postgresql') {
            configObj.connectionString = '${POSTGRES_URL}';
          } else if (config.database.value === 'mongodb') {
            configObj.connectionString = '${MONGODB_URL}';
          }
        });
        
        // Update backendConfig reference for old format
        if (!Array.isArray(backendConfig)) {
          Object.assign(backendConfig, configArray[0]);
        }
      }
      
      writeFileSync(backendConfigPath, JSON.stringify(backendConfig, null, 2));
      success(`Database configured: ${config.database.value}`);
    }

    // Create .env file if connection string provided
    if (config.connectionString && (config.database.value === 'postgresql' || config.database.value === 'mongodb')) {
      info('Creating .env file...');
      const backendDir = join(projectName, 'backend');
      const envPath = join(backendDir, '.env');
      
      // Ensure backend directory exists
      if (!existsSync(backendDir)) {
        mkdirSync(backendDir, { recursive: true });
      }
      
      const envVar = config.database.value === 'postgresql' ? 'POSTGRES_URL' : 'MONGODB_URL';
      const envContent = `${envVar}=${config.connectionString}\n`;
      writeFileSync(envPath, envContent);
      success('.env file created with database connection');
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
    execSync(`cd ${projectName} && npm install`, { stdio: 'inherit' });
    success('Dependencies installed');

    // Step 8: Initialize git (if requested)
    if (config.initGit) {
      info('Initializing git repository...');
      execSync(`cd ${projectName} && git init`, { stdio: 'pipe' });
      success('Git repository initialized');
    }

    // Success message
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

  } catch (err) {
    error(`Failed to create project: ${err.message}`);
    process.exit(1);
  }
}

main().catch(console.error);
