import { useState, useEffect, useRef } from 'react';

export type Box = [number, number, number, number, number, number, number];

export type Track = {
  id: number;
  class_id: number;
  class_name: string;
  first_seen: number;
  last_conf: number;
  age: number;
  image: string | null;
  positions: { x: number; y: number }[];
  last_seen_timestamp: number;
};

export type ConnectionStatus = 'connecting' | 'open' | 'closed';

const CLASS_NAMES: { [key: number]: string } = {
  0: 'Person',
  1: 'Bicycle',
  2: 'Car',
  3: 'Motorcycle',
  5: 'Bus',
  7: 'Truck',
};

const HEATMAP_GRID_SIZE = 20;
const HEATMAP_DECAY_RATE = 0.95;
const HEATMAP_UPDATE_INTERVAL = 1000; // ms

export const useDetections = () => {
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [tracks, setTracks] = useState<Map<number, Track>>(new Map());
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const [heatmap, setHeatmap] = useState(() => new Array(HEATMAP_GRID_SIZE * HEATMAP_GRID_SIZE).fill(0));
  const heatmapIntervalRef = useRef<number>(0);

  // Effect for decaying heatmap values
  useEffect(() => {
    heatmapIntervalRef.current = window.setInterval(() => {
      setHeatmap(prevHeatmap => prevHeatmap.map(v => v * HEATMAP_DECAY_RATE));
    }, HEATMAP_UPDATE_INTERVAL);

    return () => {
      if (heatmapIntervalRef.current) {
        clearInterval(heatmapIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const detectionWs = new WebSocket('ws://localhost:8000/ws/detections');
    setConnectionStatus('connecting');

    detectionWs.onopen = () => {
      console.log('Detection WebSocket connected');
      setConnectionStatus('open');
    };
    detectionWs.onclose = () => {
      console.log('Detection WebSocket disconnected');
      setConnectionStatus('closed');
    };
    detectionWs.onerror = (err) => {
      console.error('Detection WebSocket error:', err)
      setConnectionStatus('closed');
    };

    detectionWs.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.boxes && Array.isArray(data.boxes)) {
          const newBoxes: Box[] = data.boxes;
          setBoxes(newBoxes);
          const now = data.ts || Date.now() / 1000;
          
          setTracks((prevTracks) => {
            const newTracks = new Map(prevTracks);
            const activeTrackIds = new Set<number>();

            newBoxes.forEach((box: Box) => {
              const [x1, y1, x2, y2, id, conf, cls_id] = box;
              const centerX = (x1 + x2) / 2;
              const centerY = (y1 + y2) / 2;
              activeTrackIds.add(id);

              const existingTrack = newTracks.get(id);
              if (existingTrack) {
                existingTrack.last_conf = conf;
                existingTrack.age = now - existingTrack.first_seen;
                existingTrack.positions.push({ x: centerX, y: centerY });
                if (existingTrack.positions.length > 50) { // Limit trail length
                  existingTrack.positions.shift();
                }
                existingTrack.last_seen_timestamp = now;
              } else {
                newTracks.set(id, {
                  id,
                  class_id: cls_id,
                  class_name: CLASS_NAMES[cls_id] || 'Object',
                  first_seen: now,
                  last_conf: conf,
                  age: 0,
                  image: null,
                  positions: [{ x: centerX, y: centerY }],
                  last_seen_timestamp: now,
                });
              }
            });

            // Remove old, inactive tracks
            for (const [id, track] of newTracks.entries()) {
              if (!activeTrackIds.has(id) && (now - track.last_seen_timestamp > 3)) {
                newTracks.delete(id);
              }
            }

            return newTracks;
          });

          // Update heatmap
          setHeatmap(prevHeatmap => {
            const newHeatmap = [...prevHeatmap];
            newBoxes.forEach(box => {
              const xCenter = (box[0] + box[2]) / 2;
              const yCenter = (box[1] + box[3]) / 2;
              
              const gridX = Math.floor((xCenter / 640) * HEATMAP_GRID_SIZE);
              const gridY = Math.floor((yCenter / 480) * HEATMAP_GRID_SIZE);
              
              if (gridX >= 0 && gridX < HEATMAP_GRID_SIZE && gridY >= 0 && gridY < HEATMAP_GRID_SIZE) {
                const index = gridY * HEATMAP_GRID_SIZE + gridX;
                newHeatmap[index] = Math.min(1, newHeatmap[index] + 0.1);
              }
            });
            return newHeatmap;
          });
        }
      } catch (error) {
        console.error('Error processing WebSocket message:', error);
      }
    };

    return () => {
      detectionWs.close();
    };
  }, []);

  return { boxes, tracks, setTracks, connectionStatus, heatmap };
}; 