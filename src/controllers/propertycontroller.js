import supabase from "../config/supabaseclient.js";

export const getPropertyList = async (req, res) => {
  const { data, error } = await supabase
    .from("block")
    .select(`
      id_block,
      block_name,
      bedroom,
      bathroom,
      living_room,
      kitchen,
      family_room,
      residence (
        id_residence,
        residence_name,
        location,
        id_pt
      ),
      house (
        id_house,
        land_area,
        house_area,
        number_block,
        status,
        id_pt,
        full_price,
        down_payment
        
      )
    `);

  if (error) return res.status(400).json({ error: error.message });
  res.json(data);
};

 export const getPropertyDetail = async (req, res) => {
  const { id } = req.params;

  const { data, error } = await supabase
    .from("block")
    .select(`
      id_block,
      block_name,
      bedroom,
      bathroom,
      living_room,
      kitchen,
      family_room,
      residence (
        id_residence,
        residence_name,
        location,
        id_pt
      ),
      house (
        id_house,
        land_area,
        house_area,
        number_block,
        status,
        full_price,
        down_payment,
        id_pt
      )
    `)
    .eq("id_block", id)
    .single();

  if (error) return res.status(400).json({ error: error.message });

  // 🔹 Format angka harga jadi Rupiah
  const formatRupiah = (value) =>
    new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(value || 0);

  const formattedData = {
    ...data,
    house: {
      ...data.house,
      full_price: formatRupiah(data.house?.full_price),
      down_payment: formatRupiah(data.house?.down_payment),
      id_pt: data.house?.id_pt,
    },
  };

  res.json(formattedData);
};