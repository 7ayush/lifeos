# Life OS — UI & Design System

## Application Overview

Life OS is a personal productivity command center built as a single-page application. The interface follows a sidebar-plus-content layout with a glassmorphism-inspired visual language, warm amber/orange brand accents, and full dark/light mode support.

### Tech Stack

- React 19 + TypeScript
- Tailwind CSS 4 (utility-first, CSS custom properties for theming)
- Lucide React (icon library)
- React Router DOM 7 (client-side routing)
- Vite 8 (build tool)
- Fonts: Jost (body), Outfit (headings, brand)

---

## Application Shell

The app uses a fixed sidebar + scrollable main content area layout:

```
┌──────────────────────────────────────────────────┐
│ ┌──────────┐  ┌──────────────────────────────┐   │
│ │          │  │  [Notification Bell]    ──────│   │
│ │  Brand   │  │                              │   │
│ │  Logo    │  │                              │   │
│ │          │  │     Page Content              │   │
│ │  Nav     │  │     (max-w-7xl, centered)     │   │
│ │  Links   │  │                              │   │
│ │          │  │                              │   │
│ │  ─────── │  │                              │   │
│ │  Theme   │  │                              │   │
│ │  Profile │  │                              │   │
│ └──────────┘  └──────────────────────────────┘   │
│                              [+ FAB Button] ──── │
└──────────────────────────────────────────────────┘
```

- The sidebar is a 256px-wide glass panel with rounded corners (`rounded-2xl`), inset 12px from the viewport edge.
- Main content scrolls independently with 32px padding and a 7xl max-width container.
- A floating action button (FAB) sits fixed at bottom-right for quick capture of tasks, habits, goals, and journal entries.
- A notification bell in the top-right opens a dropdown panel.

---

## Pages

| Route | Page | Description |
|---|---|---|
| `/` | Dashboard | Greeting, daily focus hero, KPI cards, goal progress, habits/tasks widgets, hydration |
| `/goals` | Goals | Goal management with categories (Project, Area, Resource, Archive) and priorities |
| `/tasks` | Kanban Board | Drag-and-drop task board with timeframe filtering |
| `/habits` | Habits | Habit tracker with streak tracking and daily logging |
| `/journal` | Journal | Markdown-enabled journal entries with mood tracking |
| `/vault` | Vault | File/document storage |
| `/weekly-review` | Weekly Review | Weekly reflection with focus tasks |
| `/export` | Export Data | Data export functionality |
| `/hydration` | Hydration | Water intake tracker with daily goals |
| `/analytics` | Leaderboard | Radar chart personal stats, year-in-pixels heatmap, competitive leaderboard |
| `/profile` | Profile | User profile settings |
| `/login` | Login | Google OAuth sign-in with branded card |

---

## Design System

### Color Palette

The theme is defined via HSL CSS custom properties on `:root` (light) and `.dark` (dark), consumed through Tailwind's `@theme inline` directive.

#### Light Mode

| Token | HSL | Usage |
|---|---|---|
| `--background` | `0 0% 100%` | Page background (white) |
| `--foreground` | `240 10% 4%` | Primary text (near-black) |
| `--primary` | `38 92% 40%` | Brand amber/orange — buttons, active states, accents |
| `--accent` | `190 90% 30%` | Teal — secondary actions, task-related elements |
| `--secondary` | `240 5% 96%` | Subtle backgrounds for cards, inputs |
| `--muted` | `240 5% 96%` | Muted backgrounds |
| `--muted-foreground` | `240 5% 35%` | Secondary text, labels |
| `--destructive` | `0 84% 45%` | Error states, overdue indicators |
| `--border` | `240 6% 80%` | Borders, dividers |
| `--ring` | `38 92% 40%` | Focus rings (matches primary) |

#### Dark Mode

| Token | HSL | Usage |
|---|---|---|
| `--background` | `240 12% 3%` | Deep obsidian background |
| `--foreground` | `40 10% 95%` | Light text |
| `--primary` | `38 92% 50%` | Brighter amber for dark backgrounds |
| `--accent` | `190 90% 45%` | Brighter teal |
| `--secondary` | `240 6% 11%` | Dark card surfaces |
| `--muted` | `240 5% 15%` | Subtle dark backgrounds |
| `--muted-foreground` | `240 5% 58%` | Dimmed text |
| `--destructive` | `0 84% 60%` | Brighter red for dark mode |
| `--border` | `240 5% 13%` | Subtle dark borders |

#### Semantic Colors (used in components)

| Color | Light | Dark | Usage |
|---|---|---|---|
| Amber/Orange | `amber-500`, `orange-500` | `amber-400`, `orange-400` | Brand, streaks, primary actions |
| Cyan/Teal | `cyan-500` | `cyan-400` | Hydration, task accents |
| Emerald/Green | `emerald-500` | `emerald-400` | Completion states, goals, success |
| Indigo | `indigo-500` | `indigo-400` | Habits, quick capture save |
| Rose/Red | `rose-500` | `rose-400` | Overdue, destructive, high priority |
| Violet | `violet-500` | `violet-400` | Analytics, special features |

### Typography

| Element | Font | Weight | Size | Tracking |
|---|---|---|---|---|
| Body text | Jost | 400 (regular) | Base (14-16px) | Normal |
| Headings | Outfit | 700 (bold) | `text-xl` to `text-3xl` | `tracking-tight` |
| Brand name | Outfit | 700 (bold) | `text-2xl` | `tracking-tight` |
| Labels/badges | Jost | 700 (bold) | `text-[10px]` to `text-xs` | `tracking-wider` / `tracking-[0.2em]` |
| KPI values | Outfit | 700 (bold) | `text-3xl` | Default |
| Nav items | Jost | 500 (medium) | `text-sm` | `tracking-wide` |

### Border Radius

Base radius is `1rem` (16px), with derived values:

| Token | Value | Usage |
|---|---|---|
| `--radius-xl` | `1.25rem` (20px) | Large containers |
| `--radius-lg` | `1rem` (16px) | Cards, panels |
| `--radius-md` | `0.875rem` (14px) | Buttons, inputs |
| `--radius-sm` | `0.75rem` (12px) | Small elements, badges |
| `rounded-2xl` | 1rem | Standard card rounding |
| `rounded-3xl` | 1.5rem | Hero sections, login card |
| `rounded-full` | 9999px | Badges, pills, avatars |

### Spacing

Standard Tailwind spacing scale. Common patterns:
- Page padding: `p-8` (32px)
- Card padding: `p-5` to `p-6` (20-24px)
- Section gaps: `space-y-8` (32px)
- Grid gaps: `gap-4` (16px)
- Nav item padding: `px-4 py-2.5`

---

## Visual Effects

### Glassmorphism (`.glass-panel`)

The signature visual treatment. Cards and panels use a frosted-glass effect:

- Semi-transparent background: `hsl(var(--card) / 0.75)`
- Heavy backdrop blur: `blur(40px) saturate(1.3)`
- 1px border with gradient rim highlight (white-to-transparent in light, subtle white in dark)
- Layered box shadows for depth
- Used on: sidebar, dashboard cards, notification dropdown, quick capture modal, login card

### Card Hover Glow (`.card-glow`)

Interactive cards lift and glow on hover:
- `translateY(-2px)` lift
- Amber glow shadow: `rgba(245, 158, 11, 0.06)` (light) / `0.08` (dark)
- 300ms cubic-bezier transition

### Text Gradient (`.text-gradient`)

Brand gradient text for headings:
- Light: `#d97706 → #f59e0b → #0891b2` (amber to teal)
- Dark: `#fbbf24 → #f59e0b → #22d3ee` (brighter amber to cyan)

### Noise Texture (`.noise-texture`)

A subtle film-grain overlay across the entire viewport:
- SVG fractal noise at 1.8% opacity
- Animated with a stepping grain animation (8s, 10 steps)
- Fixed position, pointer-events disabled

### Shimmer Effect (`.shimmer`)

A horizontal shimmer sweep used on celebration banners:
- Linear gradient with amber highlight
- 2.5s infinite ease-in-out animation

### Ambient Glows

Decorative blurred circles placed behind content for depth:
- Sidebar: `bg-primary/6` blurred circle at top-left
- Dashboard hero: `bg-primary/4` and `bg-accent/3` blurred circles
- Login: radial gradient from `primary/6`

### Reduced Motion

All animations and transitions are disabled when `prefers-reduced-motion: reduce` is active. The noise texture is hidden entirely.

---

## Component Patterns

### Sidebar Navigation

- Glass panel with ambient glow
- Brand logo: amber-to-orange gradient square with italic "L" in Outfit font
- Nav links use `NavLink` with active state: amber left-bar indicator, `bg-primary/8` background, primary text color
- Inactive links: muted foreground, hover reveals secondary background
- Bottom section: theme toggle (Sun/Moon icons) and profile menu

### KPI Cards

- Glass panel with icon in a colored rounded square
- Label in uppercase `text-xs` with `tracking-wider`
- Value in `text-3xl` Outfit bold
- Celebration state: primary border glow + bouncing sparkle icon

### Progress Bars

- Rounded-full track with `bg-secondary/50`
- Fill uses gradient: `from-amber-500 via-primary to-accent`
- Complete state: solid emerald with glow shadow
- Optional shimmer overlay on completion

### Task/Habit List Items

- Rounded-xl cards with `bg-secondary/30` background
- Border on hover transitions
- Circle checkbox icons (empty → CheckCircle2 on complete)
- Priority badges and date labels inline

### Notification Dropdown

- Popover panel with backdrop blur
- Type-coded badges: cyan (upcoming), amber (due today), rose (overdue)
- Unread indicator: amber-to-orange gradient pill on bell icon
- Dismiss button appears on hover

### Quick Capture FAB

- Amber-to-orange gradient button with glow shadow
- Opens radial menu with 4 capture types (task, habit, goal, journal)
- Each option has its own color coding and glow
- Input modal with glass panel styling

### Login Page

- Centered glass card on dark background with radial gradient
- Large brand logo with amber glow shadow
- Google OAuth button (filled_black theme, pill shape)
- Decorative divider with "Sign in to continue" label

---

## Dark/Light Mode

Theme switching is handled by the `ThemeProvider` context:

- Persisted to `localStorage` under `lifeos_theme`
- Synced to backend via `PATCH /users/{id}/settings`
- Falls back to system preference (`prefers-color-scheme`)
- Toggle adds a `theme-transitioning` class for 200ms smooth transition
- Dark mode applies `.dark` class to `<html>`, enabling `color-scheme: dark`

---

## Scrollbar

Custom thin scrollbar:
- 5px width/height
- Transparent track
- Muted thumb with rounded corners
- Darker thumb on hover

---

## Icons

All icons come from Lucide React. Common sizes:
- Navigation: `w-[18px] h-[18px]`
- Card icons: `w-5 h-5` inside `w-10 h-10` colored containers
- KPI icons: `w-6 h-6` inside `w-12 h-12` containers
- Inline: `w-3 h-3` to `w-4 h-4`
