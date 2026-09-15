# Create Skateboard App

[![npm version](https://img.shields.io/npm/v/create-skateboard-app.svg)](https://www.npmjs.com/package/create-skateboard-app)
[![npm downloads](https://img.shields.io/npm/dm/create-skateboard-app.svg)](https://www.npmjs.com/package/create-skateboard-app)
[![license](https://img.shields.io/npm/l/create-skateboard-app.svg)](https://github.com/stevederico/create-skateboard-app/blob/master/LICENSE)

Scaffolds a [Skateboard](https://github.com/stevederico/skateboard) app: React 19 + Vite 8 + Tailwind 4 on the frontend, and a zero-crate Rust backend with JWT cookies, CSRF, scrypt, SQLite, and Stripe.

## What is Skateboard?

[Skateboard](https://github.com/stevederico/skateboard) is a production-ready SaaS boilerplate. New apps inherit UI through `@stevederico/skateboard-ui` and pull backend/glue updates with `scripts/update-skateboard.js`.

## Quick Start

```bash
npx create-skateboard-app
cd my-app
npm install
npm start                 # frontend  http://localhost:5173
cd backend && cargo run   # backend   http://localhost:8000
```

Copy `backend/.env.example` to `backend/.env` and set `JWT_SECRET`, `STRIPE_KEY`, and `STRIPE_ENDPOINT_SECRET`.

Frontend is Vite. Backend is Rust (`cargo run`). There is no `npm run server`.

## Usage

### Interactive Mode
```bash
npx create-skateboard-app
```

### With Project Name
```bash
npx create-skateboard-app my-app
```

### Non-interactive
```bash
npx create-skateboard-app my-app -y
npx create-skateboard-app my-app --name "Acme" --color red --icon rocket -y
```

## What You Get

- React 19, Vite 8, Tailwind CSS 4, TypeScript
- `@stevederico/skateboard-ui` 5.1.0 (exact pin)
- Thin Vite app (`src/main.tsx`, `src/constants.json`, `src/legal.json`) plus `backend/`
- Zero-crate Rust backend: JWT cookies, CSRF, scrypt, SQLite via system libsqlite3, Stripe via libcurl
- SQLite only
- Dark mode, mobile layout, protected routes
- Sign up / sign in, landing, settings, and legal pages (Privacy, Terms, EULA)

New apps inherit UI by bumping `@stevederico/skateboard-ui`. Backend and glue files update with:

```bash
node scripts/update-skateboard.js
```

## Requirements

- Node.js 24+
- Rust (`cargo run` in `backend/`)
- System `libsqlite3` and `libcurl`
- git or curl (the CLI downloads skateboard 5.6.0)

## Configuration

After creating your app:

1. Copy the environment template:
   ```bash
   cp backend/.env.example backend/.env
   ```

2. Update `backend/.env`:
   - `JWT_SECRET` — token signing key
   - `STRIPE_KEY` — Stripe secret key
   - `STRIPE_ENDPOINT_SECRET` — webhook secret

3. SQLite path lives in `backend/config.json` (`dbType` is `sqlite`).

## How the template is sourced

The CLI clones [stevederico/skateboard](https://github.com/stevederico/skateboard) at tag `5.6.0` (the current master release), then applies project-name and branding substitution. It does not vendor a second copy of the tree, so a pin bump is enough when skateboard ships a new release.

Overrides for development and tests:

- `SKATEBOARD_REPO` — git URL or local checkout
- `SKATEBOARD_REF` — tag or branch (default `5.6.0`)

## Contributing

```bash
npm test
```

The smoke test scaffolds from a local skateboard checkout and checks the 5.6 shape: UI pin, Rust `Cargo.toml`, Node `>=24`, SQLite only.

## License

MIT
