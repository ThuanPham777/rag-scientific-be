// src/cleanup/cleanup.service.ts
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../upload/s3.service';

/**
 * Cleanup Service - Handles periodic cleanup tasks
 *
 * 1. Guest file cleanup: Removes S3 files and RAG data for guest uploads
 *    older than GUEST_FILE_TTL_HOURS (default: 24 hours)
 *
 * 2. Orphaned file cleanup: Removes S3 files that don't have corresponding
 *    database records (e.g., failed uploads)
 */
@Injectable()
export class CleanupService implements OnModuleInit {
  private readonly logger = new Logger(CleanupService.name);
  private readonly ragUrl: string;
  private readonly guestFileTtlHours: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly http: HttpService,
    private readonly s3Service: S3Service,
  ) {
    this.ragUrl = process.env.RAG_SERVICE_URL ?? 'http://127.0.0.1:8000';
    this.guestFileTtlHours = parseInt(
      process.env.GUEST_FILE_TTL_HOURS ?? '24',
      10,
    );
  }

  onModuleInit() {
    this.logger.log(
      `Cleanup service initialized. Guest file TTL: ${this.guestFileTtlHours} hours`,
    );
  }

  /**
   * Run every hour - cleanup orphaned guest files
   * Guest files are stored in rag_paper_cache but NOT in papers table
   */
  @Cron(CronExpression.EVERY_HOUR)
  async cleanupGuestFiles() {
    this.logger.log('Starting guest file cleanup...');

    try {
      // Call RAG service to get list of orphaned guest files
      const response = await this.http.axiosRef.get(
        `${this.ragUrl}/cleanup/orphaned-guests`,
        {
          params: { max_age_hours: this.guestFileTtlHours },
        },
      );

      const orphanedFiles: { rag_paper_id: string; file_url?: string }[] =
        response.data.files || [];

      if (orphanedFiles.length === 0) {
        this.logger.log('No orphaned guest files to cleanup');
        return;
      }

      this.logger.log(
        `Found ${orphanedFiles.length} orphaned guest files to cleanup`,
      );

      let cleaned = 0;
      for (const file of orphanedFiles) {
        try {
          // 1. Delete from RAG (vector store, caches)
          await this.http.axiosRef.delete(
            `${this.ragUrl}/cleanup/${file.rag_paper_id}`,
          );

          // 2. Delete from S3 if URL is provided
          if (file.file_url) {
            await this.s3Service.deleteFile(file.file_url);
          }

          cleaned++;
        } catch (error) {
          this.logger.error(
            `Failed to cleanup guest file ${file.rag_paper_id}:`,
            error,
          );
        }
      }

      this.logger.log(`Guest file cleanup completed. Cleaned: ${cleaned}`);
    } catch (error) {
      this.logger.error('Guest file cleanup failed:', error);
    }
  }

  /**
   * Run daily at 3 AM - cleanup any orphaned S3 files
   * This catches files that might have been uploaded but never registered
   */
  @Cron('0 3 * * *') // 3:00 AM every day
  async cleanupOrphanedS3Files() {
    this.logger.log('Starting daily orphaned S3 file check...');
    // Note: This is a placeholder - implementing full S3 listing
    // requires additional logic and should be done carefully
    // to avoid accidentally deleting valid files
    this.logger.log('Daily cleanup check completed');
  }

  /**
   * Manual trigger for cleanup (can be called via admin endpoint)
   */
  async runManualCleanup(): Promise<{
    guestFiles: number;
    errors: string[];
  }> {
    this.logger.log('Manual cleanup triggered');

    const errors: string[] = [];
    let guestFiles = 0;

    try {
      const response = await this.http.axiosRef.get(
        `${this.ragUrl}/cleanup/orphaned-guests`,
        {
          params: { max_age_hours: 1 }, // More aggressive for manual cleanup
        },
      );

      const orphanedFiles = response.data.files || [];

      for (const file of orphanedFiles) {
        try {
          await this.http.axiosRef.delete(
            `${this.ragUrl}/cleanup/${file.rag_paper_id}`,
          );
          if (file.file_url) {
            await this.s3Service.deleteFile(file.file_url);
          }
          guestFiles++;
        } catch (error) {
          errors.push(`Failed to cleanup ${file.rag_paper_id}: ${error}`);
        }
      }
    } catch (error) {
      errors.push(`Failed to get orphaned files: ${error}`);
    }

    return { guestFiles, errors };
  }
}
