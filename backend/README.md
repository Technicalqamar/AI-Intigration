# Task Manager REST API with AI Task Planning

A robust, secure, and fully testable Node.js & Express REST API featuring complete Task CRUD operations backed by MongoDB Atlas and Mongoose, plus intelligent AI-powered task breakdown planning through the official Groq SDK and Zod schema validation.

---

## Table of Contents

- [Features](#features)
- [Architecture & Tech Stack](#architecture--tech-stack)
- [Project Structure](#project-structure)
- [Prerequisites & Installation](#prerequisites--installation)
- [Environment Configuration](#environment-configuration)
- [Starting the Development Server](#starting-the-development-server)
- [Running Automated Tests](#running-automated-tests)
- [API Reference](#api-reference)
  - [Health Check](#health-check)
  - [Task CRUD Endpoints](#task-crud-endpoints)
  - [AI Task Planning Endpoint](#ai-task-planning-endpoint)
- [Postman Collection](#postman-collection)
- [Deployment on Render](#deployment-on-render)
- [Security Features](#security-features)
- [Troubleshooting](#troubleshooting)

---

## Features

- **Standard REST Architecture**: Clean separation of routes, controllers, services, models, validators, and middleware.
- **MongoDB Atlas & Mongoose**: Validated task schemas, auto-timestamps, and injection-protected database operations.
- **AI Task Decomposition**: Integrates Groq to convert natural language goals into structured action steps, estimates, and priorities.
- **Strict Validation**: Bidirectional Zod validation on incoming HTTP payloads, route parameters, and AI provider outputs.
- **Security Hardened**: Helmet HTTP security headers, CORS origin whitelisting, JSON payload size bounds, and credential sanitization in logs.
- **Dedicated Rate Limiting**: Dedicated rate limiting on the AI planning endpoint to protect API quotas.
- **Automated Tests**: Tests use the native Node.js test runner (`node:test`), Supertest, an isolated in-memory MongoDB server (`mongodb-memory-server`), and deterministic Groq mocks.
- **Postman Ready**: Pre-configured collection with automatic variable binding and assertion scripts.

---

## Architecture & Tech Stack

| Technology | Purpose |
| :--- | :--- |
| **Node.js (v20+)** | Server runtime (ES Modules format: `import` / `export`) |
| **Express.js (v4.21+)** | REST API web framework |
| **MongoDB / Mongoose (v9+)** | Document database & Object Document Mapper (ODM) |
| **Groq SDK (`groq-sdk`)** | Official high-speed LLM inference SDK |
| **Zod (v4)** | Schema declaration and strict runtime validation |
| **Helmet** | HTTP security headers |
| **express-rate-limit** | IP-based request throttling for sensitive routes |
| **Morgan** | HTTP request logger |
| **CORS** | Cross-Origin Resource Sharing control |
| **Node.js Test Runner (`node:test`)** | Native test framework |
| **Supertest** | HTTP endpoint integration testing |
| **mongodb-memory-server** | Isolated in-memory MongoDB for local test suites |

---

## Project Structure

```text
.
├── .env.example                      # Template for required environment variables
├── .gitignore                        # Git exclusion rules (ignores secrets & artifacts)
├── package.json                      # Scripts, metadata, and dependencies
├── README.md                         # Documentation and usage guide
├── postman/
│   └── Task-Manager-API.postman_collection.json # Ready-to-import Postman collection
├── src/
│   ├── app.js                        # Express application configuration & middleware
│   ├── server.js                     # Server entry point & graceful shutdown listener
│   ├── config/
│   │   └── db.js                     # Mongoose connection manager & credential sanitization
│   ├── controllers/
│   │   ├── ai.controller.js          # AI planning controller
│   │   └── task.controller.js        # Task CRUD controllers
│   ├── middleware/
│   │   ├── error.middleware.js       # Centralized JSON error responder
│   │   ├── not-found.middleware.js   # 404 unhandled route handler
│   │   ├── rate-limit.middleware.js  # Dedicated AI endpoint rate limiter
│   │   └── validate.middleware.js    # Generic Zod validation middleware
│   ├── models/
│   │   └── task.model.js             # Mongoose Task schema and model
│   ├── routes/
│   │   ├── ai.routes.js              # /api/ai route definitions
│   │   └── task.routes.js            # /api/tasks route definitions
│   ├── services/
│   │   └── ai.service.js             # Groq SDK provider integration and validation
│   ├── utils/
│   │   ├── api-error.js              # Standardized ApiError helper class
│   │   └── async-handler.js          # Async controller wrapper for unhandled exceptions
│   └── validators/
│       ├── ai.validator.js           # Zod schemas for AI requests and outputs
│       └── task.validator.js         # Zod schemas for task creation, update, and params
└── tests/
    ├── ai.test.js                    # Automated tests for AI planning & rate limiting
    └── task.test.js                  # Automated tests for CRUD, health check & errors
```

---

## Prerequisites & Installation

### Prerequisites

- **Node.js**: `v20.0.0` or later (`node -v`)
- **npm**: `v10.0.0` or later (`npm -v`)
- **MongoDB Atlas**: A free cluster and connection string.
- **Groq account**: An API key from [https://console.groq.com/keys](https://console.groq.com/keys).

### Installation

1. Clone or download the repository into your workspace.
2. Install dependencies:

```bash
npm install
```

---

## Environment Configuration

The application requires an environment configuration file (`.env`). A template is provided in `.env.example`.

### 1. Create your local `.env`

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

### 2. Configure variables in `.env`

Fill in the appropriate values in your newly created `.env`:

```env
# Server Port (defaults to 5000 if not set)
PORT=5000

# Environment Mode
NODE_ENV=development

# MongoDB Atlas Connection URI (Replace with your actual Atlas cluster URI)
# Example: mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/taskdb?retryWrites=true&w=majority
MONGODB_URI=mongodb+srv://myuser:mypassword@cluster0.abcde.mongodb.net/task_manager?retryWrites=true&w=majority

# Groq API key (keep this secret; do not commit a real key)
GROQ_API_KEY=your_groq_api_key_here

# Groq model identifier
GROQ_MODEL=openai/gpt-oss-20b

# CORS Allowed Origin (Comma-separated for multiple origins, or * for all)
CORS_ORIGIN=http://localhost:3000

# AI Configuration
AI_REQUEST_TIMEOUT_MS=20000
AI_RATE_LIMIT_WINDOW_MS=900000
AI_RATE_LIMIT_MAX=10
```

> **Security Note**: Never commit your `.env` file to source control. The `.gitignore` file is pre-configured to exclude `.env` while preserving `.env.example`.

---

## Starting the Development Server

To launch the development server with automatic reloading using Nodemon:

```bash
npm run dev
```

For production execution:

```bash
npm start
```

When connected successfully, the terminal will display:

```text
[Server] Connecting to MongoDB...
[MongoDB] Connected successfully to host: cluster0-shard-00-00.abcde.mongodb.net, database: task_manager
[Server] Task Manager REST API listening on port 5000 (PID: 12345)
[Server] Environment: development
```

---

## Running Automated Tests

The test suite runs with Node's native test runner (`node:test`) and Supertest. It uses `mongodb-memory-server` and mocked AI-provider calls; the first CRUD test run may need internet access to download its MongoDB binary.

Run the entire test suite:

```bash
npm test
```

Watch mode for active development:

```bash
npm run test:watch
```

### Test Suite Breakdown

1. **Task CRUD & Error Suites** (`tests/task.test.js`):
   - Health check endpoint verification (`GET /`).
   - Task creation with defaults and custom fields (`POST /api/tasks`).
   - Validation rejection for empty titles, missing titles, invalid status enums, malformed dates, and unexpected/internal fields.
   - Task collection retrieval (`GET /api/tasks`).
   - Task retrieval by ID (`GET /api/tasks/:id`).
   - 400 Bad Request on invalid 24-char ObjectId format.
   - 404 Not Found on nonexistent task ID.
   - Partial updates with allowed fields only (`PUT /api/tasks/:id`).
   - Protection against modifying internal fields (`_id`, `__v`).
   - Task deletion (`DELETE /api/tasks/:id`).
   - Centralized 404 on unmapped routes.
   - Centralized 400 on malformed JSON bodies.

2. **AI Task Planning Suites** (`tests/ai.test.js`):
   - Rejection of empty, missing, or >3000 char descriptions.
   - Deterministic mock testing of Groq plan generation.
   - 503 Service Unavailable when `GROQ_API_KEY` is omitted.
   - 504 Gateway Timeout on provider timeout.
   - 502 Bad Gateway on provider network/server errors.
   - 502 Bad Gateway on malformed non-JSON responses.
   - 502 Bad Gateway on responses violating the Zod plan schema (e.g., negative hours).
   - 429 Too Many Requests enforcement by the dedicated AI rate limiter.

---

## API Reference

All requests accept and return JSON. Response structures adhere to a predictable convention:

- **Success**: `{ "success": true, "message": "...", "data": ... }`
- **Error**: `{ "success": false, "message": "...", "errors": [...] }`

### Health Check

#### `GET /`
Verifies API process availability and database connectivity.

**Response `200 OK`**:
```json
{
  "success": true,
  "message": "Task Manager REST API is running",
  "data": {
    "status": "healthy",
    "uptime": 45.2,
    "timestamp": "2026-10-18T05:22:00.000Z",
    "environment": "development",
    "database": {
      "status": "connected",
      "readyState": 1,
      "healthy": true
    }
  }
}
```

---

### Task CRUD Endpoints

#### 1. `POST /api/tasks`
Creates a new task.

**Headers**: `Content-Type: application/json`

**Request Body**:
```json
{
  "title": "Complete backend assessment",
  "description": "Implement Express REST API with MongoDB and Groq",
  "status": "pending",
  "dueDate": "2026-10-31T18:00:00.000Z"
}
```

- `title` *(required, string, 1-150 chars)*
- `description` *(optional, string, max 2000 chars, default: `""`)*
- `status` *(optional, enum: `"pending"` | `"in-progress"` | `"completed"`, default: `"pending"`)*
- `dueDate` *(optional, valid ISO 8601 date string or `null`)*

**Response `201 Created`**:
```json
{
  "success": true,
  "message": "Task created successfully",
  "data": {
    "_id": "6711d9f8b72458a1d5a71101",
    "title": "Complete backend assessment",
    "description": "Implement Express REST API with MongoDB and Groq",
    "status": "pending",
    "dueDate": "2026-10-31T18:00:00.000Z",
    "createdAt": "2026-10-18T05:20:00.123Z",
    "updatedAt": "2026-10-18T05:20:00.123Z"
  }
}
```

---

#### 2. `GET /api/tasks`
Retrieves all tasks sorted by `createdAt` descending.

**Response `200 OK`**:
```json
{
  "success": true,
  "message": "Tasks retrieved successfully",
  "data": [
    {
      "_id": "6711d9f8b72458a1d5a71101",
      "title": "Complete backend assessment",
      "description": "Implement Express REST API with MongoDB and Groq",
      "status": "pending",
      "dueDate": "2026-10-31T18:00:00.000Z",
      "createdAt": "2026-10-18T05:20:00.123Z",
      "updatedAt": "2026-10-18T05:20:00.123Z"
    }
  ]
}
```

---

#### 3. `GET /api/tasks/:id`
Retrieves a single task by its 24-character hex MongoDB ObjectId.

**Response `200 OK`**:
```json
{
  "success": true,
  "message": "Task retrieved successfully",
  "data": {
    "_id": "6711d9f8b72458a1d5a71101",
    "title": "Complete backend assessment",
    "description": "Implement Express REST API with MongoDB and Groq",
    "status": "pending",
    "dueDate": "2026-10-31T18:00:00.000Z",
    "createdAt": "2026-10-18T05:20:00.123Z",
    "updatedAt": "2026-10-18T05:20:00.123Z"
  }
}
```

**Response `404 Not Found`**:
```json
{
  "success": false,
  "message": "Task with ID '507f1f77bcf86cd799439011' not found."
}
```

**Response `400 Bad Request` (Invalid ID format)**:
```json
{
  "success": false,
  "message": "Validation failed for request params.",
  "errors": [
    {
      "field": "id",
      "message": "Invalid task ID format. Must be a 24-character hexadecimal string."
    }
  ]
}
```

---

#### 4. `PUT /api/tasks/:id`
Updates allowed fields of an existing task (`title`, `description`, `status`, `dueDate`). Rejects unsupported fields or attempts to modify `_id`.

**Request Body**:
```json
{
  "title": "Complete backend assessment (Review Ready)",
  "status": "in-progress"
}
```

**Response `200 OK`**:
```json
{
  "success": true,
  "message": "Task updated successfully",
  "data": {
    "_id": "6711d9f8b72458a1d5a71101",
    "title": "Complete backend assessment (Review Ready)",
    "description": "Implement Express REST API with MongoDB and Groq",
    "status": "in-progress",
    "dueDate": "2026-10-31T18:00:00.000Z",
    "createdAt": "2026-10-18T05:20:00.123Z",
    "updatedAt": "2026-10-18T05:25:10.456Z"
  }
}
```

---

#### 5. `DELETE /api/tasks/:id`
Deletes a task by ID.

**Response `200 OK`**:
```json
{
  "success": true,
  "message": "Task deleted successfully",
  "data": {
    "id": "6711d9f8b72458a1d5a71101",
    "title": "Complete backend assessment (Review Ready)"
  }
}
```

---

### AI Planning and Answer Endpoint

#### `POST /api/ai/plan-task`
Supports structured task planning and direct answers using the configured Groq model. Omitting `mode` preserves the original planning behavior.

- Rate limited to `AI_RATE_LIMIT_MAX` requests per `AI_RATE_LIMIT_WINDOW_MS`.
- Configurable model via `GROQ_MODEL` (for example, `openai/gpt-oss-20b`; it must be available to your Groq account).
- Requests and generated plans are validated with Zod before being returned to the client.

**Plan request body** (`mode` is optional for backward compatibility):
```json
{
  "mode": "plan",
  "title": "Complete my Node.js assignment",
  "description": "Build the API, test all endpoints, and prepare the submission."
}
```

`title` is optional. Existing clients can continue sending only `description`.

**Plan response `200 OK`**:
```json
{
  "success": true,
  "plan": {
    "mode": "plan",
    "summary": "Build and submit the tested Node.js assignment.",
    "priority": "high",
    "estimatedHours": 12,
    "steps": [
      "Implement the assignment API endpoints and request validation",
      "Add focused tests for successful and invalid endpoint requests",
      "Run the test suite and resolve any failing cases",
      "Prepare the submission notes and verify the final project"
    ]
  }
}
```

**Answer request body** (use exactly one of `prompt` or the legacy-compatible `description` field):
```json
{
  "mode": "answer",
  "prompt": "Explain the difference between Express middleware and controllers."
}
```

**Answer response `200 OK`**:
```json
{
  "success": true,
  "mode": "answer",
  "answer": "Middleware processes requests in the request pipeline, while controllers implement the endpoint-specific behavior and response."
}
```

Prompts and planning descriptions must be non-empty strings no longer than 3000 characters. Plan titles are optional and limited to 200 characters.

**Legacy plan request body**:
```json
{
  "description": "I need to build a portfolio website within three days."
}
```

**Response `400 Bad Request` (Empty/Missing description)**:
```json
{
  "success": false,
  "message": "Validation failed for request body.",
  "errors": [
    {
      "field": "description",
      "message": "Description cannot be empty."
    }
  ]
}
```

**Response `429 Too Many Requests` (Rate limit exceeded)**:
```json
{
  "success": false,
  "message": "Too many AI requests from this IP. Please try again later."
}
```

**Response `503 Service Unavailable` (Missing Groq configuration)**:
```json
{
  "success": false,
  "message": "AI service is currently unavailable. Groq API key is not configured."
}
```

**Response `504 Gateway Timeout` (Provider took longer than `AI_REQUEST_TIMEOUT_MS`)**:
```json
{
  "success": false,
  "message": "AI request timed out after 20000ms. Please try again later."
}
```

---

## Postman Collection

An importable Postman Collection is located in `postman/Task-Manager-API.postman_collection.json`.

### How to Import and Use:
1. Open Postman.
2. Click **Import** in the upper left.
3. Select or drag-and-drop `postman/Task-Manager-API.postman_collection.json`.
4. Ensure the collection variable `baseUrl` is set to `http://localhost:5000` (default) or your deployed URL.
5. Execute requests in sequence:
   - When **Create Task** runs, its built-in test script automatically stores the new task ID in `{{taskId}}`.
   - To test direct answers, send a `POST {{baseUrl}}/api/ai/plan-task` request with `{"mode":"answer","prompt":"Explain Express middleware and controllers."}`.
   - Subsequent **Get Task by ID**, **Update Task**, and **Delete Task** requests will automatically use `{{taskId}}`.
   - Validation and error scenario folders verify 400 and 404 responses automatically.

---

## Deployment on Render

This application is ready for deployment on [Render](https://render.com) as a Web Service.

### Step-by-Step Deployment Guide:

1. **Push repository to GitHub / GitLab**.
2. **Create a new Web Service** on Render:
   - Connect your GitHub repository.
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node src/server.js` (or `npm start`)
3. **Configure Environment Variables** in the Render Dashboard (under **Environment**):
   - `PORT`: `10000` (or leave unset; Render sets this automatically)
   - `NODE_ENV`: `production`
   - `MONGODB_URI`: `mongodb+srv://<user>:<pwd>@<cluster>.mongodb.net/<dbname>?retryWrites=true&w=majority`
   - `GROQ_API_KEY`: Your Groq API key.
   - `GROQ_MODEL`: A model available to your Groq account.
   - `CORS_ORIGIN`: Your frontend URL or `*`
   - `AI_REQUEST_TIMEOUT_MS`: `20000`
   - `AI_RATE_LIMIT_WINDOW_MS`: `900000`
   - `AI_RATE_LIMIT_MAX`: `10`
4. **Deploy**:
   - Render will build dependencies and start the service.
   - Test by opening `<your-render-url>/` in your browser to verify the health check endpoint returns `200 OK` with database connected.

---

## Security Features

- **No Secrets in Source Control**: Credentials and keys are read exclusively from environment variables.
- **Credential Masking**: `config/db.js` strips MongoDB usernames and passwords before logging any connection error.
- **HTTP Header Protection**: `helmet()` automatically secures common headers (X-Frame-Options, CSP, HSTS, etc.).
- **Origin Control**: Configurable CORS middleware.
- **Payload Bounds**: Body parser restricted to `100kb` to thwart denial-of-service attempts.
- **Strict Zod Validation**: Blocks unknown fields (`.strict()`) to prevent arbitrary property injection.
- **Safe Production Errors**: In production mode (`NODE_ENV=production`), stack traces and raw error messages are hidden from clients.
- **Dedicated AI Rate Limiting**: Dedicated rate limiter restricts repeated AI model invocations per IP.

---

## Troubleshooting

| Issue | Cause | Resolution |
| :--- | :--- | :--- |
| `[Server] Failed to initialize server: Database connection failed...` | `MONGODB_URI` is missing or invalid in `.env` | Verify `.env` exists and contains a valid MongoDB Atlas URI with appropriate network IP whitelist access (e.g., `0.0.0.0/0` in Atlas Network Access). |
| `AI service is currently unavailable. Groq API key is not configured.` | `GROQ_API_KEY` is empty or missing | Set `GROQ_API_KEY` in `.env` using a key from your Groq console. |
| `AI request timed out after 20000ms.` | Upstream network latency or slow inference | Increase `AI_REQUEST_TIMEOUT_MS` in `.env` (e.g. `30000`). |
| `Too many AI planning requests from this IP.` | Rate limit triggered | Wait 15 minutes or adjust `AI_RATE_LIMIT_MAX` / `AI_RATE_LIMIT_WINDOW_MS` in `.env`. |
| Port conflict on `5000` | Port already in use by another process | Set `PORT=5001` (or another port) in `.env`. |
