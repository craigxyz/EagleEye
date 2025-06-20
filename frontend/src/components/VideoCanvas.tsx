import React, { useRef, useEffect, useState } from 'react';
import { Alert, AlertTitle, Box } from '@mui/material';
import { Box as DetectionBox, Track } from '../hooks/useDetections';
import { useSettings } from '../contexts/SettingsContext';

type ViewMode = 'fusion' | 'rgb' | 'thermal' | 'event';

const HEATMAP_GRID_SIZE = 20;

// [x1, y1, x2, y2, track_id, conf, class_id]
type Box = [number, number, number, number, number, number, number];

const CLASS_NAMES: { [key: number]: string } = {
  0: 'Person', 1: 'Bicycle', 2: 'Car', 3: 'Motorcycle', 5: 'Bus', 7: 'Truck'
};

type VideoCanvasProps = {
  onBoxClick: (id: number) => void;
  boxes: DetectionBox[];
  tracks: Map<number, Track>;
  onImageCapture: (trackId: number, dataUrl: string) => void;
  viewMode: ViewMode;
  heatmap: number[];
};

const VideoCanvas: React.FC<VideoCanvasProps> = ({ onBoxClick, boxes, tracks, onImageCapture, viewMode, heatmap }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxesRef = useRef<DetectionBox[]>([]);
  const imagedTrackIds = useRef(new Set<number>());
  const [videoError, setVideoError] = useState<string | null>(null);
  const { settings } = useSettings();

  useEffect(() => {
    boxesRef.current = boxes.filter(box => box[5] >= settings.confidenceThreshold);
  }, [boxes, settings.confidenceThreshold]);

  useEffect(() => {
    if (!videoRef.current || videoRef.current.videoWidth === 0 || !onImageCapture) return;

    tracks.forEach(track => {
      if (!track.image && !imagedTrackIds.current.has(track.id)) {
        const box = boxes.find(b => b[4] === track.id);
        if (box) {
          const [x1, y1, x2, y2] = box;
          const cropCanvas = document.createElement('canvas');
          const cropCtx = cropCanvas.getContext('2d');
          const width = x2 - x1;
          const height = y2 - y1;
          
          if (width > 0 && height > 0 && videoRef.current) {
            cropCanvas.width = width;
            cropCanvas.height = height;
            cropCtx?.drawImage(videoRef.current, x1, y1, width, height, 0, 0, width, height);
            const dataUrl = cropCanvas.toDataURL('image/jpeg');
            onImageCapture(track.id, dataUrl);
            imagedTrackIds.current.add(track.id);
          }
        }
      }
    });
  }, [tracks, boxes, onImageCapture]);

  useEffect(() => {
    // We no longer need to manage the video stream here,
    // as it will be handled by the direct WebSocket connection.
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const wsUrl = `ws://localhost:8000/ws/${viewMode === 'fusion' ? 'rgb' : viewMode}`;
    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'blob';

    ws.onopen = () => console.log(`${viewMode} WebSocket connected`);
    ws.onclose = () => console.log(`${viewMode} WebSocket disconnected`);
    ws.onerror = (err) => console.error(`${viewMode} WebSocket error:`, err);

    const ctx = canvas.getContext('2d');

    ws.onmessage = (event) => {
      if (typeof event.data === 'object' && ctx) {
        const image = new Image();
        image.src = URL.createObjectURL(event.data);
        image.onload = () => {
          canvas.width = image.width;
          canvas.height = image.height;
          ctx.drawImage(image, 0, 0);
          URL.revokeObjectURL(image.src);

          const scaleX = canvas.width / image.width;
          const scaleY = canvas.height / image.height;

          // Draw trails
          if (settings.showTrails && ['rgb', 'fusion'].includes(viewMode)) {
            tracks.forEach(track => {
              if (track.positions.length > 1) {
                ctx.beginPath();
                ctx.moveTo(track.positions[0].x * scaleX, track.positions[0].y * scaleY);
                for (let i = 1; i < track.positions.length; i++) {
                  const opacity = i / track.positions.length;
                  ctx.strokeStyle = `rgba(255, 255, 0, ${opacity * 0.8})`;
                  ctx.lineTo(track.positions[i].x * scaleX, track.positions[i].y * scaleY);
                  ctx.stroke();
                  ctx.beginPath();
                  ctx.moveTo(track.positions[i].x * scaleX, track.positions[i].y * scaleY);
                }
              }
            });
          }

          // Draw detections
          if (['rgb', 'fusion'].includes(viewMode)) {
            boxes.forEach(([x1, y1, x2, y2, id, conf, cls_id]) => {
              if (conf >= settings.confidenceThreshold) {
                ctx.strokeStyle = settings.boxColor;
                ctx.lineWidth = settings.boxThickness;
                ctx.strokeRect(x1 * scaleX, y1 * scaleY, (x2 - x1) * scaleX, (y2 - y1) * scaleY);
                
                if (settings.showLabels) {
                  ctx.fillStyle = settings.boxColor;
                  ctx.font = '16px sans-serif';
                  const label = `${CLASS_NAMES[cls_id] || 'Object'} ${id}`;
                  ctx.fillText(label, x1 * scaleX, y1 * scaleY - 10);
                }
              }
            });
          }

          // Draw heatmap
          if (viewMode === 'event') {
            const cellWidth = canvas.width / HEATMAP_GRID_SIZE;
            const cellHeight = canvas.height / HEATMAP_GRID_SIZE;
            for (let y = 0; y < HEATMAP_GRID_SIZE; y++) {
              for (let x = 0; x < HEATMAP_GRID_SIZE; x++) {
                const index = y * HEATMAP_GRID_SIZE + x;
                const heat = heatmap[index];
                if (heat > 0.01) {
                  ctx.fillStyle = `rgba(255, 100, 0, ${heat * 0.6})`;
                  ctx.fillRect(x * cellWidth, y * cellHeight, cellWidth, cellHeight);
                }
              }
            }
          }
        };
      }
    };

    return () => {
      ws.close();
    };
  }, [viewMode, settings, boxes, tracks, heatmap]);

  // Effect for the rendering loop
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const render = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      const videoAspectRatio = video.videoWidth / video.videoHeight;
      const canvasAspectRatio = canvas.width / canvas.height;
      let renderWidth, renderHeight, xStart, yStart;

      if (videoAspectRatio > canvasAspectRatio) {
        renderWidth = canvas.width;
        renderHeight = canvas.width / videoAspectRatio;
      } else {
        renderHeight = canvas.height;
        renderWidth = canvas.height * videoAspectRatio;
      }
      xStart = (canvas.width - renderWidth) / 2;
      yStart = (canvas.height - renderHeight) / 2;
      
      const scaleX = renderWidth / video.videoWidth;
      const scaleY = renderHeight / video.videoHeight;
      
      ctx.drawImage(video, xStart, yStart, renderWidth, renderHeight);
      
      // Draw trails
      if (settings.showTrails && ['rgb', 'fusion'].includes(viewMode)) {
        tracks.forEach(track => {
          if (track.positions.length > 1) {
            ctx.beginPath();
            ctx.moveTo(track.positions[0].x * scaleX + xStart, track.positions[0].y * scaleY + yStart);
            for (let i = 1; i < track.positions.length; i++) {
              const opacity = i / track.positions.length;
              ctx.strokeStyle = `rgba(255, 255, 0, ${opacity * 0.8})`; // Fading yellow
              ctx.lineTo(track.positions[i].x * scaleX + xStart, track.positions[i].y * scaleY + yStart);
              ctx.stroke();
              ctx.beginPath();
              ctx.moveTo(track.positions[i].x * scaleX + xStart, track.positions[i].y * scaleY + yStart);
            }
          }
        });
      }

      // Draw detections
      if (['rgb', 'fusion'].includes(viewMode)) {
        boxesRef.current.forEach(([x1, y1, x2, y2, id, conf, cls_id]) => {
          ctx.strokeStyle = settings.boxColor;
          ctx.lineWidth = settings.boxThickness;
          ctx.strokeRect(x1 * scaleX + xStart, y1 * scaleY + yStart, (x2 - x1) * scaleX, (y2 - y1) * scaleY);
          
          if (settings.showLabels) {
            ctx.fillStyle = settings.boxColor;
            ctx.font = '16px sans-serif';
            const label = `${CLASS_NAMES[cls_id] || 'Object'} ${id}`;
            ctx.fillText(label, x1 * scaleX + xStart, y1 * scaleY + yStart - 10);
          }
        });
      }

      // Draw heatmap if in Event mode
      if (viewMode === 'event') {
        const cellWidth = renderWidth / HEATMAP_GRID_SIZE;
        const cellHeight = renderHeight / HEATMAP_GRID_SIZE;

        for (let y = 0; y < HEATMAP_GRID_SIZE; y++) {
          for (let x = 0; x < HEATMAP_GRID_SIZE; x++) {
            const index = y * HEATMAP_GRID_SIZE + x;
            const heat = heatmap[index];
            if (heat > 0.01) { // Only draw if there's some heat
              ctx.fillStyle = `rgba(255, 100, 0, ${heat * 0.6})`; // Orange-red, semi-transparent
              ctx.fillRect(xStart + x * cellWidth, yStart + y * cellHeight, cellWidth, cellHeight);
            }
          }
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [settings, viewMode, heatmap, tracks]);

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.videoWidth === 0) return;

    const videoAspectRatio = video.videoWidth / video.videoHeight;
    const canvasAspectRatio = canvas.width / canvas.height;
    let renderWidth, renderHeight, xStart, yStart;

    if (videoAspectRatio > canvasAspectRatio) {
      renderWidth = canvas.width;
      renderHeight = canvas.width / videoAspectRatio;
    } else {
      renderHeight = canvas.height;
      renderWidth = canvas.height * videoAspectRatio;
    }
    xStart = (canvas.width - renderWidth) / 2;
    yStart = (canvas.height - renderHeight) / 2;
    const scaleX = renderWidth / video.videoWidth;
    const scaleY = renderHeight / video.videoHeight;

    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    for (const box of boxesRef.current) {
      const [x1, y1, x2, y2, id] = box;
      const boxX1 = x1 * scaleX + xStart;
      const boxY1 = y1 * scaleY + yStart;
      const boxX2 = x2 * scaleX + xStart;
      const boxY2 = y2 * scaleY + yStart;

      if (clickX >= boxX1 && clickX <= boxX2 && clickY >= boxY1 && clickY <= boxY2) {
        onBoxClick(id);
        break;
      }
    }
  };

  return (
    <Box sx={{ position: 'relative', width: '100%', height: '100%' }}>
      <video ref={videoRef} autoPlay playsInline muted style={{ display: 'none' }} />
      <canvas ref={canvasRef} onClick={handleCanvasClick} style={{ width: '100%', height: '100%' }} />
      {videoError && (
        <Box 
          sx={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            p: 2 
          }}
        >
          <Alert severity="error" variant="filled">
            <AlertTitle>Video Error</AlertTitle>
            {videoError}
          </Alert>
        </Box>
      )}
    </Box>
  );
};

export default VideoCanvas; 