# Create Skateboard App

The fastest way to create a new [Skateboard](https://github.com/stevederico/skateboard) app.

## Quick Start

```bash
npx create-skateboard-app
cd my-app
cp backend/.env.example backend/.env
# Edit backend/.env with your database and Stripe credentials
npm run start
```

## Usage

### Interactive Mode (Default)
```bash
npx create-skateboard-app
```

### With Project Name
```bash
npx create-skateboard-app my-app
```

## What You Get

- ⚛️ React v19
- 🎨 TailwindCSS v4 
- 🧩 Shadcn/ui components
- ⚡ Vite build tool
- 🔐 Authentication ready
- 💳 Stripe integration
- 🌙 Dark mode support
- 📱 Mobile responsive
- 🛣️ React Router
- 📦 Modern JavaScript
- 🗃️ Database selection (SQLite, PostgreSQL, MongoDB)

## Features Included

- Sign up/Sign in pages
- Landing page
- Settings page with Home and Other views
- Legal pages (Privacy, Terms, EULA)
- 404 error handling
- Protected routes
- Mobile tab bar
- Customizable constants
- Interactive setup with app customization
- Color and icon selection
- Database configuration

## Requirements

- Node.js 22.5+
- npm or yarn
- git, curl, or npx (for template download)

## Configuration

After creating your app:

1. Copy the environment template:
   ```bash
   cp backend/.env.example backend/.env
   ```

2. Update `backend/.env` with your credentials:
   - Database connection string (if using PostgreSQL/MongoDB)
   - Stripe API keys
   - Other environment-specific variables

## Contributing

Contributions are welcome! Please check out the [Skateboard repository](https://github.com/stevederico/skateboard) for more information.

## License

MIT
