import { IsEnum, IsInt, IsNotEmpty, IsString } from 'class-validator';
import { PointsTransactionType } from '@common/enums/points-transaction-type.enum';

export class AdjustPointsDto {
  @IsEnum(PointsTransactionType)
  type: PointsTransactionType;

  // Positive to credit, negative to debit.
  @IsInt()
  delta: number;

  @IsString()
  @IsNotEmpty()
  reason: string;
}
