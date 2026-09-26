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

PaperAlpha is pre-configured with `netlify.toml` and `@netlify/plugin-nextjs`.

1. Push your code to GitHub:
   ```bash
   git add .
   git commit -m "feat: setup PaperAlpha with complete documentation"
   git push -u origin main
   ```
2. In [Netlify Dashboard](https://app.netlify.com):
   - Choose **Add new site** &rarr; **Import an existing project** &rarr; select `PaperAlpha`.
   - **Build command**: `npx prisma generate && npm run build`
   - **Publish directory**: `.next`
3. Set environment variables in Netlify (`DATABASE_URL`, `FILE_ENCRYPTION_SECRET`, `STORAGE_DRIVER`).
   *(For production on serverless hosts like Netlify, use a cloud database like Neon or Supabase for `DATABASE_URL`)*.

---

## 📜 License

MIT License. Built for researchers, engineers, and academics.
