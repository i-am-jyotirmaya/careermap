# CareerForge

**CareerForge** is a local-first, AI-powered multi-stream career growth, learning, and practice platform featuring an authentic **Neobrutalism UI** (`neobrutalism.dev` + `shadcn` registry `@neobrutalism` + fluent `motion/react` spring animations), backed by a local SQLite database (`data/career-forge.sqlite`) and **TypeSafe's Jev (`systemone`)** decision router.

## Key Capabilities

1. **Persuasive First-Run Onboarding Gate & Direct-to-Dashboard Routing**
   - New users are greeted with a persuasive, local-first onboarding showcase (`OnboardingFlowView.tsx`) featuring value pillars, AI provider tips, identity customization, and a **mandatory AI Engine setup gate** before entering the application.
   - Once onboarded (`isOnboarded: true`), CareerForge routes directly to **Career Streams** (`StreamsHubView.tsx`) as the primary dashboard, complete with KPI cards and 1-click Quick-Start stream templates.

2. **Top-Right User Avatar Menu, User Profile & Detailed Settings (`Danger Zone`)**
   - Top-right **User Avatar Menu** (`UserAvatarMenu.tsx`) houses **User Profile** (`UserProfileView.tsx`), **Vault & Achievements** (`GamificationVaultView.tsx`), **Settings** (`SettingsView.tsx`), and the **Secret Oracle Console (`Ctrl+K`)**.
   - **Settings** organizes **AI Engine & Jev Router**, **Workspace, UI & Memory Cache**, and a **Guarded Danger Zone** (`Reset Evaluations`, `Reset Progress`, `Delete All Career Streams & Resumes`, and `Factory Reset`) protected both in the UI modal and server-side (`POST /api/settings/danger-zone`) by an irreversibility acknowledgement checkbox + exact case-sensitive confirmation phrase.

3. **Precomputed Roadmap Flow Graph in Topic Arena**
   - Every career roadmap is guaranteed to have all 3 phases, 9+ topic nodes, and directed graph edges (`intra_phase`, `cross_phase`, `boss_convergence`) precomputed beforehand (`ensureFullPrecomputedRoadmap` + `computeRoadmapGraphEdges`).
   - Inside **Topic Arena** (`TopicWorkbenchView.tsx`), `RoadmapFlowGraph.tsx` renders an interactive coordinate-aligned SVG Bezier arrow graph across the entire roadmap with animated frontier strokes and 1-click node switching.

4. **Multi-Provider AI Driver with Live Connected Status & Zero Manual Model Assignment**
   - Saving an AI provider automatically discovers its available models and runs a live health check, displaying a **Connected & Verified** status badge across the provider list and top navigation HUD.
   - You never have to assign models to individual tasks — CareerForge automatically manages the model pool and chooses the right model per task.
   - **ChatGPT Codex Subscription**: Install the Codex CLI on the machine running CareerForge, run `codex login`, and sign in with ChatGPT. CareerForge uses `codex exec` with that session and the CLI's default model.
   - **OpenAI API**: Supports `/v1/chat/completions` and `/v1/responses` (`gpt-4.1`, `o4-mini`, `gpt-4.1-mini`, `gpt-4.1-nano`, Codex models).
   - **Anthropic Claude**: Supports `/v1/messages` (`claude-sonnet-4-5`, `claude-opus-4-1`, `claude-3-5-haiku`) and live model discovery.
   - **Ollama (Local)**: Automatic local model discovery (`GET /api/tags`) and private offline inference.
   - **OpenRouter / Custom OpenAI-Compatible**: Connect OpenRouter, Groq, LM Studio, Gemini OpenAI-compatible endpoints, or vLLM.

2. **TypeSafe's Jev Model Router (Configured Status + Autonomous Self-Selection)**
   - Shows explicit **Configured** / **Configured & Verified** status badges when Jev is configured, and automatically verifies connectivity on save.
   - Uses TypeSafe's Jev (`POST https://api.typesafe.ai/v1/systemone`, OpenRouter Decisions API, or Vercel AI Gateway) to choose the optimal model & reasoning effort per task.
   - **No Jev API Key?** Automatically chooses models on its own using CareerForge's built-in **Autonomous Local Router**.

3. **In-Memory Roadmap Nodes, Resource Caching & Deterministic On-Demand Refresh**
   - Once career roadmaps are prepared from your resume, all phase and topic nodes are kept in memory (`MemoryCacheService` + SQLite backing) and reused instantly **without invoking AI** when launching streams or navigating topics.
   - Generated learning guides, flashcards, and curated external resources are cached in memory by canonical topic node and served with zero AI calls across sessions and streams.
   - **Consistent On-Demand Refresh**: Roadmaps, stream nodes, and topic resources refresh only on demand. SHA-256 context fingerprinting ensures that if no new resume/focus information has been provided, refreshes return **100% consistent** results directly from memory without unnecessary AI calls; when new context is provided, CareerForge performs a deterministic (`temperature: 0`), baseline-anchored refresh while preserving completed progress.

4. **Independent Multi-Stream Progression**
   - Pursue multiple career streams simultaneously. Each stream maintains its own independent **Level, XP, Mastery %, Streak, 3-Phase Roadmap, Learning Library, Practice Challenges, and Evaluation History** in local SQLite.

5. **Learning Resources, Practice Arena & AI Rubric Evaluator**
   - Generates deep-dive Markdown study guides, active-recall flashcards, and curated external references.
   - Generates hands-on practice challenges (`Coding`, `System Design`, `Debugging`, `Architecture Review`, `Leadership`) across `Warmup`, `Standard`, `Hard`, and `Boss` tiers.
   - Evaluates submitted solutions strictly against weighted rubrics with strengths, actionable improvements, Socratic mentor coaching, and exemplar reference approaches.

6. **Gamified Vault, Bonuses & Hidden Easter Eggs**
   - 20 unlockable achievements (`Bronze`, `Silver`, `Gold`, `Mythic`, `Secret`), **1.25x Polymath Multi-Stream Combo**, **Flawless**, **Iterative Comeback**, and **Zero-Hint Pure Instinct** bonuses, **Mystery Spark Reliquary**, and hidden interactive Easter Eggs (`Ctrl+K` Oracle Console, 7-tap Anvil, Konami Code).

## Quick Start

```powershell
cd C:\Dev\career-forge

# Development mode (launches Express SQLite API on :3456 + Vite UI on :5173 with hot reload)
npm run dev

# Production build & single-port server (http://127.0.0.1:3456)
npm run build
npm start

# Typecheck & Automated Tests
npm run typecheck
npm test
```
# careermap
