# VectorVision: Linear Algebra Studio
**An interactive web engine for matrix-based image reconstruction, compression, and upscaling.**

Built for the **Linear Algebra CIA-III Mini Project** at Christ University.

## 📌 Project Overview
VectorVision is a full-stack mathematical tool that demonstrates how digital images can be manipulated purely through linear algebra and vector space operations. It processes images as numerical tensors, applying core mathematical theorems to achieve real-time lossy compression and dynamic upscaling.

### Core Mathematical Concepts Implemented:
1. **Singular Value Decomposition (SVD):** Decomposes an image matrix ($A = U \Sigma V^T$) to perform rank-truncated compression, drastically reducing file size by dropping low-variance singular vectors while preserving structural energy.
2. **Bilinear Vector Interpolation:** Calculates continuous linear combinations between discrete spatial pixel vectors to accurately estimate new values when upscaling an image up to 2.0x.

---

## 🛠️ Tech Stack & Architecture

### Backend (The Math Engine)
* **Python 3 & FastAPI:** Handles routing and server requests.
* **NumPy:** Executes all raw tensor/matrix calculations and algebraic decompositions.
* **Pillow (PIL):** Converts incoming image files into mathematical arrays and reconstructs them post-transformation.
* **Hosted on:** Render.com

### Frontend (The Visualizer)
* **React & Vite:** Provides a fast, single-page application framework.
* **Tailwind CSS v4:** Powers the dark-mode "hacker workstation" aesthetic.
* **Lucide React:** Supplies the scalable vector icons.
* **Hosted on:** Render.com (Static Site)

---

## 🚀 Live Demo
Access the live mathematical workstation here:
**https://vectorvision.onrender.com/**

*(Note: The free Render backend spins down after inactivity. The first transformation might take 30-60 seconds to wake up the server.)*

---

## 💻 Local Installation & Setup
If you want to run VectorVision locally on your machine, follow these steps:

### Prerequisites
* Python 3.10+
* Node.js v18+ & npm

### 1. Start the Backend
Navigate to the backend directory, install the required mathematical packages, and start the Uvicorn server:
\`\`\`bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
\`\`\`
*The backend will now be running on `http://localhost:8000`.*

### 2. Start the Frontend
Open a new terminal window, navigate to the frontend directory, install the Vite/React dependencies, and start the development server:
\`\`\`bash
cd frontend
npm install
npm run dev
\`\`\`
*The frontend will now be running on `http://localhost:5173`.*

---

## 📊 Features & UI Highlights
* **Dual Operation Modes:** Toggle instantly between SVD Matrix Compression and Bilinear Vector Upscaling.
* **Target Payload Calculation:** Input a desired file size (KB), and the algorithm will algebraically back-calculate the optimal matrix rank $k$ to hit that constraint.
* **Live System Console:** A terminal output window that streams the mathematical steps in real-time (e.g., matrix sizing, SVD calculations, variance retention percentages).
* **Tensor Visualization:** Side-by-side comparison of the original input matrix and the reconstructed output matrix.

---

## 📚 Academic Context
This project serves as the final submission for the CIA-III Linear Algebra evaluation. The accompanying 6-part academic report detailing the mathematical proofs, Eckart–Young–Mirsky theorem applications, and computational analysis can be found in the project submissions portal.
