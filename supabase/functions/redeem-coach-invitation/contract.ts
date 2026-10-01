import {
  type CoachInvitationFailure,
  coachInvitationFailure,
  type CoachInvitationRequest,
  type CoachInvitationResult,
  parseCoachInvitation,
} from "../_shared/coach-invitation.ts";

export type CoachRedemptionOutcome =
  | { data: CoachInvitationResult; error?: never }
  | { data?: never; error: CoachInvitationFailure };

export type CoachRedemptionDependencies = {
  getActor: (request: Request) => Promise<{ id: string }>;
  redeem: (
    userId: string,
    payload: CoachInvitationRequest,
  ) => Promise<CoachRedemptionOutcome>;
};

export function coachRedemptionHandler(
  dependencies: CoachRedemptionDependencies,
) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== "POST") {
      return Response.json({ error: "Metodă neacceptată." }, { status: 405 });
    }
    try {
      const actor = await dependencies.getActor(request);
      let value: unknown;
      try {
        value = await request.json();
      } catch {
        return coachInvitationFailure("INVALID_REQUEST");
      }
      const payload = parseCoachInvitation(value);
      if (!payload) return coachInvitationFailure("INVALID_REQUEST");
      const result = await dependencies.redeem(actor.id, payload);
      return result.error
        ? coachInvitationFailure(result.error)
        : Response.json(result.data);
    } catch (error) {
      return coachInvitationFailure(
        error instanceof Response && error.status === 401
          ? "UNAUTHORIZED"
          : "SERVER_ERROR",
      );
    }
  };
}
