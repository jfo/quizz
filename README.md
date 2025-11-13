# Quizz - Spaced Repetition Quiz App

A simple quiz application that helps you learn more efficiently by focusing on questions you need to work on the most. Features local storage for tracking your progress.

## Features

- **Smart question ordering** - Focus on questions you struggle with using "Most Needed" mode
- **Flexible filtering** - Filter by section, quiz, or rating level
- **Progress tracking** - Your answers and ratings are stored locally in your browser
- **Shuffle mode** - Randomize question order for variety
- **Clean, modern UI** - Simple and distraction-free interface

## Quick Start

### Prerequisites

- Node.js (v18 or higher)

### Setup

1. Clone the repository:
```bash
git clone https://github.com/jfo/quizz.git
cd quizz
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open your browser to http://localhost:3000

## Project Structure

```
quizz/
├── src/
│   ├── App.tsx              # Main app component
│   ├── main.tsx             # Entry point
│   ├── api.ts               # API layer
│   ├── questionManager.ts   # Question loading and filtering
│   └── questionState.ts     # Local storage for ratings and progress
├── public/
│   └── questions.json       # Question bank
├── index.html
├── vite.config.ts
├── package.json
└── deploy.sh                # Deploy to GitHub Pages
```

## How It Works

### Question Modes

- **Sequential mode** - Go through questions in order
- **Shuffle mode** - Randomize question order
- **Most Needed mode** - Prioritize questions you've gotten wrong or haven't answered recently

### Progress Tracking

Your progress is stored locally in your browser using localStorage:
- **Rating system** - Questions are rated 0-5 stars based on your performance
- **Correct streaks** - Track consecutive correct answers
- **Incorrect count** - Track how many times you've gotten a question wrong
- **Last answered time** - Know when you last saw each question

### Filters

- **Section filter** - Choose specific sections to study
- **Quiz filter** - Select individual quizzes
- **Rating filter** - Focus on questions with specific rating levels (e.g., only 0-2 star questions)

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run build:check` - Type check and build
- `npm run preview` - Preview production build
- `npm run test` - Run tests in watch mode
- `npm run test:ui` - Open Vitest UI
- `npm run test:run` - Run tests once
- `npm run deploy` - Deploy to GitHub Pages

## Deployment

Deploy to GitHub Pages:

```bash
npm run deploy
```

This will build the app and deploy it to the `gh-pages` branch.

## Data Storage

All data is stored locally in your browser's localStorage:
- No backend server required
- No database needed
- Data persists between sessions
- Data is specific to your browser/device

To reset your progress, clear your browser's localStorage or use the "Reset Data" button in the app.

## Adding Questions

Questions are stored in `public/questions.json`. The file structure is:

```json
[
  {
    "section": "Section Name",
    "sectionUrl": "https://...",
    "quizCount": 1,
    "quizzes": [
      {
        "url": "https://...",
        "title": "Quiz Title",
        "questionCount": 10,
        "questions": [
          {
            "id": "unique-id",
            "question": "Question text?",
            "questionEn": "English translation (optional)",
            "metadata": "Additional info (optional)",
            "options": [
              { "text": "Option 1", "textEn": "English (optional)", "correct": true },
              { "text": "Option 2", "textEn": "English (optional)", "correct": false }
            ]
          }
        ]
      }
    ]
  }
]
```

## License

MIT
