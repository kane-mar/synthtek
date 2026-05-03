/**
 * Media Processing Types
 */

export interface MediaConfig {
  maxFileSize: number;
  supportedImageFormats: string[];
  supportedAudioFormats: string[];
  supportedVideoFormats: string[];
  supportedDocumentFormats: string[];
  tempDir: string;
}

export interface MediaResult {
  success: boolean;
  type?: 'image' | 'audio' | 'video' | 'document';
  format?: string;
  filename?: string;
  size?: number;
  url?: string;
  error?: string;
}

export interface ImageInfo {
  type: 'image';
  format: string;
  width?: number;
  height?: number;
  colorSpace?: string;
}

export interface AudioInfo {
  type: 'audio';
  format: string;
  duration?: number;
  bitrate?: number;
  channels?: number;
}

export interface VideoInfo {
  type: 'video';
  format: string;
  duration?: number;
  width?: number;
  height?: number;
  codec?: string;
}

export interface DocumentInfo {
  type: 'document';
  format: string;
  pages?: number;
  title?: string;
  author?: string;
}

export interface MediaMetadata {
  filename: string;
  mimeType: string;
  size: number;
  format: string;
  type: 'image' | 'audio' | 'video' | 'document';
}
