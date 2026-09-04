import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateReportDto } from './create-report.dto';

async function validateDto(payload: Record<string, unknown>) {
  const dto = plainToInstance(CreateReportDto, payload);
  return validate(dto);
}

describe('CreateReportDto', () => {
  it('passes with valid, non-empty remarks', async () => {
    const errors = await validateDto({ remarks: 'This listing looks fake.' });
    expect(errors).toHaveLength(0);
  });

  it('fails when remarks is empty', async () => {
    const errors = await validateDto({ remarks: '' });
    const fieldError = errors.find((e) => e.property === 'remarks');
    expect(fieldError?.constraints).toHaveProperty('isNotEmpty');
  });

  it('fails when remarks is missing', async () => {
    const errors = await validateDto({});
    expect(errors.find((e) => e.property === 'remarks')).toBeDefined();
  });

  it('fails when remarks exceeds 1000 characters', async () => {
    const errors = await validateDto({ remarks: 'a'.repeat(1001) });
    const fieldError = errors.find((e) => e.property === 'remarks');
    expect(fieldError?.constraints).toHaveProperty('maxLength');
  });
});
