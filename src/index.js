import inquirer from 'inquirer';
import chalk from 'chalk';
import ora from 'ora';
import degit from 'degit';
import fs from 'fs-extra';
import path from 'path';
import { execSync } from 'child_process';

export async function createApp(projectName, options) {
  console.log(chalk.cyan('🛹 Welcome to Skateboard App Creator!'));
  console.log();

  // Get project name if not provided
  if (!projectName) {
    const nameAnswer = await inquirer.prompt([
      {
        type: 'input',
        name: 'projectName',
        message: 'What is the name of your project?',
        default: 'my-skateboard-app',
        validate: (input) => {
          if (!input.trim()) {
            return 'Project name is required';
          }
          if (!/^[a-zA-Z0-9-_]+$/.test(input)) {
            return 'Project name can only contain letters, numbers, hyphens, and underscores';
          }
          return true;
        }
      }
    ]);
    projectName = nameAnswer.projectName;
  }

  const projectPath = path.resolve(process.cwd(), projectName);

  // Check if directory already exists
  if (await fs.pathExists(projectPath)) {
    console.error(chalk.red(`Error: Directory "${projectName}" already exists!`));
    process.exit(1);
  }

  let config = {};

  // Skip prompts if --yes flag is used
  if (!options.yes) {
    config = await inquirer.prompt([
      {
        type: 'input',
        name: 'appName',
        message: 'What is your app name?',
        default: projectName
      },
      {
        type: 'input',
        name: 'tagline',
        message: 'What is your app tagline?',
        default: 'Try Something New'
      },
      {
        type: 'input',
        name: 'backendURL',
        message: 'Backend URL (for production):',
        default: 'https://api.example.com'
      },
      {
        type: 'input',
        name: 'devBackendURL',
        message: 'Development backend URL:',
        default: 'http://localhost:8000'
      },
      {
        type: 'list',
        name: 'appIcon',
        message: 'Choose an app icon:',
        choices: [
          { name: '⌘ Command', value: 'command' },
          { name: '🏠 House', value: 'house' },
          { name: '⚡ Zap', value: 'zap' },
          { name: '🚀 Rocket', value: 'rocket' },
          { name: '💎 Diamond', value: 'diamond' },
          { name: '🎯 Target', value: 'target' }
        ],
        default: 'command'
      },
      {
        type: 'confirm',
        name: 'installDeps',
        message: 'Install dependencies?',
        default: true
      },
      {
        type: 'confirm',
        name: 'initGit',
        message: 'Initialize git repository?',
        default: true
      }
    ]);
  } else {
    // Default config when using --yes
    config = {
      appName: projectName,
      tagline: 'Try Something New',
      backendURL: 'https://api.example.com',
      devBackendURL: 'http://localhost:8000',
      appIcon: 'command',
      installDeps: true,
      initGit: true
    };
  }

  console.log();

  try {
    // Clone the template
    const spinner = ora('Downloading template...').start();
    const emitter = degit('stevederico/skateboard', { cache: false, force: true });
    await emitter.clone(projectPath);
    spinner.succeed('Template downloaded');

    // Update configuration files
    spinner.start('Configuring project...');
    await updateProjectFiles(projectPath, projectName, config);
    spinner.succeed('Project configured');

    // Install dependencies
    if (config.installDeps) {
      spinner.start('Installing dependencies...');
      process.chdir(projectPath);
      execSync('npm install', { stdio: 'pipe' });
      spinner.succeed('Dependencies installed');
    }

    // Initialize git
    if (config.initGit) {
      spinner.start('Initializing git repository...');
      execSync('git init', { stdio: 'pipe' });
      execSync('git add .', { stdio: 'pipe' });
      execSync('git commit -m "Initial commit from create-skateboard-app"', { stdio: 'pipe' });
      spinner.succeed('Git repository initialized');
    }

    // Success message
    console.log();
    console.log(chalk.green('🎉 Success! Your Skateboard app has been created.'));
    console.log();
    console.log('Next steps:');
    console.log(chalk.cyan(`  cd ${projectName}`));
    if (!config.installDeps) {
      console.log(chalk.cyan('  npm install'));
    }
    console.log(chalk.cyan('  npm start'));
    console.log();
    console.log('Happy coding! 🛹');

  } catch (error) {
    console.error(chalk.red('Error creating project:'), error.message);
    process.exit(1);
  }
}

async function updateProjectFiles(projectPath, projectName, config) {
  // Update package.json
  const packageJsonPath = path.join(projectPath, 'package.json');
  const packageJson = await fs.readJson(packageJsonPath);
  packageJson.name = projectName;
  packageJson.version = '0.1.0';
  await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 });

  // Update constants.json
  const constantsPath = path.join(projectPath, 'src', 'constants.json');
  const constants = await fs.readJson(constantsPath);
  constants.appName = config.appName;
  constants.tagline = config.tagline;
  constants.appIcon = config.appIcon;
  constants.backendURL = config.backendURL;
  constants.devBackendURL = config.devBackendURL;
  await fs.writeJson(constantsPath, constants, { spaces: 4 });

  // Remove GET_STARTED.md as it's no longer needed
  const getStartedPath = path.join(projectPath, 'GET_STARTED.md');
  if (await fs.pathExists(getStartedPath)) {
    await fs.remove(getStartedPath);
  }

  // Update README.md to be project-specific
  const readmePath = path.join(projectPath, 'README.md');
  const newReadme = `# ${config.appName}

${config.tagline}

## Getting Started

1. Install dependencies:
\`\`\`bash
npm install
\`\`\`

2. Start the development server:
\`\`\`bash
npm start
\`\`\`

3. Open [http://localhost:5173](http://localhost:5173) to view it in the browser.

## Built with Skateboard

This project was created with [Skateboard](https://github.com/stevederico/skateboard) - a React boilerplate with:

- React v19
- TailwindCSS v4
- Shadcn/ui components
- Vite
- React Router
- Authentication ready
- Stripe integration
- Dark mode support

## Learn More

- [Skateboard Documentation](https://github.com/stevederico/skateboard)
- [React Documentation](https://reactjs.org/)
- [TailwindCSS Documentation](https://tailwindcss.com/)
`;

  await fs.writeFile(readmePath, newReadme);
}
