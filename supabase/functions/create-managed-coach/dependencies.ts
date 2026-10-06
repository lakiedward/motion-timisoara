import type { ManagedCoachDependencies } from "./contract.ts";

type DatabaseError = { message: string; code?: string };
type DatabaseResult<T> = { data: T | null; error: DatabaseError | null };
type CoachRow = {
  id?: string;
  role?: string;
  enabled?: boolean;
  user_id?: string;
  sport_id?: string;
  club_id?: string;
  coach_profile_id?: string;
};
type CoachQuery = PromiseLike<DatabaseResult<CoachRow[]>> & {
  eq: (column: string, value: string) => CoachQuery;
  single: () => PromiseLike<DatabaseResult<CoachRow>>;
  maybeSingle: () => PromiseLike<DatabaseResult<CoachRow>>;
};
type CoachMutation = {
  eq: (column: string, value: string) => CoachMutation;
  select: (columns: string) => CoachQuery;
};
type ManagedAuthUser = {
  id: string;
  email?: string;
  email_confirmed_at?: string;
  app_metadata: Record<string, unknown>;
};
type AuthResult = {
  data: { user: ManagedAuthUser | null };
  error: DatabaseError | null;
};

export type ManagedCoachClient = {
  auth: {
    getUser: (token: string) => Promise<AuthResult>;
    admin: {
      createUser: (input: {
        email: string;
        password: string;
        email_confirm: boolean;
        user_metadata: { name: string; phone?: string };
        app_metadata: { managed_coach_creation_id: string };
      }) => Promise<AuthResult>;
      getUserById: (id: string) => Promise<AuthResult>;
      deleteUser: (id: string) => Promise<{ error: DatabaseError | null }>;
    };
  };
  from: (table: string) => {
    select: (columns: string) => CoachQuery;
    update: (input: Record<string, unknown>) => CoachMutation;
    insert: (
      input: Record<string, unknown> | Record<string, unknown>[],
    ) => CoachMutation;
  };
};

export function createManagedCoachDependencies(
  client: ManagedCoachClient,
): ManagedCoachDependencies {
  return {
    getCaller: async (token) => {
      const { data, error } = await client.auth.getUser(token);
      if (error || !data.user) return null;
      const { data: profile, error: profileError } = await client
        .from("profiles").select("role,enabled").eq("id", data.user.id)
        .maybeSingle();
      if (profileError) throw new Error("Caller profile lookup failed");
      return {
        id: data.user.id,
        role: profile?.enabled === true ? profile.role ?? null : null,
      };
    },
    findOwnedClub: async (callerId) => {
      const { data, error } = await client.from("clubs").select("id")
        .eq("owner_user_id", callerId).maybeSingle();
      if (error) throw new Error("Owned club lookup failed");
      return data?.id ?? null;
    },
    clubExists: async (clubId) => {
      const { data, error } = await client.from("clubs").select("id")
        .eq("id", clubId).maybeSingle();
      if (error) throw new Error("Target club lookup failed");
      return data !== null;
    },
    createUser: async (payload, password, creationId) => {
      const { data, error } = await client.auth.admin.createUser({
        email: payload.email,
        password,
        email_confirm: true,
        user_metadata: { name: payload.name, phone: payload.phone },
        app_metadata: { managed_coach_creation_id: creationId },
      });
      if (error || !data.user) {
        return {
          error: error?.code === "email_exists" ||
              error?.code === "user_already_exists" ||
              /already.*registered/i.test(error?.message ?? "")
            ? "ACCOUNT_EXISTS"
            : "AUTH_CREATION_FAILED",
        };
      }
      return { id: data.user.id };
    },
    setCoachRole: async (userId) => {
      const { data, error } = await client.from("profiles")
        .update({ role: "COACH" }).eq("id", userId)
        .select("id,role,enabled").single();
      if (
        error || data?.id !== userId || data.role !== "COACH" || !data.enabled
      ) {
        throw new Error("Coach role setup failed");
      }
    },
    createCoachProfile: async (userId, bio) => {
      const { data, error } = await client.from("coach_profiles")
        .insert({ user_id: userId, bio: bio ?? null })
        .select("id,user_id").single();
      if (error || !data?.id || data.user_id !== userId) {
        throw new Error("Coach profile setup failed");
      }
      return data.id;
    },
    addSports: async (coachProfileId, sportIds) => {
      const { data, error } = await client.from("coach_sports").insert(
        sportIds.map((sportId) => ({
          coach_profile_id: coachProfileId,
          sport_id: sportId,
        })),
      ).select("sport_id");
      if (
        error || !data || data.length !== sportIds.length ||
        sportIds.some((id) => !data.some((row) => row.sport_id === id))
      ) throw new Error("Coach sports setup failed");
    },
    addToClub: async (coachProfileId, clubId) => {
      const { data, error } = await client.from("club_coaches")
        .insert({ club_id: clubId, coach_profile_id: coachProfileId })
        .select("club_id,coach_profile_id").single();
      if (
        error || data?.club_id !== clubId ||
        data.coach_profile_id !== coachProfileId
      ) throw new Error("Coach roster setup failed");
    },
    verifyCreatedCoach: async (userId, coachProfileId, email, creationId) => {
      const { data: auth, error: authError } = await client.auth.admin
        .getUserById(userId);
      const { data: profile, error: profileError } = await client
        .from("profiles").select("id,role,enabled").eq("id", userId)
        .maybeSingle();
      const { data: coach, error: coachError } = await client
        .from("coach_profiles").select("id,user_id").eq("id", coachProfileId)
        .maybeSingle();
      return !authError && !profileError && !coachError &&
        auth.user?.id === userId &&
        auth.user.email?.toLowerCase() === email.toLowerCase() &&
        Boolean(auth.user.email_confirmed_at) &&
        auth.user.app_metadata.managed_coach_creation_id === creationId &&
        profile?.id === userId && profile.role === "COACH" &&
        profile.enabled === true && coach?.id === coachProfileId &&
        coach.user_id === userId;
    },
    deleteCreatedUser: async (userId, creationId) => {
      const { data, error: lookupError } = await client.auth.admin
        .getUserById(userId);
      if (lookupError || !data.user) {
        throw new Error(
          "New coach identity cleanup could not confirm ownership",
        );
      }
      if (
        data.user.id !== userId ||
        data.user.app_metadata.managed_coach_creation_id !== creationId
      ) throw new Error("New coach identity cleanup ownership mismatch");
      const { error } = await client.auth.admin.deleteUser(userId);
      if (error) throw new Error("New coach identity cleanup failed");
    },
  };
}
