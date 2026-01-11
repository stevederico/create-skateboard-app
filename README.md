# Create Skateboard App

[![npm version](https://img.shields.io/npm/v/create-skateboard-app.svg)](https://www.npmjs.com/package/create-skateboard-app)
[![npm downloads](https://img.shields.io/npm/dm/create-skateboard-app.svg)](https://www.npmjs.com/package/create-skateboard-app)
[![license](https://img.shields.io/npm/l/create-skateboard-app.svg)](https://github.com/stevederico/create-skateboard-app/blob/master/LICENSE)

The fastest way to create a full-stack React app with authentication, payments, and database support.

## What is Skateboard?

[Skateboard](https://github.com/stevederico/skateboard) is a production-ready boilerplate for building SaaS applications. It includes user authentication, Stripe subscriptions, database adapters, and 50+ UI components out of the box.

## Quick Start

```bash
npx create-skateboard-app
cd my-app
npm run start
```

## Usage

### Interactive Mode (Recommended)
```bash
npx create-skateboard-app
```

### With Project Name
```bash
npx create-skateboard-app my-app
```

## What You Get

- React 19 with Vite
- TailwindCSS v4
- Shadcn/ui components
- Hono backend server
- JWT authentication
- Stripe payments
- Database support (SQLite, PostgreSQL, MongoDB)
- Dark mode
- Mobile responsive
- Protected routes

## Features Included

- Sign up / Sign in pages
- Landing page
- Settings page
- Legal pages (Privacy, Terms, EULA)
- 404 error handling
- Mobile tab bar
- Rate limiting
- CSRF protection

## Requirements

- Node.js 22.5+
- git or curl (for template download)

## Configuration

After creating your app:

1. Copy the environment template:
   ```bash
   cp backend/.env.example backend/.env
   ```

2. Update `backend/.env` with your credentials:
   - `JWT_SECRET` - Token signing key
   - `STRIPE_KEY` - Stripe secret key
   - `STRIPE_ENDPOINT_SECRET` - Webhook secret
   - Database connection string (if using PostgreSQL/MongoDB)

## Contributing

Contributions welcome! Please open an issue or PR.

## License

MIT
