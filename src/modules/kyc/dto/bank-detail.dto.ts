import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class BankDetailDto {
  @ApiProperty({ example: 'Nepal Investment Bank' })
  @IsNotEmpty()
  @IsString()
  bankName: string;

  @ApiProperty({ example: 'John Doe' })
  @IsNotEmpty()
  @IsString()
  accountHolderName: string;

  @ApiProperty({ example: '0123456789', description: '9–20 digit account number' })
  @IsNotEmpty()
  @Matches(/^\d{9,20}$/, { message: 'accountNumber must be 9–20 digits' })
  accountNumber: string;

  @ApiProperty({ example: 'Thamel Branch' })
  @IsNotEmpty()
  @IsString()
  branch: string;

  @ApiPropertyOptional({ example: 'NIBLNPKT' })
  @IsOptional()
  @IsString()
  swiftCode?: string;
}
