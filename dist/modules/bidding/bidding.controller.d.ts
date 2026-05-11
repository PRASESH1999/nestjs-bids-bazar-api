import type { RequestWithUser } from "../../common/interfaces/request-with-user.interface";
import { PaginationDto } from "../../common/dto/pagination.dto";
import { AuctionLifecycleService } from './services/auction-lifecycle.service';
import { BiddingService } from './services/bidding.service';
import { PlaceBidDto } from './dto/place-bid.dto';
import { ListBidsAdminQueryDto } from './dto/list-bids-admin.query.dto';
export declare class BiddingController {
    private readonly biddingService;
    private readonly auctionLifecycleService;
    private readonly logger;
    constructor(biddingService: BiddingService, auctionLifecycleService: AuctionLifecycleService);
    placeBid(productId: string, dto: PlaceBidDto, req: RequestWithUser): Promise<import("./entities/bid.entity").Bid>;
    getBidsForProduct(productId: string, req: RequestWithUser): Promise<import("./dto/bid-list-item.dto").BidListItemDto[] | import("./dto/bid-list-item-admin.dto").BidListItemAdminDto[]>;
    getMyBids(req: RequestWithUser, query: PaginationDto): Promise<import("../../common/types/paginated-result.type").PaginatedResult<import("./entities/bid.entity").Bid>>;
    adminGetBidsForProduct(productId: string): Promise<import("./dto/bid-list-item.dto").BidListItemDto[] | import("./dto/bid-list-item-admin.dto").BidListItemAdminDto[]>;
    confirmPayment(productId: string, req: RequestWithUser): Promise<import("../products/entities/product.entity").Product>;
    listAllBids(query: ListBidsAdminQueryDto): Promise<import("../../common/types/paginated-result.type").PaginatedResult<import("./entities/bid.entity").Bid>>;
}
