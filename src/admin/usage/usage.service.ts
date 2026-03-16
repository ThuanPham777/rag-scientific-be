import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface UsageEntry {
    model: string;
    provider: string;
    purpose: string;
    endpoint: string;
    inputTokens: number;
    outputTokens: number;
    durationMs?: number;
    userId?: string;
    conversationId?: string;
}

@Injectable()
export class UsageService {
    private readonly logger = new Logger(UsageService.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Log one or more LLM usage entries (fire-and-forget).
     */
    async logUsage(entries: UsageEntry[]): Promise<void> {
        if (!entries || entries.length === 0) return;

        try {
            await this.prisma.llmUsageLog.createMany({
                data: entries.map((e) => ({
                    model: e.model,
                    provider: e.provider,
                    purpose: e.purpose,
                    endpoint: e.endpoint,
                    inputTokens: e.inputTokens || 0,
                    outputTokens: e.outputTokens || 0,
                    durationMs: e.durationMs ?? null,
                    userId: e.userId ?? null,
                    conversationId: e.conversationId ?? null,
                })),
            });
            this.logger.debug(`Logged ${entries.length} LLM usage entries`);
        } catch (err) {
            this.logger.error('Failed to log LLM usage', err);
        }
    }

    /**
     * Get aggregated usage stats for the admin dashboard.
     */
    async getUsageStats(days: number) {
        const since = new Date();
        since.setDate(since.getDate() - days);

        // Total calls and tokens
        const totals = await this.prisma.llmUsageLog.aggregate({
            where: { createdAt: { gte: since } },
            _count: true,
            _sum: { inputTokens: true, outputTokens: true },
        });

        // Breakdown by model
        const byModel = await this.prisma.llmUsageLog.groupBy({
            by: ['model', 'provider'],
            where: { createdAt: { gte: since } },
            _count: true,
            _sum: { inputTokens: true, outputTokens: true },
            orderBy: { _count: { model: 'desc' } },
        });

        // Breakdown by day (raw SQL for date truncation)
        const byDay: { date: string; calls: number; input_tokens: number; output_tokens: number }[] =
            await this.prisma.$queryRaw`
        SELECT
          DATE(created_at) AS date,
          COUNT(*)::int AS calls,
          COALESCE(SUM(input_tokens), 0)::int AS input_tokens,
          COALESCE(SUM(output_tokens), 0)::int AS output_tokens
        FROM llm_usage_log
        WHERE created_at >= ${since}
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `;

        // Breakdown by purpose
        const byPurpose = await this.prisma.llmUsageLog.groupBy({
            by: ['purpose'],
            where: { createdAt: { gte: since } },
            _count: true,
            _sum: { inputTokens: true, outputTokens: true },
            orderBy: { _count: { purpose: 'desc' } },
        });

        return {
            totalCalls: totals._count,
            totalInputTokens: totals._sum.inputTokens || 0,
            totalOutputTokens: totals._sum.outputTokens || 0,
            callsByModel: byModel.map((row) => ({
                model: row.model,
                provider: row.provider,
                calls: row._count,
                inputTokens: row._sum.inputTokens || 0,
                outputTokens: row._sum.outputTokens || 0,
            })),
            callsByDay: byDay.map((row) => ({
                date: typeof row.date === 'string' ? row.date : new Date(row.date).toISOString().slice(0, 10),
                calls: Number(row.calls),
                inputTokens: Number(row.input_tokens),
                outputTokens: Number(row.output_tokens),
            })),
            callsByPurpose: byPurpose.map((row) => ({
                purpose: row.purpose,
                calls: row._count,
                inputTokens: row._sum.inputTokens || 0,
                outputTokens: row._sum.outputTokens || 0,
            })),
        };
    }
}
