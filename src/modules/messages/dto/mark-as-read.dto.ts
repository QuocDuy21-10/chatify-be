import { IsArray, IsMongoId } from 'class-validator';

export class MarkAsReadDto {
  @IsArray()
  @IsMongoId({ each: true })
  messageIds: string[];
}
