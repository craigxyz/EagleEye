import asyncio
import time
import numpy as np
import cv2
from ultralytics import YOLO

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# A mapping from class ID to class name
CLASS_NAMES = {
    0: 'Person', 1: 'Bicycle', 2: 'Car', 3: 'Motorcycle', 5: 'Bus', 7: 'Truck'
}
# The class IDs to track
CLASSES_TO_TRACK = [0, 1, 2, 3, 5, 7]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load YOLO model
model = YOLO('yolov8s.pt')

clients = set()
frame_skip = 2  # Process every 2nd frame
frame_count = 0
track_history = {} # {id: {first_seen: ts, last_conf: conf}}

@app.websocket("/ws_upload")
async def websocket_upload(websocket: WebSocket):
    await websocket.accept()
    global frame_count
    try:
        while True:
            jpeg_data = await websocket.receive_bytes()
            frame_count += 1
            if frame_count % frame_skip != 0:
                continue

            frame = cv2.imdecode(np.frombuffer(jpeg_data, np.uint8), cv2.IMREAD_COLOR)

            # Perform inference with tracking
            res = model.track(frame, conf=0.25, persist=True, verbose=False, classes=CLASSES_TO_TRACK)
            
            boxes_payload = []
            if res[0].boxes.id is not None:
                boxes = res[0].boxes.xyxy.cpu().numpy()
                confs = res[0].boxes.conf.cpu().numpy()
                track_ids = res[0].boxes.id.int().cpu().tolist()
                class_ids = res[0].boxes.cls.int().cpu().tolist()

                current_time = time.time()
                
                for box, track_id, conf, cls_id in zip(boxes, track_ids, confs, class_ids):
                    x1, y1, x2, y2 = map(float, box)
                    conf_float = float(conf)
                    
                    boxes_payload.append([x1, y1, x2, y2, track_id, conf_float, cls_id])

                    if track_id not in track_history:
                        track_history[track_id] = {
                            "first_seen": current_time, 
                            "last_conf": conf_float,
                            "class_name": CLASS_NAMES.get(cls_id, 'Object')
                        }
                    else:
                        track_history[track_id]["last_conf"] = conf_float
                
            payload = {"ts": time.time(), "boxes": boxes_payload}
            
            # Broadcast to all connected clients
            for client in clients:
                await client.send_json(payload)

    except WebSocketDisconnect:
        print("Upload websocket disconnected")
    except Exception as e:
        print(f"Error in upload websocket: {e}")


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    clients.add(websocket)
    try:
        # Send track history for initial state
        await websocket.send_json({"track_history": track_history})
        while True:
            # Keep connection open to send detection updates
            await websocket.receive_text()
    except WebSocketDisconnect:
        clients.remove(websocket)
        print("Detection websocket disconnected")

@app.get("/track_history")
async def get_track_history():
    return track_history

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000) 