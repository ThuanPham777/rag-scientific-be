import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNotebookDto } from './dto/create-notebook.dto';
import { UpdateNotebookDto } from './dto/update-notebook.dto';
import { NotebookItemDto, NotebookDetailDto } from './dto/notebook-response.dto';

@Injectable()
export class NotebookService {
  private readonly logger = new Logger(NotebookService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get all notebooks for a user (list view - no full content)
   */
  async findAllByUser(userId: string): Promise<NotebookItemDto[]> {
    const notebooks = await this.prisma.notebook.findMany({
      where: { userId },
      orderBy: [{ updatedAt: 'desc' }],
      select: {
        id: true,
        userId: true,
        title: true,
        content: true,
        orderIndex: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return notebooks.map((nb) => ({
      ...nb,
      contentPreview: nb.content
        ? nb.content.replace(/<[^>]*>/g, '').substring(0, 200)
        : '',
    }));
  }

  /**
   * Get a single notebook with full content
   */
  async findOne(id: string, userId: string): Promise<NotebookDetailDto> {
    const notebook = await this.prisma.notebook.findUnique({
      where: { id },
    });

    if (!notebook) throw new NotFoundException('Notebook not found');
    if (notebook.userId !== userId)
      throw new ForbiddenException('You do not have access to this notebook');

    return notebook as NotebookDetailDto;
  }

  /**
   * Create a new notebook
   */
  async create(
    userId: string,
    dto: CreateNotebookDto,
  ): Promise<NotebookDetailDto> {
    const maxOrder = await this.prisma.notebook.aggregate({
      where: { userId },
      _max: { orderIndex: true },
    });

    const notebook = await this.prisma.notebook.create({
      data: {
        userId,
        title: dto.title || 'Untitled',
        content: dto.content || '',
        orderIndex: (maxOrder._max.orderIndex ?? -1) + 1,
      },
    });

    return notebook as NotebookDetailDto;
  }

  /**
   * Update notebook (title and/or content) - used for auto-save
   */
  async update(
    id: string,
    userId: string,
    dto: UpdateNotebookDto,
  ): Promise<NotebookDetailDto> {
    const notebook = await this.prisma.notebook.findUnique({ where: { id } });
    if (!notebook) throw new NotFoundException('Notebook not found');
    if (notebook.userId !== userId)
      throw new ForbiddenException('You do not have access to this notebook');

    const updated = await this.prisma.notebook.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.content !== undefined && { content: dto.content }),
      },
    });

    return updated as NotebookDetailDto;
  }

  /**
   * Delete a notebook
   */
  async remove(
    id: string,
    userId: string,
  ): Promise<{ message: string }> {
    const notebook = await this.prisma.notebook.findUnique({ where: { id } });
    if (!notebook) throw new NotFoundException('Notebook not found');
    if (notebook.userId !== userId)
      throw new ForbiddenException('You do not have access to this notebook');

    await this.prisma.notebook.delete({ where: { id } });
    return { message: 'Notebook deleted successfully' };
  }
}
