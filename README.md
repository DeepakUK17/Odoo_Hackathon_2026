# AssetFlow - Enterprise Asset Intelligence

AssetFlow is a comprehensive, full-stack Enterprise Asset Management (EAM) system powered by generative AI (Google Gemini). It tracks organizational assets, predicts maintenance needs, manages allocations, and audits system usage.

## Tech Stack
- **Frontend:** React, Vite, Chart.js, Socket.io-client
- **Backend:** Node.js, Express, Socket.io, Google Gemini API
- **Database:** PostgreSQL (Neon Serverless Database)

## Key Features
1. **Asset Management:** End-to-end tracking of assets with QR codes.
2. **AI-Powered Insights:** Uses Gemini API for predictive maintenance, chat assistance, and risk detection.
3. **Allocations & Booking:** Assign assets or book shared resources in real time.
4. **Kanban Maintenance:** Visual drag-and-drop board for repair management.
5. **Real-time Notifications:** Socket.io based alerts for overdue returns and warranties.
6. **Universal Exports:** Export any module to styled Excel files dynamically.

## Getting Started

### Backend
```bash
cd backend
npm install
npm run migrate
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```
