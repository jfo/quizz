# Quiz Backend

Super simple backend with username/password authentication and state storage.

## Stack

- **Node.js** + **Express** - Web framework
- **SQLite** - File-based database (no setup required!)
- **bcryptjs** - Password hashing
- **jsonwebtoken** - JWT authentication

## Quick Start

```bash
# Install dependencies
npm install

# Start server
npm start

# Or use dev mode with auto-reload (Node 18+)
npm run dev
```

Server runs on `http://localhost:3001`

## API Endpoints

### Authentication

#### Register
```http
POST /api/register
Content-Type: application/json

{
  "username": "user123",
  "password": "password123"
}
```

Response:
```json
{
  "message": "User created successfully",
  "token": "eyJhbGc...",
  "user": {
    "id": 1,
    "username": "user123"
  }
}
```

#### Login
```http
POST /api/login
Content-Type: application/json

{
  "username": "user123",
  "password": "password123"
}
```

Response:
```json
{
  "message": "Login successful",
  "token": "eyJhbGc...",
  "user": {
    "id": 1,
    "username": "user123"
  }
}
```

### State Management

All state endpoints require authentication header:
```
Authorization: Bearer <token>
```

#### Get State
```http
GET /api/state
Authorization: Bearer <token>
```

Response:
```json
{
  "state": {
    "questions": {...},
    "progress": {...}
  }
}
```

#### Save State
```http
POST /api/state
Authorization: Bearer <token>
Content-Type: application/json

{
  "state": {
    "questions": {...},
    "progress": {...}
  }
}
```

#### Get Current User
```http
GET /api/me
Authorization: Bearer <token>
```

Response:
```json
{
  "user": {
    "id": 1,
    "username": "user123"
  }
}
```

## Environment Variables

Create a `.env` file (optional):

```env
PORT=3001
JWT_SECRET=your-secret-key-here
```

## Database

Data is stored in `quiz.db` (SQLite file) with two tables:

- `users` - User accounts with hashed passwords
- `user_state` - Quiz state per user (JSON blob)

The database file is created automatically on first run.

## Production Notes

- Change `JWT_SECRET` in production!
- Consider using a reverse proxy (nginx)
- Add rate limiting for auth endpoints
- Enable HTTPS
- Backup `quiz.db` regularly

## CORS

CORS is enabled for all origins by default. Restrict in production:

```javascript
app.use(cors({
  origin: 'https://your-frontend.com'
}));
```
