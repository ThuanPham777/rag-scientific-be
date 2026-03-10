import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SearchResultDto, SearchSessionDto, SearchNotebookDto } from './dto/search-result.dto';

@Injectable()
export class SearchService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Global search across conversations (by title or linked paper metadata)
   * and notebooks (by title).
   */
  async globalSearch(userId: string, q: string): Promise<SearchResultDto> {
    if (!q?.trim()) {
      return { sessions: [], notebooks: [] };
    }

    const term = `%${q.trim()}%`;

    // ─── Sessions ─────────────────────────────────────────────────────────────
    // Match conversations where:
    //   - conversation.title matches query, OR
    //   - a linked paper (single-paper via paperId, or multi-paper via conversation_papers)
    //     has a title / abstract / summary / fileName that matches
    const conversations = await this.prisma.$queryRaw<
      Array<{
        id: string;
        title: string | null;
        type: string;
        is_collaborative: boolean;
        updated_at: Date;
      }>
    >`
      SELECT DISTINCT c.id, c.title, c.type, c.is_collaborative, c.updated_at
      FROM conversations c
      LEFT JOIN papers p       ON p.id = c.paper_id
      LEFT JOIN conversation_papers cp ON cp.conversation_id = c.id
      LEFT JOIN papers mp      ON mp.id = cp.paper_id
      WHERE c.user_id = ${userId}::uuid
        AND (
          c.title ILIKE ${term}
          OR p.title    ILIKE ${term}
          OR p.summary  ILIKE ${term}
          OR p.abstract ILIKE ${term}
          OR p.file_name ILIKE ${term}
          OR mp.title    ILIKE ${term}
          OR mp.summary  ILIKE ${term}
          OR mp.abstract ILIKE ${term}
          OR mp.file_name ILIKE ${term}
        )
      ORDER BY c.updated_at DESC
      LIMIT 5
    `;

    // For each matched conversation, fetch its paper(s) for the subtitle
    const sessionIds = conversations.map((c) => c.id);
    let papersByConv: Record<string, Array<{ id: string; fileName: string; title: string | null }>> = {};

    if (sessionIds.length > 0) {
      // Single-paper conversations
      const singlePapers = await this.prisma.paper.findMany({
        where: {
          conversations: { some: { id: { in: sessionIds } } },
        },
        select: {
          id: true,
          fileName: true,
          title: true,
          conversations: { where: { id: { in: sessionIds } }, select: { id: true } },
        },
      });

      for (const p of singlePapers) {
        for (const conv of p.conversations) {
          if (!papersByConv[conv.id]) papersByConv[conv.id] = [];
          papersByConv[conv.id].push({ id: p.id, fileName: p.fileName, title: p.title });
        }
      }

      // Multi-paper conversations (conversation_papers join table)
      const multiPapers = await this.prisma.conversationPaper.findMany({
        where: { conversationId: { in: sessionIds } },
        include: { paper: { select: { id: true, fileName: true, title: true } } },
        orderBy: { tabOrder: 'asc' },
      });

      for (const cp of multiPapers) {
        if (!papersByConv[cp.conversationId]) papersByConv[cp.conversationId] = [];
        // Avoid duplicates
        if (!papersByConv[cp.conversationId].find((p) => p.id === cp.paper.id)) {
          papersByConv[cp.conversationId].push({
            id: cp.paper.id,
            fileName: cp.paper.fileName,
            title: cp.paper.title,
          });
        }
      }
    }

    const sessions: SearchSessionDto[] = conversations.map((c) => ({
      id: c.id,
      title: c.title ?? undefined,
      type: c.type,
      isCollaborative: c.is_collaborative,
      updatedAt: c.updated_at,
      papers: (papersByConv[c.id] ?? []).map((p) => ({
        id: p.id,
        fileName: p.fileName,
        title: p.title ?? undefined,
      })),
    }));

    // ─── Notebooks ────────────────────────────────────────────────────────────
    const rawNotebooks = await this.prisma.notebook.findMany({
      where: {
        userId,
        title: { contains: q.trim(), mode: 'insensitive' },
      },
      select: { id: true, title: true, updatedAt: true, content: true },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    });

    const notebooks: SearchNotebookDto[] = rawNotebooks.map((nb) => ({
      id: nb.id,
      title: nb.title,
      updatedAt: nb.updatedAt,
      contentPreview: nb.content
        ? nb.content.replace(/<[^>]*>/g, '').substring(0, 120)
        : undefined,
    }));

    return { sessions, notebooks };
  }
}
