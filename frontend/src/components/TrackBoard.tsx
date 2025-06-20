import React from 'react';
import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  Typography,
  List,
  ListItem,
  ListItemText,
  Chip,
  Divider,
  ListItemButton,
  Button,
  ListItemAvatar,
  Avatar,
  CardMedia,
} from '@mui/material';
import { Track } from '../hooks/useDetections';
import { PhotoCamera } from '@mui/icons-material';

type TrackBoardProps = {
  selectedId: number | null;
  tracks: Map<number, Track>;
  onSelectTrack: (id: number | null) => void;
};

const TrackBoard: React.FC<TrackBoardProps> = ({
  selectedId,
  tracks,
  onSelectTrack,
}) => {
  const sortedTracks = Array.from(tracks.values()).sort(
    (a, b) => b.first_seen - a.first_seen
  );

  const selectedTrack = selectedId ? tracks.get(selectedId) : null;

  if (selectedTrack) {
    return (
      <Card raised>
        {selectedTrack.image && (
          <CardMedia
            component="img"
            height="194"
            image={selectedTrack.image}
            alt={`Detected ${selectedTrack.class_name}`}
            sx={{ objectFit: 'contain', p: 1 }}
          />
        )}
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h5" component="div">
              Track Details: #{selectedTrack.id}
            </Typography>
            <Button size="small" onClick={() => onSelectTrack(null)}>Back</Button>
          </Box>
          <Divider sx={{ my: 2 }} />
          <Chip
            label={selectedTrack.class_name}
            color="primary"
            variant="outlined"
            sx={{ mb: 2 }}
          />
          <List dense>
            <ListItem disableGutters>
              <ListItemText
                primary={`Age: ${selectedTrack.age.toFixed(1)}s`}
                secondary={`Confidence: ${(
                  selectedTrack.last_conf * 100
                ).toFixed(2)}%`}
              />
            </ListItem>
          </List>
        </CardContent>
      </Card>
    );
  }

  if (sortedTracks.length === 0) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          p: 3,
        }}
      >
        <CircularProgress />
        <Typography sx={{ mt: 2 }}>
          Waiting for object detections...
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h6" gutterBottom>
        Live Object Tracks
      </Typography>
      <List>
        {sortedTracks.map((track) => (
          <ListItem key={track.id} disablePadding>
            <ListItemButton
              selected={selectedId === track.id}
              onClick={() => onSelectTrack(track.id)}
            >
              <ListItemAvatar>
                <Avatar variant="square" src={track.image || undefined}>
                  <PhotoCamera />
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={`ID: ${track.id}`}
                secondary={
                  <Box
                    component="span"
                    sx={{ display: 'flex', alignItems: 'center', mt: 1 }}
                  >
                    <Chip
                      label={track.class_name}
                      size="small"
                      color="secondary"
                      variant="outlined"
                    />
                    <Typography
                      variant="caption"
                      sx={{ ml: 2, color: 'text.secondary' }}
                    >
                      Age: {track.age.toFixed(1)}s
                    </Typography>
                  </Box>
                }
                secondaryTypographyProps={{ component: 'div' }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );
};

export default TrackBoard; 