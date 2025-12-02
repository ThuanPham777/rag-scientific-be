import {
    Controller,
    Post,
    UploadedFile,
    UploadedFiles,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';

@Controller('upload')
export class UploadController {
    constructor(private readonly uploadService: UploadService) { }

    @Post('image')
    @UseInterceptors(FileInterceptor('file'))
    async uploadImage(@UploadedFile() file: Express.Multer.File) {
        const result = await this.uploadService.uploadImage(file);
        return {
            success: true,
            ...result,
        };
    }

    @Post('pdf')
    @UseInterceptors(FileInterceptor('file'))
    async uploadPdf(@UploadedFile() file: Express.Multer.File) {
        const result = await this.uploadService.uploadPdf(file);
        return {
            success: true,
            ...result,
        };
    }


    @Post('pdfs')
    @UseInterceptors(FilesInterceptor('files'))
    async uploadMultiplePdf(@UploadedFiles() files: Express.Multer.File[]) {
        const results = await this.uploadService.uploadMultiplePdf(files);

        return {
            success: true,
            count: results.length,
            items: results,
        };
    }
}
