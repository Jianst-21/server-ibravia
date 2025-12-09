import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createReservation, getReservationsByUser } from '../controllers/reservationcontroller';
import supabase from '../config/supabaseclient';
import transporter from '../config/nodemailer';

// --- MOCKING DEPENDENCIES ---

// 1. Mock Nodemailer (Transporter)
vi.mock('../config/nodemailer', () => ({
  default: {
    sendMail: vi.fn().mockResolvedValue(true),
  },
}));

// 2. Mock Supabase Client
vi.mock('../config/supabaseclient', () => ({
  default: {
    from: vi.fn(),
  },
}));

describe('Reservation Controller', () => {
  let req, res;

  // Helper untuk membuat rantai mock Supabase
  // Ini membantu kita mensimulasikan query seperti: .select().eq().single()
  const createSupabaseMock = (data = null, error = null) => {
    const single = vi.fn().mockResolvedValue({ data, error });
    const maybeSingle = vi.fn().mockResolvedValue({ data, error }); // Untuk query yang mungkin pakai single()
    
    // Chain umum
    const eq = vi.fn().mockReturnValue({ 
      single, 
      in: vi.fn().mockResolvedValue({ data, error }) // Untuk .in()
    });
    
    const select = vi.fn().mockReturnValue({ eq });
    const insert = vi.fn().mockReturnValue({ select: vi.fn().mockResolvedValue({ data: [data], error }) });
    const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ data, error }) });

    return { select, insert, update, eq, single };
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup Mock Req & Res Express
    req = {
      body: {},
      params: {},
    };
    res = {
      status: vi.fn().mockReturnThis(), // Agar bisa chaining: res.status(400).json(...)
      json: vi.fn(),
    };
  });

  // ==========================================
  // TEST: createReservation
  // ==========================================
  describe('createReservation', () => {
    it('harus berhasil membuat reservasi dan mengirim email (Happy Path)', async () => {
      // Setup Data Request
      req.body = {
        id_user: 'user-123',
        id_pt: 1,
        id_house: 101,
        reservation_status: 'pending',
      };

      // --- MOCKING COMPLEX SUPABASE CALLS ---
      // Kita gunakan mockImplementation untuk membedakan respon berdasarkan nama tabel
      supabase.from.mockImplementation((table) => {
        switch (table) {
          case 'user':
            // 1. Fetch User Data
            return createSupabaseMock({ name: 'Budi Santoso', email: 'budi@test.com' });
          
          case 'reservation':
            // 2. Cek Existing Reservation (harus return kosong/null agar lolos validasi)
            // 3. Insert Reservation (return data baru)
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  in: vi.fn().mockResolvedValue({ data: [], error: null }) // Tidak ada reservasi aktif
                })
              }),
              insert: vi.fn().mockReturnValue({
                select: vi.fn().mockResolvedValue({ data: [{ id_reservasi: 999 }], error: null })
              })
            };

          case 'houses':
            // 4. Fetch House Data (Status available)
            // 5. Update House Status
            return {
              select: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({ 
                    data: { 
                      status: 'available', 
                      id_admin: 1,
                      block: { residence: { residence_name: 'Residen A' } } 
                    }, 
                    error: null 
                  })
                })
              }),
              update: vi.fn().mockReturnValue({
                eq: vi.fn().mockResolvedValue({ data: null, error: null })
              })
            };

          case 'email':
          case 'notification':
            // 6. Insert Log Email & Notif
            return { insert: vi.fn().mockResolvedValue({ error: null }) };

          case 'admin':
            // 7. Fetch Admin Data
            return createSupabaseMock({ username: 'Admin1', phone: '08123' });

          default:
            return createSupabaseMock();
        }
      });

      // Jalankan fungsi
      await createReservation(req, res);

      // Assertions
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        success: true,
        message: "Reservation created successfully!",
      }));
      
      // Pastikan email terkirim
      expect(transporter.sendMail).toHaveBeenCalled();
      const mailArgs = transporter.sendMail.mock.calls[0][0];
      expect(mailArgs.to).toBe('budi@test.com');
      expect(mailArgs.subject).toContain('Reservation Created');
    });

    it('harus gagal jika user memiliki reservasi yang belum selesai (Pending/Accepted)', async () => {
      req.body = { id_user: 'user-123' };

      supabase.from.mockImplementation((table) => {
        if (table === 'user') return createSupabaseMock({ name: 'Budi' });
        if (table === 'reservation') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                in: vi.fn().mockResolvedValue({ 
                  data: [{ id_reservasi: 555, status: 'pending' }], // Ada reservasi aktif
                  error: null 
                })
              })
            })
          };
        }
        return createSupabaseMock();
      });

      await createReservation(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: expect.stringContaining("unfinished reservation"),
      }));
    });

    it('harus gagal jika rumah sudah terjual atau di-reserve', async () => {
      req.body = { id_user: 'user-123', id_house: 101 };

      supabase.from.mockImplementation((table) => {
        if (table === 'user') return createSupabaseMock({ name: 'Budi' });
        if (table === 'reservation') return createSupabaseMock([]); // Tidak ada reservasi aktif
        if (table === 'houses') {
          return createSupabaseMock({ status: 'sold' }); // Rumah status SOLD
        }
        return createSupabaseMock();
      });

      await createReservation(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: "The house is no longer available.",
      }));
    });
  });

  // ==========================================
  // TEST: getReservationsByUser
  // ==========================================
  describe('getReservationsByUser', () => {
    it('harus mengembalikan daftar reservasi dengan format deskripsi yang benar', async () => {
      req.params.id_user = 'user-123';

      // Data mentah dari DB (nested structure)
      const mockRawData = [{
        id_reservasi: 1,
        start_date: '2023-01-01',
        end_date: '2023-01-08',
        reservation_status: 'pending',
        house: {
          number_block: '10',
          block: {
            block_name: 'A',
            bedroom: 2,
            bathroom: 1,
            living_room: true,
            family_room: false,
            kitchen: true,
            residence: { residence_name: 'Grand City' }
          }
        }
      }];

      // Mock Supabase
      const mockEq = vi.fn().mockResolvedValue({ data: mockRawData, error: null });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      supabase.from.mockReturnValue({ select: mockSelect });

      await getReservationsByUser(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      
      // Ambil hasil response
      const result = res.json.mock.calls[0][0]; // Argumen pertama dari panggilan res.json
      
      expect(result.reservations).toHaveLength(1);
      
      // Cek Logika Formating String
      const item = result.reservations[0];
      expect(item.block_name).toBe('A');
      expect(item.residence_name).toBe('Grand City');
      
      // Validasi logika string builder (Bedroom, Bathroom, Living Room, Kitchen)
      // "2 Bedrooms, 1 Bathroom, Living Room, Kitchen"
      expect(item.description).toContain('2 Bedrooms');
      expect(item.description).toContain('1 Bathroom');
      expect(item.description).toContain('Living Room');
      expect(item.description).toContain('Kitchen');
    });

    it('harus mengembalikan 404 jika tidak ada reservasi', async () => {
      req.params.id_user = 'user-ghost';

      // Mock return kosong
      const mockEq = vi.fn().mockResolvedValue({ data: [], error: null });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      supabase.from.mockReturnValue({ select: mockSelect });

      await getReservationsByUser(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ message: "No reservations found." });
    });

    it('harus mengembalikan 500 jika Supabase error', async () => {
      req.params.id_user = 'user-error';

      // Mock return error
      const mockEq = vi.fn().mockResolvedValue({ data: null, error: { message: 'DB Error' } });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      supabase.from.mockReturnValue({ select: mockSelect });

      await getReservationsByUser(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ error: "Failed to fetch user reservations." });
    });
  });
});