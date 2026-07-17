# SoundStreak

A Spotify listening-streak tracker — track your daily streak, set listening goals, and visualize your music year. Static site, deploys to GitHub Pages.

## Files
- `index.html` — landing page
- `dashboard.html` — the logged-in dashboard
- `favicon.svg` · `SoundStreakLogoDarkMode.svg` · `SoundStreakLogoLightMode.svg` — brand assets
- `hero.png` — landing hero image

## Deploy (GitHub Pages)
Upload everything in this folder to the repo root, then **Settings → Pages → Deploy from a branch → `main` → `/ (root)`**.
Live at `https://<your-username>.github.io/soundstreak/`.

## Go live with real data
Open the `CONFIG` block in `dashboard.html` and add your **Spotify Client ID** and **Last.fm API key**. Until then it runs on sample data. Full walkthrough in the *SoundStreak - Phase 1 Setup* guide.
