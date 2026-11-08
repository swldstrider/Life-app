# Life Quest ⚡

A gamified life reset app. Earn XP for daily water, protein, steps and push-ups, and for hitting your weekly workout goal. Level up, keep streaks alive and unlock badges.

It's a web app you can install to your phone's home screen. It works offline and keeps all data on your device. There's no account and no server.

## What it does

| Quest | How XP works |
|---|---|
| 💧 Water | 5 XP per 250 ml, +50 for your daily goal |
| 🍗 Protein | 5 XP per 10 g, +50 for your goal (body weight × 2 g/kg by default). One-tap foods or enter grams |
| 👟 Steps | 10 XP per 1,000 steps, +50 for your daily goal |
| 💪 Push-ups | 1 XP per rep, +50 for beating today's target, +100 for a new best |
| 🏋️ Workouts | Strength, cardio, HIIT, stretching, yoga, swim, sport or walk: 75 XP each (2/day max), +250 for your weekly goal, +50 per week in a row |
| ✅ Habits | 15 XP each (customisable: sleep, veg, no junk, message a friend…) |
| 🔥 Daily streak | Hit any daily goal or log a workout to keep it alive. Badges at 3, 7, 30, 100 and 365 days |
| 🧊 Streak freezes | Earn one every 7 streak days (bank up to 3). A missed day uses one automatically so your streak survives. With a full bank, every 7th day gives +100 XP instead |
| ⭐ Perfect day | Water + steps + push-ups all done: +100, +10 per day in a row (max +200) |
| 🏅 Badges | 30 milestones with one-off XP bonuses |

**Progressive overload:** push-ups have a daily target. Beat it and the next target goes up (by 2 reps by default). Miss two sessions in a row and it eases back. The app also suggests a sets × reps split.

**Levels** get steadily harder (level 2 = 120 XP, level 10 ≈ 3,800 XP), with ranks from Rookie to Immortal.

You can go back to earlier days to fill in missed logs. XP and streaks are recalculated from your logs, so fixing a mistake always gives the right totals.

## Put it on your phone

1. In GitHub, go to **Settings → Pages** for this repo.
2. Under *Build and deployment*, set **Source: Deploy from a branch**, then pick your branch and the `/ (root)` folder. Save.
3. After a minute, open the URL it shows (`https://<you>.github.io/Life-app/`) on your phone.
4. **iPhone:** Safari → Share → *Add to Home Screen*. **Android:** Chrome → ⋮ → *Install app*.

Export a backup from Settings now and then. Data lives in your browser, so clearing site data deletes it.

## Run locally

No build step needed:

```sh
python3 -m http.server 8000
# open http://localhost:8000
```

## Files

- `index.html`: page shell and bottom tabs
- `app.js`: game engine (XP, streaks, overload, badges) and UI
- `styles.css`: light and dark themes
- `sw.js`, `manifest.webmanifest`, `icons/`: offline support and install-to-home-screen
