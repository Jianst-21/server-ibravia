import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPropertyList, getPropertyDetail } from '../controllers/propertycontroller'; // Sesuaikan path
import supabase from '../config/supabaseclient'; // Sesuaikan path

// 1. Mock Supabase Client
// Kita mengganti fungsi asli supabase dengan fungsi tiruan (jest/vitest fn)
vi.mock('../config/supabaseclient', () => ({
  default: {
    from: vi.fn(),
  },
}));

describe('Property Controller', () => {
  let req, res;

  // Reset setiap kali sebelum menjalankan test baru
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock Request & Response Express
    req = { params: {} };
    res = {
      status: vi.fn().mockReturnThis(), // Agar bisa chaining: res.status(400).json(...)
      json: vi.fn(),
    };
  });

  // --- TEST UNTUK getPropertyList ---
  describe('getPropertyList', () => {
    it('harus mengembalikan daftar properti (status 200)', async () => {
      // Data palsu yang seolah-olah dari database
      const mockData = [{ id_block: 1, block_name: 'Blok A' }];
      
      // Setup Mock Chain Supabase: .from().select()
      const mockSelect = vi.fn().mockResolvedValue({ data: mockData, error: null });
      supabase.from.mockReturnValue({ select: mockSelect });

      await getPropertyList(req, res);

      // Assertions
      expect(supabase.from).toHaveBeenCalledWith('block'); // Cek tabel yg dipanggil
      expect(res.json).toHaveBeenCalledWith(mockData); // Cek output
      expect(res.status).not.toHaveBeenCalled(); // Pastikan tidak error
    });

    it('harus mengembalikan error jika database bermasalah (status 400)', async () => {
      // Simulasi error dari Supabase
      const mockError = { message: 'Connection failed' };
      
      const mockSelect = vi.fn().mockResolvedValue({ data: null, error: mockError });
      supabase.from.mockReturnValue({ select: mockSelect });

      await getPropertyList(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Connection failed' });
    });
  });

  // --- TEST UNTUK getPropertyDetail ---
  describe('getPropertyDetail', () => {
    it('harus mengembalikan detail properti dengan format Rupiah yang benar', async () => {
      req.params.id = 123;

      // Data mentah (angka) sebelum diformat
      const rawData = {
        id_block: 123,
        block_name: 'Blok Mewah',
        house: {
          full_price: 500000000,   // 500 Juta
          down_payment: 5000000,   // 5 Juta
          id_pt: 1
        }
      };

      // Setup Mock Chain Supabase yang lebih panjang:
      // .from().select().eq().single()
      const mockSingle = vi.fn().mockResolvedValue({ data: rawData, error: null });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      supabase.from.mockReturnValue({ select: mockSelect });

      await getPropertyDetail(req, res);

      // 1. Cek apakah query supabase benar
      expect(supabase.from).toHaveBeenCalledWith('block');
      expect(mockEq).toHaveBeenCalledWith('id_block', 123);

      // 2. Cek Logika Bisnis (Format Rupiah)
      // Kita ambil argumen yang dikirim ke res.json()
      const responseData = res.json.mock.calls[0][0];

      // Pastikan angka sudah berubah jadi String Rupiah
      // Note: Spasi non-breaking space ( ) mungkin terjadi di Intl, kita cek substring saja
      expect(responseData.house.full_price).toContain('Rp');
      expect(responseData.house.full_price).toContain('500.000.000');
      expect(responseData.house.down_payment).toContain('5.000.000');
    });

    it('harus menangani error jika data tidak ditemukan atau DB error', async () => {
      req.params.id = 999;
      const mockError = { message: 'Row not found' };

      // Setup mock error chain
      const mockSingle = vi.fn().mockResolvedValue({ data: null, error: mockError });
      const mockEq = vi.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      supabase.from.mockReturnValue({ select: mockSelect });

      await getPropertyDetail(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Row not found' });
    });
  });
});