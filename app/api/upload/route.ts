import { NextRequest, NextResponse } from 'next/server'
import { v2 as cloudinary } from 'cloudinary'

// Configure Cloudinary
cloudinary.config({
    cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
})

// Optimization constants
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_WIDTH = 1200 // Max width untuk hemat storage (cukup untuk web)
const QUALITY = 'auto:good' // AI-optimized quality by Cloudinary

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData()
        const file = formData.get('file') as File

        if (!file) {
            return NextResponse.json(
                { success: false, message: 'No file provided' },
                { status: 400 }
            )
        }

        // ✅ VALIDATION 1: File type
        if (!file.type.startsWith('image/')) {
            return NextResponse.json(
                { success: false, message: 'File harus berupa gambar' },
                { status: 400 }
            )
        }

        // ✅ VALIDATION 2: File size (backend validation)
        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json(
                { success: false, message: 'Ukuran file maksimal 5MB' },
                { status: 400 }
            )
        }

        // Convert file to base64
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)
        const base64 = buffer.toString('base64')
        const dataUri = `data:${file.type};base64,${base64}`

        // ✅ OPTIMIZED UPLOAD to Cloudinary
        const result = await cloudinary.uploader.upload(dataUri, {
            folder: 'vast_finance',
            resource_type: 'image',

            // 🚀 OPTIMIZATION: Auto-resize + compress + format
            transformation: [
                {
                    width: MAX_WIDTH,
                    crop: 'limit', // Hanya resize jika lebih besar dari 1200px
                    quality: QUALITY, // AI-optimized quality
                    fetch_format: 'auto', // Auto pilih format terbaik (WebP/AVIF/JPG)
                }
            ],
        })

        return NextResponse.json({
            success: true,
            url: result.secure_url,
            public_id: result.public_id,
            // Info untuk monitoring
            original_size: file.size,
            optimized_size: result.bytes,
            format: result.format,
            // Metadata untuk cleanup tracking
            metadata: {
                upload_date: new Date().toISOString(),
                scheduled_deletion_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days (3 months)
            }
        })

    } catch (error) {
        console.error('Upload error:', error)
        return NextResponse.json(
            { success: false, message: 'Upload failed' },
            { status: 500 }
        )
    }
}
