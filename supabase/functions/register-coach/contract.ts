import {
  type CoachInvitationFailure,
  coachInvitationFailure,
  type CoachInvitationRequest,
  parseCoachInvitation,
} from "../_shared/coach-invitation.ts";
import type { CoachRedemptionOutcome } from "../redeem-coach-invitation/contract.ts";

export type RegisterCoachRequest = CoachInvitationRequest & {
  email: string;
  password: string;
};

export function parseRegisterCoach(
  value: unknown,
): RegisterCoachRequest | null {
  const invitation = parseCoachInvitation(value, ["email", "password"]);
  if (!invitation) return null;
  const input = value as Record<string, unknown>;
  if (
    typeof input.email !== "string" || input.email.trim().length > 320 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim()) ||
    typeof input.password !== "string" || input.password.length < 6 ||
    input.password.length > 1024
  ) {
    return null;
  }
  return { ...invitation, email: input.email.trim(), password: input.password };
}

export type RegisterCoachDependencies = {
  preflight: (invitationCode: string) => Promise<CoachInvitationFailure | null>;
  createUser: (
    payload: RegisterCoachRequest,
  ) => Promise<{ id: string } | { error: CoachInvitationFailure }>;
  redeem: (
    userId: string,
    payload: CoachInvitationRequest,
  ) => Promise<CoachRedemptionOutcome>;
  deleteCreatedUser: (userId: string) => Promise<void>;
  createStripeAccount: (
    userId: string,
    coachProfileId: string,
    email: string,
  ) => Promise<string | null>;
};

export function registerCoachHandler(dependencies: RegisterCoachDependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") {
      return Response.json({ error: "Metodă neacceptată." }, { status: 405 });
    }
    let createdUserId: string | undefined;
    let committed = false;
    try {
      let value: unknown;
      try {
        value = await request.json();
      } catch {
        return coachInvitationFailure("INVALID_REQUEST");
      }
      const payload = parseRegisterCoach(value);
      if (!payload) return coachInvitationFailure("INVALID_REQUEST");
      const preflightError = await dependencies.preflight(
        payload.invitationCode,
      );
      if (preflightError) return coachInvitationFailure(preflightError);
      const created = await dependencies.createUser(payload);
      if ("error" in created) return coachInvitationFailure(created.error);
      createdUserId = created.id;
      const redemption = await dependencies.redeem(createdUserId, payload);
      if (redemption.error) {
        await dependencies.deleteCreatedUser(createdUserId);
        createdUserId = undefined;
        return coachInvitationFailure(redemption.error);
      }
      committed = true;
      let stripeAccountId: string | null = null;
      try {
        stripeAccountId = await dependencies.createStripeAccount(
          createdUserId,
          redemption.data.coachProfileId,
          payload.email,
        );
      } catch {
        console.warn("register-coach: optional Stripe setup unavailable");
      }
      return Response.json({
        userId: createdUserId,
        stripeAccountId,
        message: "Coach registered successfully",
      });
    } catch {
      if (createdUserId && !committed) {
        try {
          await dependencies.deleteCreatedUser(createdUserId);
        } catch {
          console.error(
            "register-coach: newly created auth user cleanup failed",
          );
        }
      }
      return coachInvitationFailure("SERVER_ERROR");
    }
  };
}
