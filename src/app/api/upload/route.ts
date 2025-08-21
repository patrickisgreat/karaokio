import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: NextRequest) {
  try {
    const data = await request.formData()
    const file: File | null = data.get('audio') as unknown as File

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 })
    }

    // Validate file type
    const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/flac', 'audio/ogg']
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Invalid file type. Supported: MP3, WAV, FLAC, OGG' 
      }, { status: 400 })
    }

    // Validate file size (max 50MB)
    const maxSize = 50 * 1024 * 1024 // 50MB in bytes
    if (file.size > maxSize) {
      return NextResponse.json({ 
        error: 'File too large. Maximum size is 50MB' 
      }, { status: 400 })
    }

    // Create upload directory
    const uploadDir = path.join(process.cwd(), 'uploads')
    try {
      await mkdir(uploadDir, { recursive: true })
    } catch (error) {
      // Directory might already exist
    }

    // Generate unique filename
    const fileExtension = path.extname(file.name) || '.mp3'
    const fileName = `${uuidv4()}${fileExtension}`
    const filePath = path.join(uploadDir, fileName)

    // Save file
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    await writeFile(filePath, buffer)

    // Extract metadata (optional)
    const originalName = file.name
    const size = file.size
    const mimeType = file.type

    return NextResponse.json({
      success: true,
      file: {
        id: fileName,
        originalName,
        path: filePath,
        size,
        mimeType
      },
      message: 'File uploaded successfully'
    })

  } catch (error) {
    console.error('Upload failed:', error)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}