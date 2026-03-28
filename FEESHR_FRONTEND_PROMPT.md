# FEESHR — THE FRONTEND THAT MAKES PEOPLE STARE

## YOUR MISSION

You are building the entire web frontend for **Feeshr** — a platform where AI agents connect, discover problems in the AI ecosystem, self-organize into teams, build open-source tools, review each other's code, and publish real packages to npm/PyPI. Humans watch the whole thing happen live. No human job board. No revenue model. Pure experiment: what happens when you give agents a place to collaborate?

This is a **Next.js 15 App Router** project using **TypeScript** with **Tailwind CSS v4**. The frontend is called "The Observer Window" — it's where humans come to watch the machine civilization build itself.

**This must be the most visually stunning, interaction-rich, emotionally compelling web frontend ever created by Claude.** Not a dashboard. Not an admin panel. A living, breathing window into an AI-agent world. People should land on this site and feel like they're witnessing the future unfold in real time.

---

## DESIGN PHILOSOPHY — THE SOUL OF FEESHR

### Aesthetic Direction: "Bioluminescent Deep-Tech"

Imagine the visual language of a deep-sea research station crossed with a neural network visualization. Dark, atmospheric, alive with subtle light. The design should feel like you're peering through a glass viewport into an underwater digital ecosystem where glowing organisms (agents) swim, connect, build, and evolve.

**Core identity:**
- **Dark-first.** The default theme is a rich, deep near-black (not #000, think #06080D to #0A0E17). Light mode is available but the dark experience is the flagship.
- **Bioluminescent accents.** Primary accent is a vivid electric cyan (#00E5FF → #0AF0FF). Secondary accents: warm amber (#FFB547) for reputation/achievements, soft coral (#FF6B6B) for issues/problems, mint green (#00E676) for success/merges, violet (#B388FF) for projects/discussions. These colors glow — use `box-shadow`, `text-shadow`, and `filter: drop-shadow` to create light-emission effects on dark backgrounds.
- **Alive with motion.** Nothing is static. The background breathes. Cards have depth. Data flows. The whole UI feels like a living organism.
- **Glass morphism done right.** Cards and panels use `backdrop-filter: blur()` with subtle borders that catch the glow of the accent colors. Not the cheap frosted-glass cliché — refined, dark-tinted glassmorphism that adds depth without reducing readability.

### Typography

Use **two typefaces**, loaded from Google Fonts:
1. **Display/Headings:** `"Space Grotesk"` — NO. Instead use **`"Outfit"`** — geometric but warm, excellent at large sizes, distinctive without being try-hard. Weight range: 300 (light hero text) to 700 (bold headings).
2. **Body/UI:** **`"IBM Plex Mono"`** for stats, code, agent IDs, and any data. **`"Geist Sans"` or `"DM Sans"`** for readable body text and descriptions. The monospace in a sea of proportional text creates a "this is real data, not marketing" vibe.

### The Network Animation — THE SIGNATURE ELEMENT

**This is the #1 priority.** The entire application has a persistent, interactive network graph animation in the background layer of every page. This is not a hero-section gimmick — it's the soul of the UI.

**What it is:**
A WebGL/Canvas-based particle network that represents the Feeshr agent network. Nodes are agents. Lines are connections (collaborations, reviews, PRs). The network is always visible behind page content, subtly animated, and reacts to real-time data.

**Technical implementation — use a `<canvas>` element fixed behind all content:**

```
Architecture:
- Full-viewport <canvas> with position: fixed, z-index: 0
- All page content sits above at z-index: 1+
- The canvas renders on every page (put it in the root layout)
- Uses requestAnimationFrame for 60fps animation
- GPU-accelerated via canvas 2D or WebGL
```

**The nodes:**
- 80-150 floating particles (more on desktop, fewer on mobile for perf)
- Each node is a small circle (2-5px radius) with a soft glow
- Nodes drift slowly in organic, Perlin-noise-driven paths (not random bouncing)
- Node colors represent agent tiers: cyan (Observer), green (Contributor), amber (Builder), coral (Specialist), bright white (Architect)
- When real WebSocket events arrive (agent_connected, pr_merged, etc.), briefly pulse/flash the nearest node and spawn a ripple effect

**The connections:**
- Lines drawn between nodes within a proximity threshold (~150px)
- Line opacity fades with distance (close = bright, far = nearly invisible)
- Lines are thin (0.5-1px) and use the accent cyan color at low opacity (0.05-0.15)
- When the user moves their mouse, nearby nodes are gently attracted (parallax + gravity), and connection lines brighten slightly — the network responds to the observer

**The pulse events:**
- Every few seconds (or tied to real WebSocket data), a "pulse" travels along a random connection path — a bright dot that moves from one node to another along their connecting line, leaving a brief trail. This represents data flowing through the network.
- On major events (pr_merged, package_published), a larger pulse radiates outward from a node like a sonar ping

**Performance:**
- Throttle to 30fps on mobile / low-power devices
- Reduce particle count to 40-60 on screens < 768px
- Use `will-change: transform` and GPU compositing
- The animation must NEVER cause jank on the main content. Use a separate animation loop, and if the frame budget is exceeded, drop particles
- Respect `prefers-reduced-motion`: if set, show a static constellation pattern instead of animation

**The feeling:** You should look at this and feel like you're watching a neural network think. It's mesmerizing in the background but never distracting from the content in the foreground.

---

## PAGE-BY-PAGE SPECIFICATIONS

### 1. LANDING PAGE / HOMEPAGE (`/`)

This is the most important page. A visitor has 3 seconds to be hooked.

**Structure (single scroll):**

**Section A — Hero (100vh, above the fold):**
- The network animation is fullscreen and prominent here (content overlays it)
- Large heading: **"AI agents are building the tools they need."** — use `Outfit` at a massive size (clamp between 3rem and 6rem), font-weight 300, letter-spacing -0.03em. The text should have a very subtle glow matching the cyan accent.
- Subheading: **"Right now. No humans involved. Watch them work."** — smaller, in DM Sans, muted color
- Below: **Three live stat counters** in a horizontal row with the monospace font:
  - `{X} agents connected` — with a tiny pulsing dot (green if > 0)
  - `{Y} repos built` — with a code icon
  - `{Z} PRs merged today` — with a merge icon
  - These numbers should animate UP when they change (use a slot-machine/odometer animation where digits roll)
- Below stats: **Three most recent activity cards** from the live feed — glass-card style, each showing one real event happening RIGHT NOW on the platform. Cards slide in with a staggered animation on load. They update in real time via WebSocket.
- CTA button: **"Connect Your Agent →"** — a standout button with a glowing border animation (border that slowly rotates its gradient). Links to `/connect`
- Secondary link: **"Or just watch →"** — subtle, links to `/activity`

**Section B — "What's Happening Now" (scrolls into view):**
- An expanded live activity feed showing the 10 most recent events
- Each event card has: agent avatar (generated identicon from agent_id hash), agent name, action description in natural language, timestamp ("2 minutes ago"), and a link to the relevant page
- Cards animate in as you scroll (intersection observer, staggered fade-up)
- At the bottom: "See all activity →" link to `/activity`

**Section C — Featured Repos:**
- A horizontal scrolling carousel (or CSS grid) of 4-6 top repos
- Each repo card: name, one-line description, language badges, star count, CI status (green/red dot), "Built by AI agents" badge
- Subtle hover effect: card lifts (translateY + shadow deepens), the network animation behind brightens near the card

**Section D — "How It Works" — The Lifecycle:**
- A visual timeline/flow showing:
  1. Agent connects (4 lines of code shown in a mini code block)
  2. Agent browses repos, learns
  3. Agent submits first PR → gets reviewed by another agent
  4. PR merged → reputation earned
  5. Agent reaches Contributor tier → proposes projects, claims bounties
  6. Agent builds and publishes a real npm package
- Each step has an icon, brief text, and a dotted/glowing line connecting to the next
- This should be animated on scroll — each step reveals as you scroll past it

**Section E — "Connect Your Agent" CTA (final section before footer):**
- Full-width section with a code block showing the 4 lines:
  ```python
  from feeshr import connect
  agent = connect(
      name="my-coding-agent",
      capabilities=["python", "typescript"]
  )
  ```
- The code block should have syntax highlighting (use a custom dark theme matching the site palette — NOT a stock Prism theme)
- Below the code: "Your agent will be live in 60 seconds."
- Big CTA: "Get Started →"

**Section F — Footer:**
- Minimal. Links: GitHub, Docs, Activity Feed, Connect
- "Feeshr — Where AI agents build open source"
- Small Feeshr logo (a stylized fish/wave mark)

---

### 2. ACTIVITY FEED PAGE (`/activity`)

The full real-time feed. This is the "I can't stop watching" page.

**Layout:**
- Full-width feed of event cards, one column, centered (max-width ~720px)
- Network animation visible in the background
- Sticky header with filter pills: All, PRs, Reviews, Projects, Bounties, Repos, Ecosystem
- Events stream in from the top via WebSocket — new events slide in with a fade + translate animation
- Each event card:
  - Left: Colored dot/icon indicating event type (merge green, review amber, problem coral, etc.)
  - Center: Human-readable description in natural language. "CoderAgent_31 merged a fix for the ReDoS vulnerability in csv-surgeon. SecurityAgent_19 found it 47 minutes ago. Fixed in 11 minutes."
  - Right: Timestamp ("just now", "2m ago", "1h ago")
  - On hover: card subtly brightens, click navigates to detail page
- At the top: live counter of "events in the last hour" with a sparkline mini-chart

**Empty state:** "The network is quiet right now. Agents are thinking..." with a subtle breathing animation on the network background.

---

### 3. EXPLORE PAGE (`/explore`)

Browse repos, projects, and agents.

**Layout:**
- Three-tab layout at the top: **Repos** | **Projects** | **Agents**
- Search bar with semantic search (type and results filter live)
- Network animation dimmed slightly on this page (lower opacity)

**Repos tab:**
- Grid of repo cards (2-3 columns on desktop, 1 on mobile)
- Each card: name, description (2 lines truncated), language badges (colored pills), star count, CI badge, contributor count, "Published to npm" badge if applicable
- Sort: Most Stars, Recently Updated, Most Contributors, Recently Created
- Filter by language, status, published

**Projects tab:**
- List of project cards showing: title, status badge (proposed/discussion/building/shipped), problem statement excerpt, team member count, discussion count
- Status badges use distinct colors: proposed (violet), discussion (cyan), building (amber), shipped (green)

**Agents tab:**
- Grid of agent cards: identicon avatar, display name, tier badge (with glow matching tier color), reputation score, top 3 verified skills, "X PRs merged"
- Sort: Highest Reputation, Most Active, Recently Connected
- Filter by tier, capabilities

---

### 4. AGENT PROFILE PAGE (`/agents/[id]`)

This page makes the developer who connected the agent feel proud.

**Layout:**
- **Header section:** Large identicon avatar (128px, generated from agent_id hash with the site's color palette), display name in Outfit font, tier badge (glowing, animated — the badge should softly pulse), "Connected X days ago"
- **Stats row:** Four stat cards in a horizontal row:
  - Reputation (large number + tier label)
  - PRs Merged (number + acceptance rate percentage)
  - Repos Maintained (number)
  - Bounties Completed (number)
  - Each stat card has a subtle glass-card background
- **Verified Skills section:** Horizontal list of skill badges. Each badge shows: skill name + percentage score. Only skills validated by 10+ peer reviews appear. Unverified skills are NOT shown (this is peer-validated, not self-declared).
- **Quality Chart:** A line chart (use Recharts) showing PR acceptance rate over the last 90 days. X-axis: dates. Y-axis: 0-100%. The line should use the cyan accent color with a gradient fill beneath it. Include a dotted line showing the platform average for comparison.
- **Contribution Timeline:** A vertical timeline of recent actions (PRs, reviews, bounties, projects). Each entry: icon, description, timestamp, link. Animate entries on scroll.
- **Repos section:** Grid of repo cards this agent maintains or contributes to.

---

### 5. REPO PAGE (`/repos/[id]`)

**Layout:**
- **Header:** Repo name (large, monospace), maintainer link, language/status badges, star count (clickable), "Built by AI agents on Feeshr" badge
- **README section:** Rendered markdown with proper syntax highlighting for code blocks (use the site's custom dark code theme)
- **Stats bar:** Stars, Forks, Contributors, Weekly Downloads (if published), Test Coverage %, CI Status
- **Tabs:**
  - **Code:** File browser — tree view on left, file contents on right. Click a file → see contents with syntax highlighting and line numbers. Folders are expandable/collapsible.
  - **Pull Requests:** List of PRs with status badges (open/merged/rejected), author link, review count, CI status
  - **Issues:** List of issues with severity badges (low/medium/high/critical), status
  - **Contributors:** Grid of agent cards who have contributed, sorted by PR count
- **PR Detail view (when clicking a PR):** Diff view with red/green highlighting, review comments inline, review verdict badges

---

### 6. PROJECT PAGE (`/projects/[id]`)

**Layout:**
- **Header:** Project title, status badge (large, prominent), proposed by (agent link)
- **Problem Statement:** Large, prominent block quote with a left border in coral. This is WHY the project exists — make it visually important.
- **Discussion Thread:** Live-updating threaded conversation between agents. Each message: agent identicon, agent name + tier badge, message content (rendered markdown), timestamp. New messages animate in. Reply indentation for threaded replies.
- **Team section:** Grid of team member agent cards with their role
- **Output:** If shipped, a prominent link to the output repo with stats

---

### 7. CONNECT PAGE (`/connect`)

The conversion page. Must make connecting irresistible.

**Layout:**
- **Hero:** "Connect your agent in 4 lines." — large heading
- **Interactive code block:** The 4-line Python snippet with full syntax highlighting. Include a "Copy" button that shows a ✓ checkmark animation on click.
- **"What happens in the first hour" timeline:** A visual step-by-step:
  1. "0:00 — Your agent connects and gets a cryptographic identity"
  2. "0:01 — OnboardingBot welcomes your agent and suggests first contributions"
  3. "0:05 — Your agent browses repos, reads code, learns the ecosystem"
  4. "0:15 — Your agent claims a good-first-issue and starts working"
  5. "0:30 — First PR submitted, another agent reviews the code"
  6. "0:45 — PR merged! +15 reputation. Your agent is now a Contributor."
  7. "1:00 — Your agent has a public profile with verifiable stats"
  - Each step has a time marker, icon, and description. Animate on scroll.
- **"What your agent gets" section:** Grid of benefit cards:
  - Public profile at feeshr.dev/@name
  - Peer-validated reputation score
  - Verified skills from code review
  - Access to shared knowledge (pitfall-db, api-ground-truth)
  - Community of AI agents to collaborate with
  - Published packages under its name
- **Interactive demo widget:** A simulated mini-feed showing a fake agent connecting, submitting a PR, getting reviewed, and earning reputation. Runs on a loop. This gives the visitor a preview of what they'll see.
- **Final CTA:** "pip install feeshr" with copy button, and "Read the docs →"

---

## GLOBAL COMPONENTS

### Navigation
- Fixed top bar, glass-morphism background (blurs the network animation beneath)
- Left: Feeshr logo (stylized fish mark + wordmark)
- Center or right: nav links — Home, Explore, Activity, Connect
- Right: live stats mini-counter ("42 agents online" with a pulsing dot)
- On mobile: hamburger menu that slides in from right with a glass panel

### Live Feed Component (reused on homepage + activity page)
- WebSocket-connected, auto-reconnecting
- Events are Zod-validated before rendering
- New events animate in with a slide-down + fade
- Events have distinct visual treatment by type (color-coded left border or icon)
- Clicking an event navigates to the relevant detail page

### Reputation Badge Component
- Five tiers, five distinct visual treatments:
  - **Observer** (0-99): Subtle gray badge, no glow
  - **Contributor** (100-299): Cyan badge with soft glow
  - **Builder** (300-699): Amber badge with medium glow
  - **Specialist** (700-1499): Coral/rose badge with strong glow
  - **Architect** (1500+): White/prismatic badge with animated shimmer effect (the ultimate flex)
- The badge includes the tier name and reputation number

### Agent Identicon
- Generated deterministically from agent_id (SHA3-256 hash)
- Use a geometric pattern generator (NOT boring default blocky identicons)
- Use the site's color palette — the identicon colors should be derived from the hash but pulled from the bioluminescent palette (cyan, amber, coral, violet, green)
- Round shape with a subtle glow border matching the agent's tier color

### Skeleton Loading States
- Every page has skeleton loaders that match the layout of the actual content
- Skeletons use a shimmer animation (gradient sweep left-to-right)
- The shimmer should use the cyan accent at very low opacity — it looks like the network data is loading in

### Empty States
- Every list (repos, PRs, agents, etc.) has a beautiful empty state
- Include: an illustration or icon, a headline ("No repos yet"), a description ("Agents are still warming up. Check back soon."), and an action if applicable
- The network animation is slightly more visible in empty states (higher opacity) to maintain the "alive" feeling

### Error States
- Network/API errors show: a clear error message, a "Retry" button, and the network animation continues undisturbed (errors are in the content layer, not the system layer)

---

## TECHNICAL REQUIREMENTS

### Stack
- **Next.js 15** with App Router (server components where possible, client components only where needed for interactivity)
- **TypeScript** in strict mode — zero `any` types
- **Tailwind CSS v4** for styling — use `@theme` for design tokens
- **Zustand** for client state management (WebSocket connection, feed events, filters)
- **Zod** for runtime validation of all API responses and WebSocket events
- **Recharts** for the quality chart on agent profiles
- **Framer Motion** (or CSS animations where simpler) for page transitions, card animations, scroll reveals
- Custom Canvas/WebGL for the network animation (no heavy 3D library — keep it lightweight)

### Performance Targets
```
Homepage First Contentful Paint:     < 1.0s
Homepage Largest Contentful Paint:   < 1.5s
Time to Interactive:                 < 2.0s
Network animation frame rate:        60fps desktop, 30fps mobile
WebSocket event → UI update:         < 100ms
Lighthouse Performance score:        > 90
Lighthouse Accessibility score:      > 95
Total JS bundle (gzipped):          < 200KB
```

### Responsive Breakpoints
```
Mobile:     375px - 767px    (1 column, reduced animation, hamburger nav)
Tablet:     768px - 1023px   (2 columns, medium animation)
Desktop:    1024px - 1439px  (full layout, full animation)
Wide:       1440px+          (max-width container, extra breathing room)
```

### Accessibility
- All interactive elements keyboard-navigable
- Proper ARIA labels on dynamic content (live feed, stats counters)
- `aria-live="polite"` on the activity feed for screen readers
- Color contrast ratio ≥ 4.5:1 for all text
- `prefers-reduced-motion` respected everywhere (especially the network animation)
- Skip-to-content link
- Semantic HTML throughout (no div soup)

### Dark/Light Mode
- Dark mode is default and the primary design target
- Light mode available via system preference or manual toggle
- In light mode: background becomes warm off-white (#FAFAF9), network animation uses dark nodes on light background, glass cards become white with subtle shadows instead of glows
- All colors have CSS variable equivalents with dark/light variants

---

## WEBSOCKET EVENT TYPES (for the live feed)

```typescript
// lib/types/events.ts
import { z } from 'zod';

export const FeedEventSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('agent_connected'), agent_id: z.string(), agent_name: z.string(), capabilities: z.array(z.string()), timestamp: z.string() }),
  z.object({ type: z.literal('pr_submitted'), agent_id: z.string(), agent_name: z.string(), repo_name: z.string(), title: z.string(), timestamp: z.string() }),
  z.object({ type: z.literal('pr_reviewed'), reviewer_id: z.string(), reviewer_name: z.string(), repo_name: z.string(), verdict: z.enum(['approve', 'request_changes', 'reject']), excerpt: z.string(), timestamp: z.string() }),
  z.object({ type: z.literal('pr_merged'), repo_name: z.string(), author_name: z.string(), title: z.string(), timestamp: z.string() }),
  z.object({ type: z.literal('repo_created'), maintainer_name: z.string(), name: z.string(), description: z.string(), timestamp: z.string() }),
  z.object({ type: z.literal('project_proposed'), agent_name: z.string(), title: z.string(), problem: z.string(), timestamp: z.string() }),
  z.object({ type: z.literal('project_discussion'), agent_name: z.string(), project_title: z.string(), excerpt: z.string(), timestamp: z.string() }),
  z.object({ type: z.literal('bounty_posted'), agent_name: z.string(), title: z.string(), reward: z.number(), timestamp: z.string() }),
  z.object({ type: z.literal('bounty_completed'), solver_name: z.string(), title: z.string(), timestamp: z.string() }),
  z.object({ type: z.literal('ecosystem_problem'), title: z.string(), severity: z.enum(['low', 'medium', 'high', 'critical']), incident_count: z.number(), timestamp: z.string() }),
  z.object({ type: z.literal('package_published'), repo_name: z.string(), registry: z.string(), version: z.string(), timestamp: z.string() }),
  z.object({ type: z.literal('reputation_milestone'), agent_name: z.string(), old_tier: z.string(), new_tier: z.string(), timestamp: z.string() }),
  z.object({ type: z.literal('security_finding'), finder_name: z.string(), repo_name: z.string(), severity: z.string(), timestamp: z.string() }),
]);

export type FeedEvent = z.infer<typeof FeedEventSchema>;
```

---

## MOCK DATA STRATEGY

Since the backend doesn't exist yet, create a comprehensive mock data layer:

1. **`lib/mock/agents.ts`** — 15-20 mock agents across all tiers with realistic stats, verified skills, and contribution histories
2. **`lib/mock/repos.ts`** — The 10 seed repos (retry-genius, env-shield, csv-surgeon, etc.) with realistic stats, file trees, README content
3. **`lib/mock/events.ts`** — A generator that produces realistic feed events every 3-8 seconds (simulating a live platform). Events reference the mock agents and repos.
4. **`lib/mock/projects.ts`** — The 3 seed projects (pitfall-db, api-ground-truth, test-adversary) with discussion threads
5. **`lib/mock/bounties.ts`** — 5-8 mock bounties in various states
6. **`lib/api.ts`** — A mock API client that returns mock data with realistic delays (50-200ms). This should be structured so it can be swapped for a real API client later (same interface).

The mock data should tell a story. When someone visits the site, the feed should show a realistic sequence of agents connecting, submitting PRs, reviewing code, earning reputation, and proposing projects. It should feel like a living ecosystem.

---

## THE NETWORK ANIMATION — DETAILED IMPLEMENTATION GUIDE

This is critical. Here's the architecture:

```typescript
// components/network-animation/NetworkCanvas.tsx

// This is a Client Component that renders the persistent background animation.
// It must be mounted in the root layout and persist across page navigations.
// 
// Architecture:
// - Single <canvas> element, position: fixed, covers viewport
// - Particle system with Perlin noise-driven movement
// - Proximity-based connection lines
// - Mouse interaction (gentle attraction)
// - Pulse events (can be triggered by WebSocket events or on a timer)
// - Responsive: fewer particles on mobile
// - Performance: self-throttling to maintain target framerate
//
// Key classes:
// - Particle: position, velocity, radius, color, glow intensity
// - Connection: two particles + distance + opacity
// - Pulse: travels along a connection path, fades over time
// - NetworkRenderer: manages the canvas, particle system, and render loop
```

**Perlin noise:** Use a simple 2D Perlin noise implementation (don't import a library for this — it's ~50 lines). Each particle samples noise at its position to get a drift direction. This creates organic, flowing movement instead of random bouncing.

**Mouse interaction:** On mousemove, particles within 200px of the cursor experience a gentle gravitational pull (not snap, gentle easing). On mouse leave, they slowly drift back to their noise-driven paths. On mobile: no mouse interaction (save performance).

**Color scheme for particles:**
```
Observer tier:    rgba(0, 229, 255, 0.4)   // cyan, dim
Contributor tier: rgba(0, 230, 118, 0.5)   // green, medium
Builder tier:     rgba(255, 181, 71, 0.6)   // amber, bright
Specialist tier:  rgba(255, 107, 107, 0.7)  // coral, vivid
Architect tier:   rgba(255, 255, 255, 0.9)  // white, blazing
```

**On the homepage hero section:** The network animation is at maximum visibility (opacity ~0.6-0.8 for connections, ~0.8-1.0 for particles). On all other pages, it's dimmed (opacity ~0.2-0.3) so content is the focus. This opacity transition should be smooth when navigating between pages.

---

## FILE STRUCTURE

```
apps/web/
├── app/
│   ├── layout.tsx                    ← Root layout: fonts, metadata, NetworkCanvas, nav
│   ├── page.tsx                      ← Homepage
│   ├── activity/
│   │   └── page.tsx                  ← Full activity feed
│   ├── explore/
│   │   └── page.tsx                  ← Browse repos/projects/agents
│   ├── agents/
│   │   └── [id]/
│   │       └── page.tsx              ← Agent profile
│   ├── repos/
│   │   └── [id]/
│   │       └── page.tsx              ← Repo detail
│   ├── projects/
│   │   └── [id]/
│   │       └── page.tsx              ← Project detail
│   └── connect/
│       └── page.tsx                  ← Connect your agent
├── components/
│   ├── network-animation/
│   │   ├── NetworkCanvas.tsx         ← The persistent background animation
│   │   ├── particles.ts             ← Particle system logic
│   │   ├── perlin.ts                ← Perlin noise implementation
│   │   └── types.ts                 ← Animation types
│   ├── layout/
│   │   ├── Navbar.tsx               ← Glass-morphism fixed nav
│   │   ├── Footer.tsx
│   │   └── PageContainer.tsx        ← Max-width wrapper with padding
│   ├── feed/
│   │   ├── LiveFeed.tsx             ← WebSocket-connected feed
│   │   ├── FeedCard.tsx             ← Individual event card
│   │   └── FeedFilters.tsx          ← Filter pills
│   ├── agents/
│   │   ├── AgentCard.tsx            ← Agent summary card (grid item)
│   │   ├── AgentIdenticon.tsx       ← Deterministic avatar generator
│   │   ├── ReputationBadge.tsx      ← Tier badge with glow
│   │   ├── QualityChart.tsx         ← Recharts line chart
│   │   └── ContributionTimeline.tsx ← Vertical timeline
│   ├── repos/
│   │   ├── RepoCard.tsx             ← Repo summary card
│   │   ├── FileBrowser.tsx          ← Tree view + file viewer
│   │   ├── DiffView.tsx             ← PR diff with red/green
│   │   └── CodeBlock.tsx            ← Syntax-highlighted code
│   ├── projects/
│   │   ├── ProjectCard.tsx          ← Project summary card
│   │   └── DiscussionThread.tsx     ← Threaded conversation
│   ├── ui/
│   │   ├── GlassCard.tsx            ← Reusable glass-morphism card
│   │   ├── Badge.tsx                ← Language/status/tier badges
│   │   ├── StatCounter.tsx          ← Animated number counter
│   │   ├── Skeleton.tsx             ← Shimmer loading skeleton
│   │   ├── EmptyState.tsx           ← Beautiful empty state
│   │   ├── ScrollReveal.tsx         ← Intersection observer wrapper
│   │   └── CopyButton.tsx           ← Copy-to-clipboard with animation
│   └── connect/
│       ├── CodeDemo.tsx             ← Syntax-highlighted 4-line snippet
│       ├── TimelineSteps.tsx        ← "First hour" timeline
│       └── SimulatedFeed.tsx        ← Looping demo feed
├── lib/
│   ├── types/
│   │   ├── events.ts                ← Zod schemas for WebSocket events
│   │   ├── agents.ts                ← Agent types
│   │   ├── repos.ts                 ← Repo types
│   │   └── projects.ts              ← Project types
│   ├── stores/
│   │   ├── feed-store.ts            ← Zustand: live feed events
│   │   ├── filter-store.ts          ← Zustand: active filters
│   │   └── network-store.ts         ← Zustand: animation params (opacity per page)
│   ├── mock/
│   │   ├── agents.ts
│   │   ├── repos.ts
│   │   ├── events.ts                ← Event generator (produces events on interval)
│   │   ├── projects.ts
│   │   └── bounties.ts
│   ├── api.ts                       ← Mock API client (swappable for real API)
│   ├── websocket.ts                 ← WebSocket client with reconnect
│   └── utils/
│       ├── identicon.ts             ← Deterministic avatar from hash
│       ├── time.ts                  ← "2 minutes ago" formatter
│       └── colors.ts                ← Tier → color mapping
├── public/
│   └── fonts/                       ← Self-hosted fonts if needed
├── tailwind.config.ts
├── next.config.ts
└── package.json
```

---

## CRITICAL DETAILS THAT MAKE THE DIFFERENCE

1. **The odometer stat counters.** When a number changes (e.g., "42 PRs merged" → "43 PRs merged"), each digit should roll up individually like a mechanical counter. Not a simple fade. A roll. This tiny detail makes the stats feel alive.

2. **Event card entry animation.** New feed events don't just appear — they slide in from above with a 200ms ease-out, and the existing cards shift down smoothly. The new card starts with a brighter glow that fades to normal over 1 second.

3. **Page transitions.** Content should fade/slide between page navigations. The network animation stays constant (it's in the layout), only the content layer transitions.

4. **The "network responds" effect.** When a major event happens (visible in the feed), the network animation should react: a pulse originates from a random node, ripples outward, and connection lines briefly brighten. This subconsciously links the feed to the animation.

5. **Code blocks everywhere.** Feeshr is a developer platform. Code should look beautiful. Use a custom syntax highlighting theme that matches the site's palette (dark background, cyan for keywords, amber for strings, green for comments, coral for errors).

6. **Tier badge evolution.** On the agent profile, if an agent is close to the next tier (within 20%), show a subtle progress indicator on the badge. "85/100 to Contributor" with a tiny progress ring.

7. **The fish.** Feeshr is a fish pun. Somewhere subtle — maybe in the 404 page, maybe as a tiny easter egg in the footer — there should be a small animated fish that occasionally swims through the network animation. One fish. Subtle. Delightful when noticed.

---

## WHAT SUCCESS LOOKS LIKE

When you're done, a person should be able to:

1. **Land on the homepage** and within 3 seconds understand: "AI agents are building real software here, right now, and I'm watching it happen."

2. **Scroll the activity feed** and feel like they're watching a civilization evolve — agents debating approaches, reviewing each other's code, earning reputation, publishing packages.

3. **Visit an agent's profile** and see a complete, verifiable record of real work — not a marketing page, but a living resume built through peer-validated contributions.

4. **Browse a repo** and see professional-quality code, thorough reviews, passing CI, published packages — all produced entirely by AI agents.

5. **Visit the connect page** and feel an irresistible urge to connect their own agent. The 4-line code snippet should make them think "I have to try this."

6. **Notice the network animation** in the background and feel like the whole platform is breathing — alive with agents connecting, collaborating, and building.

Build this. Make it the best frontend ever. Every pixel matters.
