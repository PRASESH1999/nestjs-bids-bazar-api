import {
  BadGatewayException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import axios from 'axios';
import { firstValueFrom } from 'rxjs';
import { PathaoAuthService } from './pathao-auth.service';
import type {
  PathaoArea,
  PathaoCity,
  PathaoCreateOrderInput,
  PathaoCreateOrderResult,
  PathaoOrderInfoResult,
  PathaoZone,
} from '../dto/pathao.dto';

// City/zone/area lists are large and rarely change — cached in memory rather
// than a DB-backed cache table (see plan decision #7).
const LOCATION_CACHE_TTL_MS = 60 * 60 * 1000;

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

@Injectable()
export class PathaoClientService {
  private readonly logger = new Logger(PathaoClientService.name);

  private citiesCache: CacheEntry<PathaoCity[]> | null = null;
  private readonly zonesCache = new Map<number, CacheEntry<PathaoZone[]>>();
  private readonly areasCache = new Map<number, CacheEntry<PathaoArea[]>>();

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
    private readonly authService: PathaoAuthService,
  ) {}

  // ─── Location lookups (proxied to the frontend, credentials never leave
  // the server) ────────────────────────────────────────────────────────────

  async getCities(): Promise<PathaoCity[]> {
    if (this.citiesCache && this.isFresh(this.citiesCache)) {
      return this.citiesCache.data;
    }
    const raw = await this.request<{
      data: { data: { city_id: number; city_name: string }[] };
    }>('GET', '/aladdin/api/v1/city-list');
    const cities = raw.data.data.map((c) => ({
      cityId: c.city_id,
      cityName: c.city_name,
    }));
    this.citiesCache = { data: cities, fetchedAt: Date.now() };
    return cities;
  }

  async getZones(cityId: number): Promise<PathaoZone[]> {
    const cached = this.zonesCache.get(cityId);
    if (cached && this.isFresh(cached)) return cached.data;

    const raw = await this.request<{
      data: { data: { zone_id: number; zone_name: string }[] };
    }>('GET', `/aladdin/api/v1/cities/${cityId}/zone-list`);
    const zones = raw.data.data.map((z) => ({
      zoneId: z.zone_id,
      zoneName: z.zone_name,
    }));
    this.zonesCache.set(cityId, { data: zones, fetchedAt: Date.now() });
    return zones;
  }

  async getAreas(zoneId: number): Promise<PathaoArea[]> {
    const cached = this.areasCache.get(zoneId);
    if (cached && this.isFresh(cached)) return cached.data;

    const raw = await this.request<{
      data: {
        data: {
          area_id: number;
          area_name: string;
          home_delivery_available: boolean;
          pickup_available: boolean;
        }[];
      };
    }>('GET', `/aladdin/api/v1/zones/${zoneId}/area-list`);
    const areas = raw.data.data.map((a) => ({
      areaId: a.area_id,
      areaName: a.area_name,
      homeDeliveryAvailable: a.home_delivery_available,
      pickupAvailable: a.pickup_available,
    }));
    this.areasCache.set(zoneId, { data: areas, fetchedAt: Date.now() });
    return areas;
  }

  private isFresh<T>(entry: CacheEntry<T>): boolean {
    return Date.now() - entry.fetchedAt < LOCATION_CACHE_TTL_MS;
  }

  // ─── Serviceability ─────────────────────────────────────────────────────
  // We can only fulfil inside Kathmandu Valley for now (plan decision #2) —
  // a hard checkout gate, not a UI hint. Config-only check, no Pathao call.

  private valleyCityIds: Set<number> | null = null;

  isServiceable(pathaoCityId: number): boolean {
    return this.loadValleyCityIds().has(pathaoCityId);
  }

  serviceableCityIds(): number[] {
    return [...this.loadValleyCityIds()];
  }

  private loadValleyCityIds(): Set<number> {
    if (!this.valleyCityIds) {
      const raw = this.configService.getOrThrow<string>(
        'PATHAO_VALLEY_CITY_IDS',
      );
      this.valleyCityIds = new Set(
        raw
          .split(',')
          .map((s) => Number(s.trim()))
          .filter((n) => !Number.isNaN(n)),
      );
    }
    return this.valleyCityIds;
  }

  // ─── Orders ─────────────────────────────────────────────────────────────

  async createOrder(
    input: PathaoCreateOrderInput,
  ): Promise<PathaoCreateOrderResult> {
    const body = {
      store_id: input.storeId,
      merchant_order_id: input.merchantOrderId,
      recipient_name: input.recipientName,
      recipient_phone: input.recipientPhone,
      recipient_address: input.recipientAddress,
      recipient_city: input.recipientCity,
      recipient_zone: input.recipientZone,
      ...(input.recipientArea !== null
        ? { recipient_area: input.recipientArea }
        : {}),
      delivery_type: 48, // Normal delivery — v1 has no express option
      item_type: 2, // Parcel
      item_quantity: input.itemQuantity,
      item_weight: input.itemWeightKg,
      item_description: input.itemDescription,
      amount_to_collect: input.amountToCollect,
      ...(input.specialInstruction
        ? { special_instruction: input.specialInstruction }
        : {}),
    };

    const raw = await this.request<{
      data: {
        consignment_id: string;
        merchant_order_id: string;
        order_status: string;
        delivery_fee: number | null;
      };
    }>('POST', '/aladdin/api/v1/orders', body);

    return {
      consignmentId: raw.data.consignment_id,
      merchantOrderId: raw.data.merchant_order_id,
      orderStatus: raw.data.order_status,
      deliveryFee: raw.data.delivery_fee ?? null,
    };
  }

  async getOrderInfo(consignmentId: string): Promise<PathaoOrderInfoResult> {
    const raw = await this.request<{
      data: {
        consignment_id: string;
        merchant_order_id: string | null;
        order_status: string;
        order_status_slug: string;
        updated_at: string | null;
      };
    }>('GET', `/aladdin/api/v1/orders/${consignmentId}/info`);

    return {
      consignmentId: raw.data.consignment_id,
      merchantOrderId: raw.data.merchant_order_id,
      orderStatus: raw.data.order_status,
      orderStatusSlug: raw.data.order_status_slug,
      updatedAt: raw.data.updated_at,
    };
  }

  // ─── Internal request helper ───────────────────────────────────────────

  private async request<T>(
    method: 'GET' | 'POST',
    endpoint: string,
    body?: unknown,
    isRetry = false,
  ): Promise<T> {
    const baseUrl = this.configService.getOrThrow<string>('PATHAO_BASE_URL');
    const url = `${baseUrl}${endpoint}`;
    const authHeader = await this.authService.getAuthHeader();

    const headers = {
      'Content-Type': 'application/json',
      Authorization: authHeader,
    };

    try {
      const obs =
        method === 'GET'
          ? this.httpService.get<T>(url, { headers, timeout: 10_000 })
          : this.httpService.post<T>(url, body, { headers, timeout: 10_000 });

      const response = await firstValueFrom(obs);
      return response.data;
    } catch (err: unknown) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;

      if (status === 401 && !isRetry) {
        this.logger.warn(
          `${endpoint} returned 401, refreshing token and retrying`,
        );
        await this.authService.forceRefresh();
        return this.request<T>(method, endpoint, body, true);
      }

      this.mapError(err, endpoint);
    }
  }

  private mapError(err: unknown, endpoint: string): never {
    const isAxios = axios.isAxiosError(err);
    const status = isAxios ? err.response?.status : undefined;
    const payload: unknown = isAxios ? err.response?.data : undefined;
    const rawMessage = err instanceof Error ? err.message : String(err);
    const message =
      (typeof payload === 'object' && payload !== null
        ? JSON.stringify(payload)
        : (payload as string | undefined)) ?? rawMessage;

    if (!status) {
      throw new ServiceUnavailableException(
        `Network or timeout error calling Pathao ${endpoint}: ${rawMessage}`,
      );
    }

    throw new BadGatewayException(
      `Pathao ${endpoint} failed (${status}): ${message}`,
    );
  }
}
