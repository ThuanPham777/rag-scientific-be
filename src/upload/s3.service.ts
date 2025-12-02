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
    private readonly cloudfrontUrl?: string;

    constructor(private readonly config: ConfigService) {
        this.region = this.config.get<string>('AWS_REGION')!;
        this.bucket = this.config.get<string>('AWS_S3_BUCKET')!;
        this.cloudfrontUrl = this.config.get<string>('AWS_CLOUDFRONT_URL')!;

        this.s3 = new S3Client({
            region: this.region,
            credentials: {
                accessKeyId: this.config.get<string>('AWS_ACCESS_KEY_ID')!,
                secretAccessKey: this.config.get<string>('AWS_SECRET_ACCESS_KEY')!,
            },
        });
    }

    /**
     * Upload buffer lên S3 (private), dùng CloudFront để serve
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

        // Upload private
        const command = new PutObjectCommand({
            Bucket: this.bucket,
            Key: key,
            Body: fileBuffer,
            ContentType: mimeType,
            ACL: 'private', // IMPORTANT khi dùng CloudFront OAC
        });

        await this.s3.send(command);

        // ALWAYS generate CloudFront URL
        const fileUrl = `${this.cloudfrontUrl}/${key}`;

        return {
            key,
            url: fileUrl,
            bucket: this.bucket,
            region: this.region,
        };
    }
}
