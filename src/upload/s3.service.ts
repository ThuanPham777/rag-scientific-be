// src/upload/s3.service.ts
import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { extname } from 'path';

@Injectable()
export class S3Service {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly region: string;
  private readonly logger = new Logger(S3Service.name);

  constructor(private readonly config: ConfigService) {
    this.region = this.config.get<string>('AWS_REGION') || 'ap-southeast-1';
    this.bucket = this.config.get<string>('AWS_S3_BUCKET')!;

    this.s3 = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.config.get<string>('AWS_ACCESS_KEY_ID')!,
        secretAccessKey: this.config.get<string>('AWS_SECRET_ACCESS_KEY')!,
      },
    });
  }

  /**
   * Upload buffer lên S3
   * Note: Bucket policy should allow public read access
   */
  async uploadFile(
    fileBuffer: Buffer,
    originalName: string,
    folder: string,
    mimeType: string,
  ) {
    const ext = extname(originalName) || '';
    const cleanFolder = folder.replace(/\/?$/, '/'); // ensure trailing slash
    const key = `${cleanFolder}${randomUUID()}${ext}`;

    // Upload without ACL (bucket policy handles public access)
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: fileBuffer,
      ContentType: mimeType,
    });

    await this.s3.send(command);

    // Generate direct S3 URL
    const fileUrl = `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;

    return {
      key,
      url: fileUrl,
      bucket: this.bucket,
      region: this.region,
    };
  }

  /**
   * Upload base64 image to S3
   * @param base64Data - Base64 encoded image data (without data URL prefix)
   * @param folder - Folder in S3 bucket
   * @param mimeType - MIME type (default: image/png)
   * @returns S3 URL
   */
  async uploadBase64Image(
    base64Data: string,
    folder: string = 'chat-images',
    mimeType: string = 'image/png',
  ): Promise<string> {
    // Remove data URL prefix if present
    const base64Clean = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Clean, 'base64');

    const ext = mimeType === 'image/jpeg' ? '.jpg' : '.png';
    const cleanFolder = folder.replace(/\/?$/, '/');
    const key = `${cleanFolder}${randomUUID()}${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    });

    await this.s3.send(command);

    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  /**
   * Extract S3 key from full URL
   */
  extractKeyFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      // Remove leading slash
      return urlObj.pathname.substring(1);
    } catch {
      return null;
    }
  }

  /**
   * Delete a single file from S3
   */
  async deleteFile(url: string): Promise<boolean> {
    const key = this.extractKeyFromUrl(url);
    if (!key) {
      this.logger.warn(`Invalid S3 URL: ${url}`);
      return false;
    }

    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });
      await this.s3.send(command);
      this.logger.log(`Deleted S3 file: ${key}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to delete S3 file ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete multiple files from S3
   */
  async deleteFiles(
    urls: string[],
  ): Promise<{ deleted: number; failed: number }> {
    const keys = urls
      .map((url) => this.extractKeyFromUrl(url))
      .filter((key): key is string => key !== null);

    if (keys.length === 0) {
      return { deleted: 0, failed: urls.length };
    }

    try {
      const command = new DeleteObjectsCommand({
        Bucket: this.bucket,
        Delete: {
          Objects: keys.map((Key) => ({ Key })),
          Quiet: false,
        },
      });
      const result = await this.s3.send(command);
      const deleted = result.Deleted?.length || 0;
      const failed = result.Errors?.length || 0;
      this.logger.log(`Deleted ${deleted} S3 files, ${failed} failed`);
      return { deleted, failed };
    } catch (error) {
      this.logger.error('Failed to delete S3 files:', error);
      return { deleted: 0, failed: keys.length };
    }
  }
}
