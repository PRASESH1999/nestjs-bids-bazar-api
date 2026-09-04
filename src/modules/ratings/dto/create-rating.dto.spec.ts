import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateRatingDto } from './create-rating.dto';

async function validateDto(payload: Record<string, unknown>) {
  const dto = plainToInstance(CreateRatingDto, payload);
  return validate(dto);
}

describe('CreateRatingDto', () => {
  it.each([1, 2, 3, 4, 5])('passes for rating = %i', async (rating) => {
    const errors = await validateDto({ rating });
    expect(errors).toHaveLength(0);
  });

  it('passes with optional remarks', async () => {
    const errors = await validateDto({ rating: 5, remarks: 'Great seller!' });
    expect(errors).toHaveLength(0);
  });

  it.each([0, 6, -1])('fails for rating = %i (outside 1-5)', async (rating) => {
    const errors = await validateDto({ rating });
    expect(errors.find((e) => e.property === 'rating')).toBeDefined();
  });

  it('fails for a non-integer rating', async () => {
    const errors = await validateDto({ rating: 3.5 });
    const fieldError = errors.find((e) => e.property === 'rating');
    expect(fieldError?.constraints).toHaveProperty('isInt');
  });

  it('fails when rating is missing', async () => {
    const errors = await validateDto({});
    expect(errors.find((e) => e.property === 'rating')).toBeDefined();
  });

  it('fails when remarks exceeds 1000 characters', async () => {
    const errors = await validateDto({ rating: 5, remarks: 'a'.repeat(1001) });
    const fieldError = errors.find((e) => e.property === 'remarks');
    expect(fieldError?.constraints).toHaveProperty('maxLength');
  });
});
