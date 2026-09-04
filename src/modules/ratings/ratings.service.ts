import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PaymentStatus } from '@common/enums/payment-status.enum';
import { PaginatedResult } from '@common/types/paginated-result.type';
import { SellerRating } from './entities/seller-rating.entity';
import { RatingsRepository } from './ratings.repository';

export interface CreatedRatingResponse {
  id: string;
  rating: number;
  remarks: string | null;
  createdAt: Date;
}

export interface SellerRatingResponse {
  id: string;
  rating: number;
  remarks: string | null;
  createdAt: Date;
  buyer: { username: string };
}

@Injectable()
export class RatingsService {
  constructor(private readonly ratingsRepository: RatingsRepository) {}

  async rateSeller(
    buyerId: string,
    paymentId: string,
    rating: number,
    remarks?: string,
  ): Promise<CreatedRatingResponse> {
    const payment =
      await this.ratingsRepository.findPaymentWithProduct(paymentId);
    if (!payment) {
      throw new NotFoundException('Transaction not found');
    }

    if (payment.winnerUserId !== buyerId) {
      throw new ForbiddenException(
        'You are not the buyer for this transaction',
      );
    }

    if (payment.status !== PaymentStatus.SUCCESS) {
      throw new BadRequestException('This transaction is not complete yet');
    }

    const existing = await this.ratingsRepository.findByPaymentId(paymentId);
    if (existing) {
      throw new ConflictException('You have already rated this transaction');
    }

    // The unique paymentId index is the final backstop against a concurrent
    // double-rating race — a 23505 from it is mapped to the same 409 by the
    // global exception filter.
    const saved = await this.ratingsRepository.createAndRecomputeAggregate({
      buyerId,
      sellerId: payment.product.ownerId,
      paymentId,
      rating,
      remarks: remarks ?? null,
    });

    return {
      id: saved.id,
      rating: saved.rating,
      remarks: saved.remarks,
      createdAt: saved.createdAt,
    };
  }

  async listSellerRatings(
    sellerId: string,
    page: number,
    limit: number,
  ): Promise<PaginatedResult<SellerRatingResponse>> {
    const [rows, total] = await this.ratingsRepository.findPaginatedForSeller(
      sellerId,
      page,
      limit,
    );
    return {
      data: rows.map((r) => this.mapRating(r)),
      meta: { page, limit, total },
    };
  }

  /**
   * Which of `paymentIds` already have a rating, as a single batch query.
   * For a future buyer purchase-history endpoint to compute hasRated/canRate
   * without a per-order lookup.
   */
  async getRatedPaymentIds(paymentIds: string[]): Promise<Set<string>> {
    if (paymentIds.length === 0) return new Set();
    const ids = await this.ratingsRepository.findRatedPaymentIds(paymentIds);
    return new Set(ids);
  }

  private mapRating(r: SellerRating): SellerRatingResponse {
    return {
      id: r.id,
      rating: r.rating,
      remarks: r.remarks,
      createdAt: r.createdAt,
      buyer: { username: r.buyer.username },
    };
  }
}
