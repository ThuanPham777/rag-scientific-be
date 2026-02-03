// src/guest/guest.controller.ts
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiBody,
  ApiOkResponse,
  ApiParam,
} from '@nestjs/swagger';
import { GuestService } from './guest.service';
import {
  GuestAskQuestionDto,
  GuestAskQuestionResponseDto,
  GuestUploadResponseDto,
  GuestExplainRegionDto,
  GuestStatusResponseDto,
} from './dto/guest.dto';
import { ApiResponseDto } from '../common/dto/api-response.dto';

@ApiTags('Guest')
@Controller('guest')
export class GuestController {
  constructor(private readonly guestService: GuestService) {}

  @Post('upload')
  @ApiOperation({
    summary: 'Upload PDF for guest (no authentication required)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiOkResponse({ type: GuestUploadResponseDto })
  @UseInterceptors(FileInterceptor('file'))
  async uploadPdf(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<GuestUploadResponseDto> {
    const data = await this.guestService.uploadPdf(file);
    return ApiResponseDto.success(
      data,
      'PDF uploaded, processing in background',
    ) as GuestUploadResponseDto;
  }

  @Get('status/:ragFileId')
  @ApiOperation({
    summary: 'Check ingest status for guest upload',
  })
  @ApiParam({ name: 'ragFileId', description: 'RAG file ID' })
  @ApiOkResponse({ type: GuestStatusResponseDto })
  async checkStatus(
    @Param('ragFileId') ragFileId: string,
  ): Promise<GuestStatusResponseDto> {
    const status = this.guestService.getIngestStatus(ragFileId);
    return ApiResponseDto.success(
      { status },
      'Status retrieved',
    ) as GuestStatusResponseDto;
  }

  @Post('ask')
  @ApiOperation({
    summary: 'Ask question for guest session (no authentication required)',
  })
  @ApiOkResponse({ type: GuestAskQuestionResponseDto })
  async askQuestion(
    @Body() dto: GuestAskQuestionDto,
  ): Promise<GuestAskQuestionResponseDto> {
    const data = await this.guestService.askQuestion(dto);
    return ApiResponseDto.success(
      data,
      'Answer generated',
    ) as GuestAskQuestionResponseDto;
  }

  @Post('explain-region')
  @ApiOperation({
    summary: 'Explain selected region for guest (no authentication required)',
  })
  @ApiOkResponse({ type: GuestAskQuestionResponseDto })
  async explainRegion(
    @Body() dto: GuestExplainRegionDto,
  ): Promise<GuestAskQuestionResponseDto> {
    const data = await this.guestService.explainRegion(dto);
    return ApiResponseDto.success(
      data,
      'Region explained',
    ) as GuestAskQuestionResponseDto;
  }
}
