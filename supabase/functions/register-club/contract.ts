import {
  type AnafCompany,
  type CompanyLookup,
  isValidCui,
  normalizeCui,
} from "../_shared/company-cui.ts";

export type RegisterClubRequest = {
  email: string;
  password: string;
  name: string;
  phone: string;
  clubName: string;
  companyCui: string;
  clubCity: string | null;
  sportIds: string[];
};

export type RegisterClubFailure =
  | "INVALID_REQUEST"
  | "CUI_NOT_FOUND"
  | "CUI_DEREGISTERED"
  | "CUI_INACTIVE"
  | "ACCOUNT_EXISTS"
  | "SERVER_ERROR";

const FAILURE_STATUS: Record<RegisterClubFailure, number> = {
  INVALID_REQUEST: 400,
  CUI_NOT_FOUND: 422,
  CUI_DEREGISTERED: 422,
  CUI_INACTIVE: 422,
  ACCOUNT_EXISTS: 409,
  SERVER_ERROR: 500,
};

export function registerClubFailure(code: RegisterClubFailure): Response {
  return Response.json({ error: code, code }, {
    status: FAILURE_STATUS[code],
  });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function trimmed(value: unknown, min: number, max: number): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  return text.length >= min && text.length <= max ? text : null;
}

export function parseRegisterClub(value: unknown): RegisterClubRequest | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const email = trimmed(input.email, 3, 320);
  const name = trimmed(input.name, 3, 200);
  const clubName = trimmed(input.clubName, 2, 200);
  const phone = typeof input.phone === "string"
    ? input.phone.replace(/[\s.-]/g, "")
    : "";
  const companyCui = typeof input.companyCui === "string"
    ? normalizeCui(input.companyCui)
    : "";
  const city = input.clubCity === undefined || input.clubCity === null
    ? null
    : trimmed(input.clubCity, 0, 120);
  const sportIds = input.sportIds === undefined ? [] : input.sportIds;
  if (
    !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name ||
    !clubName || !/^\+?[0-9]{8,15}$/.test(phone) || !isValidCui(companyCui) ||
    (input.clubCity !== undefined && input.clubCity !== null &&
      city === null) ||
    typeof input.password !== "string" || input.password.length < 6 ||
    input.password.length > 1024 || !Array.isArray(sportIds) ||
    sportIds.length > 50 ||
    !sportIds.every((id) => typeof id === "string" && UUID.test(id))
  ) {
    return null;
  }
  return {
    email,
    password: input.password,
    name,
    phone,
    clubName,
    companyCui,
    clubCity: city || null,
    sportIds: [...new Set(sportIds as string[])],
  };
}

export type ClubRecord = {
  ownerUserId: string;
  payload: RegisterClubRequest;
  company: AnafCompany | null;
};

export type RegisterClubDependencies = {
  lookupCompany: (cui: string) => Promise<CompanyLookup>;
  createUser: (
    payload: RegisterClubRequest,
  ) => Promise<{ id: string } | { error: RegisterClubFailure }>;
  promoteToClub: (userId: string) => Promise<boolean>;
  insertClub: (record: ClubRecord) => Promise<string | null>;
  linkSports: (clubId: string, sportIds: string[]) => Promise<void>;
  deleteCreatedUser: (userId: string) => Promise<void>;
  createStripeAccount: (
    clubId: string,
    payload: RegisterClubRequest,
  ) => Promise<string | null>;
};

const LOOKUP_FAILURE: Partial<
  Record<CompanyLookup["status"], RegisterClubFailure>
> = {
  not_found: "CUI_NOT_FOUND",
  deregistered: "CUI_DEREGISTERED",
  inactive: "CUI_INACTIVE",
};

export function registerClubHandler(dependencies: RegisterClubDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") {
      return Response.json({ error: "Metodă neacceptată." }, { status: 405 });
    }
    let value: unknown;
    try {
      value = await request.json();
    } catch {
      return registerClubFailure("INVALID_REQUEST");
    }
    const payload = parseRegisterClub(value);
    if (!payload) return registerClubFailure("INVALID_REQUEST");

    const lookup = await dependencies.lookupCompany(payload.companyCui);
    const lookupFailure = LOOKUP_FAILURE[lookup.status];
    if (lookupFailure) return registerClubFailure(lookupFailure);
    const company = lookup.status === "found" ? lookup.company : null;

    const created = await dependencies.createUser(payload);
    if ("error" in created) return registerClubFailure(created.error);
    const userId = created.id;

    const clubId = await dependencies.promoteToClub(userId)
      ? await dependencies.insertClub({ ownerUserId: userId, payload, company })
      : null;
    if (!clubId) {
      await dependencies.deleteCreatedUser(userId);
      return registerClubFailure("SERVER_ERROR");
    }

    if (payload.sportIds.length) {
      await dependencies.linkSports(clubId, payload.sportIds).catch(() => {});
    }
    const stripeAccountId = await dependencies
      .createStripeAccount(clubId, payload).catch(() => null);

    return Response.json({
      userId,
      clubId,
      stripeAccountId,
      companyVerified: company !== null,
    });
  };
}
