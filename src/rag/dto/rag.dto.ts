// src/rag/dto/rag.dto.ts

/**
 * RAG Context Item - represents a text, table, or image context from RAG
 */
export interface RagContextItem {
  source_id: string;
  text: string;
  type?: string;
  page?: number;
  metadata?: {
    section_title?: string;
    page_label?: number;
    page_start?: number;
    page_end?: number;
    modality?: string;
    bbox?: any;
    layout_width?: number;
    layout_height?: number;
    source_paper_id?: string;
    paper_id?: string;
    [key: string]: any;
  };
  image_b64?: string;
  table_html?: string;
}

/**
 * RAG Context - combined context information from RAG response
 */
export interface RagContext {
  texts?: RagContextItem[];
  tables?: RagContextItem[];
  images?: RagContextItem[];
  citations?: any[];
  model_name?: string;
  token_count?: number;
  latency_ms?: number;
}

/**
 * RAG Query Response - response from /query and /query-multi endpoints
 */
export interface RagQueryResponse {
  answer: string;
  context?: RagContext;
  sources?: RagSourceInfo[];
}

/**
 * RAG Source Info - source information for multi-paper queries
 */
export interface RagSourceInfo {
  paper_id: string;
  title?: string;
}

/**
 * Ingest Request DTO - for /ingest-from-url endpoint
 */
export interface RagIngestRequest {
  file_url: string;
  file_id: string;
}

/**
 * Ingest Response - response from /ingest-from-url endpoint
 */
export interface RagIngestResponse {
  title?: string;
  abstract?: string;
  authors?: string[] | string;
  num_pages?: number;
  node_count?: number;
  table_count?: number;
  image_count?: number;
}

/**
 * Query Request - for /query endpoint
 */
export interface RagQueryRequest {
  file_id: string;
  question: string;
}

/**
 * Multi-Query Request - for /query-multi endpoint
 */
export interface RagMultiQueryRequest {
  file_ids: string[];
  question: string;
}

/**
 * Explain Region Request - for /explain-region endpoint
 */
export interface RagExplainRegionRequest {
  file_id: string;
  question: string;
  image_b64: string;
  page_number?: number;
}

/**
 * Orphaned Guest File info from cleanup endpoint
 */
export interface RagOrphanedGuestFile {
  rag_paper_id: string;
  file_url?: string;
}

/**
 * Orphaned Guests Response - from /cleanup/orphaned-guests
 */
export interface RagOrphanedGuestsResponse {
  files: RagOrphanedGuestFile[];
}
