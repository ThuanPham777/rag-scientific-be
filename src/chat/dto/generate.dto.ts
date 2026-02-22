import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class GenerateRequestDto {
  @ApiProperty({
    description: 'Prompt or instruction for the AI to follow',
    example: 'Write a brief introduction about convolutional neural networks.',
    minLength: 1,
  })
  @IsString()
  @MinLength(1)
  prompt: string;
}

export class GenerateResponseDto {
  @ApiProperty({
    description: 'Generated text produced by the AI model',
  })
  answer: string;
}
