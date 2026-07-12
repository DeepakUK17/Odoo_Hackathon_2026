# AssetFlow - Enterprise Asset Intelligence

**🚀 Live Frontend URL:** [**https://odoo-hackathon-2026-lac.vercel.app/**](https://odoo-hackathon-2026-lac.vercel.app/)  
**⚙️ Live Backend URL:** [**https://odoo-hackathon-2026-iyjk.onrender.com/**](https://odoo-hackathon-2026-iyjk.onrender.com/)

*Built for the Odoo Hackathon 2026*

---

## 📖 Overview

**AssetFlow** is a next-generation Enterprise Asset Management platform. Traditional asset management is static, slow, and heavily disconnected. AssetFlow changes that by introducing a fully **real-time, WebSocket-powered ecosystem** wrapped in a premium, responsive UI. 

Whether an employee is reporting a broken laptop, or an IT administrator is running a quarterly compliance audit, AssetFlow ensures every stakeholder is connected and updated instantly—without ever needing to refresh the page.

---

## 🔑 Quick Evaluator Access (Demo Logins)

To evaluate the platform, simply go to the **Live Frontend URL** and click any of the "Quick Demo Login" buttons on the login page. The database is pre-seeded with comprehensive mock data.

| Role | Email | Password | Permissions / View |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@technova.com` | `password123` | Full system access, all audits, all maintenance tickets. |
| **Asset Manager** | `manager@technova.com` | `password123` | Manage allocations, audits, and hardware inventory. |
| **Dept Head** | `dept.head@technova.com` | `password123` | Can view and approve transfers within their department. |
| **Employee** | `sneha@technova.com` | `password123` | Can only view assets assigned to them, verify their own audits, and raise maintenance tickets. |

*(Note: Passwords are automatically filled if you click the Quick Demo buttons on the login screen).*

---

## ✨ Key Features & Innovations

### 1. Real-Time Interactions (WebSockets)
AssetFlow is built around real-time bidirectional communication. If an employee drags a maintenance ticket to "In Progress" on the Kanban board, the IT Administrator's dashboard updates in milliseconds without a page refresh.

### 2. Smart, Decentralized Audits
Auditing is traditionally a top-down nightmare. AssetFlow decentralizes it. When an audit is triggered, employees log into their personal dashboards to securely self-verify the assets assigned to them. Missing or damaged assets are immediately flagged to administration. 

### 3. Gemini AI Assistant Integration
A context-aware AI chatbot is built directly into the workspace. Users can ask natural language questions like *"What is the status of asset AF-0004?"* or *"Show me all overdue laptops."* The AI understands the database schema and streams live operational data back to the user instantly.

### 4. Interactive Maintenance Kanban
No more messy email chains for broken hardware. A visual drag-and-drop Kanban board allows seamless tracking of maintenance requests, prioritized strictly by roles.

### 5. Premium, Modern UI/UX
Designed with a "Glassmorphism" aesthetic, curated dark-mode color palettes, micro-animations, and smooth transitions to create an enterprise application that users actually *want* to use.

---

## 🛠️ Technology Stack

**Frontend:**
- React 18 + Vite
- React Router DOM (Single Page Application Routing)
- Vanilla CSS (Custom Design System, CSS Variables, Glassmorphism)
- Socket.io-client (Real-time events)
- Axios (HTTP client)

**Backend:**
- Node.js & Express.js
- Socket.io (WebSocket server)
- PostgreSQL (via `pg` raw SQL queries)
- Neon Serverless Postgres (Database hosting)
- JWT (JSON Web Tokens for secure authentication)
- Google Generative AI (`@google/genai` for chatbot)

---

## ⚙️ Running Locally

If you wish to run the project locally rather than using the live links, follow these steps:

### 1. Clone the repository
```bash
git clone https://github.com/DeepakUK17/Odoo_Hackathon_2026.git
cd Odoo_Hackathon_2026
```

### 2. Setup the Backend
```bash
cd backend
npm install
```
Create a `.env` file in the `backend` directory with:
```env
PORT=5000
DATABASE_URL=your_neon_postgres_url
JWT_SECRET=your_jwt_secret
GEMINI_API_KEY=your_google_gemini_api_key
FRONTEND_URL=http://localhost:5173
```
Run the server:
```bash
npm run dev
```

### 3. Setup the Frontend
```bash
cd ../frontend
npm install
```
Create a `.env` file in the `frontend` directory with:
```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```
Run the frontend:
```bash
npm run dev
```
The application will be available at `http://localhost:5173`.

---
*Built with ❤️ for Odoo Hackathon 2026*
