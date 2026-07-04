import api from './client';

export const authAPI = {
  register: (data: { email: string; password: string; name: string; role?: string }) =>
    api.post('/auth/register', data),
  login: (data: { email: string; password: string }) =>
    api.post('/auth/login', data),
  me: () => api.get('/auth/me'),
};

export const eventsAPI = {
  list: (params?: Record<string, string>) => api.get('/events', { params }),
  get: (id: string) => api.get(`/events/${id}`),
  getSeatMap: (id: string) => api.get(`/events/${id}/seats`),
  create: (data: any) => api.post('/events', data),
  myEvents: () => api.get('/events/organiser/my'),
};

export const venuesAPI = {
  list: () => api.get('/venues'),
  get: (id: string) => api.get(`/venues/${id}`),
  create: (data: any) => api.post('/venues', data),
};

export const seatsAPI = {
  hold: (eventId: string, seatIds: string[]) =>
    api.post('/seats/hold', { event_id: eventId, seat_ids: seatIds }),
  release: (eventId: string, seatIds?: string[]) =>
    api.post('/seats/release', { event_id: eventId, seat_ids: seatIds }),
  myHold: (eventId: string) => api.get(`/seats/my-hold/${eventId}`),
};

export const bookingsAPI = {
  create: (data: { event_id: string; seat_ids: string[]; payment_method?: string }) =>
    api.post('/bookings', data),
  my: () => api.get('/bookings/my'),
  get: (id: string) => api.get(`/bookings/${id}`),
  cancel: (id: string) => api.delete(`/bookings/${id}`),
};

export const waitlistAPI = {
  join: (eventId: string, categoryId: string) =>
    api.post('/waitlist/join', { event_id: eventId, category_id: categoryId }),
  status: (eventId: string) => api.get(`/waitlist/status/${eventId}`),
  claim: (token: string) => api.post(`/waitlist/claim/${token}`),
  leave: (id: string) => api.delete(`/waitlist/${id}`),
};

export const organiserAPI = {
  events: () => api.get('/organiser/events'),
  eventSummary: (id: string) => api.get(`/organiser/events/${id}/summary`),
};

export const adminAPI = {
  stats: () => api.get('/admin/stats'),
  users: () => api.get('/admin/users'),
  events: () => api.get('/admin/events'),
  changeRole: (userId: string, role: string) =>
    api.patch(`/admin/users/${userId}/role`, { role }),
};
