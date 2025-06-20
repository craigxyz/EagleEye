# EagleEye Live Object Detection

This project is a demonstration of live object detection from a built-in webcam, displayed in a browser.

## Architecture

- **Frontend**: React, Vite, Material-UI
- **Backend**: Python, FastAPI, WebSockets
- **Object Detection**: YOLOv8n
- **Object Tracking**: ByteTrack

## Setup and Run

### Backend

1.  Navigate to the `backend` directory:
    ```bash
    cd backend
    ```
2.  Create a Python virtual environment and activate it:
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    ```
3.  Install the required Python packages:
    ```bash
    pip install -r requirements.txt
    ```
4.  Start the backend server:
    ```bash
    python main.py
    ```

### Frontend

1.  Navigate to the `frontend` directory:
    ```bash
    cd frontend
    ```
2.  Install the required npm packages:
    ```bash
    npm install
    ```
3.  Start the frontend development server:
    ```bash
    npm run dev
    ```

After starting both the backend and frontend servers, open your browser to the address provided by the `npm run dev` command (usually `http://localhost:5173`).
You may need to grant camera and location permissions in your browser for all features to work correctly.
The application will display a live feed from your webcam with bounding boxes for any detected objects. You can click on the hamburger menu to view a list of tracked objects, see their captured images, and view their approximate location on a minimap. 