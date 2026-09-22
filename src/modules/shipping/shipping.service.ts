import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Not, Repository } from 'typeorm';
import {
  MAX_SHIPPING_ADDRESSES,
  ShippingAddress,
} from './entities/shipping-address.entity';
import {
  CreateShippingAddressDto,
  UpdateShippingAddressDto,
} from './dto/shipping-address.dto';

/**
 * A buyer's saved delivery addresses.
 *
 * Two invariants, both enforced here rather than in the schema because both
 * carry a message the caller needs to read:
 *
 *  - at most {@link MAX_SHIPPING_ADDRESSES} per user;
 *  - at most one default, and — while any address exists — at least one.
 *
 * The second is the fiddly one. "Exactly one default" is easy to state and
 * wrong: deleting the default would leave none, and a partial unique index
 * cannot reassign. So the rules are: the first address saved becomes the
 * default; setting a new default clears the old one in the same transaction;
 * and deleting the default promotes the oldest survivor.
 */
@Injectable()
export class ShippingService {
  constructor(
    @InjectRepository(ShippingAddress)
    private readonly addressRepo: Repository<ShippingAddress>,
    private readonly dataSource: DataSource,
  ) {}

  async list(userId: string): Promise<ShippingAddress[]> {
    return this.addressRepo.find({
      where: { userId },
      // Default first, then newest — the checkout picker reads this order
      // directly and the preselected one should be at the top.
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
  }

  async getOwned(userId: string, id: string): Promise<ShippingAddress> {
    const address = await this.addressRepo.findOne({ where: { id, userId } });
    // Scoped by userId, so someone else's id is a 404 rather than a 403 — it
    // does not confirm the row exists.
    if (!address) throw new NotFoundException('Shipping address not found');
    return address;
  }

  async create(
    userId: string,
    dto: CreateShippingAddressDto,
  ): Promise<ShippingAddress> {
    const count = await this.addressRepo.countBy({ userId });
    if (count >= MAX_SHIPPING_ADDRESSES) {
      throw new BadRequestException(
        `You can save at most ${MAX_SHIPPING_ADDRESSES} delivery addresses. Remove one to add another.`,
      );
    }

    // The first address is the default whatever the caller asked for: a buyer
    // with exactly one saved address and no default would get an empty picker.
    const isDefault = count === 0 ? true : (dto.isDefault ?? false);

    return this.dataSource.transaction(async (manager) => {
      if (isDefault) await this.clearDefaults(manager, userId);

      const address = manager.getRepository(ShippingAddress).create({
        userId,
        label: dto.label,
        recipientName: dto.recipientName,
        recipientPhone: dto.recipientPhone,
        province: dto.province,
        district: dto.district,
        city: dto.city,
        street: dto.street,
        wardNumber: dto.wardNumber ?? null,
        landmark: dto.landmark ?? null,
        isDefault,
      });
      return manager.getRepository(ShippingAddress).save(address);
    });
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateShippingAddressDto,
  ): Promise<ShippingAddress> {
    const address = await this.getOwned(userId, id);

    return this.dataSource.transaction(async (manager) => {
      if (dto.isDefault === true) {
        await this.clearDefaults(manager, userId, id);
        address.isDefault = true;
      } else if (dto.isDefault === false && address.isDefault) {
        // Refused rather than silently ignored. Turning the only default off
        // leaves the checkout picker with nothing preselected, and the way to
        // move a default is to set it on the address that should have it.
        throw new BadRequestException(
          'Set another address as the default instead of clearing this one.',
        );
      }

      if (dto.label !== undefined) address.label = dto.label;
      if (dto.recipientName !== undefined)
        address.recipientName = dto.recipientName;
      if (dto.recipientPhone !== undefined)
        address.recipientPhone = dto.recipientPhone;
      if (dto.province !== undefined) address.province = dto.province;
      if (dto.district !== undefined) address.district = dto.district;
      if (dto.city !== undefined) address.city = dto.city;
      if (dto.street !== undefined) address.street = dto.street;
      if (dto.wardNumber !== undefined)
        address.wardNumber = dto.wardNumber || null;
      if (dto.landmark !== undefined) address.landmark = dto.landmark || null;

      return manager.getRepository(ShippingAddress).save(address);
    });
  }

  async remove(userId: string, id: string): Promise<void> {
    const address = await this.getOwned(userId, id);

    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(ShippingAddress);
      await repo.remove(address);

      // Promote the oldest survivor, so a buyer who deletes their default is
      // not left with a picker that preselects nothing.
      if (address.isDefault) {
        const next = await repo.findOne({
          where: { userId },
          order: { createdAt: 'ASC' },
        });
        if (next) {
          next.isDefault = true;
          await repo.save(next);
        }
      }
    });
  }

  private async clearDefaults(
    manager: { getRepository: typeof DataSource.prototype.getRepository },
    userId: string,
    exceptId?: string,
  ): Promise<void> {
    await manager
      .getRepository(ShippingAddress)
      .update(exceptId ? { userId, id: Not(exceptId) } : { userId }, {
        isDefault: false,
      });
  }
}
