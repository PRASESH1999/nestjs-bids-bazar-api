/**
 * SANDBOX SMOKE TEST — NOT COMMITTED TO PRODUCTION.
 * Run once against the Pathao Courier sandbox to verify credentials and the
 * city/zone/area location lookups the checkout picker depends on.
 *
 * Usage:
 *   npx ts-node -r tsconfig-paths/register scripts/pathao-sandbox-test.ts
 *
 * Requires a valid .env (or .env.development) with PATHAO_* vars set.
 * Does NOT create a real order — PATHAO_STORE_ID may not point at a real,
 * approved store yet (that's a manual one-time registration step outside
 * this codebase). Remove or gate (NODE_ENV check) this file before
 * production.
 */
import 'dotenv/config';
import axios from 'axios';

const BASE_URL = process.env.PATHAO_BASE_URL!;
const CLIENT_ID = process.env.PATHAO_CLIENT_ID!;
const CLIENT_SECRET = process.env.PATHAO_CLIENT_SECRET!;
const USERNAME = process.env.PATHAO_USERNAME!;
const PASSWORD = process.env.PATHAO_PASSWORD!;

async function run() {
  // ── Step 1: Issue token (password grant) ──────────────────────────────────
  console.log('\n--- Step 1: Issue token ---');
  const tokenRes = await axios.post<{
    token_type: string;
    expires_in: number;
    access_token: string;
    refresh_token: string;
  }>(`${BASE_URL}/aladdin/api/v1/issue-token`, {
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    grant_type: 'password',
    username: USERNAME,
    password: PASSWORD,
  });
  console.log('Token status:', tokenRes.status);
  console.log('expires_in (s):', tokenRes.data.expires_in);
  const accessToken = tokenRes.data.access_token;
  console.log('access_token prefix:', accessToken.slice(0, 20) + '...');

  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${accessToken}`,
  };

  // ── Step 2: City list ──────────────────────────────────────────────────────
  console.log('\n--- Step 2: City list ---');
  const cityRes = await axios.get<{
    data: { data: { city_id: number; city_name: string }[] };
  }>(`${BASE_URL}/aladdin/api/v1/city-list`, { headers: authHeaders });
  const cities = cityRes.data.data.data;
  console.log('Cities received:', cities.length);
  const firstCity = cities[0];
  console.log('First city:', firstCity);

  // ── Step 3: Zone list (for the first city) ─────────────────────────────────
  console.log('\n--- Step 3: Zone list ---');
  const zoneRes = await axios.get<{
    data: { data: { zone_id: number; zone_name: string }[] };
  }>(`${BASE_URL}/aladdin/api/v1/cities/${firstCity.city_id}/zone-list`, {
    headers: authHeaders,
  });
  const zones = zoneRes.data.data.data;
  console.log(`Zones received for city ${firstCity.city_id}:`, zones.length);
  const firstZone = zones[0];
  console.log('First zone:', firstZone);

  // ── Step 4: Area list (for the first zone) ─────────────────────────────────
  console.log('\n--- Step 4: Area list ---');
  const areaRes = await axios.get<{
    data: {
      data: {
        area_id: number;
        area_name: string;
        home_delivery_available: boolean;
        pickup_available: boolean;
      }[];
    };
  }>(`${BASE_URL}/aladdin/api/v1/zones/${firstZone.zone_id}/area-list`, {
    headers: authHeaders,
  });
  const areas = areaRes.data.data.data;
  console.log(`Areas received for zone ${firstZone.zone_id}:`, areas.length);
  console.log('First area:', areas[0]);

  console.log('\n✓ All sandbox steps completed successfully.');
  console.log(
    '\nNOTE: no order was created. To smoke-test order creation, first ' +
      'register the warehouse as a Pathao Store (manual, one-time, via ' +
      "Pathao's own onboarding), set PATHAO_STORE_ID to its real id, then " +
      'exercise POST /admin/deliveries/:id/dispatch through the app instead ' +
      'of this script.',
  );
}

run().catch((err: unknown) => {
  const detail: unknown = axios.isAxiosError(err)
    ? (err.response?.data ?? err.message)
    : err instanceof Error
      ? err.message
      : String(err);
  console.error('Smoke test failed:', detail);
  process.exit(1);
});
