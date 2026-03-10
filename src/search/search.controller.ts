import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../auth/jwt.strategy';
import { SearchService } from './search.service';
import { ApiResponseDto } from '../common/dto/api-response.dto';

@ApiTags('search')
@ApiBearerAuth('JWT-auth')
@UseGuards(JwtAuthGuard)
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({
    summary: 'Global search across sessions and notebooks',
    description:
      'Returns top matching chat sessions (by title or linked paper metadata) and notebooks (by title). Groups results into { sessions, notebooks }.',
  })
  @ApiQuery({ name: 'q', required: true, description: 'Search query string' })
  async search(
    @CurrentUser() user: CurrentUserPayload,
    @Query('q') q: string,
  ) {
    const data = await this.searchService.globalSearch(user.id, q);
    return ApiResponseDto.success(data, 'Search results');
  }
}
