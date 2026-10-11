# திருவள்ளுவர் தமிழ் பள்ளி - வினா விடை (Thiruvalluvar Tamil School Quiz)

Interactive Tamil Quiz application with authentic Tamil voice narration, 15-second countdown timer, sound effects synthesizer, and curriculum-aligned questions.

---

## 🚀 How to Deploy on Render (Step-by-Step)

This app is a full-stack Node.js + React application. It serves the frontend SPA while providing the backend TTS audio API on `/api/tts`.

### Method 1: Deploy as a Render Web Service (Recommended)

1. **Push your code to GitHub / GitLab**.
2. Go to [dashboard.render.com](https://dashboard.render.com/) and click **New +** ➔ **Web Service**.
3. Connect your repository.
4. Configure the service settings:
   - **Name**: `thiruvalluvar-tamil-quiz` (or any name you prefer)
   - **Region**: Choose the closest region (e.g. Oregon, Frankfurt, Singapore)
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: `Free`
5. **Environment Variables**:
   Under **Advanced** ➔ **Add Environment Variable**:
   - `NODE_ENV`: `production`
   - `GEMINI_API_KEY`: *(Optional)* Your Gemini API key from Google AI Studio.
6. Click **Deploy Web Service**.
7. Once deployed, Render will provide a live URL (e.g., `https://thiruvalluvar-tamil-quiz.onrender.com`).

---

### Method 2: Render Blueprint (Infrastructure-as-Code)

A `render.yaml` file is included in this repository.
1. Connect your repository to Render.
2. Go to **Blueprints** in Render and click **New Blueprint Instance**.
3. Select this repository. Render will automatically read `render.yaml` and configure the build and start commands.

---

## 💻 Running Locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Development mode (starts Express server with Vite middleware on http://localhost:3000):
   ```bash
   npm run dev
   ```

3. Build and test production:
   ```bash
   npm run build
   npm start
   ```

---

## ⚙️ Key Configuration

- **PORT**: The server automatically binds to `process.env.PORT` (used by Render and Cloud Run) or defaults to `3000`.
- **Backend API**:
  - `GET /api/health`: Health status endpoint.
  - `POST /api/tts`: Native Tamil voice synthesis audio engine.
