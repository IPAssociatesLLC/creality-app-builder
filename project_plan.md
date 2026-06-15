# CreAIlity — AI App Builder

## 1. Project Description
A full AI app builder workspace. Users can describe any app in plain text and an AI agent generates the full React + TypeScript codebase. Users can describe any app in plain text and an AI agent generates the full React + TypeScript codebase. Features side-by-side chat + live preview, GitHub import, project file upload from other platforms (Bolt, v0, Lovable, Replit), file explorer, version history, and one-click deploy.

## 2. Page Structure
- `/` — Home / New project dashboard (prompt box, recent projects, templates, import options)
- `/workspace` — Full builder workspace (sidebar + chat + live preview)

## 3. Core Features
- [x] Brand renamed to **CreAIlity** across all pages, navbar, footer, meta tags
- [x] White text on dark background (navbar, hero) — no more dark text on dark bg
- [x] Dark theme applied globally (`.dark` class on html)
- [x] Inter + JetBrains Mono font system
- [x] Full dark landing page with all sections (Hero, Features, HowItWorks, Showcase, Stats, CTA, FAQ, Footer)
- [x] AI Model Selector — choose GPT-4o, Claude 3.5 Sonnet, Gemini 2.0 Flash, DeepSeek V3, Grok 3
- [x] Model API key management stored in localStorage
- [x] **Conversation memory** — AI remembers context across messages, iterates on the same app (last 30 turns kept)
- [x] **Real AI code generation** — ChatPanel calls actual AI APIs (OpenAI, Anthropic, Google, DeepSeek, xAI) using user's API keys
- [x] **Live code preview in iframe** — generated HTML/React code renders immediately in PreviewPanel
- [x] New project home screen with prompt input
- [x] Template starters (SaaS, E-commerce, Landing Page, etc.)
- [x] GitHub import modal (URL entry + connected repos list)
- [x] File/project upload modal (drag & drop ZIP, supports Bolt/v0/Lovable/Replit exports)
- [x] Full workspace layout: file sidebar, chat panel, preview panel
- [x] Top bar with project rename, undo/redo, share, deploy
- [x] **Deploy to Vercel/Netlify** — downloads generated HTML + opens deploy platform in new tab
- [x] Version history tab in sidebar
- [x] Panel layout switcher (chat only / split / preview only)

## 4. Data Model Design
N/A — No database needed for current phase (UI only)

## 5. Backend / Third-party Integration Plan
- Supabase: connected
- Shopify: Not needed
- Stripe: need to connect

## 6. Development Phase Plan

### Phase 1: Full Builder UI ✅
- Goal: Complete workspace UI with all panels and import flows
- Deliverable: Working builder interface with mock AI responses

### Phase 2 (Future): Real AI Integration
- Goal: Connect to actual AI model (OpenAI/Anthropic) for real code generation
- Deliverable: Live code generation from prompts

### Phase 3 (Future): Auth + Project Persistence
- Goal: Save projects, user accounts, version history
- Deliverable: Full persistence layer via Supabase