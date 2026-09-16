# Track Guru

**Classroom activity analytics with face-verified attendance.** An admin dashboard for tracking teacher sessions, verifying who actually started them, and reviewing what happened in the room.

[![Live demo](https://img.shields.io/badge/demo-trackguru.vercel.app-006CC4?style=flat-square)](https://trackguru.vercel.app/dashboard)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-Auth%20%C2%B7%20Firestore-FFCA28?style=flat-square&logo=firebase&logoColor=black)
![face-api.js](https://img.shields.io/badge/face--api.js-computer%20vision-0A7E8C?style=flat-square)

![Track Guru dashboard](Screenshot%202026-03-16%20at%2009.26.30.png)

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

These only work in seeded demo mode. If Firebase is not configured, the app boots with sample teachers and schedules so it can be evaluated without provisioning anything.

## Features

- **Dashboard** — Overview of today's schedule, verified session starts, teacher list, and recent session history.
- **Live Monitor** — Start face-verified sessions, watch the live camera feed with real-time face tracking (green bounding box), continuous screenshot capture, and a session timer. Ending a session triggers AI summary generation.
- **Teacher Registry** — Register teachers, manage profiles, and enroll face data with live detection and duplicate prevention. The scanner draws a green box for a new face, and a red box with the existing name if that person is already enrolled.
- **Reports** — Browse session logs per teacher with time filters, view activity timelines, expand or collapse AI summaries, and export printable reports.
- **Profile** — View and update admin contact details.

## Privacy

Face data is stored as **descriptors only**. Embeddings are persisted as Float32Arrays in Firestore and no face image is ever written to storage. Screenshot previews captured during live monitoring are held in component state and sent for analysis when the session ends, not retained.

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
│   ├── AuthContext.jsx          # Auth state
│   └── AppDataContext.jsx       # App data + API actions
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

| Command             | Description                 |
|---------------------|-----------------------------|
| `npm run dev`       | Start Vite dev server       |
| `npm run build`     | Production build to `dist/` |
| `npm run preview`   | Preview production build    |
| `npm run ai-server` | Start AI analysis server    |

## Firebase Setup

1. Copy `.env.example` to `.env` and add your Firebase project keys.
2. Deploy Firestore, Storage, and Realtime Database rules from the `firebase/` directory.
3. Without Firebase config, the app defaults to seeded demo mode.

## Known limitations

`src/services/aiService.js` holds an OpenAI integration placeholder that calls from the client. For production this belongs behind a backend so the key is never shipped to the browser.
