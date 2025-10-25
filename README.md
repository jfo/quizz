# Quizz - Spaced Repetition Quiz App

A quiz application that uses spaced repetition (SM-2 algorithm) to help you learn more efficiently by focusing on questions you need to work on.

## Features

- Spaced repetition algorithm (SM-2) to optimize learning
- PostgreSQL database to track progress and statistics
- TypeScript backend (Express) and frontend (React + Vite)
- Clean, modern UI
- Real-time statistics tracking

## Project Structure

```
quizz/
├── backend/          # Express API server
│   ├── src/
│   │   ├── index.ts           # Main server file
│   │   ├── routes.ts          # API routes
│   │   ├── db.ts              # Database connection
│   │   ├── spacedRepetition.ts # SM-2 algorithm
│   │   └── types.ts           # TypeScript types
│   ├── schema.sql             # Database schema
│   └── package.json
├── frontend/         # React frontend
│   ├── src/
│   │   ├── App.tsx            # Main app component
│   │   ├── main.tsx           # Entry point
│   │   ├── api.ts             # API client
│   │   └── index.css          # Styles
│   └── package.json
└── questions.json    # Question bank
```

## Setup

### Prerequisites

- Node.js (v18 or higher)
- Docker and Docker Compose (recommended) OR PostgreSQL (v14 or higher)

### 1. Database Setup

#### Option A: Using Docker (Recommended)

Start PostgreSQL with Docker Compose:

```bash
docker-compose up -d
```

The database will automatically be created with the schema. That's it!

#### Option B: Manual PostgreSQL Setup

Create a PostgreSQL database:

```bash
psql -U postgres
CREATE DATABASE quizz_db;
\q
```

Run the schema:

```bash
psql -U postgres -d quizz_db -f backend/schema.sql
```

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in the `backend` directory:

```bash
cp .env.example .env
```

Edit `.env` with your PostgreSQL credentials:

```
PORT=3001
DATABASE_URL=postgresql://postgres:quizz_password@localhost:5432/quizz_db
```

Note: If using Docker Compose, the default credentials above will work. If using your own PostgreSQL, update the password accordingly.

### 3. Frontend Setup

```bash
cd frontend
npm install
```

## Running the App

### Start the backend (in one terminal):

```bash
cd backend
npm run dev
```

The API will run on http://localhost:3001

### Start the frontend (in another terminal):

```bash
cd frontend
npm run dev
```

The frontend will run on http://localhost:3000

## How It Works

### Spaced Repetition Algorithm

The app uses the SM-2 (SuperMemo 2) algorithm to determine when to show each question:

1. **New questions** start with default settings
2. **Correct answers** increase the interval before the next review
3. **Incorrect answers** reset the interval to review sooner
4. The algorithm adapts to your performance on each question

### API Endpoints

- `GET /api/questions/next` - Get the next question to study
- `POST /api/answers` - Submit an answer and update statistics
- `GET /api/stats` - Get overall statistics

## Database Schema

- `question_stats` - Tracks spaced repetition data for each question
- `response_history` - Logs every answer for historical tracking
- `session_stats` - Overall session statistics (optional)

## Next Steps

Some ideas for future features:

- User accounts and authentication
- Multiple study modes (practice mode, test mode)
- Progress visualization and charts
- Custom question sets
- Mobile app version
- Study streak tracking
- Daily goals and reminders
