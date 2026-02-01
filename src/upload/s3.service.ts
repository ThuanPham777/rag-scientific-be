// src/upload/s3.service.ts
import { Injectable } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { extname } from 'path';

@Injectable()
export class S3Service {
  private readonly s3: S3Client;
  private readonly bucket: string;
  private readonly region: string;

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
}
