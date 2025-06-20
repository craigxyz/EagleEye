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
  const wsRef = useRef<WebSocket | null>(null);
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
    const startVideo = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setVideoError("Webcam access is not supported by this browser.");
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            width: { ideal: 3840 }, 
            height: { ideal: 2160 } 
          } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().then(() => {
            setVideoError(null);
          }).catch(e => {
            console.error("Video play failed:", e);
            setVideoError("Video playback failed. Please check browser permissions.");
          });
        }
      } catch (err) {
        console.error("Error accessing webcam:", err);
        setVideoError("Could not access the webcam. Please ensure it's not in use and that you've granted permission in your browser settings.");
      }
    };

    startVideo();

    wsRef.current = new WebSocket('ws://localhost:8000/ws_upload');
    wsRef.current.onopen = () => console.log('Upload WebSocket connected');
    wsRef.current.onclose = () => console.log('Upload WebSocket disconnected');
    wsRef.current.onerror = (err) => console.error('Upload WebSocket error:', err);
    const uploadWs = wsRef.current;

    const sendFrame = () => {
      if (videoRef.current && videoRef.current.readyState === 4 && uploadWs.readyState === WebSocket.OPEN) {
        const offscreenCanvas = document.createElement('canvas');
        offscreenCanvas.width = videoRef.current.videoWidth;
        offscreenCanvas.height = videoRef.current.videoHeight;
        const ctx = offscreenCanvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(videoRef.current, 0, 0, offscreenCanvas.width, offscreenCanvas.height);
          offscreenCanvas.toBlob((blob) => {
            if (blob && uploadWs.readyState === WebSocket.OPEN) {
              uploadWs.send(blob);
            }
          }, 'image/jpeg', 0.8);
        }
      }
    };

    const frameInterval = window.setInterval(sendFrame, 1000 / 15);

    return () => {
      clearInterval(frameInterval);
      if (uploadWs.readyState === WebSocket.OPEN || uploadWs.readyState === WebSocket.CONNECTING) {
        uploadWs.close();
      }
      if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      }
    };
  }, []);

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