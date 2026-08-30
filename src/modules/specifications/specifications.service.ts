import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Specification } from './entities/specification.entity';
import { CreateSpecificationDto } from './dto/create-specification.dto';
import { UpdateSpecificationDto } from './dto/update-specification.dto';

@Injectable()
export class SpecificationsService {
  constructor(
    @InjectRepository(Specification)
    private readonly specificationRepo: Repository<Specification>,
  ) {}

  // ─── Public ──────────────────────────────────────────────────────────────

  async listSpecifications(includeInactive = false): Promise<Specification[]> {
    return this.specificationRepo.find({
      where: includeInactive ? {} : { isActive: true },
      order: { displayOrder: 'ASC', name: 'ASC' },
    });
  }

  async getSpecificationById(id: string): Promise<Specification> {
    const specification = await this.specificationRepo.findOne({
      where: { id },
    });
    if (!specification) throw new NotFoundException('Specification not found');
    return specification;
  }

  // ─── Admin ────────────────────────────────────────────────────────────────

  async createSpecification(
    dto: CreateSpecificationDto,
  ): Promise<Specification> {
    await this.assertSpecificationNameUnique(dto.name);

    const specification = this.specificationRepo.create({
      name: dto.name,
      displayOrder: dto.displayOrder ?? 0,
    });

    return this.specificationRepo.save(specification);
  }

  async updateSpecification(
    id: string,
    dto: UpdateSpecificationDto,
  ): Promise<Specification> {
    const specification = await this.getSpecificationById(id);

    if (
      dto.name !== undefined &&
      dto.name.toLowerCase() !== specification.name.toLowerCase()
    ) {
      await this.assertSpecificationNameUnique(dto.name, id);
      specification.name = dto.name;
    }

    if (dto.displayOrder !== undefined)
      specification.displayOrder = dto.displayOrder;
    if (dto.isActive !== undefined) specification.isActive = dto.isActive;

    return this.specificationRepo.save(specification);
  }

  async deleteSpecification(id: string): Promise<void> {
    const specification = await this.getSpecificationById(id);
    specification.isActive = false;
    await this.specificationRepo.save(specification);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private async assertSpecificationNameUnique(
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.specificationRepo
      .createQueryBuilder('specification')
      .where('LOWER(specification.name) = :name', {
        name: name.toLowerCase(),
      })
      .getOne();
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        `A specification with name '${name}' already exists`,
      );
    }
  }
}
