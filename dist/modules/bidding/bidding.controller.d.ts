import { type MessageEvent } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Observable } from 'rxjs';
import type { RequestWithUser } from "../../common/interfaces/request-with-user.interface";
import { PaginationDto } from "../../common/dto/pagination.dto";
import { Product } from "../products/entities/product.entity";
import { AuctionLifecycleService } from './services/auction-lifecycle.service';
import { AuctionBroadcastService } from './services/auction-broadcast.service';
import { BiddingService } from './services/bidding.service';
import { PlaceBidDto } from './dto/place-bid.dto';
import { ListBidsAdminQueryDto } from './dto/list-bids-admin.query.dto';
export declare class BiddingController {
    private readonly biddingService;
    private readonly auctionLifecycleService;
    private readonly auctionBroadcastService;
    private readonly dataSource;
    private readonly logger;
    constructor(biddingService: BiddingService, auctionLifecycleService: AuctionLifecycleService, auctionBroadcastService: AuctionBroadcastService, dataSource: DataSource);
    placeBid(productId: string, dto: PlaceBidDto, req: RequestWithUser): Promise<import("./entities/bid.entity").Bid>;
    streamProductEvents(productId: string): Promise<Observable<MessageEvent>>;
    getBidsForProduct(productId: string, req: RequestWithUser): Promise<import("./dto/bid-list-item.dto").BidListItemDto[] | import("./dto/bid-list-item-admin.dto").BidListItemAdminDto[]>;
    getMyBids(req: RequestWithUser, query: PaginationDto): Promise<import("../../common/types/paginated-result.type").PaginatedResult<import("./entities/bid.entity").Bid>>;
    adminGetBidsForProduct(productId: string): Promise<import("./dto/bid-list-item.dto").BidListItemDto[] | import("./dto/bid-list-item-admin.dto").BidListItemAdminDto[]>;
    confirmPayment(productId: string, req: RequestWithUser): Promise<Product>;
    listAllBids(query: ListBidsAdminQueryDto): Promise<import("../../common/types/paginated-result.type").PaginatedResult<import("./entities/bid.entity").Bid>>;
}
