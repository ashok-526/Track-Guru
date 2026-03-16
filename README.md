# Track Guru — Classroom Activity Analytics

A modern admin dashboard for tracking teacher sessions, verifying attendance with face recognition, and reviewing classroom activity reports.

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Demo Credentials

| Role         | Staff ID       | Password      |
|--------------|----------------|---------------|
| School Admin | `NGA-ADM-001`  | `password123` |

If Firebase is not configured, the app runs in seeded demo mode with sample teachers and schedules.

## Features

- **Dashboard** — Overview of today's schedule, verified session starts, teacher list, and recent session history.
- **Live Monitor** — Start face-verified sessions, watch the live camera feed with real-time face tracking (green bounding box), continuous screenshot capture, and a session timer. End session triggers AI-powered summary generation.
- **Teacher Registry** — Register teachers, manage profiles, and enroll face data with live face detection and duplicate prevention. The scanner shows a green tracking box for new faces and a red box with the enrolled name if the face already exists.
- **Reports** — Browse session logs per teacher with time filters, view activity timelines, AI summaries with expand/collapse, and export clean printable reports.
- **Profile** — View and update admin contact details.

## Tech Stack

| Layer       | Technology                                          |
|-------------|-----------------------------------------------------|
| Framework   | React 18, React Router 6                            |
| Build       | Vite 5                                              |
| Styling     | Tailwind CSS 3, custom design system (`#006CC4`)    |
| Animation   | Framer Motion                                       |
| Face AI     | face-api.js (TinyFaceDetector + FaceRecognitionNet) |
| Backend     | Firebase Auth, Firestore, Realtime DB, Storage      |
| PDF         | react-pdf                                           |
| Toasts      | react-hot-toast                                     |

## Project Structure

```
src/
├── components/
│   ├── layout/AppShell.jsx      # Sidebar + header shell
│   ├── ui/                      # Button, Card, Modal, Spinner
│   └── vision/                  # TeacherVisionSummary
├── context/
│   ├── AuthContext.jsx           # Auth state
│   └── AppDataContext.jsx        # App data + API actions
├── hooks/
│   └── useFaceRecognition.js    # Camera + face-api hook
├── lib/
│   └── faceRecognition.js       # Model loading + detector config
├── pages/
│   ├── LandingPage.jsx          # Login + marketing
│   ├── DashboardPage.jsx        # Main dashboard
│   ├── AttendancePage.jsx       # Live monitor + session management
│   ├── StudentRegistryPage.jsx  # Teacher registry + face enrollment
│   ├── ReportsPage.jsx          # Session reports + export
│   └── ProfilePage.jsx          # Admin profile
├── services/                    # Firebase + AI service layers
├── App.jsx                      # Routes
├── main.jsx                     # Entry point
└── index.css                    # Global styles + design tokens
```

## Scripts

| Command          | Description                  |
|------------------|------------------------------|
| `npm run dev`    | Start Vite dev server        |
| `npm run build`  | Production build to `dist/`  |
| `npm run preview`| Preview production build     |
| `npm run ai-server` | Start AI analysis server |

## Firebase Setup

1. Copy `.env.example` to `.env` and add your Firebase project keys.
2. Deploy Firestore, Storage, and Realtime Database rules from the `firebase/` directory.
3. Without Firebase config, the app defaults to seeded demo mode.

## Notes

- Face embeddings are stored as Float32Arrays in Firestore. No face images are persisted — only descriptors.
- Screenshot previews during live monitoring are held in component state and sent for AI analysis on session end.
- The `src/services/aiService.js` contains the OpenAI integration placeholder. For production, move the API call to a backend.
