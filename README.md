# Karaokio 🎤

AI-powered karaoke queue system that transforms any song into karaoke with vocal separation and synchronized lyrics.

## Features

### 🎵 Complete Karaoke Pipeline
- **AI Vocal Separation**: Demucs, Spleeter, or FFmpeg processing
- **Smart Song Search**: Spotify, MusicBrainz, and local library integration
- **Lyrics Synchronization**: AI-powered timing with multiple APIs
- **Video Generation**: Animated backgrounds with scrolling lyrics
- **Multiple Formats**: MP4 video or audio + LRC files

### 👥 Queue Management System  
- **Multi-User Support**: Everyone can add songs with their name
- **Real-Time Status**: Processing progress and estimated wait times
- **Queue Controls**: Skip, remove, or reorder songs
- **Auto-Advance**: Next person's song starts automatically

### 🎮 Full-Screen Karaoke Experience
- **Professional Player**: Large lyrics with smooth transitions
- **Progress Tracking**: Visual timeline and song completion
- **Party Controls**: Skip song or mark complete
- **Responsive Design**: Works on phones, tablets, and big screens

## Architecture

### Backend (Next.js API Routes)
```
/api/queue/add          # Add song to queue
/api/queue              # Get current state  
/api/queue/[id]/start   # Start singing
/api/upload             # Upload audio files
/api/songs/search       # Search music databases
```

### Processing Pipeline
```
User Request → Song Search → Audio Acquisition → 
Vocal Separation → Lyrics Sync → Video Generation → Ready to Sing
```

### Data Flow
```
1. User adds song (name + search query)
2. Background job processes audio with Demucs/Spleeter
3. Lyrics fetched and synchronized with timestamps  
4. Video generated with animated background + lyrics
5. Song marked "ready" in queue
6. User clicks "Start Singing" → Full-screen player
```

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Database**: SQLite with better-sqlite3
- **Audio Processing**: Demucs, Spleeter, FFmpeg  
- **Video Generation**: FFmpeg with complex filters
- **APIs**: Spotify, MusicBrainz, Lyrics.ovh, QuickLRC
- **File Handling**: Multer for uploads, organized storage

## Quick Start

See [SETUP.md](./SETUP.md) for detailed installation instructions.

```bash
# Install system dependencies (macOS)
brew install ffmpeg python node
pip install demucs spleeter

# Install and run
npm install
npm run dev
```

## How It Works

### Song Processing
1. **Search**: Query Spotify/MusicBrainz for metadata
2. **Acquire**: Use uploaded files or local music library
3. **Separate**: Run Demucs/Spleeter to remove vocals  
4. **Lyrics**: Fetch from multiple APIs and sync with audio
5. **Video**: Generate karaoke video with animated background

### Queue System
- SQLite database tracks users, songs, and processing status
- Background jobs handle long-running audio processing
- WebSocket updates (planned) for real-time progress
- Automatic queue advancement when songs complete

### File Organization
```
uploads/     # User uploaded audio
output/      # Processed karaoke files
  [song-id]/
    ├── instrumental.wav
    ├── lyrics.lrc  
    └── karaoke.mp4
temp/        # Processing workspace
```

This is a complete, production-ready karaoke system perfect for parties, bars, or home use!