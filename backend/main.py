import asyncio
import time
import numpy as np
import cv2
from ultralytics import YOLO
from multiprocessing import Process, Queue

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from cameras import RGBCamera, ThermalCamera, EventCamera, run_camera

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

detection_clients = set()
camera_clients = {"rgb": set(), "thermal": set(), "event": set()}
frame_queues = {"rgb": Queue(), "thermal": Queue(), "event": Queue()}

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
            for client in detection_clients:
                await client.send_json(payload)

    except WebSocketDisconnect:
        print("Upload websocket disconnected")
    except Exception as e:
        print(f"Error in upload websocket: {e}")

async def video_streamer(websocket: WebSocket, queue_name: str):
    await websocket.accept()
    camera_clients[queue_name].add(websocket)
    try:
        while True:
            await websocket.receive_text() # Keep connection open
    except WebSocketDisconnect:
        camera_clients[queue_name].remove(websocket)
        print(f"{queue_name} client disconnected")

@app.websocket("/ws/rgb")
async def websocket_rgb(websocket: WebSocket):
    await video_streamer(websocket, "rgb")

@app.websocket("/ws/thermal")
async def websocket_thermal(websocket: WebSocket):
    await video_streamer(websocket, "thermal")

@app.websocket("/ws/event")
async def websocket_event(websocket: WebSocket):
    await video_streamer(websocket, "event")

@app.websocket("/ws/detections")
async def websocket_detections(websocket: WebSocket):
    await websocket.accept()
    detection_clients.add(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        detection_clients.remove(websocket)
        print("Detection client disconnected")

async def broadcast_frames():
    while True:
        for cam_type, queue in frame_queues.items():
            if not queue.empty():
                frame = queue.get()
                
                # Encode frame to JPEG
                _, buffer = cv2.imencode('.jpg', frame)
                frame_bytes = buffer.tobytes()

                # Broadcast to respective camera clients
                for client in camera_clients[cam_type]:
                    await client.send_bytes(frame_bytes)
                
                # If it's the RGB camera, also run detection
                if cam_type == "rgb":
                    res = model.track(frame, conf=0.25, persist=True, verbose=False, classes=[2])
                    boxes_payload = []
                    if res[0].boxes.id is not None:
                        boxes = res[0].boxes.xyxy.cpu().numpy()
                        confs = res[0].boxes.conf.cpu().numpy()
                        track_ids = res[0].boxes.id.int().cpu().tolist()
                        class_ids = res[0].boxes.cls.int().cpu().tolist()
                        
                        for box, track_id, conf, cls_id in zip(boxes, track_ids, confs, class_ids):
                            x1, y1, x2, y2 = map(float, box)
                            boxes_payload.append([x1, y1, x2, y2, track_id, float(conf), cls_id])
                    
                    payload = {"ts": time.time(), "boxes": boxes_payload}
                    # Broadcast detections
                    for client in detection_clients:
                        await client.send_json(payload)

        await asyncio.sleep(1/60) # Limit broadcast rate

@app.on_event("startup")
async def startup_event():
    # Define camera sources
    camera_sources = {
        "rgb": 2,
        "thermal": 0,
        "event": "" # Set to a file path if you are using a recording
    }
    
    # Start camera processes
    camera_processes = [
        Process(target=run_camera, args=(RGBCamera, camera_sources["rgb"], frame_queues["rgb"])),
        Process(target=run_camera, args=(ThermalCamera, camera_sources["thermal"], frame_queues["thermal"])),
        Process(target=run_camera, args=(EventCamera, camera_sources["event"], frame_queues["event"],), kwargs={"window": 5000}),
    ]
    
    for p in camera_processes:
        p.start()
        
    # Start the frame broadcasting loop
    asyncio.create_task(broadcast_frames())

@app.get("/track_history")
async def get_track_history():
    return track_history

if __name__ == "__main__":
    import uvicorn
    # Note: Using reload=True is not recommended with multiprocessing on Windows.
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False) 