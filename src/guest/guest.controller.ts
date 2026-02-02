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
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { GuestService } from './guest.service';
import {
  GuestAskQuestionDto,
  GuestAskQuestionResponseDto,
  GuestUploadResponseDto,
  GuestExplainRegionDto,
} from './dto/guest.dto';

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
  @UseInterceptors(FileInterceptor('file'))
  async uploadPdf(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<GuestUploadResponseDto> {
    return this.guestService.uploadPdf(file);
  }

  @Get('status/:ragFileId')
  @ApiOperation({
    summary: 'Check ingest status for guest upload',
  })
  async checkStatus(@Param('ragFileId') ragFileId: string) {
    const status = this.guestService.getIngestStatus(ragFileId);
    return {
      success: true,
      data: { status },
    };
  }

  @Post('ask')
  @ApiOperation({
    summary: 'Ask question for guest session (no authentication required)',
  })
  async askQuestion(
    @Body() dto: GuestAskQuestionDto,
  ): Promise<GuestAskQuestionResponseDto> {
    return this.guestService.askQuestion(dto);
  }

  @Post('explain-region')
  @ApiOperation({
    summary: 'Explain selected region for guest (no authentication required)',
  })
  async explainRegion(
    @Body() dto: GuestExplainRegionDto,
  ): Promise<GuestAskQuestionResponseDto> {
    return this.guestService.explainRegion(dto);
  }
}
