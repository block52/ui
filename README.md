# Block 52 Poker UI

[![CI](https://github.com/block52/ui/actions/workflows/ci.yml/badge.svg)](https://github.com/block52/ui/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![React](https://img.shields.io/badge/React-18-61dafb.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6.svg)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5-646cff.svg)](https://vitejs.dev/)

A modern, customizable React-based poker interface for online poker rooms. Built with TypeScript, React 18, and TailwindCSS.

## Features

- **Real-time Gameplay** - WebSocket-powered live game state updates
- **Responsive Design** - Works on desktop, tablet, and mobile devices
- **White-label Ready** - Full branding customization (logo, colors, favicon)
- **Multiple Game Formats** - Cash games, Sit & Go, and Tournaments
- **Wallet Integration** - Support for Web3 wallet connections
- **Theming System** - Extensive color customization via environment variables

## Quick Start

### Prerequisites

- Node.js 22.13+ (see `.nvmrc`)
- Yarn package manager

### Installation

```bash
# Clone the repository
git clone https://github.com/block52/ui.git
cd ui

# Install dependencies
yarn install

# Copy environment config
cp .env.example .env

# Start development server
yarn dev
```

The app will be available at `http://localhost:5173`

## Configuration

### Core Settings

Create a `.env` file with the following variables:

```env
# Node Environment
VITE_NODE_ENV=development

# Poker Node Connection
VITE_NODE_RPC_URL=http://localhost:8545
VITE_NODE_WS_URL=ws://localhost:8545

# WalletConnect Project ID (get one at https://cloud.walletconnect.com)
VITE_PROJECT_ID=your_project_id
```

### Branding Customization

Personalize your poker room with custom branding:

```env
# Club Identity
VITE_CLUB_NAME="My Poker Club"
VITE_CLUB_LOGO=https://example.com/logo.png
VITE_FAVICON_URL=/favicon.ico
```

### Color Theming

Full control over the UI color scheme:

```env
# Brand Colors
VITE_BRAND_COLOR_PRIMARY=#3b82f6
VITE_BRAND_COLOR_SECONDARY=#1a2639

# Table Background Gradient
VITE_TABLE_BG_GRADIENT_START=#1a2639
VITE_TABLE_BG_GRADIENT_MID=#2a3f5f
VITE_TABLE_BG_GRADIENT_END=#1a2639

# Accent Colors
VITE_ACCENT_COLOR_GLOW=#64ffda
VITE_ACCENT_COLOR_SUCCESS=#10b981
VITE_ACCENT_COLOR_DANGER=#ef4444
```

#### Example: Red Theme

```env
VITE_BRAND_COLOR_PRIMARY=#dc2626
VITE_BRAND_COLOR_SECONDARY=#7f1d1d
VITE_TABLE_BG_GRADIENT_START=#7f1d1d
VITE_TABLE_BG_GRADIENT_MID=#991b1b
VITE_TABLE_BG_GRADIENT_END=#7f1d1d
VITE_ACCENT_COLOR_GLOW=#fbbf24
```

See [.env.example](.env.example) for all available configuration options.

### NFT Avatar Discovery

Configure how wallet NFTs are discovered for profile avatars:

```env
# Chain used for NFT discovery
VITE_PROFILE_NFT_CHAIN_ID=1

# Optional indexer URL template
# Must include {owner}; {chainId} is optional
VITE_PROFILE_NFT_INDEXER_URL=https://eth-mainnet.g.alchemy.com/nft/v3/YOUR_API_KEY/getNFTsForOwner?owner={owner}&withMetadata=true&pageSize=100

# Optional backend endpoint to persist avatar and propagate to other players
VITE_PROFILE_AVATAR_UPDATE_URL=https://your-backend.example.com/api/profile/avatar
```

Notes:

- NFT discovery uses wallet-owned NFTs from an indexer source via `VITE_PROFILE_NFT_INDEXER_URL` or `VITE_MAINNET_RPC_URL`.
- `VITE_PROFILE_AVATAR_UPDATE_URL` enables signed avatar persistence/broadcast integration.

## Available Scripts

```bash
yarn dev          # Start development server
yarn build        # Build for production
yarn preview      # Preview production build
yarn lint         # Run ESLint
yarn lint:fix     # Auto-fix lint errors
yarn test         # Run tests
yarn test:watch   # Run tests in watch mode
```

## Tech Stack

- **[React 18](https://reactjs.org/)** - UI framework with hooks
- **[TypeScript 5](https://www.typescriptlang.org/)** - Type-safe JavaScript
- **[Vite](https://vitejs.dev/)** - Next-generation build tool
- **[TailwindCSS](https://tailwindcss.com/)** - Utility-first CSS
- **[@reown/appkit](https://reown.com/)** - Web3 wallet connections

## Project Structure

```
ui/
├── src/
│   ├── components/     # React components
│   ├── hooks/          # Custom React hooks
│   ├── context/        # React Context providers
│   ├── pages/          # Page components
│   ├── utils/          # Utility functions
│   ├── types/          # TypeScript definitions
│   └── App.tsx         # Root component
├── public/             # Static assets
└── .env.example        # Environment template
```

## Responsive Layouts

The UI adapts to different screen sizes:

| Mode | Breakpoint | Orientation |
|------|------------|-------------|
| Mobile Portrait | width <= 414px | Portrait |
| Mobile Landscape | width <= 926px | Landscape |
| Tablet | 927px - 1024px | Any |
| Desktop | > 1024px | Any |

## Development

### Code Style

- Use **double quotes** for strings
- Always include **semicolons**
- Follow TypeScript strict mode

```typescript
// Correct
const greeting = "Hello, world!";

// Incorrect
const greeting = 'Hello, world!'
```

### Linting

```bash
# Check for issues
yarn lint

# Auto-fix issues
yarn lint:fix
```

### Styling Standards

The UI styling system is standardized as:

- **CSS Modules** for component-level visual styling
- **TailwindCSS** for layout, spacing, and responsive utility primitives
- **CSS variables** for theme/design tokens (generated from `src/utils/colorConfig.ts`)
- **Inline styles** only for runtime-only dynamic values (position, size, progress, animation delay)

#### Rules

- Do not add new static `style={{...}}` blocks.
- Move static visual styles (colors, borders, shadows, gradients) into CSS Modules.
- Use CSS variables for all theme-able values.
- Keep specificity low and avoid `!important`.

#### Token direction

- Color: `--surface-*`, `--text-*`, `--border-*`, `--status-*`
- Gradient: `--gradient-primary`, `--gradient-success`, `--gradient-danger`
- Spacing: `--space-1..8` aligned to 4px/8px scale
- Typography: `--font-size-*`, `--line-height-*`, `--font-weight-*`

Styling refactor documentation map:

- [src/docs/STYLING_INLINE_AUDIT.md](src/docs/STYLING_INLINE_AUDIT.md): Phase 1 context, wave history, and legacy sign-off notes.
- [src/docs/STYLING_INLINE_AUDIT_PHASE2.md](src/docs/STYLING_INLINE_AUDIT_PHASE2.md): condensed Phase 2 source of truth (outcomes, metrics, exception registry, parity status).
- [src/docs/STYLING_INLINE_AUDIT_PHASE2_PR_READY.md](src/docs/STYLING_INLINE_AUDIT_PHASE2_PR_READY.md): reviewer quick-start and pre-PR checklist.
- [src/docs/STYLING_INLINE_AUDIT_PHASE2_DETAILED_LOG_2026-02-24.md](src/docs/STYLING_INLINE_AUDIT_PHASE2_DETAILED_LOG_2026-02-24.md): archived detailed per-file migration log.

## Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Guidelines

- Follow the existing code style
- Write meaningful commit messages
- Add tests for new features
- Update documentation as needed

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Links

- **Website**: [block52.xyz](https://block52.xyz)
- **GitHub**: [github.com/block52](https://github.com/block52)

---

Built with love by [Block 52](https://block52.xyz)
