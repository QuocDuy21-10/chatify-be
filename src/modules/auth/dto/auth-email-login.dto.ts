import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class AuthEmailLoginDto {
  @ApiProperty({ example: 'admin@gmail.com', description: 'Email' })
  @IsString({ message: 'Email must be a string' })
  @IsNotEmpty({ message: 'Email is required' })
  @IsEmail({}, { message: 'Email must be a valid email' })
  email: string;

  @IsString({ message: 'password must be a string' })
  @IsNotEmpty({ message: 'password is required' })
  @Transform(({ value }) => value.trim())
  @ApiProperty({
    example: '123456',
    description: 'password',
  })
  password: string;
}
