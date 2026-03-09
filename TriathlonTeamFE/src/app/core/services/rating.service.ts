import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { RatingRequest, RatingResponse, AverageRating, MyRatings } from '../models/rating.model';

@Injectable({
  providedIn: 'root'
})
export class RatingService {
  private readonly baseUrl = '/api/ratings';

  constructor(private http: HttpClient) {}

  rateCourse(courseId: string, request: RatingRequest): Observable<RatingResponse> {
    return this.http.post<RatingResponse>(`${this.baseUrl}/courses/${courseId}`, request);
  }

  rateCoach(coachId: string, request: RatingRequest): Observable<RatingResponse> {
    return this.http.post<RatingResponse>(`${this.baseUrl}/coaches/${coachId}`, request);
  }

  getMyCourseRating(courseId: string): Observable<RatingResponse> {
    return this.http.get<RatingResponse>(`${this.baseUrl}/courses/${courseId}/mine`);
  }

  getMyCoachRating(coachId: string): Observable<RatingResponse> {
    return this.http.get<RatingResponse>(`${this.baseUrl}/coaches/${coachId}/mine`);
  }

  getCourseAverageRating(courseId: string): Observable<AverageRating> {
    return this.http.get<AverageRating>(`${this.baseUrl}/courses/${courseId}/average`);
  }

  getCoachAverageRating(coachId: string): Observable<AverageRating> {
    return this.http.get<AverageRating>(`${this.baseUrl}/coaches/${coachId}/average`);
  }

  getMyRatings(): Observable<MyRatings> {
    return this.http.get<MyRatings>(`${this.baseUrl}/mine`);
  }
}



