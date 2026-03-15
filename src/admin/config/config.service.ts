import {
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

// Default configs seeded on first access
const DEFAULT_CONFIGS: Record<string, { value: any; description: string }> = {
    'llm.generation': {
        value: { provider: 'openai', model: 'gpt-4o-mini', temperature: 0.2 },
        description: 'Model cho trả lời câu hỏi user',
    },
    'llm.hyde': {
        value: { provider: 'groq', model: 'llama-3.3-70b-versatile', temperature: 0.7 },
        description: 'Model cho HyDE query transformation',
    },
    'llm.condense': {
        value: { provider: 'groq', model: 'llama-3.3-70b-versatile', temperature: 0.3 },
        description: 'Model cho condense follow-up questions',
    },
    'llm.classification': {
        value: { provider: 'openai', model: 'gpt-4o-mini', temperature: 0.1 },
        description: 'Model cho auto-classification',
    },
    'llm.summarization': {
        value: { provider: 'groq', model: 'llama-3.3-70b-versatile', temperature: 0.3 },
        description: 'Model cho table/image summarization',
    },
    'llm.vision': {
        value: { provider: 'openai', model: 'gpt-4o-mini', temperature: 0.2 },
        description: 'Model cho vision tasks (explain region)',
    },
    'rag.chat_history_limit': {
        value: { value: 5 },
        description: 'Số tin nhắn gần nhất gửi vào chat history',
    },
    'rag.relevance_threshold': {
        value: { value: 0.45 },
        description: 'Ngưỡng relevance score tối thiểu',
    },
    'rag.retrieval_k': {
        value: { value: 12 },
        description: 'Số chunks retrieve mỗi query',
    },
    // --- LLM Prompts (dynamic, editable from UI) ---
    'prompt.rag_instructions': {
        value: {
            text: 'You are the best scientific research assistant. '
                + 'Use ONLY the provided context to answer. Synthesize information from multiple sources when needed. '
                + 'If asked for a summary, combine information to create a comprehensive answer. '
                + 'Keep answers concise and cite sources as [S1], [S2], etc. '
                + 'Ground every claim in the context.\n\n'
                + 'CRITICAL LaTeX Formatting Rules (MUST follow exactly):\n'
                + '- For inline math, use single dollar signs: $E = mc^2$\n'
                + '- For block/display math, use double dollar signs on their own lines:\n'
                + '$$\n\\frac{a}{b} = c\n$$\n'
                + '- Always use backslash for LaTeX commands: \\frac, \\sum, \\int, \\sqrt, \\alpha, \\beta\n'
                + '- ALWAYS close every math delimiter: if you open $, you must close with $\n'
                + '- Use \\text{} for words inside math: $P(\\text{event}) = 0.5$\n'
                + '- Fractions: \\frac{numerator}{denominator}\n'
                + '- Subscripts: x_i or x_{ij}, Superscripts: x^2 or x^{n+1}\n'
                + '- DO NOT leave unbalanced $ signs in your response',
        },
        description: 'System prompt chính cho RAG answer generation',
    },
    'prompt.region_explain': {
        value: {
            text: 'You are an expert scientific assistant analyzing a specific region from a research paper. '
                + 'You are provided with a CROPPED IMAGE of the region and textual context from the paper. '
                + '1. Identify if the region is a math formula, table, figure/plot, or text. '
                + '2. Explain it clearly for a student audience. '
                + '3. Use the provided Textual Context to reduce hallucination. Cite it if helpful.\n\n'
                + 'CRITICAL LaTeX Formatting Rules (MUST follow exactly):\n'
                + '- For inline math, use single dollar signs: $E = mc^2$\n'
                + '- For block/display math, use double dollar signs on their own lines\n'
                + '- Use backslash for all LaTeX commands\n'
                + '- ALWAYS balance math delimiters\n'
                + '- Define each variable after equations',
        },
        description: 'Prompt cho Explain Region (vision crop ảnh)',
    },
    'prompt.condense_question': {
        value: {
            text: 'Given the following conversation context and a follow-up question, '
                + 'rephrase the follow-up question to be a standalone question that '
                + 'can be understood without the conversation history.',
        },
        description: 'Prompt cho condense follow-up questions',
    },
};

// Available LLM models per provider
const AVAILABLE_MODELS = {
    openai: [
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini', vision: true },
        { id: 'gpt-4o', name: 'GPT-4o', vision: true },
        { id: 'gpt-4.1-mini', name: 'GPT-4.1 Mini', vision: true },
    ],
    groq: [
        { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B', vision: false },
        { id: 'gemma2-9b-it', name: 'Gemma 2 9B', vision: false },
        { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B', vision: false },
    ],
    gemini: [
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', vision: true },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', vision: true },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', vision: true },
    ],
};

@Injectable()
export class SystemConfigService {
    private readonly logger = new Logger(SystemConfigService.name);
    private cache: Map<string, any> = new Map();
    private cacheLoaded = false;

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Seed default configs if they don't exist
     */
    async seedDefaults(): Promise<void> {
        for (const [key, config] of Object.entries(DEFAULT_CONFIGS)) {
            const existing = await this.prisma.systemConfig.findUnique({
                where: { key },
            });
            if (!existing) {
                await this.prisma.systemConfig.create({
                    data: {
                        key,
                        value: config.value,
                        description: config.description,
                    },
                });
                this.logger.log(`Seeded config: ${key}`);
            }
        }
        this.cacheLoaded = false; // Invalidate cache after seeding
    }

    /**
     * Load all configs into memory cache
     */
    private async loadCache(): Promise<void> {
        const configs = await this.prisma.systemConfig.findMany();
        this.cache.clear();
        for (const config of configs) {
            this.cache.set(config.key, config.value);
        }
        this.cacheLoaded = true;
    }

    /**
     * Get a single config value by key
     */
    async get(key: string): Promise<any> {
        if (!this.cacheLoaded) {
            await this.loadCache();
        }

        if (this.cache.has(key)) {
            return this.cache.get(key);
        }

        // Fallback to default
        if (DEFAULT_CONFIGS[key]) {
            return DEFAULT_CONFIGS[key].value;
        }

        return null;
    }

    /**
     * Get all configs
     */
    async getAll(): Promise<any[]> {
        await this.seedDefaults();
        const configs = await this.prisma.systemConfig.findMany({
            orderBy: { key: 'asc' },
        });
        return configs;
    }

    /**
     * Update a config value
     */
    async update(
        key: string,
        value: any,
        updatedBy?: string,
    ): Promise<any> {
        const existing = await this.prisma.systemConfig.findUnique({
            where: { key },
        });

        if (!existing) {
            throw new NotFoundException(`Config key "${key}" not found`);
        }

        const updated = await this.prisma.systemConfig.update({
            where: { key },
            data: {
                value,
                updatedBy,
            },
        });

        // Invalidate cache
        this.cache.set(key, value);

        this.logger.log(`Config updated: ${key}`);
        return updated;
    }

    /**
     * Get available LLM models grouped by provider
     */
    getAvailableModels() {
        return AVAILABLE_MODELS;
    }

    /**
     * Invalidate the cache (force reload on next access)
     */
    invalidateCache(): void {
        this.cacheLoaded = false;
        this.cache.clear();
    }

    /**
     * Get the default value for a config key (for restore-default)
     */
    getDefault(key: string): { value: any; description: string } | null {
        return DEFAULT_CONFIGS[key] ?? null;
    }
}
