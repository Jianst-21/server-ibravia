import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as authController from '../controllers/authcontroller'; // Sesuaikan path
import supabase from '../config/supabaseclient';
import bcrypt from 'bcryptjs';
import transporter from '../config/nodemailer';
import sharp from 'sharp';

// =================================================================
// 1. MOCKING DEPENDENCIES
// =================================================================

// Mock Supabase
vi.mock('../config/supabaseclient', () => ({
  default: {
    from: vi.fn(),
    storage: {
      from: vi.fn(),
    },
  },
}));

// Mock Bcrypt (Hashing & Compare)
vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn(),
    compare: vi.fn(),
  },
}));

// Mock Nodemailer (Send Email)
vi.mock('../config/nodemailer', () => ({
  default: {
    sendMail: vi.fn(),
  },
}));

// Mock Sharp (Image Processing)
// Sharp dipanggil sebagai function: sharp(buffer) -> return object with .metadata()
vi.mock('sharp', () => {
  return {
    default: vi.fn().mockReturnValue({
      metadata: vi.fn(),
    }),
  };
});

// Mock UUID (agar nama file bisa diprediksi, opsional tapi bagus)
vi.mock('uuid', () => ({
  v4: () => 'mock-uuid',
}));

describe('Auth Controller', () => {
  let req, res;

  // Helper untuk membuat mock chain Supabase dasar: from().select().eq()...
  // Ini membantu mengurangi repetisi kode setup mock
  const mockSupabaseChain = (resultData, resultError = null) => {
    const chain = {
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({ data: resultData, error: resultError }),
      single: vi.fn().mockResolvedValue({ data: resultData, error: resultError }),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
    };
    return chain;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset Req & Res
    req = {
      params: {},
      body: {},
      session: {},
      file: null,
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
  });

  // =================================================================
  // TEST: LOGIN
  // =================================================================
  describe('login', () => {
    it('harus login sukses jika email & password benar (status 200)', async () => {
      req.body = { identifier: 'test@example.com', password: 'password123' };

      const mockUser = {
        id_user: 1,
        email: 'test@example.com',
        username: 'testuser',
        password: 'hashedpassword',
        account_status: true, // Akun aktif
      };

      // Mock Supabase
      const chain = mockSupabaseChain(mockUser);
      supabase.from.mockReturnValue(chain);

      // Mock Bcrypt Compare (True)
      bcrypt.compare.mockResolvedValue(true);

      await authController.login(req, res);

      expect(supabase.from).toHaveBeenCalledWith('user');
      expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashedpassword');
      expect(req.session.user).toBeDefined(); // Session harus terisi
      expect(req.session.user.id).toBe(1);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: 'Login successful.' }));
    });

    it('harus gagal jika akun belum diverifikasi (status 403)', async () => {
      req.body = { identifier: 'test@example.com', password: 'password123' };
      const mockUser = { account_status: false }; // Belum aktif

      const chain = mockSupabaseChain(mockUser);
      supabase.from.mockReturnValue(chain);

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.stringContaining('not verified') }));
    });

    it('harus gagal jika password salah (status 401)', async () => {
      req.body = { identifier: 'test@example.com', password: 'wrongpass' };
      const mockUser = { password: 'hashed', account_status: true };

      supabase.from.mockReturnValue(mockSupabaseChain(mockUser));
      bcrypt.compare.mockResolvedValue(false); // Password salah

      await authController.login(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
    });
  });

  // =================================================================
  // TEST: SIGNUP
  // =================================================================
  describe('signup', () => {
    it('harus berhasil signup dan mengirim OTP (status 200)', async () => {
      req.body = { name: 'New User', email: 'new@example.com', password: 'pass' };

      // 1. Setup Data Mock
      const checkChain = mockSupabaseChain(null); // Simulasi user belum ada
      const insertUserChain = mockSupabaseChain({ id_user: 10, email: 'new@example.com', name: 'New User' });
      const insertOtpChain = mockSupabaseChain(null);

      // 2. Setup Antrian Mock Supabase (PERHATIKAN URUTANNYA)
      supabase.from
        .mockReturnValueOnce(checkChain)       // Panggilan 1: Cek existing user (Return Null)
        // Panggilan Delete DI-SKIP oleh controller karena user null, jadi JANGAN buat mock untuk itu.
        .mockReturnValueOnce(insertUserChain)  // Panggilan 2: Insert User (Langsung kesini)
        .mockReturnValueOnce(insertOtpChain);  // Panggilan 3: Insert OTP (di dalam sendOTP)

      bcrypt.hash.mockResolvedValue('hashed_secret');

      await authController.signup(req, res);

      // Assertions
      expect(bcrypt.hash).toHaveBeenCalled();
      expect(transporter.sendMail).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('OTP has been sent') }));
    });

    it('harus gagal jika email sudah dipakai dan aktif (status 400)', async () => {
      req.body = { email: 'exist@example.com', name: 'Existing', password: 'pass' };
      
      // Simulasi user ditemukan dan sudah aktif
      const existingUser = { account_status: true, email: 'exist@example.com' };
      
      // Kita gunakan mockReturnValueOnce agar lebih spesifik untuk panggilan pertama (maybeSingle)
      const existingUserChain = mockSupabaseChain(existingUser);
      supabase.from.mockReturnValue(existingUserChain);

      await authController.signup(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Email already in use.' });
    });
  });

  // =================================================================
  // TEST: VERIFY OTP
  // =================================================================
  describe('verifyOTP', () => {
    it('harus memverifikasi signup sukses dan mengupdate status user', async () => {
      req.body = { email: 'user@test.com', otp: '123456', purpose: 'signup' };
      
      const mockUser = { id_user: 1, email: 'user@test.com' };
      // Expired time di masa depan
      const futureTime = new Date(Date.now() + 10000).toISOString();
      const mockOtp = { 
        id_otp: 55, 
        otp_status: false, 
        expired_time: futureTime 
      };

      const chain = {
        ...mockSupabaseChain(mockUser), // Default user fetch
        limit: vi.fn().mockReturnThis(),
        single: vi.fn()
          .mockResolvedValueOnce({ data: mockUser, error: null }) // 1. Get User
          .mockResolvedValueOnce({ data: mockOtp, error: null })  // 2. Get OTP
          .mockResolvedValueOnce({ data: null, error: null }),    // 3. Update User (return value ignored)
      };

      supabase.from.mockReturnValue(chain);

      await authController.verifyOTP(req, res);

      // Cek apakah OTP diupdate jadi true
      expect(chain.update).toHaveBeenCalledWith({ otp_status: true });
      // Cek apakah User diupdate (karena purpose signup)
      expect(chain.update).toHaveBeenCalledWith({ account_status: true });
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('Account verified') }));
    });

    it('harus gagal jika OTP kadaluarsa (status 400)', async () => {
      req.body = { email: 'user@test.com', otp: '123456', purpose: 'signup' };

      const mockUser = { id_user: 1 };
      const pastTime = new Date(Date.now() - 10000).toISOString(); // Masa lalu
      const mockOtp = { id_otp: 55, otp_status: false, expired_time: pastTime };

      const chain = {
        ...mockSupabaseChain(null),
        single: vi.fn()
          .mockResolvedValueOnce({ data: mockUser })
          .mockResolvedValueOnce({ data: mockOtp }),
      };
      supabase.from.mockReturnValue(chain);

      await authController.verifyOTP(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'OTP has expired.' });
    });
  });

  // =================================================================
  // TEST: UPDATE USER (File Upload)
  // =================================================================
  describe('updateUser', () => {
    it('harus mengupdate profil dengan gambar jika resolusi valid', async () => {
      req.params.id_user = '1';
      req.body = { first_name: 'John', last_name: 'Doe' };
      req.file = {
        buffer: Buffer.from('fake-image'),
        originalname: 'test.jpg',
        mimetype: 'image/jpeg',
      };

      // Mock Sharp Metadata (Resolusi OK)
      sharp().metadata.mockResolvedValue({ width: 500, height: 500 });

      // Mock Supabase Storage Upload
      const mockUpload = vi.fn().mockResolvedValue({ error: null });
      const mockGetUrl = vi.fn().mockReturnValue({ data: { publicUrl: 'http://img.com/pic.jpg' } });
      
      supabase.storage.from.mockReturnValue({
        upload: mockUpload,
        getPublicUrl: mockGetUrl,
      });

      // Mock DB Update
      const mockUpdatedUser = { id_user: 1, name: 'John Doe', photo_profile: 'http://img.com/pic.jpg' };
      supabase.from.mockReturnValue(mockSupabaseChain(mockUpdatedUser));

      await authController.updateUser(req, res);

      // Assertions
      expect(sharp().metadata).toHaveBeenCalled(); // Cek resolusi
      expect(mockUpload).toHaveBeenCalled(); // Cek upload
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ 
        message: 'Profile updated successfully.',
        user: mockUpdatedUser 
      }));
    });

    it('harus gagal jika resolusi gambar terlalu kecil (status 400)', async () => {
      req.params.id_user = '1';
      req.file = { buffer: Buffer.from('small-img') };

      // Mock Sharp Metadata (Kecil)
      sharp().metadata.mockResolvedValue({ width: 300, height: 300 });

      await authController.updateUser(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Minimum image resolution is 400x400px.' });
    });
  });

  // =================================================================
  // TEST: GET USER BY ID
  // =================================================================
  describe('getUserById', () => {
    it('harus mengembalikan data user (status 200)', async () => {
      req.params.id_user = 1;
      const mockData = { id_user: 1, name: 'Test' };
      
      supabase.from.mockReturnValue(mockSupabaseChain(mockData));

      await authController.getUserById(req, res);

      expect(res.json).toHaveBeenCalledWith({ user: mockData });
    });

    it('harus return 404 jika user tidak ada', async () => {
      req.params.id_user = 999;
      
      supabase.from.mockReturnValue(mockSupabaseChain(null)); // Data null

      await authController.getUserById(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  // =================================================================
  // TEST: LOGOUT
  // =================================================================
  describe('logout', () => {
    it('harus menghapus session (destroy)', () => {
      req.session.destroy = vi.fn();

      authController.logout(req, res);

      expect(req.session.destroy).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ message: 'Logout successful.' });
    });
  });
});