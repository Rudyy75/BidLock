import request from 'supertest';
import app from '../src/app';

describe('API Tests', () => {
  describe('Auth', () => {
    it('should return 400 if userId is missing', async () => {
      const res = await request(app).post('/api/auth/login').send({});
      expect(res.statusCode).toEqual(400);
      expect(res.body).toHaveProperty('message', 'userId is required');
    });
  });

  describe('Security', () => {
    it('should reject unauthorized access to protected routes', async () => {
      const res = await request(app).post('/api/rides').send({});
      expect(res.statusCode).toEqual(401);
      expect(res.body).toHaveProperty('message', 'Unauthorized: Missing token');
    });
  });
});
