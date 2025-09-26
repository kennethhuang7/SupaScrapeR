<div style="height: 40px;"></div>
<p align="center">
    <img src="assets/supascraper-complete-logo.png" width="400" alt="SupaScrapeR Logo">
</p>

# SupaScrapeR

Welcome to **SupaScrapeR**, an advanced Reddit data collection tool with intelligent scraping, trending keyword analysis, and Supabase integration. This application is a tool created by and for AdAi, but can be used by anyone who wants to use Supabase to scrape and store Reddit posts/data.

**📝 What does this app do?** SupaScrapeR automatically collects posts and comments from Reddit based on topics you're interested in, then saves all that information to a cloud database where you can analyze it later. Think of it like having a research assistant that never sleeps!

<details open="open">
<summary>Table of Contents</summary>
    <ol>
        <li><a href="#overview">Overview</a></li>
        <li><a href="#features">Features</a></li>
        <li><a href="#installation">Installation</a></li>   
        <li><a href="#database-setup">Database Setup</a></li>   
        <li><a href="#usage-guide">Usage Guide</a></li>     
        <li><a href="#configuration">Configuration</a></li>
        <li><a href="#troubleshooting">Troubleshooting</a></li>
        <li><a href="#license">License</a></li>
        <li><a href="#authors">Authors</a></li>
    </ol>
</details>

## Overview

SupaScrapeR provides an intelligent approach to Reddit data collection with multiple scraping strategies, automated sentiment analysis, and seamless cloud storage integration. The application features a user-friendly GUI and detailed error handling for reliable data collection.

**🎯 Perfect for:** Researchers, students, marketers, journalists, or anyone who wants to understand what people are talking about on Reddit without spending hours manually browsing.

**💡 Real-world example:** Want to know what people think about electric cars? SupaScrapeR can automatically find and save thousands of Reddit posts and comments about electric vehicles, then tell you whether people's opinions are positive, negative, or neutral with VADER sentiment analysis!

## Features

### 🎯 **Intelligent Scraping Modes**
- **Keyword Search**: Target specific topics with trending keyword discovery via Google Trends
  - *What this means:* Tell the app "I want posts about cats" and it will find related trending topics like "cat videos," "cat breeds," "cat behavior," etc.
- **DeepScan**: Comprehensive analysis of high-engagement, new posts based on comment count and activity
  - *What this means:* The app takes the newest 100 posts from a subreddit and picks out the ones that have a lot of user interaction.
- **Combined Mode**: Run both strategies for maximum coverage and data diversity
  - *What this means:* Use both methods to catch everything: keywords from older posts **and** popular new posts!

### ⚙️ **Configurable Batch Processing**
- **Keyword Batches**: 5, 10, 25, 50 posts per batch
- **DeepScan Batches**: 5, 10, 25, 50, 100 posts per batch
- **Memory Optimization**: Built-in recommendations for optimal performance and reasonable memory usage
- **Real-time Adjustment**: Configure batch sizes without application restart
- *What this means:* The app processes posts in small groups instead of all at once, so it won't crash your computer. You can adjust how many posts it handles at once based on how powerful your computer is.

### 🔍 **Google Trends Integration**
- **Trending Keywords**: Automatic discovery of related trending terms based on your seed keywords
- **Custom Base Keywords**: Start with your own keywords to find related trending topics
- **Smart Filtering**: Intelligent keyword selection and validation with manual override options
- *What this means:* If you search for "iPhone," the app will automatically find related trending topics like "iPhone 15," "iPhone review," "iPhone vs Android," etc., so you don't miss anything important.

### 💾 **Advanced Data Management**
- **Supabase Integration**: Automatic cloud storage with real-time synchronization
  - *What this means:* All your collected data is automatically saved to the cloud, so you can access it from anywhere and never lose it
- **Preset System**: Save and quickly load custom subreddit configurations (5 preset slots)
  - *What this means:* Save your favorite groups of subreddits (like "Technology Subreddits" or "News Subreddits") so you don't have to set them up every time
- **Sentiment Analysis**: VADER sentiment scoring for both posts and comments
  - *What this means:* The app automatically tells you if posts and comments are positive, negative, or neutral in tone
- **Duplicate Prevention**: Smart deduplication prevents data redundancy
  - *What this means:* If the same post appears multiple times, the app only saves it once
- **Comment Threading**: Full list of comments saved alongside the post
  - *What this means:* Collects not just posts, but all the replies and conversations under each post. Don't worry: they are connected, so you don't have to worry about matching comments to posts yourself!

### 🔒 **Security Features**
- **Encrypted Storage**: All credentials encrypted locally using Fernet encryption
  - *What this means:* Your passwords and API keys are scrambled and stored safely on your computer
- **Auto-login**: Secure credential persistence across sessions
  - *What this means:* You only need to enter your passwords once, and the app remembers them securely (if you want it to)
- **API Validation**: Real-time testing of Reddit and Supabase connections before use
  - *What this means:* The app checks that your account information works before starting to collect data
- **Paste Protection**: Intelligent formatting strip during credential entry
  - *What this means:* If you copy and paste passwords (especially from other apps that have dark mode like Discord), the app cleans up any extra formatting automatically

### 🖥️ **Cross-Platform Support**
- **Windows**: Native .exe with full feature support
- **macOS**: Native .app bundle with periodic updates
- **Source**: Run directly from Python source for development
- *What this means:* Works on both Windows and Mac computers, no matter which one you have! Because we code on Windows, though, the macOS version will be updated less often (probably only during major updates)

### 📊 **Real-time Monitoring**
- **Progress Tracking**: Visual progress bars for keywords, posts, and subreddits
- **Live Logging**: Real-time activity feed with detailed status messages
- **Error Handling**: Comprehensive error logging with automatic retry mechanisms
- **Performance Metrics**: Built-in memory usage optimization and recommendations
- *What this means:* You can watch the app work in real-time and see exactly what it's doing, how fast it's working, and if anything goes wrong

## Installation

### 📊 **Standard vs Enhanced Performance**

**📦 Standard Version:**
- ✅ Faster startup time
- ✅ Uses less memory (RAM)
- ✅ Smaller download size
- ✅ Works well on older computers
- ⚡ Processes posts quickly

**⚡ Enhanced Version:**
- ⚠️ Slower first startup (loads language processing models)
- ⚠️ Uses more memory (requires 4GB+ RAM recommended)
- ⚠️ Larger download size
- ✅ Much better at finding relevant posts (can detect names of people, organizations, GPEs (countries, cities, states, etc), and products)
- ✅ Smarter filtering reduces irrelevant results
- ✅ Better for research requiring higher accuracy

**💡 Recommendation:** Most users should start with Standard and upgrade to Enhanced if they need more accurate results. If you have no worries about RAM or computer storage usage, Enhanced will always offer better results!

**📝 Note:**  If you choose to download the Enhanced version, verify it's working correctly by checking the NLP status after logging in. On the "Choose how you want to run the scraper" screen (right after you log in successfully), look at the bottom of the screen below the three main buttons. You should see:
- ✅ Enhanced version working: "✨ Enhanced Search with NLP is available" (in green text)
- ⚠️ Problem detected: "⚠️ spaCy installed but model not found" (in yellow text)
- ❌ Standard version only: "Standard search mode (spaCy not installed)" (in gray text)

### 🚀 **The Easy Way (Recommended for Everyone)**

**No technical knowledge required!** Just download and double-click to run.

#### For Windows Users

**Step 1: Download the App**
1. Go to [our releases page](https://github.com/kennethhuang7/SupaScrapeR/releases)
2. Look for the newest version at the top
3. Click on `SupaScrapeR-(whichever version you want)-Windows.zip` to download it
4. Wait for the download to finish (the file will appear in your Downloads folder)

**Step 2: Extract the App**
1. Go to your Downloads folder
2. Find the `SupaScrapeR-(whichever version you want)-Windows.zip` file
3. Right-click on it and choose "Extract All..."
4. A window will pop up - just click "Extract"
5. A new folder will appear with the app inside

**Step 3: Move to a Safe Location** 
1. Cut or copy the extracted folder
2. Paste it somewhere permanent like your Desktop or Documents folder
3. **Important:** Don't leave it in Downloads - you might accidentally delete it!

**Step 4: First Time Running**
1. Open the folder you just moved
2. Look for a file called `SupaScrapeR.exe` 
3. Double-click on it to start the app
4. **If Windows shows a security warning:**
   - Click "More info" at the bottom of the warning
   - Then click "Run anyway"
   - This happens because we're a small developer, not because the app is dangerous
> **Note:** This warning appears because the app is not signed with a paid Windows code-signing certificate. The software is safe to use when downloaded from the official GitHub release.

**Step 5: Create a Shortcut (Optional but Recommended)**
1. Right-click on `SupaScrapeR.exe`
2. Choose "Create shortcut"
3. Drag the shortcut to your Desktop for easy access

**Tips:**
- Create a desktop shortcut to `SupaScrapeR.exe` for quick access
- Keep the executable and its dependencies in the same extracted folder

#### For Mac Users

**Step 1: Download the App**
1. Go to [our releases page](https://github.com/kennethhuang7/SupaScrapeR/releases)
2. Look for the newest version at the top
3. Click on `SupaScrapeR-(whichever version you want)-macOS.zip` to download it
4. Wait for the download to finish

**Step 2: Install the App**
1. Find the downloaded file (usually in Downloads)
2. Double-click `SupaScrapeR-(whichever version you want)-macOS.zip` to unzip it
3. Drag `SupaScrapeR.app` to your Applications folder

**Step 3: First Time Running (Important!)**
1. **Don't double-click the app yet!** macOS will block it.
2. Instead, right-click (or Control-click) on `SupaScrapeR.app`
3. Choose "Open" from the menu that appears
4. macOS will show a warning - click "Open" in the dialog box
5. The app will start and remember that it's safe for next time

**Important: Security Configuration**

Because this app is built without an Apple Developer ID, macOS will block it by default.

**First Launch Instructions:**
1. **Right-click** (or Control-click) on `SupaScrapeR.app`
2. **Choose "Open"** from the context menu
3. Click **"Open"** in the security dialog

**If macOS continues to block the application:**

```bash
xattr -dr com.apple.quarantine "/path/to/SupaScrapeR.app"
```

> **Tip:** Drag and drop the app into Terminal to automatically insert its path

**If macOS Still Won't Let You Run It:**
1. Open Terminal (found in Applications → Utilities)
2. Type this command, but don't press Enter yet:

   ```
   xattr -dr com.apple.quarantine 
   ```
3. Drag the SupaScrapeR.app file into the Terminal window
4. Now press Enter
5. Try opening the app normally

### 🔧 **The Technical Way (For Programmers)**
If you're comfortable with programming and want to run the latest development version:

#### Prerequisites
- Python 3.7 or higher
- Basic familiarity with command line/terminal

#### Choose Your Version
**Standard Version:** Faster startup, less memory usage, basic keyword matching
**Enhanced Version:** Better accuracy with NLP features, requires more resources

#### Installation Steps

**Standard Version Setup:**

**For Windows:**
1. Open Command Prompt (search "cmd" in Start menu)
2. Copy and paste these commands one at a time, pressing Enter after each:
```cmd
git clone https://github.com/kennethhuang7/supascraper.git
cd supascraper
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python SupaScrapeR.py
```

**For Mac:**
1. Open Terminal (Applications → Utilities → Terminal)
2. Copy and paste these commands one at a time, pressing Enter after each:
```bash
git clone https://github.com/kennethhuang7/supascraper.git
cd supascraper
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python SupaScrapeR.py
```

**Enhanced Version Setup (for better accuracy):**

**For Windows:**
1. Open Command Prompt (search "cmd" in Start menu)
2. Copy and paste these commands one at a time, pressing Enter after each:
```cmd
git clone https://github.com/kennethhuang7/supascraper.git
cd supascraper
python -m venv venv_plus
venv_plus\Scripts\activate
pip install -r requirements.txt
pip install spacy inflect
python -m spacy download en_core_web_sm
python SupaScrapeR.py
```

**For Mac:**
1. Open Terminal (Applications → Utilities → Terminal)
2. Copy and paste these commands one at a time, pressing Enter after each:
```bash
git clone https://github.com/kennethhuang7/supascraper.git
cd supascraper
python3 -m venv venv_plus
source venv_plus/bin/activate
pip install -r requirements.txt
pip install spacy inflect
python -m spacy download en_core_web_sm
python SupaScrapeR.py
```

#### What These Commands Do
- `git clone` - Downloads the source code
- `cd supascraper` - Enters the downloaded folder
- `python -m venv venv` or `venv_plus` - Creates a safe environment for the app (enhanced uses separate environment)
- `activate` - Activates that environment
- `pip install -r requirements.txt` - Installs all the needed components
- `pip install spacy inflect` (Enhanced only) - Installs advanced language processing library and text inflection tools
- `python -m spacy download en_core_web_sm` (Enhanced only) - Downloads English language model for better text analysis
- `python SupaScrapeR.py` - Runs the app

**💡 Enhanced Version Notes:**
- Requires approximately 50MB additional download for the language model
- Uses more RAM during operation (4GB+ recommended)
- Provides better keyword relevance detection and filtering
- Can identify named entities (people, organizations, locations, products)

#### Technical Dependencies
The app needs these Python components (automatically installed with the commands above):

**Standard Version:**
- PyQt5>=5.15.0 - Creates the user interface
- praw>=7.0.0 - Connects to Reddit
- vaderSentiment>=3.3.2 - Analyzes emotion in text
- pytrends>=4.9.0 - Gets trending topics from Google
- supabase>=1.0.0 - Connects to the database
- cryptography>=3.4.0 - Keeps your passwords safe

**Enhanced Version (for better accuracy):**
- All standard dependencies plus:
- spacy - Advanced natural language processing
- inflect - Handles plural/singular word forms for better keyword matching
- en-core-web-sm - English language model for spaCy

## Database Setup

**🗃️** SupaScrapeR requires a properly configured Supabase database to store collected Reddit data.

### Prerequisites

- Supabase account (free at [supabase.com](https://supabase.com))
- New Supabase project
- Access to your project's SQL Editor

### Step 1: Create Your Free Account

1. **Go to Supabase:**
   - Open your web browser
   - Type `supabase.com` in the address bar
   - Press Enter

2. **Sign Up:**
   - Click the "Start your project" or "Sign Up" button
   - You can sign up with your email or use Google/GitHub if you have those accounts
   - Follow the instructions to create your account
   - **It's completely free!**

3. **Create a New Project:**
   - Once you're logged in, click "New Project"
   - Choose any organization (or create one - just use your name)
   - Fill out the project details:
     - **Name:** `SupaScrapeR Data` (or any name you like)
     - **Database Password:** Create a strong password and **write it down somewhere safe!**
     - **Region:** Choose the one closest to you (like "US East" if you're in America)
   - Click "Create new project"
   - Wait 2-3 minutes for it to be ready

### Database Schema Creation

**🔧 What are we doing?** We're creating a data table in your database where all the Reddit posts will be stored, and we're giving it instructions on how to organize the data.

#### Step 1: Enable UUID Extension

1. **Open the SQL Editor:**
   - In your Supabase project, look for the sidebar on the left
   - Click on "SQL Editor" (it has an icon that looks like `</>`)

2. **Create the Storage Space:**
   - You'll see a big text box where you can type
   - Copy and paste this code into the text box:

```sql
-- Enable UUID extension for unique identifiers
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
```

3. **Click "RUN" (the button should be at the bottom right)**

#### Step 2: Create Main Table

4. **Create the Main Storage Table:**
   - Clear the text box and paste this larger code:

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

5. **Click "RUN" again**

#### Step 3: Create Performance Index

6. **Make It Fast:**
   - Clear the text box and paste this code to make searching faster:

```sql
-- Create unique index for fast lookups and duplicate prevention
CREATE UNIQUE INDEX idx_reddit_posts_post_id ON reddit_posts(post_id);
```

7. **Click "RUN"**

### Obtaining Credentials

**🔑 What are these?** These are like the address and key to your database. The app needs these to know where to store your data.

After creating the database, you'll need:

1. **Project URL**: Found in Settings → API
   - Format: `https://your-project-id.supabase.co`

2. **Service Role Key**: Found in Settings → API → Project API keys
   - Use the `service_role` key (not the `anon` key)
   - This key has full database access - keep it secure! If it somehow gets leaked, change it immedately!

**To find these:**

1. **Find Your Project URL:**
   - In the sidebar, click "Settings" (gear icon)
   - Click "API"
   - Look for "Project URL" - it will look like `https://abcdefg.supabase.co`
   - **Copy this and save it somewhere safe!**

2. **Find Your Secret Key:**
   - On the same page, scroll down to "Project API keys"
   - Look for "service_role" (NOT "anon")
   - Click the copy button next to the long string of text
   - **Save this somewhere safe too!**
   - **Warning:** Keep this secret! Don't share it with anyone or post it online.

### Verification

Test your setup with this query:

1. **Verify Your Setup:**
   - Go back to the SQL Editor
   - Clear the text box and paste:

```sql
-- Verify table structure
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'reddit_posts' 
ORDER BY ordinal_position;
```

2. **Click "RUN"**
3. **You should see a list of columns like "id", "post_id", "title", etc.**
4. **If you see this list, you're all set! If not, go back and try the previous steps again.**

## Usage Guide

### 🔐 Getting Reddit Permission (API Credentials)

**🤔 Why do I need this?** Reddit requires all apps to have permission before they can collect data. It's like getting a library card before you can check out books.

#### Step 1: Get Reddit API Access

1. **Go to Reddit:**
   - Open your web browser
   - Go to `reddit.com`
   - **Log in to your Reddit account** (if you don't have one, create a free account first)

2. **Go to the App Creation Page:**
   - Once logged in, go to `reddit.com/prefs/apps`
   - Or: Click your username → User Settings → Safety & Privacy → Manage third-party app authorization

3. **Create a New App:**
   - Scroll down and click "Create App" or "Create Another App"
   - Fill out the form exactly like this:
     - **Name:** `SupaScrapeR` (or any name you want)
     - **App type:** Click the circle next to "script" (**Very important!**)
     - **Description:** `Data collection for research` (or anything you want)
     - **About URL:** Leave this completely blank
     - **Redirect URI:** Type exactly: `http://localhost:8080`
   - Click "Create app"

#### Step 2: Save Your Reddit Credentials

**After creating the app, you'll see a box with your app information. You need to save three pieces of information:**

1. **Client ID:**
   - Look under your app name
   - You'll see a string of letters and numbers (exactly 14 characters)
   - Copy this and save it somewhere safe

2. **Client Secret:**
   - Look for "secret" in the app box
   - You'll see a longer string of letters and numbers (about 27 characters)
   - Copy this and save it somewhere safe

3. **User Agent:**
   - You make this up yourself
   - Format: `YourAppName by YourRedditUsername`
   - Example: `SupaScrapeR by john_doe`
   - Write this down somewhere safe

### Step-by-Step Walkthrough

**📋 What you'll need before starting:**
- SupaScrapeR installed on your computer
- Your Supabase Project URL and Service Key (from Database Setup)
- Your Reddit Client ID, Client Secret, and User Agent (from above)

#### 1. Launch and Setup
- Start SupaScrapeR
- Choose data storage location (default recommended for first-time users)
- Enter your API credentials (Reddit and Supabase)
- Enable "Keep me signed in" for convenience (if you want!)

**Detailed Steps:**

1. **Start SupaScrapeR:**
   - Find the SupaScrapeR icon (on Desktop or in Applications) and double click to open it
   - Wait for the app to load (may take a few seconds the first time - please be patient!)

2. **Choose Where to Store App Data:**
   - The app will ask where you want to store your configuration files
   - **For beginners:** Click "Use Default Location" - this is the easiest option
   - **For advanced users:** Click "Browse Folder" to choose a custom location
   - Click "Continue"

3. **Enter Your Credentials:**
   - You'll see a login screen with 5 text boxes to fill out:
   - **Supabase Project URL:** Paste the URL you saved from Supabase (looks like `https://abcdefg.supabase.co`)
   - **Supabase Service Role Key:** Paste the long secret key you saved from Supabase
   - **Reddit Client ID:** Paste the 14-character code from Reddit
   - **Reddit Client Secret:** Paste the 27-character code from Reddit
   - **Reddit User Agent:** Type the user agent string you created (like `SupaScrapeR/1.0 by yourname`)
   - **Keep me signed in:** Check this box so you don't have to enter everything again next time
   - **Click "Login"**

#### 2. Select Run Mode
- **Run Once**: Single data collection session
- **Run Continuously**: Ongoing collection! After finishing one cycle, SupaScrapeR will take a 10 minute break and start a new cycle.

**🤔 Why wait 10 minutes?** The Reddit API we are using is free, but we should be careful not to do too many requests constantly! There ARE some limits to our access when it comes to how quickly/often we call on it.

**You'll see three options:**

1. **"Run Once" (Recommended for beginners):**
   - Collects data one time and then stops
   - Perfect for testing or one-time research projects
   - You can always run it again later

2. **"Run Continuously":**
   - Keeps collecting data with 10 minute breaks in between forever (until you stop it)
   - Good for ongoing, live monitoring of topics
   - Uses more computer resources

3. **"Logout":**
   - Returns to the login screen if you need to change your credentials, or just want to delete your user credential files! (It is encrypted, so someone can't just open and read it to know your login, but just if you need some extra ease of mind!)

**👆 Click your choice to continue**

#### 3. Choose Scraping Strategy
- **Keyword Search Only**: Target specific topics using trending keywords
- **DeepScan Only**: Analyze high-engagement posts without keyword filtering
- **Both Methods**: Comprehensive coverage using both approaches

**You'll see three collection strategies:**

1. **"Keyword Search Only":**
   - Searches for specific topics you're interested in
   - Example: If you choose "climate change," it finds posts about climate change
   - **Best for:** Researching specific topics

2. **"DeepScan Only":**
   - Finds the most popular and active posts (lots of comments and upvotes)
   - Doesn't focus on specific topics
   - **Best for:** Finding trending and controversial discussions

3. **"Both Keyword and DeepScan" (Recommended):**
   - Does both methods in one run
   - Gives you the most complete data
   - **Best for:** Most research projects

**⚙️ Settings Button:** Next to each option is a gear icon. Click this if you want to customize which subreddits (Reddit communities) to search. For beginners, the default settings work great!

**👆 Click your choice to continue**

#### 4. Configure Subreddits
- **Default Configuration**: Use built-in subreddit lists
- **Custom Presets**: Load your saved configurations
- Use the ⚙️ settings button to customize subreddit lists

**📋 What are subreddits?** These are different communities on Reddit, like r/politics, r/technology, r/cats, etc. You're choosing which communities the app should look at.

**You'll see several preset options:**

1. **"Default Configuration" (Recommended for beginners):**
   - Uses our carefully selected list of popular subreddits
   - Covers news, politics, technology, and general interest topics
   - **Best choice if you're not sure what to pick**

2. **"Preset 1-5":**
   - These are custom lists you can create and save
   - Will be empty the first time you use the app
   - Useful if you want to focus on specific types of communities

**👆 Click "Default Configuration" and then "Confirm Preset"**

#### 5. Set Up Keywords (if using Keyword Search)
- Enter base keywords (e.g., "politics, election, democracy")
- Fetch related trending keywords from Google Trends
- Select which keywords to include in your search

**🔍 If you picked Keyword Search or Both methods, you'll see a keyword setup screen:**

1. **Enter Your Base Keywords:**
   - Type topics you're interested in, separated by commas
   - Example: `climate change, global warming, environment`
   - Example: `iPhone, smartphone, mobile phone`
   - The app starts with "politics" as an example

2. **Click "Fetch Related Keywords":**
   - The app connects to Google Trends to find related trending topics
   - This might take 30-60 seconds
   - **If it fails:** Your internet might be slow, or Google Trends might be busy. Just try again.

3. **Select Your Keywords:**
   - You'll see a list of trending keywords related to your topics
   - Each keyword has a checkbox next to it
   - **All keywords are selected by default**
   - Uncheck any keywords you don't want to include
   - **Tip:** More keywords = more data, but longer collection time

4. **Click "Confirm Selection"**

#### 6. Optimize Performance
- Configure batch sizes based on your system:
  - **4GB RAM or less**: Keyword: 5, DeepScan: 5
  - **8GB RAM**: Keyword: 10, DeepScan: 25
  - **16GB+ RAM**: Keyword: 25, DeepScan: 50

**📋 You'll see a summary of all your choices:**
- Run mode (once or continuous)
- Scraping strategy (keyword, deepscan, or both)
- Which preset you selected
- Your chosen keywords (if applicable)
- Current batch sizes (how many posts to process at once)

**🎛️ Two final options:**

1. **"Configure Batch Size" (Optional):**
   - This controls how many posts the app processes at once
   - **Smaller numbers (5-10):** Slower but uses less computer memory
   - **Larger numbers (25-50):** Faster but uses more computer memory
   - **For most computers:** The default settings work fine

2. **"Start Scraping":**
   - Click this to begin collecting data!

#### 7. Monitor Progress
- Watch real-time progress bars for keywords, posts, and subreddits
- Review live log output for detailed activity information
- Use stop/restart controls as needed

**📊 The app will show you a progress screen with:**

1. **Header Information:**
   - Shows what the app is currently doing
   - Example: "Searching r/politics for keyword 'election'"

2. **Live Activity Log:**
   - Real-time updates of what's happening
   - You'll see messages like "Saved Post: [post title]" or "Skipped duplicate post"

3. **Progress Bars:**
   - **Keywords Progress (Yellow):** Which keyword is being processed
   - **Posts Progress (Green):** How many posts processed in current batch
   - **Subreddits Progress (Blue):** Which subreddit is being processed

4. **Control Button:**
   - **"Stop Scraping":** Click this if you want to stop early
   - **"Restart":** Appears when scraping is finished or user stop is completed, click to return to setup page for another run!

### 🎯 What Happens to Your Data

**💾 Where does the data go?**
1. All collected posts and comments are automatically saved to your Supabase database
2. You can view your data by going to your Supabase project
3. Click "Table Editor" in the sidebar
4. Click on "reddit_posts" to see all your collected data

**📊 What data is collected for each post:**
- Post title and content
- Post ID (Reddit gives each post their own unique ID - this is how we prevent duplicates from being saved!)
- Author name
- Number of upvotes and comments
- Post "score" (upvotes - downvotes)
- Upvote ratio (Ratio of people that upvoted the post)
- When it was posted (labeled created_utc because we use Coordinated Universal Time)
- Which subreddit (community) it came from
- Sentiment analysis (positive, negative, or neutral)
- Comments and replies (Up to 50, but we take the top ones!)
- Direct link to the original post

**🔍 How to analyze your data:**
- Use the Supabase interface to filter and search your data
- Export to Excel or Google Sheets for further analysis
- Use the sentiment scores to understand public opinion
- Track trends over time by looking at post dates

### Default Subreddit Lists

**📋 When you choose "Default Configuration," here's what communities the app will search:**

**Broad Subreddits** (Keyword Search):
`politics`, `Conservative`, `Republican`, `democrats`, `NewsAndPolitics`, `AmericanPolitics`, `uspolitics`, `NeutralPolitics`, `popculture`, `popculturechat`, `newjersey`, `GenZ`, `lgbt`, `law`, `NoFilterNews`, `news`, `worldnews`, `GlobalNews`, `goodnews`, `Millennials`, `teenagers`, `technews`, `finance`, `Parenting`, `Parents`, `blackladies`, `asian`, `scotus`, `centrist`, `geopolitics`, `anime_titties`, `nyc`, `HeadlineWorthy`

**Concentrated Subreddits** (DeepScan):
`politics`, `Conservative`, `Republican`, `democrats`, `NewsAndPolitics`, `AmericanPolitics`, `uspolitics`, `NeutralPolitics`, `NoFilterNews`, `PoliticalDiscussion`, `scotus`, `centrist`, `geopolitics`, `anime_titties`

**🤔 Why these subreddits?** We chose these because they're active, have good discussions, and cover a wide range of topics that are useful for research. You can always customize this list using the settings buttons!

**😰 Anime WHAT????** Listen, we know how it sounds, but that's just what its called. It is actually a really good source for world politics and news!

## Configuration

### 🔧 Performance Settings Guide

**💡 Why does this matter?** Different computers have different amounts of power. These settings help the app run smoothly on your specific computer without crashing or running too slowly.

### Batch Size Recommendations

**🤔 What's a "batch"?** Instead of processing all posts at once (which could crash or overwhelm your computer), the app processes them in small groups called "batches." Think of it like washing dishes - you don't wash every dish in your house at once, you do a sink-full at a time.

| System RAM | Keyword Batch | DeepScan Batch | Comments/Post |
|------------|---------------|----------------|---------------|
| 4GB or less | 5 | 5 | 25 |
| 8GB | 10 | 25 | 50 |
| 16GB+ | 25 | 50 | 100 |


**🔍 How to check your computer's RAM:**
- **Windows:** Press Ctrl+Shift+Esc, click "Performance" tab, look at "Memory"
- **Mac:** Apple menu → About This Mac, look at "Memory"

**⚡ What happens if settings are too high?**
- App becomes very slow
- Computer fan runs loudly
- App might crash
- Other programs become unresponsive
- Your computer will cry out for help, wondering why you subjected it to this

**🐌 What happens if settings are too low?**
- App runs very slowly
- Takes much longer to collect data
- Well, at least theres no risk of crashing due to memory issues I guess...

### Data Storage Structure

**🗂️ The app creates several types of files:**

- **Configuration files**: `Documents/SupaScrapeR/`
- **User data**: Your chosen data folder
- **Encrypted credentials**: Stored locally with Fernet encryption
- **Presets**: JSON format with subreddit configurations
- **Error logs**: Detailed logging for troubleshooting

1. **Configuration Files** (stored in `Documents/SupaScrapeR/`)
   - Your app settings and preferences
   - Error logs for troubleshooting
   - Temporary and miscellaneous files we use behind the scenes

2. **User Data** (stored wherever you chose during setup)
   - Custom subreddit presets
   - Encrypted login credentials (if you chose "keep me signed in")

3. **Reddit Data** (stored in your Supabase cloud database)
   - All the posts and comments collected
   - Accessible from anywhere with internet

**🔐 Security Notes:**
- Your passwords are encrypted and stored safely
- Only you can access your Supabase database, unless you add collaborators (I'm too lazy to explain how, sorry! Go bother Supabase to learn how😭)
- Reddit data is stored in the cloud, not on your computer

### Performance Optimization

**🌐 Internet Connection:**
- Use stable, high-speed internet connection
- Monitor system resources using task manager (Windows) or activity monitor (macOS) and adjust batch sizes accordingly
- Consider running during off-peak hours (hours where people prooooobably won't be using it) for better API performance

**💻 Computer Optimization:**
- Close other programs that use a lot of your computer's memory while running SupaScrapeR
- Don't run virus scans or software updates at the same time 
- Make sure your computer is plugged in (for laptops)
- Ensure you have at least 1GB of free disk space (surely, right?)

**📊 Monitoring Performance:**
- Watch the progress bars to see if the app is working steadily
- If the log shows many "Network timeout" errors, try smaller batch sizes
- If posts are being processed very slowly, close other programs. It might help!

## Troubleshooting

### 🆘 Common Problems and Solutions

**💡 Don't panic!** Most problems have simple solutions. Read through these common issues and their fixes.

### Common Issues

#### Authentication Problems

**❌ "Invalid Reddit API credentials"**

*What this means:* The app can't connect to Reddit with the information you provided.

**Reddit API Issues:**
- Verify Client ID is exactly 14 characters
- Ensure Client Secret is approximately 27 characters
- Confirm app type is set to "script", not "web app"
- Check User Agent format: `AppName/Version by username`

*How to fix it:*
1. Go back to `reddit.com/prefs/apps`
2. Check that your app type is set to "script" (not "web app")
3. Copy your Client ID again - it should be exactly 14 characters
4. Copy your Client Secret again - it should be about 27 characters
5. Make sure your User Agent follows the format: `AppName/1.0 by username`
6. Try logging in again

**❌ "Supabase connection failed"**

*What this means:* The app can't connect to your database.

**Supabase Connection Issues:**
- Verify URL format: `https://your-project-id.supabase.co`
- Use Service Role key, not anon/public key
- Ensure project is not paused
- Test connection with provided SQL queries

*How to fix it:*
1. Check your Supabase Project URL - it should look like `https://abcdefg.supabase.co`
2. Make sure you're using the "service_role" key, not the "anon" key
3. Go to your Supabase project and make sure it's not paused
4. Try copying and pasting your credentials again
5. Make sure you have internet connection

**❌ "Table 'reddit_posts' doesn't exist"**

*What this means:* You haven't set up your database properly.

*How to fix it:*
1. Go back to your Supabase project
2. Click "SQL Editor" in the sidebar
3. [Follow the Database Setup steps again](#database-setup)
4. Make sure you clicked "RUN" after each SQL command
5. Try the verification query to make sure the table was created

#### Performance Problems

**❌ App is running very slowly**

*What this means:* Your computer doesn't have enough resources to run the current settings.

**Memory Issues:**
- Reduce batch sizes (try 5 for both modes)
- Close other applications
- Restart application periodically during long sessions
- Monitor system memory usage

*How to fix it:*
1. Close other programs, especially web browsers with many tabs
2. Reduce batch sizes:
   - Use 5 for both Keyword and DeepScan batch sizes
   - This makes it slower but more stable
3. Choose fewer keywords (try 2-3 instead of 10+)
4. Restart your computer and try again
5. Check available memory:
   - Windows: Ctrl+Shift+Esc → Performance tab
   - Mac: Activity Monitor → Memory tab

**❌ "Out of memory" errors**

*What this means:* The app is trying to use more memory than your computer has.

*How to fix it:*
1. Immediately reduce all batch sizes to 5
2. Close all other programs
3. Restart the app
4. Try running at night when no other programs are open, or when you don't have to actively use your computer
5. If it keeps happening, your computer might just not have enough RAM. Sorry! This isn't really a fixable issue for us.

**❌ "Network timeout" errors appearing frequently**

*What this means:* Your internet connection is too slow or unstable.

**Network Timeouts:**
- Check internet connection stability
- Reduce concurrent requests by lowering batch sizes
- Wait and retry during Reddit high-traffic periods
- Consider using VPN if experiencing regional issues

*How to fix it:*
1. Check your internet connection speed
2. Switch from WiFi to ethernet cable if possible
3. Reduce batch sizes to put less stress on your connection
4. Try running at different times of day, when the API we use isn't as busy
5. Consider using a VPN if you're having regional connectivity issues
6. Wait 5-10 minutes and try again - Reddit might be experiencing high traffic

#### Application Startup Issues

**❌ App won't start on Windows**

*What this means:* Windows is blocking the app or it's missing files.

**Windows:**
- Ensure entire folder was extracted, not just the .exe
- Try running as Administrator
- Check Windows Defender exceptions
- Install Visual C++ Redistributable if needed

*How to fix it:*
1. Make sure you extracted the entire ZIP folder, not just the .exe file
2. Try right-clicking SupaScrapeR.exe and choosing "Run as administrator"
3. Check if Windows Defender blocked it:
   - Open Windows Security
   - Go to Virus & threat protection
   - Check if SupaScrapeR is in quarantine
   - If so, restore it and add it to exclusions
4. Install Microsoft Visual C++ Redistributable if prompted

**❌ App won't start on Mac**

*What this means:* macOS is blocking the app for security reasons.

**macOS:**
- Follow security instructions in installation section
- Remove quarantine flag using Terminal command
- Ensure macOS 10.14 or later
- Check available disk space (1GB+ recommended)

*How to fix it:*
1. Don't double-click the app - right-click and choose "Open" instead
2. Click "Open" when macOS warns you about the developer
3. If it still won't work, try the Terminal command:

   ```
   xattr -dr com.apple.quarantine /path/to/SupaScrapeR.app
   ```
4. Make sure you have macOS 10.14 or newer
5. Ensure you have at least 1GB of free disk space

#### Google Trends Integration Issues

**❌ "Failed to fetch trending keywords"**

*What this means:* Google Trends is temporarily unavailable or rate-limiting you.

**Keyword Fetch Failures:**
- Google Trends has rate limits - wait 5-10 minutes and retry
- Try more general keywords if specific ones fail
- Proceed with manual keyword selection if automated discovery fails
- Check internet connection and regional access

*How to fix it:*
1. Wait 5-10 minutes and click "Try Again"
2. Check your internet connection
3. Try using simpler, more general keywords
4. If it keeps failing, you can skip this step and proceed with your original keywords
5. Google Trends has daily limits - try again tomorrow if nothing works

**❌ "No keywords found" or "All keywords failed"**

*What this means:* Google Trends couldn't find trending topics related to your keywords. Well, aren't you niche.

*How to fix it:*
1. Try more popular, general keywords like "politics" or "technology"
2. Check spelling of your keywords
3. Use single words instead of phrases
4. Proceed with manual keyword selection - just type what you want to search for

**❌ App says "Saved Post" but I don't see data in Supabase**

*What this means:* There might be a delay or connection issue.

*How to fix it:*
1. Wait 2-3 minutes and refresh your Supabase page
2. Check that you're looking at the "reddit_posts" table
3. Make sure you're logged into the correct Supabase project
4. Check the app logs for any error messages
5. Try stopping and restarting the collection

**❌ All posts are being marked as "Duplicate Post (Skipped)"**

*What this means:* You've already collected these posts before, or they're being processed multiple times.

*How to fix it:*
1. This is actually normal behavior - the app prevents collecting the same post twice
2. Try different keywords or subreddits if you want new data
3. Wait a few hours/days for new posts to appear on Reddit
4. If you want to recollect everything, you'd need to delete your existing data first (advanced users only)

### Error Logs

**🗂️ Finding Error Logs**

If you're having persistent problems, check the error logs:

SupaScrapeR automatically saves detailed error logs for troubleshooting:

**Log file locations:**
- **Windows**: `%USERPROFILE%\Documents\SupaScrapeR\error_log.txt`
- **macOS**: `~/Documents/SupaScrapeR/error_log.txt`

**Windows:**
1. Press Windows key + R
2. Type: `%USERPROFILE%\Documents\SupaScrapeR`
3. Press Enter
4. Look for `error_log.txt`

**Mac:**
1. Open Finder
2. Press Cmd+Shift+G
3. Type: `~/Documents/SupaScrapeR`
4. Press Enter
5. Look for `error_log.txt`

**Log entry types:**
- `[INFO]` - Normal operation messages
- `[WARNING]` - Non-critical issues that were handled
- `[ERROR]` - Problems that may affect functionality
- `[DEBUG]` - Detailed technical information

**Understanding Error Log Messages:**
- `[INFO]` - Normal operation, nothing to worry about
- `[WARNING]` - Minor issues that were handled automatically
- `[ERROR]` - Problems that might affect how the app works
- `[DEBUG]` - Technical details for troubleshooting

**🔄 "Nuclear Option" - Complete Reset**

If nothing else works, you can completely reset the app:

1. **Close SupaScrapeR completely**
2. **Delete configuration folder:**
   - Windows: Delete `Documents\SupaScrapeR` folder
   - Mac: Delete `~/Documents/SupaScrapeR` folder
3. **Restart the app** - it will be like the first time you used it
4. **Re-enter all your credentials and settings**

**⚠️ Warning:** This will delete all your saved presets and settings, but your collected data in Supabase will be safe.

### Getting Help

**📞 If you're still stuck after trying everything above:**

If you're still experiencing issues:

1. **Check the error logs first** (see instructions above)
2. **Search existing issues:**
   - Go to [our GitHub Issues page](https://github.com/kennethhuang7/SupaScrapeR/issues)
   - Use the search box to look for your specific problem
   - Someone might have already solved it!

3. **Create a new help request:**
   - If you can't find a solution, click "New Issue" on GitHub
   - **Include this information:**
     - Your operating system (Windows 10, macOS Big Sur, etc.)
     - What you were trying to do when the problem happened
     - The exact error message you saw
     - Relevant lines from your error log (if any)
     - How much RAM your computer has
   - **Don't include:** Your passwords, API keys, or other sensitive information

4. **What to expect:**
   - We will try to respond as soon as possible
   - Be patient and polite - we are a small team!

**💡 Tips for Getting Better Help:**
- Be specific about what happened
- Include screenshots of error messages (but hide any passwords)
- Tell us what you already tried
- Mention if it worked before and suddenly stopped

**🔒 Privacy Note:** Never share your Reddit API credentials, Supabase keys, or any passwords in help requests. We'll never ask for these!

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

**🤔 What does this mean for you?**
- You can use this software for free, forever
- You can modify it if you know how to program
- You can share it with friends and colleagues
- You can use it for commercial purposes
- No warranty is provided - use at your own risk

## Authors

**Kenneth Huang** - *Creator and Lead Developer*
- GitHub: [@kennethhuang7](https://github.com/kennethhuang7)
- LinkedIn: [Kenneth Huang](https://www.linkedin.com/in/kennethhuang7/)

---

**📧 Questions?** Feel free to reach out on GitHub or LinkedIn. 

**🌟 Enjoying SupaScrapeR?** Consider giving us a star on GitHub - it helps others discover the project!
