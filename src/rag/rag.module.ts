// src/rag/rag.module.ts
import { Module, Global } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { RagService } from './rag.service';

/**
 * RagModule - Centralized module for RAG service integration
 *
 * This module is marked as @Global so RagService is available
 * throughout the application without needing to import the module
 * in every consuming module.
 *
 * The module provides:
 * - RagService: Handles all HTTP communication with the RAG (FastAPI) service
 * - DTOs: Type definitions for RAG API requests/responses
 */
@Global()
@Module({
  imports: [HttpModule],
  providers: [RagService],
  exports: [RagService],
})
export class RagModule {}
