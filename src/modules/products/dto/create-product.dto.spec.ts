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

  it.each(['province', 'district', 'city', 'street'])(
    'fails when %s is missing',
    async (field) => {
      const payload = buildPayload();
      delete payload[field];

      const errors = await validateDto(payload);
      expect(errors.find((e) => e.property === field)).toBeDefined();
    },
  );

  it.each(['province', 'district', 'city', 'street'])(
    'fails when %s is an empty string',
    async (field) => {
      const errors = await validateDto(buildPayload({ [field]: '' }));
      const fieldError = errors.find((e) => e.property === field);
      expect(fieldError?.constraints).toHaveProperty('isNotEmpty');
    },
  );

  it('fails when wardNumber is missing', async () => {
    const payload = buildPayload();
    delete payload.wardNumber;

    const errors = await validateDto(payload);
    expect(errors.find((e) => e.property === 'wardNumber')).toBeDefined();
  });

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
