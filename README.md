# Karaokio 🎤

AI-powered karaoke queue system that transforms any song into karaoke with vocal separation and synchronized lyrics.

## Features

### 🎵 Complete Karaoke Pipeline
- **AI Vocal Separation**: Demucs or FFmpeg processing
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
2. Background job processes audio with Demucs
3. Lyrics fetched and synchronized with timestamps  
4. Video generated with animated background + lyrics
5. Song marked "ready" in queue
6. User clicks "Start Singing" → Full-screen player
```

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Database**: SQLite with better-sqlite3
- **Audio Processing**: Demucs, FFmpeg  
- **Video Processing**: FFmpeg with complex filters and audio replacement
- **Content Acquisition**: WebTorrent for audio, YouTube-dl for karaoke videos
- **APIs**: Spotify, MusicBrainz, Lyrics.ovh, QuickLRC, Genius, Musixmatch
- **Caching**: Smart file-based caching with automatic cleanup

## Quick Start

See [SETUP.md](./SETUP.md) for detailed installation instructions.

```bash
# Install system dependencies (macOS)
brew install ffmpeg yt-dlp
pipx install demucs

# Install and run
npm install
npm run doctor
npm run dev
```

## 🚀 The Autonomous Karaoke Factory

Karaokio can **automatically find, download, and process any song** into karaoke format:

### Complete Autonomous Flow
```
User Request → Cache Check → Torrent Search → YouTube Karaoke Video → 
Vocal Separation → Lyrics Sync → Audio Replacement → Ready to Sing!
```

**Step-by-Step Process:**
1. 🔍 **Cache Check**: Instantly serve if song already processed
2. 📥 **Torrent Download**: Find and download original song via torrents  
3. 🎥 **YouTube Search**: Download matching karaoke video automatically
4. 🎙️ **Vocal Separation**: Remove vocals with Demucs AI
5. 📝 **Lyrics Sync**: Fetch and synchronize lyrics with timestamps
6. 🔄 **Audio Replacement**: Replace karaoke video audio with AI-processed track
7. 💾 **Cache Storage**: Save for instant future access
8. 🎤 **Ready to Sing**: Full karaoke experience with professional quality

### 🔧 Configuration & Security

**All sensitive data is centralized and never committed:**
- Copy `.env.example` to `.env.local`
- Add your API keys (Spotify, Genius, etc.)
- Configure torrent/YouTube settings
- All secrets stay local (in `.gitignore`)

### Real-World Example

**User Action:**
```
Alice adds: "Don't Stop Me Now Queen"
```

**System Response (Fully Automatic):**
```
[5 seconds]  ✅ Cache miss - starting autonomous processing
[30 seconds] 📥 Downloaded from torrent: "Queen - Don't Stop Me Now.mp3"
[45 seconds] 🎥 Downloaded YouTube karaoke: "Don't Stop Me Now Karaoke"
[3 minutes]  🎙️ Vocal separation complete (Demucs)
[3.5 min]    📝 Lyrics fetched and synchronized
[4 minutes]  🔄 Replaced karaoke video audio with instrumental
[4.5 min]    💾 Cached for future use
[5 minutes]  🎉 "Ready to Sing!" - Alice can start karaoke
```

### File Organization
```
uploads/          # User uploaded audio
downloads/        # Torrent downloads  
youtube_videos/   # Downloaded karaoke videos
cache/           # Smart caching system
output/          # Final karaoke files
  [song-id]/
    ├── original.mp3        # Downloaded source
    ├── instrumental.wav    # De-vocalized track
    ├── lyrics.lrc         # Synchronized lyrics
    └── final_karaoke.mp4  # Ready-to-stream video
temp/            # Processing workspace
```

### 🎯 Perfect For

- **House Parties**: Everyone requests songs, system handles everything
- **Karaoke Bars**: Autonomous song acquisition and processing
- **Private Events**: No copyright concerns, full automation
- **Music Enthusiasts**: High-quality vocal separation and video sync

This creates a **completely autonomous karaoke experience** - just add requests and sing!