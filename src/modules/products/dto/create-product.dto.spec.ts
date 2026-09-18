import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ItemCondition } from '@common/enums/item-condition.enum';
import { CreateProductDto } from './create-product.dto';

// Multipart form-data always arrives as strings — mirrors what Nest actually
// hands the DTO at runtime (before @Type(() => Number) coercion), rather than
// a pre-typed JS object.
function buildPayload(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    title: 'A perfectly good title',
    description: 'A sufficiently long product description for validation.',
    categoryId: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
    subcategoryId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    condition: ItemCondition.NEW,
    basePrice: '1000',
    province: 'Bagmati',
    district: 'Kathmandu',
    city: 'Kathmandu',
    street: 'New Road',
    wardNumber: '5',
    ...overrides,
  };
}

async function validateDto(payload: Record<string, unknown>) {
  const dto = plainToInstance(CreateProductDto, payload);
  return validate(dto);
}

describe('CreateProductDto — pickup location validation', () => {
  it('passes with all five valid location fields', async () => {
    const errors = await validateDto(buildPayload());
    expect(errors).toHaveLength(0);
  });

  // Every field is optional at create time — a DRAFT can be saved
  // incrementally and is only fully validated at submit time (see
  // ProductsService.assertReadyForSubmission), not here.
  it.each(['province', 'district', 'city', 'street', 'wardNumber'])(
    'passes when %s is missing (deferred to submission, not creation)',
    async (field) => {
      const payload = buildPayload();
      delete payload[field];

      const errors = await validateDto(payload);
      expect(errors.find((e) => e.property === field)).toBeUndefined();
    },
  );

  it.each(['province', 'district', 'city', 'street'])(
    'fails when %s is an empty string (still shape-validated if provided)',
    async (field) => {
      const errors = await validateDto(buildPayload({ [field]: '' }));
      const fieldError = errors.find((e) => e.property === field);
      expect(fieldError?.constraints).toHaveProperty('isNotEmpty');
    },
  );

  it.each(['0', '-3', '2.5', 'abc'])(
    'fails when wardNumber is invalid (%s)',
    async (wardNumber) => {
      const errors = await validateDto(buildPayload({ wardNumber }));
      expect(errors.find((e) => e.property === 'wardNumber')).toBeDefined();
    },
  );

  it('accepts a positive integer wardNumber', async () => {
    const errors = await validateDto(buildPayload({ wardNumber: '12' }));
    expect(errors.find((e) => e.property === 'wardNumber')).toBeUndefined();
  });
});

describe('CreateProductDto — basePrice validation', () => {
  it('accepts a whole-number basePrice', async () => {
    const errors = await validateDto(buildPayload({ basePrice: '1590' }));
    expect(errors.find((e) => e.property === 'basePrice')).toBeUndefined();
  });

  it('rejects a basePrice with decimals', async () => {
    const errors = await validateDto(buildPayload({ basePrice: '1590.50' }));
    expect(
      errors.find((e) => e.property === 'basePrice')?.constraints,
    ).toHaveProperty('isInt');
  });
});

describe('CreateProductDto — draft creation with an empty payload', () => {
  it('passes with no fields at all — a DRAFT can start completely empty', async () => {
    const errors = await validateDto({});
    expect(errors).toHaveLength(0);
  });

  it('still shape-validates whatever IS provided on a partial draft', async () => {
    const errors = await validateDto({ categoryId: 'not-a-uuid' });
    expect(
      errors.find((e) => e.property === 'categoryId')?.constraints,
    ).toHaveProperty('isUuid');
  });
});
