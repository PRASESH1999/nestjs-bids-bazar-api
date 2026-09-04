import { Injectable } from '@nestjs/common';
import { DataSource, In, Repository } from 'typeorm';
import { Payment } from '@modules/payments/entities/payment.entity';
import { User } from '@modules/users/entities/user.entity';
import { SellerRating } from './entities/seller-rating.entity';

export interface CreateRatingData {
  buyerId: string;
  sellerId: string;
  paymentId: string;
  rating: number;
  remarks: string | null;
}

@Injectable()
export class RatingsRepository {
  private readonly repo: Repository<SellerRating>;
  private readonly paymentRepo: Repository<Payment>;

  constructor(private readonly dataSource: DataSource) {
    this.repo = this.dataSource.getRepository(SellerRating);
    this.paymentRepo = this.dataSource.getRepository(Payment);
  }

  async findPaymentWithProduct(paymentId: string): Promise<Payment | null> {
    return this.paymentRepo.findOne({
      where: { id: paymentId },
      relations: ['product'],
    });
  }

  async findByPaymentId(paymentId: string): Promise<SellerRating | null> {
    return this.repo.findOneBy({ paymentId });
  }

  // Inserts the rating and recomputes the seller's aggregate in one
  // transaction, so averageRating/ratingCount can never drift from the
  // underlying rows — recomputed from scratch (AVG/COUNT), never patched
  // incrementally.
  async createAndRecomputeAggregate(
    data: CreateRatingData,
  ): Promise<SellerRating> {
    return this.dataSource.transaction(async (manager) => {
      const ratingRepo = manager.getRepository(SellerRating);
      const rating = ratingRepo.create(data);
      const saved = await ratingRepo.save(rating);

      const agg = await ratingRepo
        .createQueryBuilder('r')
        .select('AVG(r.rating)', 'avg')
        .addSelect('COUNT(*)', 'count')
        .where('r.sellerId = :sellerId', { sellerId: data.sellerId })
        .getRawOne<{ avg: string; count: string }>();

      await manager.getRepository(User).update(data.sellerId, {
        averageRating: agg ? Number(agg.avg) : 0,
        ratingCount: agg ? Number(agg.count) : 0,
      });

      return saved;
    });
  }

  async findPaginatedForSeller(
    sellerId: string,
    page: number,
    limit: number,
  ): Promise<[SellerRating[], number]> {
    return this.repo
      .createQueryBuilder('r')
      .innerJoinAndSelect('r.buyer', 'buyer')
      .where('r.sellerId = :sellerId', { sellerId })
      .orderBy('r.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();
  }

  // Single IN query for the whole batch — which of these payments already
  // have a rating. For a future buyer purchase-history endpoint to compute
  // canRate/hasRated without a per-order lookup.
  async findRatedPaymentIds(paymentIds: string[]): Promise<string[]> {
    if (paymentIds.length === 0) return [];
    const rows = await this.repo.find({
      where: { paymentId: In(paymentIds) },
      select: { paymentId: true },
    });
    return rows.map((r) => r.paymentId);
  }
}
