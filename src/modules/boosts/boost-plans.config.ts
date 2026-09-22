import { BoostScheme } from '@common/enums/boost-scheme.enum';

export interface BoostPlan {
  scheme: BoostScheme;
  days: number;
  price: number;
}

// Fixed pricing tiers — not env-configurable (Rule: business constants live in
// code, same as Product's basePrice multipliers). No refunds once purchased.
export const BOOST_PLANS: Record<BoostScheme, BoostPlan> = {
  [BoostScheme.PER_DAY]: { scheme: BoostScheme.PER_DAY, days: 1, price: 200 },
  [BoostScheme.THREE_DAYS]: {
    scheme: BoostScheme.THREE_DAYS,
    days: 3,
    price: 500,
  },
  [BoostScheme.SEVEN_DAYS]: {
    scheme: BoostScheme.SEVEN_DAYS,
    days: 7,
    price: 1000,
  },
  [BoostScheme.FIFTEEN_DAYS]: {
    scheme: BoostScheme.FIFTEEN_DAYS,
    days: 15,
    price: 1800,
  },
  [BoostScheme.THIRTY_DAYS]: {
    scheme: BoostScheme.THIRTY_DAYS,
    days: 30,
    price: 3000,
  },
};
