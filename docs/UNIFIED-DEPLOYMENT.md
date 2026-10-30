# One deployment, separate Path Lab login

## Result

Import the **repository root** (`D:\Pathlab`) into **one Vercel project**. Do not select `business-portal` as the Vercel Root Directory for this combined deployment.

| URL                                      | Application                              |
| ---------------------------------------- | ---------------------------------------- |
| `/`                                      | Business Hub website                     |
| `/hotel`, `/legal`                       | Customer-facing business services        |
| `/login`, `/admin/*`                     | Business Hub's staff login and workspace |
| `/pathlab/`                              | Existing Pure Path Lab application       |
| `/pathlab/login`, `/pathlab/admin/login` | Existing Path Lab login                  |
| `/api/*`                                 | Existing Path Lab API, unchanged         |
| `/hub-api/*`                             | Separate Business Hub API                |
| `/uploads/*`                             | Existing Lab upload routes               |

Path Lab retains its own JWT authentication, `ppl_token`/`ppl_user` storage, users, roles and MongoDB configuration (`MONGO_URI`, `JWT_SECRET`). Business Hub retains its own cookie sessions, staff accounts and a separate MongoDB database (`HUB_MONGODB_URI`, `HUB_MONGODB_DATABASE`). Neither login grants access to the other app. No account or patient data migration is performed.

## Repository/build structure

```text
Pathlab/
  frontend/                 original Lab React app
  backend/                  original Lab Express app
  business-portal/
    src/                    portal / restaurant / hotel / legal UI
    server/                 separate Hub models and Express app
  api/
    index.js                original Lab Vercel entry
    hub.js                  Hub Vercel entry
  scripts/
    build-unified.cjs       builds and assembles both frontends
    setup-hub.cjs           explicit one-time Hub setup
    preview-unified.cjs     isolated local combined preview
  dist/                     generated, ignored
    index.html              portal
    assets/                 portal assets
    pathlab/                entire Lab build and assets
  vercel.json               one deployment's routing/functions
```

This is a single-repository multi-app layout. It does not need a framework migration or a separate Vercel project for each module. Existing standalone Lab dev scripts remain available. A standalone `npm run build:pathlab` still builds Lab at `/`; only the unified build selects `/pathlab/`.

## Install, build and verify

From the repository root:

```powershell
npm run install:all
npm run build
npm run test:unified
npm test --prefix business-portal
```

`npm run build` builds the Lab with a `/pathlab/` base, builds the Hub with `/hub-api`, and assembles both under root `dist`. Hashed assets are served before SPA fallbacks. Legacy public QR paths `/r/*`, `/patient/report` and `/reports` redirect into the Lab prefix. Existing Lab API/upload URLs and root logo references remain valid.

## Local preview

```powershell
npm run preview:unified
```

Open `http://127.0.0.1:4118/` and `http://127.0.0.1:4118/pathlab/`. The existing Hub development API on port 4318 is reused; otherwise it is started. The Lab API preview uses a fresh isolated local MongoDB with no real users, so production Lab credentials are intentionally not valid in this preview. Existing Lab databases, accounts and patient records are never seeded or migrated by the preview.

For build and preview in one command, use `npm run dev:unified`. The original standalone Lab `npm run dev` remains available.

The Hub Vite preview on port 5178 also forwards `/pathlab`, Lab `/api`, `/uploads` and the Lab logo to the combined preview. It forwards `/hub-api` to its own development backend. Keep the combined preview running to open Lab from that Vite URL.

## Vercel configuration

1. Import the repository into one Vercel project. Root Directory: repository root. Node: 22.x or newer supported by the project.
2. The committed `vercel.json` supplies install/build/output configuration. The output is `dist`, not either child application's `dist`.
3. Retain the existing Lab environment values. Set `CLIENT_URL` and `PUBLIC_BASE_URL` to `https://YOUR-DOMAIN/pathlab` for newly generated Lab links. Keep existing integration-specific variables. If an OAuth callback was previously the frontend `/login`, update that callback and its provider registration to `/pathlab/login`; API callback URLs remain under the unchanged `/api` namespace.
4. Set Hub variables: `HUB_MONGODB_URI`, `HUB_MONGODB_DATABASE=business_portal`, `APP_ORIGIN=https://YOUR-DOMAIN`, `TRUST_PROXY=1`. Use a separate database; never point Hub setup at the Lab database.
5. Provision Hub once using the setup script below. Normal function requests do not seed data or print passwords. The API caches a MongoDB connection/app within each running instance and persists throttling counters in MongoDB.
6. Configure Preview and Production variables separately. Preview deployments must use isolated test databases. Use the exact preview origin for `APP_ORIGIN` where configured.
7. Push to the connected Git repository: both frontends and both API functions are included in the same deployment. Attach the custom domain to this one Vercel project.

See `.env.unified.example` for **placeholder names only**, not usable credentials. Database URIs, JWT secrets and owner passwords must never use `VITE_` names or appear in committed files.

## First Hub owner and data

In a trusted local shell or setup job, supply `HUB_MONGODB_URI`, `HUB_MONGODB_DATABASE`, `HUB_OWNER_EMAIL` and `HUB_OWNER_PASSWORD` (at least 12 characters) securely, then run:

```powershell
npm run setup:hub
```

The command preserves existing accounts and seeds settings without sample menu/room/legal catalog records. `npm run setup:hub -- --demo` explicitly includes sample catalog content for non-production use. Existing Path Lab accounts remain unchanged; its original seed command is **not** part of unified install/build/deploy.

## Checks before public launch

- Confirm both logins independently, protected routes, refresh/deep links, public booking/enquiry submissions and real-printer output.
- Use approved business content and receipt settings rather than development sample data.
- **Existing Lab uploads:** the original Lab currently stores uploaded files on local disk or Vercel `/tmp`. Those files are not durable between serverless instances. This integration preserves that implementation; durable object storage and migration of existing uploaded files still need to be configured before using uploads in production. The repository build does not migrate files or change their permissions. Also review direct-upload handling for files larger than Vercel's function request limit.
- Production deployment and Atlas access cannot be verified without the actual Vercel project/environment configuration. Nothing is published by these local preparation steps.

## References

- Vite on Vercel: https://vercel.com/docs/frameworks/frontend/vite
- Vercel routing configuration: https://vercel.com/docs/project-configuration/vercel-json
- Vercel function limits: https://vercel.com/docs/functions/limitations

Reviewed 28 October 2026.
