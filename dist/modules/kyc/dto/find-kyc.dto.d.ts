import { KycStatus } from "../../../common/enums/kyc-status.enum";
import { PaginationDto } from "../../../common/dto/pagination.dto";
export declare class FindKycDto extends PaginationDto {
    status?: KycStatus;
}
