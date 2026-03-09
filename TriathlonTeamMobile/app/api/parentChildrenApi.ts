import { supabase } from '../lib/supabase';

export type ChildDto = {
  id: string;
  name: string;
  birthDate: string;
  level: string | null;
  allergies: string | null;
  emergencyContactName: string | null;
  emergencyPhone: string | null;
  gdprConsentAt: string | null;
  secondaryContactName: string | null;
  secondaryPhone: string | null;
  tshirtSize: string | null;
  hasPhoto: boolean;
};

export type EnrollmentKind = 'COURSE' | 'CAMP' | string;
export type EnrollmentStatus = string;

export type ChildSummary = {
  id: string;
  name: string;
};

export type EntitySummary = {
  id: string;
  name: string;
  type: EnrollmentKind;
} | null;

export type PaymentSummary = {
  id: string;
  method: string;
  status: string;
  amount: number;
  createdAt: string;
  paidAt: string | null;
} | null;

export type EnrollmentDto = {
  id: string;
  kind: EnrollmentKind;
  status: EnrollmentStatus;
  child: ChildSummary;
  entity: EntitySummary;
  payment: PaymentSummary;
  createdAt: string;
  purchasedSessions: number;
  remainingSessions: number;
  sessionsUsed: number;
};

export type AttendanceSessionDto = {
  id: string;
  date: string;
  status: string;
  statusLabel: string;
  note: string | null;
};

export type AttendanceCourseDto = {
  id: string;
  name: string;
  sessions: AttendanceSessionDto[];
};

export type ParentAttendanceDto = {
  courses: AttendanceCourseDto[];
};

const statusLabels: Record<string, string> = {
  PRESENT: 'Present',
  ABSENT: 'Absent',
  EXCUSED: 'Excused',
};

export const getParentChildren = async (): Promise<ChildDto[]> => {
  const { data: user } = await supabase.auth.getUser();
  if (!user.user) throw new Error('Not authenticated');

  const { data, error } = await supabase
    .from('children')
    .select('*')
    .eq('parent_id', user.user.id)
    .order('first_name');

  if (error) throw new Error(error.message);

  return (data ?? []).map((c) => ({
    id: c.id,
    name: `${c.first_name} ${c.last_name}`.trim(),
    birthDate: c.birth_date ?? '',
    level: c.level ?? null,
    allergies: c.allergies ?? null,
    emergencyContactName: c.emergency_contact_name ?? null,
    emergencyPhone: c.emergency_phone ?? null,
    gdprConsentAt: c.gdpr_consent_at ?? null,
    secondaryContactName: c.secondary_contact_name ?? null,
    secondaryPhone: c.secondary_phone ?? null,
    tshirtSize: c.tshirt_size ?? null,
    hasPhoto: !!c.photo_storage_path,
  }));
};

export const getParentChild = async (childId: string): Promise<ChildDto> => {
  const { data, error } = await supabase
    .from('children')
    .select('*')
    .eq('id', childId)
    .single();

  if (error || !data) throw new Error(error?.message ?? 'Child not found');

  return {
    id: data.id,
    name: `${data.first_name} ${data.last_name}`.trim(),
    birthDate: data.birth_date ?? '',
    level: data.level ?? null,
    allergies: data.allergies ?? null,
    emergencyContactName: data.emergency_contact_name ?? null,
    emergencyPhone: data.emergency_phone ?? null,
    gdprConsentAt: data.gdpr_consent_at ?? null,
    secondaryContactName: data.secondary_contact_name ?? null,
    secondaryPhone: data.secondary_phone ?? null,
    tshirtSize: data.tshirt_size ?? null,
    hasPhoto: !!data.photo_storage_path,
  };
};

export const getParentChildEnrollments = async (childId: string): Promise<EnrollmentDto[]> => {
  const { data, error } = await supabase
    .from('enrollments')
    .select(`
      id,
      entity_type,
      entity_id,
      status,
      payment_method,
      sessions_remaining,
      sessions_total,
      created_at,
      children!inner (id, first_name, last_name),
      payments (id, payment_method, status, amount, created_at, paid_at)
    `)
    .eq('child_id', childId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  const enrollments: EnrollmentDto[] = [];

  for (const row of data ?? []) {
    const child = Array.isArray(row.children) ? row.children[0] : row.children;
    const payment = Array.isArray(row.payments) ? row.payments[0] : row.payments;

    // Resolve entity name based on type
    let entity: EntitySummary = null;
    if (row.entity_id) {
      const table =
        row.entity_type === 'COURSE'
          ? 'courses'
          : row.entity_type === 'CAMP'
            ? 'camps'
            : 'activities';
      const { data: entityData } = await supabase
        .from(table)
        .select('id, name')
        .eq('id', row.entity_id)
        .single();
      if (entityData) {
        entity = { id: entityData.id, name: entityData.name, type: row.entity_type };
      }
    }

    const sessionsTotal = row.sessions_total ?? 0;
    const sessionsRemaining = row.sessions_remaining ?? 0;
    const sessionsUsed = sessionsTotal - sessionsRemaining;

    enrollments.push({
      id: row.id,
      kind: row.entity_type,
      status: row.status,
      child: {
        id: child?.id ?? childId,
        name: child ? `${child.first_name} ${child.last_name}`.trim() : '',
      },
      entity,
      payment: payment
        ? {
            id: payment.id,
            method: payment.payment_method ?? '',
            status: payment.status ?? '',
            amount: payment.amount ?? 0,
            createdAt: payment.created_at ?? '',
            paidAt: payment.paid_at ?? null,
          }
        : null,
      createdAt: row.created_at ?? '',
      purchasedSessions: sessionsTotal,
      remainingSessions: sessionsRemaining,
      sessionsUsed,
    });
  }

  return enrollments;
};

export const getParentChildAttendance = async (
  childId: string,
): Promise<ParentAttendanceDto> => {
  const { data, error } = await supabase
    .from('attendance')
    .select(`
      id,
      status,
      note,
      course_occurrences!inner (
        id,
        starts_at,
        courses!inner (id, name)
      )
    `)
    .eq('child_id', childId)
    .order('id', { ascending: false });

  if (error) throw new Error(error.message);

  // Group attendance by course
  const courseMap = new Map<string, AttendanceCourseDto>();

  for (const row of data ?? []) {
    const occ = Array.isArray(row.course_occurrences)
      ? row.course_occurrences[0]
      : row.course_occurrences;
    const course = occ?.courses
      ? Array.isArray(occ.courses)
        ? occ.courses[0]
        : occ.courses
      : null;

    if (!course) continue;

    if (!courseMap.has(course.id)) {
      courseMap.set(course.id, {
        id: course.id,
        name: course.name,
        sessions: [],
      });
    }

    courseMap.get(course.id)!.sessions.push({
      id: row.id,
      date: occ?.starts_at ?? '',
      status: row.status ?? '',
      statusLabel: statusLabels[row.status] ?? row.status ?? '',
      note: row.note ?? null,
    });
  }

  return { courses: Array.from(courseMap.values()) };
};

export const buildParentChildPhotoUrl = (childId: string): string => {
  const { data } = supabase.storage.from('children-photos').getPublicUrl(`${childId}/photo`);
  return data.publicUrl;
};
