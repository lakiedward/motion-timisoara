export interface RatingRequest {
  rating: number;
  comment?: string;
}

export interface RatingResponse {
  id: string;
  rating: number;
  comment?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AverageRating {
  averageRating: number;
  totalRatings: number;
}

export interface MyRatings {
  courseRatings: RatingResponse[];
  coachRatings: RatingResponse[];
}



