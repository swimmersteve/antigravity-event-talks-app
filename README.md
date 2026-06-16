# BigQuery Release Notes Tracker

A sleek, premium Python Flask and vanilla web application (HTML/JS/CSS) that fetches the official Google Cloud BigQuery RSS/Atom release notes, formats them into a searchable dashboard, and provides a custom Twitter/X sharing experience.

## Features

- **Atom-Level Update Splitting**: Automatically splits daily Google Cloud Atom entries into individual, isolated cards (separating features, issues, deprecations, etc.).
- **Smart 10-Minute Caching**: Saves network bandwidth by caching parsed notes in-memory for 10 minutes, with support for manual, force-refreshes (`?refresh=true`).
- **Graceful Fallback**: If a live fetch fails, the app serves cached stale data rather than crashing.
- **Accurate Twitter / X Composer Modal**:
  - Automatically calculates remaining character space, counting all URLs as exactly **23 characters** matching Twitter's exact `t.co` wrapper guidelines.
  - Features a live-updating mockup card of X's dark mode visual layout.
  - Integrates an SVG circular progress meter that fills as you type (changing from Blue to Amber to Red if you exceed the limit).
  - Prompts a one-click redirect to X Web Intent with pre-filled content.
- **Live Filtering & Search**: Instant keyword search matching titles, categories, dates, or details, alongside clickable summary counts.

---

## Tech Stack

- **Backend**: Python 3, Flask, Requests, BeautifulSoup4, xml.etree.ElementTree
- **Frontend**: Vanilla HTML5, Vanilla CSS3 (custom variables, glassmorphic overlays, card grids), ES6 JavaScript, Lucide Icons

---

## Getting Started

### Prerequisites

- Python 3.9+ installed on your machine.

### Installation & Run

1. **Clone the repository** (if not already local):
   ```bash
   git clone https://github.com/swimmersteve/antigravity-event-talks-app.git
   cd antigravity-event-talks-app
   ```

2. **Create and activate a virtual environment**:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```

3. **Install the dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Start the Flask development server**:
   ```bash
   python3 app.py
   ```

5. **Open the browser**:
   Navigate to [http://localhost:5001](http://localhost:5001) to view and use the app.

---

## File Structure

```text
├── app.py                  # Flask server & Atom RSS parser
├── templates/
│   └── index.html          # HTML structure & Modal templates
├── static/
│   ├── style.css           # Premium dark-theme stylesheet
│   └── app.js              # Client state, Search, & Modal actions
├── requirements.txt        # Python dependencies list
└── .gitignore              # Ignore rules for git
```
