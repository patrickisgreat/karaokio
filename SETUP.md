# Karaokio Setup Guide

## Prerequisites

### System Dependencies

1. **Python 3.8+** with pip
2. **FFmpeg** - For audio/video processing
3. **Node.js 18+** - For the web application

### Audio Separation Tools

Choose one or more:

**Option A: Demucs (Recommended - Highest Quality)**
```bash
pip install demucs
```

**Option B: Spleeter**
```bash
pip install spleeter tensorflow
```

**Option C: Basic FFmpeg (Fastest)**
Already included with FFmpeg installation.

### System Installation

**macOS:**
```bash
# Install Homebrew if not already installed
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install dependencies
brew install ffmpeg python node
pip install demucs spleeter tensorflow
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install ffmpeg python3 python3-pip nodejs npm
pip3 install demucs spleeter tensorflow
```

**Windows:**
```bash
# Install via Chocolatey
choco install ffmpeg python nodejs

# Install Python packages
pip install demucs spleeter tensorflow
```

## Application Setup

1. **Install Node.js dependencies:**
```bash
npm install
```

2. **Set up environment variables:**
Create `.env.local`:
```env
# Optional API Keys (for enhanced functionality)
SPOTIFY_ACCESS_TOKEN=your_spotify_token
GENIUS_ACCESS_TOKEN=your_genius_token
MUSIXMATCH_API_KEY=your_musixmatch_key
QUICKLRC_API_KEY=your_quicklrc_key

# File paths
UPLOAD_DIR=./uploads
OUTPUT_DIR=./output
TEMP_DIR=./temp
```

3. **Create required directories:**
```bash
mkdir -p uploads output temp
```

4. **Initialize database:**
The SQLite database will be created automatically on first run.

5. **Start the application:**
```bash
npm run dev
```

## Usage

### Basic Workflow

1. **Add Songs**: Users enter their name and song request
2. **Processing**: System searches for audio and processes with AI
3. **Queue**: Songs appear in queue with status updates  
4. **Karaoke**: When ready, users can start singing

### Audio Sources

The system supports multiple audio sources:

1. **User Uploads**: Upload MP3/WAV files directly
2. **Local Library**: Scan local music folder
3. **External Sources**: Configure with streaming APIs

### Processing Quality Options

- **Fast**: Basic vocal removal using FFmpeg (~30 seconds)
- **Balanced**: Spleeter processing (~1-2 minutes)  
- **High**: Demucs processing (~3-5 minutes)

## File Structure

```
karaokio/
├── uploads/          # User uploaded audio files
├── output/           # Processed karaoke files  
├── temp/             # Temporary processing files
├── karaoke.db        # SQLite database
└── src/
    ├── app/api/      # Backend API routes
    ├── lib/          # Core processing logic
    └── components/   # React UI components
```

## API Endpoints

- `POST /api/queue/add` - Add song to queue
- `GET /api/queue` - Get current queue state
- `POST /api/upload` - Upload audio file
- `POST /api/songs/search` - Search for songs
- `POST /api/queue/[id]/start` - Start singing song
- `POST /api/queue/[id]/complete` - Mark song complete

## Troubleshooting

### Common Issues

1. **"Demucs not found"**
   - Ensure Python and Demucs are installed: `pip install demucs`

2. **"FFmpeg not found"**
   - Install FFmpeg: `brew install ffmpeg` (Mac) or `sudo apt install ffmpeg` (Linux)

3. **Processing stuck**
   - Check disk space in temp/output directories
   - Restart the development server

4. **No audio files found**
   - Upload files to `/uploads` directory
   - Or implement music library scanning

### Performance Tips

- Use SSD storage for faster processing
- Allocate sufficient RAM (4GB+ recommended)
- Use "Fast" mode for real-time karaoke events
- Pre-process popular songs during setup

## Production Deployment

For production use:

1. Set up proper file storage (AWS S3, etc.)
2. Configure background job queue (Redis/Bull)  
3. Add user authentication
4. Set up monitoring and logging
5. Configure reverse proxy (nginx)
6. Use PM2 or Docker for process management