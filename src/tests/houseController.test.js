import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

// ⚠️ Import file controller kamu
// Karena kamu export default router, kita bisa beri nama apa saja saat import (misal: houseRouter)
import houseRouter from '../controllers/housecontroller.js'; 

// ⚠️ Sesuaikan path ke config supabase kamu
import supabase from '../config/supabaseclient.js'; 

// 1. Mock Supabase agar tidak connect ke DB asli
vi.mock('../config/supabaseclient.js', () => ({
  default: {
    from: vi.fn(),
  },
}));

// 2. Setup Express App Dummy
const app = express();
app.use(express.json());

// Kita pasang 'houseController' (yang isinya router) ke aplikasi dummy
app.use(houseRouter); 

describe('House Controller (GET /block/:id_block)', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('harus mengembalikan data houses jika sukses (Status 200)', async () => {
    const mockIdBlock = '123';
    
    // Data dummy hasil query
    const mockData = [
      { 
        id_house: 1, 
        house_area: 50,
        full_price: 500000000,
        block: { block_name: 'Blok Mawar' }
      }
    ];

    // --- MOCKING CHAIN SUPABASE ---
    // Struktur query di kodinganmu: .from('houses').select(...).eq(...)
    
    // 1. .eq() mengembalikan hasil akhir (Promise)
    const mockEq = vi.fn().mockResolvedValue({ data: mockData, error: null });
    
    // 2. .select() mengembalikan object yang punya fungsi .eq
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    
    // 3. .from() mengembalikan object yang punya fungsi .select
    supabase.from.mockReturnValue({ select: mockSelect });

    // --- JALANKAN REQUEST ---
    const res = await request(app).get(`/block/${mockIdBlock}`);

    // --- ASSERTIONS ---
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(mockData); // Cek apakah datanya sama

    // Pastikan Supabase dipanggil dengan benar
    expect(supabase.from).toHaveBeenCalledWith('houses');
    // Kita bisa cek apakah ID yang dikirim ke .eq() sudah benar
    expect(mockEq).toHaveBeenCalledWith('id_block', mockIdBlock);
  });

  it('harus menangani error jika Supabase gagal (Status 500)', async () => {
    const mockIdBlock = '999';
    const errorMessage = 'Error fetching houses';

    // --- MOCKING ERROR ---
    // Simulasikan database error di bagian .eq()
    const mockEq = vi.fn().mockResolvedValue({ 
      data: null, 
      error: { message: errorMessage } 
    });
    
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    supabase.from.mockReturnValue({ select: mockSelect });

    // --- JALANKAN REQUEST ---
    const res = await request(app).get(`/block/${mockIdBlock}`);

    // --- ASSERTIONS ---
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe(errorMessage);
  });
});