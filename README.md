# PaperAlpha 📄🔬

> **Autonomous multi-agent system that transforms research materials (code, datasets, experimental notes, notebooks) into publication-ready, format-compliant academic research papers.**

---

## 🌟 Key Features

- **Multi-Agent Research Pipeline**: Orchestrated pipeline across parsing, literature search, synthesis, section drafting, claim verification, formatting, and DOCX document generation.
- **Academic Citation Manager**:
  - Verification against scholarly indices (OpenAlex, Crossref, arXiv, Semantic Scholar).
  - Accurate in-text citation placement and formatting (`[1]`, `Vaswani et al. (2017)`).
  - Strict compliance with major citation styles: **IEEE, APA, Vancouver, Harvard, Chicago, MLA**.
  - Rule-enforced integrity checks preventing fabricated references.
- **Venue & Publisher Presets**: Built-in format presets for **IEEE, Springer (LNCS/LLNCS), Elsevier, ACM, APA, Nature**, and fully customizable format specifications.
- **Section Revision & Human Review**:
  - Live per-section markdown editor with revision tracking and word budget meters.
  - Targeted single-section regeneration preserving manual edits.
  - 5-point publication verification checklist gating release.
- **Camera-Ready Export**: Generates publication-ready Word (`.docx`) documents with typography, column styling, headers/footers, math equations, and formatted references.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 15 (App Router, Server Actions)
- **Language**: TypeScript 5.9 / Node.js >= 20
- **Database / ORM**: Prisma ORM 6.19 (PostgreSQL / SQLite)
- **Styling**: Tailwind CSS 4, Lucide Icons
- **Testing**: Vitest 3.2
- **Deployment**: Netlify (`@netlify/plugin-nextjs`), Vercel, or custom Docker

---

## 🚀 Quick Start

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/debmalyaSanyal/PaperAlpha.git
cd PaperAlpha
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` (or create `.env`):
```env
DATABASE_URL="file:./dev.db"
APP_BASE_URL="http://localhost:3000"
FILE_ENCRYPTION_SECRET="generate-a-32-byte-hex-string-for-security"
STORAGE_DRIVER="local"
```

### 3. Initialize Database
```bash
npx prisma db push
```

### 4. Run Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing & Verification

Run the full verification suite (types, unit tests, and production build):
```bash
npm run typecheck   # Typecheck with TypeScript
npm run test        # Vitest suite
npm run build       # Next.js production build
```

---

## 🌐 Deploy to Netlify

This is a Next.js server-rendered application, not a static folder. Connect the
repository to Netlify so it can run the build; uploading the source folder with
the manual drag-and-drop deployer cannot run the application.

1. In [Netlify](https://app.netlify.com), choose **Add new site** → **Import an existing project**, then select this repository. Netlify reads `netlify.toml` automatically. Do not add the legacy Next.js plugin in the Netlify UI.
2. In **Project configuration** → **Environment variables**, add the production values below. Keep all secrets in Netlify; do not commit them to `.env`.

   | Variable | Required value |
   | --- | --- |
   | `DATABASE_URL` | A persistent PostgreSQL connection string. The included SQLite configuration is only for local development. |
   | `AUTH_SECRET` | A new random string of at least 32 characters. |
   | `ALLOW_ANONYMOUS_DEV_USER` | `true` until a real login flow is added. |
   | `STORAGE_DRIVER` | `s3` for durable uploads, with the S3 variables from `.env.example`; local storage is temporary on Netlify. |
   | `BACKEND_URL` | The public HTTPS URL of the separately deployed Python worker service. |
   | `WORKER_SHARED_SECRET` | The same random secret configured on that worker service. |
   | `LLM_PROVIDER`, provider API key | The model provider and its key, configured on the worker service. |

3. Set the Prisma datasource in `prisma/schema.prisma` to `postgresql`, then run `npx prisma db push` once using the same `DATABASE_URL` to create the tables. Commit the schema change before triggering the deploy.
4. Click **Deploy site**. The build command is `npm run build` and the publish directory is `.next`.

The Next.js site, API routes, database, file storage, and paper-generation
worker are separate services. Netlify hosts the first two. The Python worker is
not included in this folder, so `http://127.0.0.1:8000` will never work after
deployment; use a deployed worker URL for `BACKEND_URL`.

---

## 📜 License

MIT License. Built for researchers, engineers, and academics.
