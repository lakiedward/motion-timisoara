export interface AdminCamp {
  id: string;
  title: string;
  slug: string;
  description?: string | null;
  periodStart: string;
  periodEnd: string;
  locationText?: string | null;
  capacity?: number | null;
  price: number;
  galleryJson?: string | null;
  allowCash: boolean;
  enrolledCount?: number | null;
}

export interface AdminCampPayload {
  title: string;
  slug: string;
  description?: string | null;
  periodStart: string;
  periodEnd: string;
  locationText?: string | null;
  capacity?: number | null;
  price: number;
  galleryJson?: string | null;
  allowCash: boolean;
}

