export interface Page<T> {
  data: T[];
  metadata: {
    total: number;
    page: number;
    lastPage: number;
  };
}

export interface PageRequest {
  page?: number;
  limit?: number;
}
