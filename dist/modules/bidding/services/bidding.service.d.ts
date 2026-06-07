import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { DataSource } from 'typeorm';
import { PaginatedResult } from "../../../common/types/paginated-result.type";
import { PaginationDto } from "../../../common/dto/pagination.dto";
import { MailService } from "../../mail/mail.service";
import { Bid } from '../entities/bid.entity';
import { BidListItemAdminDto } from '../dto/bid-list-item-admin.dto';
import { BidListItemDto } from '../dto/bid-list-item.dto';
import { ListBidsAdminQueryDto } from '../dto/list-bids-admin.query.dto';
import { PlaceBidDto } from '../dto/place-bid.dto';
export declare class BiddingService {
    private readonly dataSource;
    private readonly configService;
    private readonly mailService;
    private readonly eventEmitter;
    private readonly logger;
    constructor(dataSource: DataSource, configService: ConfigService, mailService: MailService, eventEmitter: EventEmitter2);
    placeBid(userId: string, productId: string, dto: PlaceBidDto): Promise<Bid>;
    getBidsForProduct(productId: string, viewerType: 'authenticated' | 'admin'): Promise<BidListItemDto[] | BidListItemAdminDto[]>;
    getTopBiddersForProduct(productId: string): Promise<Array<{
        username: string;
        highestBid: number;
    }>>;
    getBidCountsForProduct(productId: string): Promise<{
        totalBids: number;
        newBidsToday: number;
    }>;
    getWinningBidder(winningBidId: string | null): Promise<{
        id: string;
        username: string;
        winningBid: number;
    } | null>;
    getMyBids(userId: string, query: PaginationDto): Promise<PaginatedResult<Bid>>;
    listAllBids(query: ListBidsAdminQueryDto): Promise<PaginatedResult<Bid>>;
    private computeValidBidRange;
}
