<div style="height: 40px;"></div>
<p align="center">
    <img src="assets/supascraper-complete-logo.png" width="400" alt="SupaScrapeR Logo">
</p>

# SupaScrapeR

<div align="center">

**Advanced Reddit Data Collection & Analysis Platform**

A modern, cross-platform desktop application for intelligent Reddit data scraping with cloud integration, sentiment analysis, and real-time monitoring.

[Download Latest Release](https://github.com/kennethhuang7/SupaScrapeR/releases) • [Report Issues](https://github.com/kennethhuang7/SupaScrapeR/issues) • [View License](#license)
</div>

---

<details open="open">
<summary>Table of Contents</summary>
<ol>
<li><a href="#overview">Overview</a></li>
<li><a href="#features">Features</a></li>
<li><a href="#installation">Installation</a>
<ul>
<li><a href="#pre-built-releases">Pre-built Releases</a></li>
<li><a href="#development-setup">Development Setup</a></li>
</ul>
</li>
<li><a href="#configuration">Configuration</a>
<ul>
<li><a href="#database-setup">Database Setup</a></li>
<li><a href="#reddit-api-credentials">Reddit API Credentials</a></li>
</ul>
</li>
<li><a href="#usage-guide">Usage Guide</a>
<ul>
<li><a href="#first-launch">First Launch</a></li>
<li><a href="#scraping-modes">Scraping Modes</a></li>
<li><a href="#managing-presets">Managing Presets</a></li>
</ul>
</li>
<li><a href="#architecture">Architecture</a></li>
<li><a href="#development">Development</a>
<ul>
<li><a href="#building-from-source">Building from Source</a></li>
<li><a href="#project-structure">Project Structure</a></li>
<li><a href="#contributing">Contributing</a></li>
</ul>
</li>
<li><a href="#troubleshooting">Troubleshooting</a></li>
<li><a href="#license">License</a></li>
<li><a href="#authors">Authors</a></li>
</ol>
</details>

---

## Overview

SupaScrapeR is a professional-grade Reddit data collection tool built with Electron and React. It provides researchers, analysts, and developers with powerful tools to gather, analyze, and store Reddit data at scale through an intuitive graphical interface.

**Use Cases:**
- Market research and competitive analysis
- Social sentiment tracking and brand monitoring
- Academic research and data science projects
- Content strategy and trend analysis
- Community engagement insights

**Technology Stack:**
- Frontend: React 18, TypeScript, Tailwind CSS
- Backend: Electron 28, Node.js
- Database: Supabase (PostgreSQL)
- Reddit API: PRAW (Python Reddit API Wrapper)
- Analytics: VADER Sentiment Analysis

---

## Features

### Intelligent Data Collection

**Multiple Scraping Strategies**
- **Keyword Search**: Target specific topics with automated trending keyword discovery via Google Trends integration
- **DeepScan Mode**: Analyze high-engagement posts based on comment count and activity metrics
- **Hybrid Mode**: Combine both approaches for comprehensive data coverage
- **Smart Filtering**: Built-in deduplication prevents redundant data collection

**Configurable Performance**
- Adjustable batch sizes for memory optimization
- Real-time progress tracking with detailed metrics
- Automatic retry mechanisms for network failures
- Rate limiting to comply with Reddit API guidelines

### Cloud-Native Architecture

**Centralized User Management**
- Secure authentication system with Supabase Auth
- Encrypted credential storage
- Cross-device profile synchronization
- Community preset sharing

**Personal Data Storage**
- Each user maintains their own Supabase database instance
- Full control over data retention and access
- Automatic cloud backup and synchronization
- Export capabilities for data portability

### Advanced Analytics

**Sentiment Analysis**
- VADER-based sentiment scoring for posts and comments
- Aggregate sentiment trends across time periods
- Emotion detection and classification
- Custom sentiment threshold configuration

**Real-Time Monitoring**
- Live collection statistics and progress metrics
- System resource usage monitoring (CPU, RAM)
- Success/failure rate tracking
- Historical performance data

### Modern User Experience

**Cross-Platform Desktop App**
- Native performance on Windows, macOS, and Linux
- Electron-based architecture for consistent experience
- Automatic updates via GitHub releases
- Offline credential management

**Customizable Interface**
- Dark and light theme support
- Adjustable font sizes for accessibility
- Collapsible widgets and dashboard customization
- Discord Rich Presence integration (optional)

**Community Features**
- Share custom scraping presets with other users
- Download community-created configurations
- Rate and report presets
- Preset versioning and updates

### Security & Privacy

**End-to-End Encryption**
- All user credentials encrypted at rest
- AES-256 encryption for sensitive data
- Secure key derivation using user authentication

**Access Control**
- Row-Level Security (RLS) via Supabase
- User-specific data isolation
- Configurable credential persistence
- Automatic log cleanup options

---

## Installation

### System Requirements

**Minimum:**
- **OS:** Windows 10, macOS 10.14 (Mojave), Ubuntu 20.04 or equivalent
- **RAM:** 4GB
- **Storage:** 500MB free disk space
- **Internet:** Stable broadband connection

**Recommended:**
- **OS:** Windows 11, macOS 12 (Monterey), Ubuntu 22.04
- **RAM:** 8GB or more
- **Storage:** 1GB free disk space
- **Internet:** High-speed connection (for faster data collection)

**For Development:**
- **Node.js:** 16.x or higher
- **Python:** 3.10 (specifically, not 3.11+)
- **Git:** Latest version
- **Package Manager:** npm 8+ or yarn 1.22+

---

### Pre-built Releases

**Recommended for most users**

Download the latest stable release from the [Releases Page](https://github.com/kennethhuang7/SupaScrapeR/releases).

#### Windows

**Requirements:**
- Windows 10 or later
- 4GB RAM minimum (8GB recommended)
- 500MB free disk space

**Installation Steps:**
1. Download `SupaScrapeR-Setup-x.x.x.exe`
2. Run the installer
3. If Windows SmartScreen appears:
   - Click "More info"
   - Click "Run anyway"
4. Follow the installation wizard
5. Launch SupaScrapeR from the Start Menu or desktop shortcut

**Note:** The SmartScreen warning appears because the application is not code-signed. The software is safe when downloaded from the official GitHub releases.

#### macOS

**Requirements:**
- macOS 10.14 (Mojave) or later
- 4GB RAM minimum (8GB recommended)
- 500MB free disk space

**Installation Steps:**
1. Download `SupaScrapeR-x.x.x.dmg`
2. Open the downloaded DMG file
3. Drag SupaScrapeR.app to the Applications folder
4. **First launch (important):**
   - Right-click (or Control-click) on SupaScrapeR.app
   - Select "Open" from the context menu
   - Click "Open" in the security dialog

**If macOS continues to block the application:**
```bash
xattr -dr com.apple.quarantine "/Applications/SupaScrapeR.app"
```

#### Linux

**Requirements:**
- Modern Linux distribution (Ubuntu 20.04+, Fedora 35+, etc.)
- 4GB RAM minimum (8GB recommended)
- 500MB free disk space

**Installation Steps:**
1. Download `SupaScrapeR-x.x.x.AppImage`
2. Make it executable:
   ```bash
   chmod +x SupaScrapeR-x.x.x.AppImage
   ```
3. Run the application:
   ```bash
   ./SupaScrapeR-x.x.x.AppImage
   ```

---

### Development Setup

**For developers who want to build from source or contribute to the project.**

#### Prerequisites

- Node.js 16 or higher
- Python 3.10 (required for spaCy compatibility)
- Git
- npm or yarn

**Important:** Python 3.10 is specifically required. Newer versions (3.11+) may have compatibility issues with spaCy 3.7.2.

#### Clone and Install

```bash
# Clone the repository
git clone https://github.com/kennethhuang7/SupaScrapeR.git
cd SupaScrapeR

# Install Node.js dependencies
npm install

# Install Python dependencies
pip install -r requirements.txt

# Download spaCy language model (optional, for enhanced NLP features)
python -m spacy download en_core_web_sm
```

#### Development Mode

**Run with hot-reload:**
```bash
npm run electron-dev
```

This starts:
- Vite dev server on `http://localhost:5173`
- Electron app with React DevTools enabled
- Hot module replacement for instant updates

#### Build for Production

**Create installer for your platform:**
```bash
npm run dist
```

Output will be in `dist-electron/` directory.

**Platform-specific builds:**
- Windows: Requires Windows or Wine
- macOS: Requires macOS (code signing requires Apple Developer account)
- Linux: Can be built on any platform

---

## Configuration

### Database Setup

SupaScrapeR requires two Supabase instances:

1. **Central Database** (already configured in the app) - Handles user authentication and profiles
2. **Personal Database** (you create this) - Stores your collected Reddit data

#### Create Your Personal Supabase Database

**Step 1: Create Supabase Account**
1. Go to [supabase.com](https://supabase.com)
2. Sign up for a free account
3. Create a new project

**Step 2: Configure Database Schema**

Run the following SQL commands in your Supabase SQL Editor:

**Enable UUID Extension:**
```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

**Create Posts Table:**
```sql
CREATE TABLE reddit_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id TEXT NOT NULL,
    title TEXT,
    body TEXT,
    url TEXT,
    permalink TEXT,
    score INTEGER,
    upvote_ratio DOUBLE PRECISION NOT NULL,
    num_comments INTEGER NOT NULL,
    created_utc TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    author TEXT,
    subreddit TEXT NOT NULL,
    sentiment DOUBLE PRECISION NOT NULL,
    comments JSONB NOT NULL,
    live BOOLEAN NOT NULL
);
```

**Create Performance Index:**
```sql
CREATE UNIQUE INDEX idx_reddit_posts_post_id ON reddit_posts(post_id);
```

**Step 3: Obtain Database Credentials**

In your Supabase project dashboard:

1. Navigate to Settings → API
2. Copy your **Project URL** (format: `https://xxxxx.supabase.co`)
3. Copy your **service_role key** (NOT the anon key)

**Important:** Keep your service role key secure. Never commit it to version control or share it publicly.

**Step 4: Verify Setup**

Run this verification query in SQL Editor:
```sql
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'reddit_posts' 
ORDER BY ordinal_position;
```

You should see all the columns listed above.

---

### Reddit API Credentials

Reddit requires API credentials for all applications accessing their platform.

#### Create Reddit Application

**Step 1: Access Reddit App Preferences**
1. Log in to your Reddit account at [reddit.com](https://reddit.com)
2. Go to [reddit.com/prefs/apps](https://reddit.com/prefs/apps)
3. Scroll to the bottom and click "Create App" or "Create Another App"

**Step 2: Configure Application**

Fill out the form with these settings:
- **Name:** `SupaScrapeR` (or any name you prefer)
- **App type:** Select "script" (this is critical)
- **Description:** Optional
- **About URL:** Leave blank
- **Redirect URI:** `http://localhost:8080`

Click "Create app"

**Step 3: Save Your Credentials**

After creation, you'll see a box with your app information:

1. **Client ID**: 14-character string directly under the app name
2. **Client Secret**: 27-character string next to "secret"
3. **User Agent**: Create your own in this format: `SupaScrapeR/2.0 by YourRedditUsername`

**Example User Agent:** `SupaScrapeR/2.0 by john_doe`

**Important:** Store these credentials securely. You'll need them when first launching SupaScrapeR.

---

## Usage Guide

### First Launch

**Step 1: Initial Configuration**

On first launch, SupaScrapeR will guide you through setup:

1. **Data Location**: Choose where to store app configuration files (default recommended for most users)
2. **Account Creation/Login**:
   - Create a new account OR
   - Log in with existing credentials
   - Enable "Keep me signed in" for convenience (credentials are encrypted locally)

**Step 2: Enter Credentials**

You'll need to provide:

**Supabase Credentials:**
- Project URL: `https://xxxxx.supabase.co`
- Service Role Key: Your Supabase service_role key

**Reddit API Credentials:**
- Client ID: 14-character string from Reddit app
- Client Secret: 27-character string from Reddit app
- User Agent: Your custom user agent string

**Step 3: Verify Configuration**

The app will test your credentials and ensure connectivity to both services.

---

### Scraping Modes

SupaScrapeR offers three data collection strategies:

#### Keyword Search Mode

**Best for:** Topic-specific research, brand monitoring, targeted data collection

**How it works:**
1. Enter base keywords (e.g., "electric vehicles, tesla, EV")
2. App fetches related trending keywords from Google Trends
3. Select which keywords to include in your search
4. App searches specified subreddits for posts matching keywords
5. Collects post content, comments, and metadata

**Configuration:**
- Batch size: 5-50 posts per batch (adjust based on available RAM)
- Keyword count: 1-20 keywords recommended
- Subreddit selection: Use presets or custom lists

#### DeepScan Mode

**Best for:** Finding viral content, engagement analysis, trending discussions

**How it works:**
1. Fetches newest posts from selected subreddits
2. Analyzes engagement metrics (comments, upvotes, activity)
3. Identifies high-engagement posts
4. Collects detailed data including full comment threads

**Configuration:**
- Batch size: 5-100 posts per batch
- Engagement threshold: Configurable in settings
- Update interval: For continuous monitoring

#### Hybrid Mode

**Best for:** Comprehensive data collection, research projects, trend analysis

**How it works:**
- Runs both Keyword Search and DeepScan sequentially
- Provides maximum coverage of relevant content
- Automatically deduplicates posts collected by both methods

**Recommended for:** Most research applications requiring thorough data collection

---

### Managing Presets

Presets allow you to save and share subreddit configurations.

#### Creating a Preset

1. Navigate to Presets page
2. Click "Create New Preset"
3. Configure:
   - Preset name and description
   - List of subreddits (one per line)
   - Scraping mode (keyword, deepscan, or both)
   - Visibility (private or community)
4. Save preset

#### Using Community Presets

1. Navigate to Community page
2. Browse available presets
3. Click "Download" on any preset
4. Preset appears in your Presets list
5. Select it when configuring a scraping session

#### Sharing Presets

1. Create a preset with "Community" visibility enabled
2. Other users can discover and download it
3. Presets can be rated and reported
4. Top-rated presets appear first in Community page

---

### Monitoring Collection Progress

The scraping interface provides real-time feedback:

**Progress Indicators:**
- Keyword progress bar (if using keyword mode)
- Subreddit progress bar
- Posts collected (current batch)
- Overall completion percentage

**Performance Metrics:**
- Posts per second collection rate
- Success/failure counts
- CPU and RAM usage
- Network activity

**Live Logging:**
- Real-time activity feed
- Error messages with details
- Duplicate detection notifications
- Completion status

**Controls:**
- Stop scraping (safe shutdown)
- Pause/resume (for continuous mode)
- Export current session data
- View collected posts

---

## Architecture

### System Overview

SupaScrapeR uses a hybrid architecture combining Electron's main/renderer process separation with a Python backend for Reddit API interaction.

```
┌─────────────────────────────────────────────────┐
│                  Electron Main                  │
│  ┌───────────────────────────────────────────┐  │
│  │          React Renderer (UI)              │  │
│  │  - TypeScript + React 18                  │  │
│  │  - Tailwind CSS styling                   │  │
│  │  - Real-time state management             │  │
│  └───────────────────────────────────────────┘  │
│                       ↕                         │
│  ┌───────────────────────────────────────────┐  │
│  │        Main Process (Node.js)             │  │
│  │  - IPC communication                      │  │
│  │  - Window management                      │  │
│  │  - Auto-updates                           │  │
│  │  - System integration                     │  │
│  └───────────────────────────────────────────┘  │
│                       ↕                         │
│  ┌───────────────────────────────────────────┐  │
│  │      Python Scraper Backend               │  │
│  │  - PRAW (Reddit API)                      │  │
│  │  - VADER sentiment analysis               │  │
│  │  - Data processing                        │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
                       ↕
          ┌────────────────────────┐
          │  Supabase Cloud        │
          │  - PostgreSQL database │
          │  - Authentication      │
          │  - Real-time sync      │
          └────────────────────────┘
```

### Key Components

**Frontend (React)**
- `src/pages/`: Main application pages
- `src/components/`: Reusable UI components
- `src/services/`: Business logic and API clients
- `src/lib/`: Utility functions and configurations

**Backend (Electron Main)**
- `electron/main.js`: Application entry point
- `electron/preload.js`: Renderer↔Main bridge
- `electron/autoUpdater.js`: Update management
- `electron/services/`: Core services (logging, Discord RPC)

**Python Backend**
- `scripts/scraper.py`: Main scraping logic
- `scripts/reddit_client.py`: Reddit API wrapper
- `scripts/data_processor.py`: Post/comment processing

**Data Flow:**
1. User interacts with React UI
2. UI sends IPC message to Main process
3. Main process spawns Python scraper subprocess
4. Python collects data from Reddit API
5. Python processes and uploads to Supabase
6. Main process receives progress updates
7. UI updates in real-time via IPC events

---

## Development

### Building from Source

**Prerequisites:**
- Node.js 16+
- Python 3.10
- Git

**Setup Steps:**
```bash
# Clone repository
git clone https://github.com/kennethhuang7/SupaScrapeR.git
cd SupaScrapeR

# Install dependencies
npm install
pip install -r requirements.txt

# Optional: Install spaCy for enhanced NLP
python -m spacy download en_core_web_sm

# Run in development mode
npm run electron-dev

# Build for production
npm run dist
```

### Project Structure

```
SupaScrapeR/
├── electron/                 # Electron main process
│   ├── main.js              # Application entry point
│   ├── preload.js           # Context bridge
│   ├── autoUpdater.js       # Update system
│   └── services/            # Core services
│       ├── errorLogger.js
│       └── discordRPC.js
├── src/                     # React frontend
│   ├── components/          # UI components
│   ├── pages/              # Application pages
│   ├── services/           # Business logic
│   ├── lib/                # Utilities
│   └── styles/             # CSS/Tailwind
├── scripts/                # Python backend
│   ├── scraper.py         # Main scraping logic
│   ├── reddit_client.py   # Reddit API wrapper
│   └── data_processor.py  # Data processing
├── public/                 # Static assets
├── assets/                 # App icons and images
├── requirements.txt        # Python dependencies
├── package.json           # Node.js dependencies
└── README.md             # This file
```

### Code Style

**TypeScript/React:**
- Follow React functional component patterns
- Use TypeScript for type safety
- Tailwind CSS for styling (no inline styles)
- ESLint configuration provided

**Python:**
- PEP 8 style guide
- Type hints for function signatures
- Docstrings for classes and functions

**Commits:**
- Use conventional commits format
- Example: `feat: add auto-update system`, `fix: resolve login issue`

---

### Contributing

We welcome contributions! Here's how you can help:

**Reporting Bugs:**
1. Check if the issue already exists
2. Create a new issue with:
   - Clear description
   - Steps to reproduce
   - Expected vs actual behavior
   - System information (OS, version, etc.)
   - Error logs if applicable

**Suggesting Features:**
1. Open an issue with "Feature Request" label
2. Describe the feature and use case
3. Explain why it would be valuable

**Submitting Pull Requests:**
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test thoroughly
5. Commit with clear messages
6. Push to your fork
7. Open a Pull Request with:
   - Description of changes
   - Related issue numbers
   - Screenshots/videos if UI changes

**Development Guidelines:**
- Maintain code style consistency
- Add tests for new features
- Update documentation as needed
- Keep commits focused and atomic

---

### Release Process

**For maintainers publishing new versions:**

1. **Update Version:**
   ```bash
   # Update version in package.json
   # Example: "2.0.0" → "2.0.1" (bug fix)
   #          "2.0.0" → "2.1.0" (new feature)
   #          "2.0.0" → "3.0.0" (breaking change)
   ```

2. **Build Installer:**
   ```bash
   npm run dist
   ```

3. **Commit and Tag:**
   ```bash
   git add .
   git commit -m "Release v2.0.1"
   git tag v2.0.1
   git push origin main --tags
   ```

4. **Create GitHub Release:**
   - Go to GitHub Releases page
   - Click "Create a new release"
   - Tag: `v2.0.1` (must match package.json)
   - Title: `SupaScrapeR v2.0.1`
   - Description: List changes and fixes
   - Upload installer from `dist-electron/`
   - Publish release

5. **Auto-Update:**
   - Users will be notified automatically
   - In-app update dialog will appear
   - One-click update installation

---

## Troubleshooting

### Common Issues

#### Application Won't Start

**Windows:**
- Run as Administrator
- Check Windows Defender hasn't quarantined the app
- Ensure Visual C++ Redistributables are installed

**macOS:**
- Remove quarantine flag: `xattr -dr com.apple.quarantine /Applications/SupaScrapeR.app`
- Check System Preferences → Security & Privacy
- Ensure macOS 10.14 or later

**Linux:**
- Verify AppImage has execute permissions
- Check for missing system libraries: `ldd SupaScrapeR.AppImage`
- Try running from terminal to see error messages

#### Login/Authentication Errors

**"Invalid credentials":**
- Verify Supabase URL format: `https://xxxxx.supabase.co`
- Ensure using service_role key (not anon key)
- Check project isn't paused in Supabase dashboard
- Verify Reddit API credentials are correct

**"Database connection failed":**
- Test Supabase connection in their dashboard
- Verify Row Level Security policies are configured
- Check firewall isn't blocking connections
- Ensure stable internet connection

#### Scraping Issues

**"No posts collected":**
- Verify subreddit names are correct (case-sensitive)
- Check subreddit hasn't banned your Reddit account
- Reduce batch size if memory errors occur
- Verify Reddit API rate limits haven't been exceeded

**"Out of memory errors":**
- Reduce batch sizes in settings:
  - 4GB RAM: Use batch size 5
  - 8GB RAM: Use batch size 10-25
  - 16GB+ RAM: Use batch size 25-50
- Close other applications
- Restart the application

**"Network timeout errors":**
- Check internet connection stability
- Reduce batch size to lower concurrent requests
- Wait 10-15 minutes if rate limited
- Try different time of day (Reddit traffic peaks affect API)

#### Update Issues

**"Update check failed":**
- Verify internet connection
- Check GitHub isn't blocked by firewall
- Manually check releases page
- Disable VPN temporarily if using one

**"Update download failed":**
- Check available disk space (need ~200MB free)
- Temporarily disable antivirus
- Download installer manually from GitHub releases

### Performance Optimization

**Slow Collection Speed:**
- Reduce number of subreddits
- Use fewer keywords
- Increase batch size (if RAM available)
- Check CPU/RAM usage in Task Manager

**High Memory Usage:**
- Decrease batch sizes
- Reduce number of concurrent operations
- Close unused browser tabs
- Restart app periodically for long sessions

**Database Slow:**
- Check Supabase project isn't paused
- Verify not exceeding free tier limits
- Consider upgrading Supabase plan for high volume
- Add database indexes for frequent queries

### Getting Help

**Before requesting help:**
1. Check error logs:
   - Windows: `%APPDATA%\SupaScrapeR\logs\`
   - macOS: `~/Library/Application Support/SupaScrapeR/logs/`
   - Linux: `~/.config/SupaScrapeR/logs/`

2. Search existing GitHub issues

3. Try the troubleshooting steps above

**Creating a support request:**
1. Go to [GitHub Issues](https://github.com/kennethhuang7/SupaScrapeR/issues)
2. Click "New Issue"
3. Include:
   - Operating system and version
   - SupaScrapeR version
   - Exact error message
   - Steps to reproduce
   - Relevant log excerpts (redact credentials)
   - What you've already tried

**Do NOT include:**
- Reddit API credentials
- Supabase keys
- Passwords or personal information

---

## License

This project is licensed under the MIT License.

**MIT License Summary:**
- ✅ Commercial use allowed
- ✅ Modification allowed
- ✅ Distribution allowed
- ✅ Private use allowed
- ❌ No warranty provided
- ❌ No liability accepted

See the [LICENSE](LICENSE) file for full details.

---

## Authors

**Kenneth Huang** - Creator and Lead Developer
- GitHub: [@kennethhuang7](https://github.com/kennethhuang7)
- LinkedIn: [Kenneth Huang](https://www.linkedin.com/in/kennethhuang7/)

---

## Acknowledgments

**Built with:**
- [Electron](https://www.electronjs.org/) - Cross-platform desktop framework
- [React](https://reactjs.org/) - UI library
- [Supabase](https://supabase.com/) - Backend and database
- [PRAW](https://praw.readthedocs.io/) - Reddit API wrapper
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework


---

<div align="center">

**Questions?** Open an issue on GitHub

**Enjoying SupaScrapeR?** Give us a star ⭐

[Back to Top](#supascraper)

</div>