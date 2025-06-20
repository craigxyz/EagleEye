import cv2
import time
import numpy as np
from multiprocessing import Queue
from metavision_core.event_io import EventsIterator
from metavision_sdk_core import BaseFrameGenerationAlgorithm

class Camera:
    def __init__(self, source, queue):
        self.source = source
        self.queue = queue
        self.homography_matrix = None

    def load_homography(self, path):
        try:
            self.homography_matrix = np.load(path)
        except FileNotFoundError:
            print(f"Warning: Homography matrix not found at {path}")
            self.homography_matrix = np.identity(3)

    def run(self):
        raise NotImplementedError("Subclasses must implement this method")

    def _warp_and_send(self, frame):
        if self.homography_matrix is not None:
            # Note: Ensure the output size matches what you expect.
            # You might need to adjust the shape based on a reference frame.
            warped_frame = cv2.warpPerspective(frame, self.homography_matrix, (frame.shape[1], frame.shape[0]))
            self.queue.put(warped_frame)
        else:
            self.queue.put(frame)


class RGBCamera(Camera):
    def run(self):
        cap = cv2.VideoCapture(self.source)
        if not cap.isOpened():
            print(f"Error: Could not open RGB camera at source {self.source}")
            return
            
        # self.load_homography("/media/ssd/TRIAIR/rgb-therm_homography_matrix.npy") # Example path
        
        while True:
            ret, frame = cap.read()
            if not ret:
                print("Error: RGB camera disconnected.")
                break
            self.queue.put(frame) # For now, send raw frame
            time.sleep(1/30) # Limit to ~30fps


class ThermalCamera(Camera):
    def run(self):
        cap = cv2.VideoCapture(self.source)
        if not cap.isOpened():
            print(f"Error: Could not open Thermal camera at source {self.source}")
            return
            
        self.load_homography("/media/ssd/TRIAIR/therm-rgb_homography_matrix.npy")

        while True:
            ret, frame = cap.read()
            if not ret:
                print("Error: Thermal camera disconnected.")
                break
            self._warp_and_send(frame)
            time.sleep(1/30) # Limit to ~30fps


class EventCamera(Camera):
    def __init__(self, source, queue, **kwargs):
        super().__init__(source, queue)
        self.window = kwargs.get('window', 5000)
    
    def run(self):
        try:
            mv_iterator = EventsIterator(input_path=self.source, delta_t=33333)
            height, width = mv_iterator.get_size()
        except Exception as e:
            print(f"Error: Could not open Event camera. {e}")
            return

        self.load_homography("/media/ssd/TRIAIR/e-rgb_homography_matrix.npy")
        
        for evs in mv_iterator:
            image = np.zeros((height, width, 3), dtype=np.uint8)
            BaseFrameGenerationAlgorithm.generate_frame(evs, image, accumulation_time_us=self.window)
            self._warp_and_send(image)

def run_camera(camera_class, source, queue, **kwargs):
    cam = camera_class(source, queue, **kwargs)
    cam.run() 