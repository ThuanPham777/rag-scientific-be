import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
    @ApiProperty({ description: 'Current password' })
    @IsString()
    oldPassword: string;

    @ApiProperty({ description: 'New password (min 8 characters)', minLength: 8 })
    @IsString()
    @MinLength(8)
    newPassword: string;
}
