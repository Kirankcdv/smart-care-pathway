# 🏥 AI System for Adaptive Care Pathway Recommendation

### AI-Assisted Chronic Disease Management and Personalized Care Recommendations

The **AI System for Adaptive Care Pathway Recommendation in Chronic Disease Management** is a full-stack healthcare application designed to analyze patient information and vital measurements and provide ML-assisted care recommendations.

The system combines a React-based healthcare dashboard, FastAPI backend, MongoDB database, Random Forest machine-learning model, and Google Gemini API to provide patient-specific recommendations, explanations, personalized diet guidance, and historical health information.

---

## 🎯 Project Overview

Chronic diseases such as diabetes, hypertension, and cardiovascular diseases require continuous monitoring and personalized care.

This system provides a workflow where patient information and vital measurements are submitted through a web dashboard. The backend prepares the data and uses a trained machine-learning model to generate a care-action recommendation.

The recommendation is then passed to a generative AI layer that produces a natural-language explanation and personalized diet guidance.

Patient information and historical vitals are stored in MongoDB so that previous measurements and recommendation history can be reviewed over time.

---

## 🚀 Key Features

- 👤 Create and manage patient records
- 🩺 Enter patient vital measurements
- 📊 Visualize patient health history
- 🤖 ML-based care-pathway recommendation
- 🌳 Random Forest classification model
- 🧠 AI-generated explanation using Google Gemini
- 🥗 Personalized diet-plan generation
- 📈 Historical vitals tracking
- 📉 Chart-based health visualization
- ⚡ FastAPI REST APIs
- 🗄️ MongoDB persistent storage
- 🎨 React clinical dashboard
- 🔊 Text-to-speech support for AI explanations
- 🔄 End-to-end patient-to-recommendation workflow

---

## 🏗️ System Architecture

```text
                         ┌─────────────────────────┐
                         │     Patient / Doctor    │
                         │        Input            │
                         │                         │
                         │ • Patient Details       │
                         │ • Vital Measurements    │
                         └────────────┬────────────┘
                                      │
                                      ▼
                         ┌─────────────────────────┐
                         │     React Frontend      │
                         │   Clinical Dashboard    │
                         ├─────────────────────────┤
                         │ • Patient Management     │
                         │ • Vital Input            │
                         │ • Charts                 │
                         │ • Recommendation Card   │
                         │ • History                │
                         │ • AI Explanation         │
                         └────────────┬────────────┘
                                      │
                              HTTP / REST API
                                      │
                                      ▼
                         ┌─────────────────────────┐
                         │     FastAPI Backend     │
                         ├─────────────────────────┤
                         │ • Patient API             │
                         │ • Vitals API              │
                         │ • Recommendation API     │
                         │ • AI Explanation API     │
                         └────────────┬────────────┘
                                      │
                         ┌────────────┴────────────┐
                         │                         │
                         ▼                         ▼
              ┌─────────────────────┐   ┌─────────────────────┐
              │  Feature Preparation│   │      MongoDB        │
              │                     │   │                     │
              │ Patient + Vital     │   │ • Patient Records   │
              │ Feature Processing   │   │ • Vital History     │
              └──────────┬──────────┘   │ • Recommendations   │
                         │               └─────────────────────┘
                         ▼
              ┌─────────────────────────┐
              │    Random Forest Model  │
              ├─────────────────────────┤
              │ Patient Feature Data    │
              │           ↓             │
              │ Care-Action Prediction  │
              └────────────┬────────────┘
                           │
                           ▼
              ┌─────────────────────────┐
              │   Care Recommendation   │
              │                         │
              │ • Maintain Plan         │
              │ • Intensify Lifestyle   │
              │ • Adjust Medication     │
              │ • Refer Specialist      │
              └────────────┬────────────┘
                           │
                           ▼
              ┌─────────────────────────┐
              │    Google Gemini API    │
              ├─────────────────────────┤
              │ • Explanation           │
              │ • Patient-friendly text │
              │ • Diet Plan             │
              └────────────┬────────────┘
                           │
                           ▼
              ┌─────────────────────────┐
              │     Result Dashboard    │
              │                         │
              │ Recommendation          │
              │ Explanation             │
              │ Diet Guidance            │
              │ Health History            │
              └─────────────────────────┘
```

---

## 🔄 Application Flow

```text
┌──────────────────────┐
│ Patient / Doctor     │
│ Enters Patient Data  │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ React Clinical       │
│ Dashboard            │
└──────────┬───────────┘
           │
           │ HTTP Request
           ▼
┌──────────────────────┐
│ FastAPI Backend      │
│                      │
│ Patient / Vitals API │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Feature Preparation  │
│ & Validation         │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Random Forest        │
│ Recommendation Model │
└──────────┬───────────┘
           │
           ▼
┌──────────────────────┐
│ Care-Action          │
│ Recommendation       │
└──────────┬───────────┘
           │
           ├─────────────────────┐
           │                     │
           ▼                     ▼
┌──────────────────────┐  ┌──────────────────────┐
│ MongoDB              │  │ Google Gemini API    │
│                      │  │                      │
│ Store patient/vitals │  │ Generate explanation │
│ history              │  │ + diet guidance     │
└──────────────────────┘  └──────────┬───────────┘
                                     │
                                     ▼
                          ┌──────────────────────┐
                          │ React Dashboard      │
                          │                      │
                          │ Recommendation       │
                          │ Explanation          │
                          │ Diet Plan             │
                          │ History / Charts     │
                          └──────────────────────┘
```

---

## 🤖 Machine Learning Workflow

```text
                Patient Vital Measurements
                         │
                         ▼
                ┌──────────────────┐
                │ Feature          │
                │ Preparation      │
                └────────┬─────────┘
                         │
                         ▼
                ┌──────────────────┐
                │ Prediction       │
                │ Features         │
                └────────┬─────────┘
                         │
                         ▼
                ┌──────────────────┐
                │ Random Forest    │
                │ Classifier       │
                └────────┬─────────┘
                         │
                         ▼
                ┌──────────────────┐
                │ Care-Action      │
                │ Recommendation   │
                └────────┬─────────┘
                         │
             ┌───────────┼────────────┐
             │           │            │
             ▼           ▼            ▼
       Maintain Plan  Intensify   Adjust Medication
                     Lifestyle
                         │
                         ▼
                  Refer Specialist
```

---

## 🧠 AI Explanation Workflow

After the machine-learning model generates the care-action recommendation, the recommendation and patient information are passed to the generative AI layer.

```text
Random Forest Recommendation
             │
             ▼
      Patient Information
             │
             ▼
      Google Gemini API
             │
       ┌─────┴─────┐
       │           │
       ▼           ▼
 Explanation    Diet Plan
       │           │
       └─────┬─────┘
             ▼
     React Dashboard
             │
             ▼
      Patient-Friendly
          Output
```

The AI explanation is displayed using Markdown formatting and can also be read aloud through the browser's SpeechSynthesis API.

---

## 🧩 Main Components

### 🎨 Frontend

The frontend is implemented using React and provides a purpose-built clinical dashboard.

**Responsibilities:**

- Patient creation and loading
- Patient information entry
- Vital measurement entry
- Recommendation display
- Historical data visualization
- Chart rendering
- AI explanation display
- Diet-plan display
- Text-to-speech interaction

**Technologies:**

- React
- Vite
- JavaScript
- Chart.js
- HTML5
- CSS3

---

### ⚙️ Backend

The backend is implemented using Python FastAPI and exposes REST APIs for the application.

**Responsibilities:**

- Patient creation and retrieval
- Vital submission
- Recommendation generation
- ML model inference
- AI explanation generation
- Database communication
- Historical data retrieval

**Technologies:**

- Python
- FastAPI
- REST APIs

---

### 🌳 Machine Learning Model

The recommendation engine uses a trained **Random Forest classifier**.

The model processes patient features and generates a care-action recommendation.

The project uses the Pima dataset containing **768 records** and uses a serialized Random Forest model for runtime inference.

The trained model contains **614 training samples**, corresponding to a 614/154 train/test allocation.

---

### 🗄️ MongoDB

MongoDB is used as the persistent database layer.

It stores:

- Patient records
- Patient vital measurements
- Historical health information
- Recommendation information
- Vitals history

This allows the dashboard to retrieve previous measurements and display health trends over time.

---

### 🧠 Google Gemini Integration

Google Gemini is used as a generative AI layer after the machine-learning recommendation.

It generates:

- Natural-language explanation
- Patient-friendly reasoning
- Personalized diet guidance

The purpose of this layer is to make the ML recommendation easier for an end user to understand.

---

## 📊 Dataset and Model Development

The machine-learning workflow uses the Pima dataset containing **768 records**.

The project derives prediction features from the dataset and creates care-action labels using patient information including glucose level, BMI, and the original outcome field.

The recommendation model uses a Random Forest classifier.

```text
Pima Dataset
     │
     ▼
Data Preprocessing
     │
     ▼
Feature Preparation
     │
     ▼
Care-Action Label Engineering
     │
     ▼
Train / Test Data
     │
     ▼
Random Forest Training
     │
     ▼
Serialized Model
     │
     ▼
FastAPI Runtime Inference
```

The exact threshold rules used for generating the engineered care-action labels are not included in the available project documentation and are therefore not reproduced here.

---

## 🏥 Care Recommendation States

The project documentation describes the dashboard as presenting recommendation severity through states such as:

- 🟢 Stable
- 🟡 Monitor
- 🔴 Urgent

The detailed ML report additionally describes four engineered care-action classes:

- Maintain Plan
- Intensify Lifestyle
- Adjust Medication
- Refer Specialist

These represent different layers of the implemented system: the dashboard presents an understandable recommendation/severity state, while the ML report documents the engineered care-action classification used by the recommendation model.

---

## 📈 Patient History

The system stores patient vitals and historical information in MongoDB.

The frontend can use this information to display health trends through charts.

The documented implementation includes Chart.js visualization for measurements such as:

- Glucose
- BMI

```text
Patient
   │
   ▼
New Vital Measurement
   │
   ▼
FastAPI
   │
   ▼
MongoDB
   │
   ├──────── Previous Vitals
   │
   └──────── New Vital
              │
              ▼
       History Timeline
              │
              ▼
        Chart.js Graph
```

---

## 📁 Project Structure

```text
smart-care-pathway/
│
├── frontend/
│   ├── ...
│   └── ...
│
├── backend/
│   ├── ...
│   └── ...
│
├── model/
│   ├── ...
│   └── ...
│
├── dataset/
│   └── ...
│
├── README.md
│
└── ...
```

The documented project uses separate frontend and backend components. The exact complete file tree is not reproduced where it was not available in the supplied documentation.

---

## 🛠️ Technology Stack

| Layer | Technology |
|------|------------|
| Frontend | React |
| Frontend Build Tool | Vite |
| Visualization | Chart.js |
| Backend | Python |
| API Framework | FastAPI |
| Database | MongoDB |
| Machine Learning | Scikit-learn |
| ML Model | Random Forest |
| Data Processing | Pandas |
| Numerical Processing | NumPy |
| Generative AI | Google Gemini API |
| Text-to-Speech | Browser SpeechSynthesis |
| Version Control | Git |
| Repository | GitHub |

---

## 🔌 API Workflow

```text
React Frontend
      │
      ├──────────────► Patient API
      │
      ├──────────────► Vitals API
      │
      ├──────────────► Recommendation API
      │
      └──────────────► AI Explanation API
                             │
                             ▼
                      FastAPI Backend
                             │
                 ┌───────────┴───────────┐
                 │                       │
                 ▼                       ▼
          Random Forest              Gemini API
             Model                      │
                 │                       │
                 └───────────┬───────────┘
                             ▼
                         Response
                             │
                             ▼
                      React Dashboard
```

---

## 🔄 End-to-End Workflow

```text
Create Patient
      │
      ▼
Enter Patient Information
      │
      ▼
Enter Vital Measurements
      │
      ▼
FastAPI Receives Request
      │
      ▼
Prepare ML Features
      │
      ▼
Random Forest Prediction
      │
      ▼
Care-Action Recommendation
      │
      ├──────────────► Store Result in MongoDB
      │
      ▼
Gemini Explanation
      │
      ▼
Personalized Diet Guidance
      │
      ▼
Display Recommendation
      │
      ▼
Review Patient History
      │
      ▼
View Charts and Previous Vitals
```

---

## ▶️ Getting Started

### Clone the Repository

```bash
git clone https://github.com/dheerajD18/smart-care-pathway.git
cd smart-care-pathway
```

### Backend

```bash
cd backend
pip install -r requirements.txt
```

Start the FastAPI application using the project's configured startup command.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Make sure MongoDB is running and the required environment variables for the backend and Gemini integration are configured according to the project setup.

---

## 🔐 Current Implementation and Future Work

The current implementation is a functional prototype demonstrating the complete flow from patient creation to recommendation and history review.

The documented future work includes:

- 🔐 User authentication
- 🔑 JWT-based authentication
- 🚀 Application deployment
- 🛡️ Additional security hardening
- 🏥 Enhanced clinical decision-support capabilities

---

## 🧪 Testing

The documented implementation has been verified through the end-to-end application flow:

```text
Create Patient
      ↓
Enter Vitals
      ↓
Get Recommendation
      ↓
View Result
      ↓
Review History
```

The React dashboard and FastAPI backend were used to verify the working flow.

---

## 📊 Project Highlights

- Full-stack healthcare application
- Machine-learning-based recommendation engine
- Random Forest classification
- FastAPI REST backend
- React clinical dashboard
- MongoDB historical data storage
- Google Gemini AI explanation layer
- Personalized diet guidance
- Chart.js health visualization
- Browser text-to-speech support
- Patient history tracking
- End-to-end recommendation workflow

---

## 🎯 Project Objective

The objective of this project is to provide a technology-driven approach for adaptive chronic disease management by combining patient data, machine learning, persistent health history, and generative AI.

The system demonstrates how a full-stack application can collect patient information, process vital measurements, generate care recommendations, explain those recommendations in natural language, and retain historical information for future review.

---

## 📚 Learning Outcomes

Through this project, the following concepts were implemented and demonstrated:

- Full-stack web application development
- React frontend development
- FastAPI backend development
- REST API design
- MongoDB database integration
- Machine-learning model integration
- Random Forest classification
- Data preprocessing
- Feature engineering
- Generative AI integration
- Google Gemini API integration
- Patient history management
- Data visualization using Chart.js
- Browser SpeechSynthesis
- Git and GitHub workflow

---

## 🔗 Repository

GitHub:

https://github.com/dheerajD18/smart-care-pathway

---

## ⭐ Support

If you find this project useful, consider giving the repository a star ⭐

---

## 📄 License

This project is intended for educational, development, research, and demonstration purposes.
