import { httpClient } from './httpClient';
import { API_BASE_URL } from '../config/env';

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

export const getParentChildren = async (): Promise<ChildDto[]> => {
  const response = await httpClient.get<ChildDto[]>('/api/parent/children');
  return response.data;
};

export const getParentChild = async (childId: string): Promise<ChildDto> => {
  const response = await httpClient.get<ChildDto>(`/api/parent/children/${childId}`);
  return response.data;
};

export const getParentChildEnrollments = async (childId: string): Promise<EnrollmentDto[]> => {
  const response = await httpClient.get<EnrollmentDto[]>(`/api/parent/children/${childId}/enrollments`);
  return response.data;
};

export const getParentChildAttendance = async (
  childId: string,
): Promise<ParentAttendanceDto> => {
  const response = await httpClient.get<ParentAttendanceDto>(`/api/parent/children/${childId}/attendance`);
  return response.data;
};

export const buildParentChildPhotoUrl = (childId: string): string => {
  return `${API_BASE_URL}/api/parent/children/${childId}/photo`;
};
