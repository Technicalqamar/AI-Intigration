# Task Manager API with AI Integration

This repository contains separate backend and frontend projects. The backend remains the source of truth for task persistence and AI planning; the frontend calls its HTTP API.

## Project structure

```text
AI Intigration/
├── backend/
│   ├── src/
│   ├── tests/
│   ├── postman/
│   ├── node_modules/       # created by npm install
│   ├── .env                # local secrets; ignored by Git
│   ├── .env.example
│   ├── package.json
│   └── package-lock.json
├── frontend/
│   ├── src/
│   ├── public/
│   ├── node_modules/       # created by npm install
│   ├── .env.example
│   ├── index.html
│   ├── package.json
│   └── package-lock.json
└── README.md
```

## Prerequisites

- Node.js 20 or newer and npm.
- A MongoDB connection string and Groq API key for database persistence and live AI planning.

## Configure and run

Open two PowerShell terminals from the repository root.

### Backend

```powershell
Set-Location .\backend
npm install
Copy-Item .env.example .env   # first setup only; preserve existing .env values
npm run dev
```

Set `MONGODB_URI` and `GROQ_API_KEY` in `backend/.env`. The backend defaults to port `5000`; when `PORT=8080`, its existing server configuration uses port `3000`.

### Frontend

```powershell
Set-Location .\frontend
npm install
npm run dev
```

Vite serves the frontend at `http://localhost:5173` and proxies `/api` to `http://localhost:5000`. Leave `VITE_API_BASE_URL` empty to use that proxy. Set it in `frontend/.env.local` only when the API uses a different absolute URL. For direct browser-to-API requests, include the frontend origin in `CORS_ORIGIN` in `backend/.env`.

### Checks

```powershell
Set-Location .\backend
npm test
npm run lint
```

```powershell
Set-Location .\frontend
npm run build
npm run preview
```

## API endpoints

| Method | Endpoint | Success |
| --- | --- | ---: |
| GET | `/` | 200 |
| GET | `/api/tasks` | 200 |
| POST | `/api/tasks` | 201 |
| GET | `/api/tasks/:id` | 200 |
| PUT | `/api/tasks/:id` | 200 |
| DELETE | `/api/tasks/:id` | 200 |
| POST | `/api/ai/plan-task` | 200 |

Invalid request data returns 400, missing tasks return 404, and AI provider configuration or upstream errors use the backend's existing error responses.

Import `backend/postman/Task-Manager-API.postman_collection.json` to use the Postman collection.

## Security

`backend/.env` and environment-specific frontend files are ignored by Git. Never put database credentials or AI provider keys in frontend variables; only the public API base URL belongs in `VITE_API_BASE_URL`.
