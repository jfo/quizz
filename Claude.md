# Claude Notes - Quizz App

## ALWAYS DO
- Update this file when you make changes, learn something new, or have ideas
- Run `npm run test:run` before committing
- Keep App.tsx clean - it's already 1200+ lines, extract if adding features

---

## What is this?
Spaced repetition quiz app for Danish citizenship test (Indfødsretsprøven). Pure client-side, no backend. Everything in localStorage.

## Quick Start
```bash
npm run dev      # localhost:3000
npm run test:run # tests
npm run deploy   # gh-pages
```

## Architecture (data flows down)
```
App.tsx (1200 lines, all UI + state)
  ↓
api.ts (facade - clean interface)
  ↓
questionManager.ts (filtering, sorting, "most needed" algo)
  ↓
questionState.ts (localStorage CRUD)
```

## Key Files
- `src/App.tsx` - monster component, 40+ useState hooks. needs refactoring tbh
- `src/questionManager.ts` - the brain. `sortByNeed()` is the magic
- `src/questionState.ts` - localStorage wrapper. rating 0-10, streaks, timestamps
- `public/questions.json` - all quiz content (1000+ questions)
- `src/index.css` - CSS vars for theming, dark mode via `data-theme="dark"`

## The Algorithm (calculateNeedScore)
```
score = (100 - rating*15) + (incorrectCount*5) - (streak*3) + min(daysSince, 30)
```
- Lower rating = higher need (study what you don't know)
- More incorrect = boost priority
- Long streak = deprioritize (you know it)
- Time decay = resurface old stuff

Rating updates:
- Correct: rating++ (max 10), streak++
- Wrong: rating-- (min 0), streak=0, incorrectCount++

## Data Model
localStorage key: `questionStates`
```ts
{
  "question-id": {
    rating: 0-10,
    correctStreak: number,
    incorrectCount: number,
    lastAnswered: timestamp
  }
}
```

Also stores: selectedSections, selectedQuizzes, shuffleMode, mostNeededMode, ratingFilter, darkMode, settingsCollapsed

## Testing
- Vitest + happy-dom
- Good coverage on questionState.ts & questionManager.ts (~90%)
- App.tsx has 0 tests - would be nice to add
- `src/test/setup.ts` mocks localStorage

## Deployment
- GitHub Pages at https://jfo.github.io/quizz/
- `npm run deploy` runs deploy.sh → builds, copies to gh-pages worktree, pushes
- GitHub Actions auto-deploys on push to main
- Base path is `/quizz/` (see vite.config.ts)

---

## Ideas & TODOs

### Refactoring
- [ ] Split App.tsx - extract SettingsPanel, QuizCard, StatsDisplay components
- [ ] Custom hooks: useLocalStorage, useQuestionFilters, useSessionStats
- [ ] Context for theme/dark mode instead of prop drilling (there isn't much rn tho)

### Features
- [ ] Keyboard shortcuts (n=next, 1-4=select option, space=reveal)
- [ ] Undo last rating change
- [ ] Session history / review wrong answers
- [ ] Better mobile UX - swipe gestures?
- [ ] Timer mode for exam practice
- [ ] Spaced repetition scheduling (like Anki intervals - 1d, 3d, 7d, etc)
- [ ] Multi-device sync (would need backend tho)

### Performance
- questions.json is loaded all at once - fine for 1000 questions but won't scale
- Could lazy load sections/quizzes
- Memoize filtered question lists

### Testing
- [ ] Add component tests for App.tsx
- [ ] E2E tests with Playwright
- [ ] Test localStorage edge cases (quota exceeded, private browsing)

### Accessibility
- Already has: skip links, ARIA labels, focus indicators
- Could add: reduced motion support, high contrast mode

### UX Polish
- Animation for correct/incorrect feedback
- Sound effects (optional)
- Confetti on completing a quiz lol

---

## Gotchas & Notes

1. **Fisher-Yates shuffle** in questionManager - don't mess with it, it's correct
2. **Base path** - remember vite.config.ts has `/quizz/` for prod
3. **Import/export validation** in questionState.ts is thorough - don't bypass it
4. **40+ useState hooks** in App.tsx - yeah it's a lot. works tho
5. **Tests mock localStorage** in setup.ts - if tests fail weirdly, check there first
6. **gh-pages branch** - never edit directly, deploy.sh overwrites it
7. **questions.json structure** is nested: sections > quizzes > questions

## Patterns Used
- Facade pattern (api.ts)
- Single responsibility (state vs manager vs UI)
- CSS custom properties for theming
- Happy path + error handling in tests

## What I'd Change
If starting fresh:
- Use Zustand or Jotai for state (simpler than Redux, better than useState soup)
- Component composition from day 1
- Maybe SvelteKit? This is simple enough it doesn't need React's overhead

But also... it works fine. Don't over-engineer. Ship features.

---

*Last updated: 2025-11-19*
