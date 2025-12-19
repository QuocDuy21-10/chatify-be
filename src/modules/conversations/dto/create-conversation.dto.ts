import { ApiParam, ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsMongoId } from 'class-validator';

export class CreateConversationDto {
  @IsNotEmpty()
  @IsMongoId()
  @ApiProperty({
    description: 'The ID of the participant user',
    example: '60d0fe4f5311236168a109ca',
  })
  participantId: string;
}
