import { createClient } from '@supabase/supabase-js';
import { exec } from 'child_process';
import { promisify } from 'util';
import { tmpdir } from 'os';
import { join } from 'path';
import { unlinkSync, existsSync, writeFileSync, readFileSync } from 'fs';

const execAsync = promisify(exec);

const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/+$/, '');
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set. Audio storage will be disabled.');
}

const supabase = supabaseUrl && supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : null;

const BUCKET_NAME = 'meeting-audio';
const MAX_BUCKET_SIZE_BYTES = 52428800; // 50MB (Supabase limit)
const MAX_BUCKET_FILES = parseInt(process.env.AUDIO_MAX_FILES || '20', 10); // Maximum number of audio files to keep
const AUDIO_RETENTION_DAYS = parseInt(process.env.AUDIO_RETENTION_DAYS || '30', 10); // Delete audio files older than X days

/**
 * Compress audio for storage/playback while maintaining acceptable quality
 * Converts to MP3 with optimized settings for speech:
 * - 48 kbps bitrate (excellent for speech verification, saves ~85-90% space)
 * - Mono channel (speech doesn't need stereo)
 * - 16kHz sample rate (optimal for speech recognition and playback)
 * - VBR (Variable Bit Rate) for better quality-to-size ratio
 * - Maintains excellent intelligibility while drastically reducing file size
 */
async function compressAudioForStorage(
  audioBuffer: Buffer,
  originalMimeType: string,
  originalName: string
): Promise<Buffer> {
  const tempInputPath = join(tmpdir(), `input-${Date.now()}.${originalName.split('.').pop() || 'webm'}`);
  const tempOutputPath = join(tmpdir(), `compressed-${Date.now()}.mp3`);

  try {
    // Write original audio to temp file
    writeFileSync(tempInputPath, audioBuffer);

    // Use ffmpeg to compress to MP3 with VBR for better quality
    // -q:a 4 = VBR quality 4 (good balance, ~65-85 kbps average)
    // -ac 1 = mono
    // -ar 16000 = 16kHz (speech optimal)
    const ffmpegCommand = `ffmpeg -i "${tempInputPath}" -c:a libmp3lame -q:a 4 -ac 1 -ar 16000 -y "${tempOutputPath}"`;
    
    await execAsync(ffmpegCommand);

    // Read compressed audio
    const compressedBuffer = readFileSync(tempOutputPath);

    const originalSize = audioBuffer.length / 1024 / 1024;
    const compressedSize = compressedBuffer.length / 1024 / 1024;
    const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(1);

    console.log(`[Audio Compression] ${originalSize.toFixed(2)} MB → ${compressedSize.toFixed(2)} MB (${compressionRatio}% reduction)`);

    return compressedBuffer;
  } catch (error) {
    console.error('[Audio Compression] Failed to compress audio:', error);
    // Return original if compression fails
    return audioBuffer;
  } finally {
    // Clean up temp files
    if (existsSync(tempInputPath)) unlinkSync(tempInputPath);
    if (existsSync(tempOutputPath)) unlinkSync(tempOutputPath);
  }
}

export async function ensureBucketExists(): Promise<void> {
  if (!supabase) {
    throw new Error('Supabase client not initialized. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  }
  
  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some((bucket) => bucket.name === BUCKET_NAME);
    
    if (!bucketExists) {
      const { error } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: false,
        allowedMimeTypes: ['audio/*'],
        fileSizeLimit: MAX_BUCKET_SIZE_BYTES, // 50MB
      });
      
      if (error) {
        console.error('Failed to create bucket:', error);
        throw error;
      }
      
      // Enable public access for signed URLs
      const { error: policyError } = await supabase.storage.createBucket(BUCKET_NAME, {
        public: true,
      });
      
      if (policyError) {
        console.warn('Could not set bucket as public:', policyError);
      }
    }
  } catch (error) {
    console.error('Error checking/creating bucket:', error);
    throw error;
  }
}

/**
 * Clean up old audio files to maintain bucket within limits
 * Deletes files older than retention period or when exceeding max file count
 */
async function cleanupOldAudioFiles(userId: string): Promise<void> {
  if (!supabase) return;
  
  try {
    const { data: files, error } = await supabase.storage
      .from(BUCKET_NAME)
      .list(userId);
    
    if (error || !files) {
      console.error('[Audio Cleanup] Failed to list files:', error);
      return;
    }
    
    // Filter only audio files (exclude folders)
    const audioFiles = files.filter(f => !f.name.endsWith('/'));
    
    // Sort by created_at (oldest first)
    audioFiles.sort((a, b) => {
      const dateA = new Date(a.created_at || 0);
      const dateB = new Date(b.created_at || 0);
      return dateA.getTime() - dateB.getTime();
    });
    
    // Delete files older than retention period
    const retentionCutoff = new Date();
    retentionCutoff.setDate(retentionCutoff.getDate() - AUDIO_RETENTION_DAYS);
    
    let deletedCount = 0;
    for (const file of audioFiles) {
      const fileDate = new Date(file.created_at || 0);
      
      // Delete if older than retention period
      if (fileDate < retentionCutoff) {
        console.log(`[Audio Cleanup] Deleting old file: ${file.name} (${Math.floor((Date.now() - fileDate.getTime()) / (1000 * 60 * 60 * 24))} days old)`);
        const { error: deleteError } = await supabase.storage
          .from(BUCKET_NAME)
          .remove([`${userId}/${file.name}`]);
        
        if (deleteError) {
          console.error(`[Audio Cleanup] Failed to delete ${file.name}:`, deleteError);
        } else {
          deletedCount++;
        }
      }
    }
    
    // If still too many files, delete oldest ones
    const remainingFiles = audioFiles.filter(f => {
      const fileDate = new Date(f.created_at || 0);
      return fileDate >= retentionCutoff;
    });
    
    if (remainingFiles.length > MAX_BUCKET_FILES) {
      const filesToDelete = remainingFiles.slice(0, remainingFiles.length - MAX_BUCKET_FILES);
      for (const file of filesToDelete) {
        console.log(`[Audio Cleanup] Deleting excess file: ${file.name}`);
        const { error: deleteError } = await supabase.storage
          .from(BUCKET_NAME)
          .remove([`${userId}/${file.name}`]);
        
        if (deleteError) {
          console.error(`[Audio Cleanup] Failed to delete ${file.name}:`, deleteError);
        } else {
          deletedCount++;
        }
      }
    }
    
    if (deletedCount > 0) {
      console.log(`[Audio Cleanup] Deleted ${deletedCount} old audio files`);
    }
  } catch (error) {
    console.error('[Audio Cleanup] Error:', error);
  }
}

export async function uploadMeetingAudio(
  userId: string,
  meetingId: number,
  audioBuffer: Buffer,
  mimeType: string,
  originalName: string
): Promise<string | null> {
  if (!supabase) {
    console.warn('Supabase client not initialized. Skipping audio upload.');
    return null;
  }
  
  try {
    console.log(`[Audio Upload] Starting upload for meeting ${meetingId}, size: ${audioBuffer.length} bytes (${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
    
    // Clean up old files before uploading new one
    await cleanupOldAudioFiles(userId);
    
    // Compress audio for storage (keeps original quality for transcription)
    console.log('[Audio Upload] Compressing audio for storage...');
    const compressedAudio = await compressAudioForStorage(audioBuffer, mimeType, originalName);
    
    // Check if compressed file is still too large for single file limit
    if (compressedAudio.length > MAX_BUCKET_SIZE_BYTES) {
      console.warn(`[Audio Upload] Compressed file ${(compressedAudio.length / 1024 / 1024).toFixed(2)} MB exceeds single file limit. Skipping audio storage.`);
      return null;
    }
    
    await ensureBucketExists();
    
    const extension = 'mp3'; // Always use MP3 for compressed audio
    const fileName = `${userId}/${meetingId}.${extension}`;
    
    console.log(`[Audio Upload] Uploading compressed audio to bucket: ${BUCKET_NAME}, file: ${fileName}`);
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, compressedAudio, {
        contentType: 'audio/mpeg',
        upsert: true,
      });
    
    if (error) {
      // Check if error is due to quota/size limit
      if (error.message?.includes('quota') || error.message?.includes('size') || error.message?.includes('limit')) {
        console.warn('[Audio Upload] Storage quota exceeded, skipping audio storage. Meeting will be saved without audio playback.');
        return null;
      }
      console.error('[Audio Upload] Failed to upload audio:', error);
      throw new Error(`Failed to upload audio: ${error.message}`);
    }
    
    console.log('[Audio Upload] Upload successful, generating signed URL');
    // Generate a signed URL that expires in 24 hours
    const { data: urlData, error: urlError } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(fileName, 86400); // 24 hours
    
    if (urlError) {
      console.error('[Audio Upload] Failed to create signed URL:', urlError);
      throw new Error(`Failed to create signed URL: ${urlError.message}`);
    }
    
    console.log('[Audio Upload] Signed URL generated successfully');
    return urlData.signedUrl;
  } catch (error) {
    console.error('[Audio Upload] Error uploading audio:', error);
    // Return null to allow meeting to be saved without audio
    return null;
  }
}

export async function getMeetingAudioUrl(
  userId: string,
  meetingId: number,
  extension: string = 'webm'
): Promise<string | null> {
  if (!supabase) {
    return null;
  }
  
  try {
    const fileName = `${userId}/${meetingId}.${extension}`;
    
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(fileName, 86400); // 24 hours
    
    if (error) {
      console.error('Failed to get audio URL:', error);
      return null;
    }
    
    return data.signedUrl;
  } catch (error) {
    console.error('Error getting audio URL:', error);
    return null;
  }
}
