const supabase = require('../lib/supabase');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();

  const { id } = req.query;

  try {
    switch (req.method) {
      case 'GET':
        if (id) {
          const { data, error } = await supabase
            .from('sessions').select('*').eq('id', id).single();
          if (error) throw error;
          if (!data) return res.status(404).json({ message: `Session ${id} not found` });
          return res.status(200).json(data);
        } else {
          const { data, error } = await supabase
            .from('sessions').select('*').order('created_at', { ascending: false });
          if (error) throw error;
          return res.status(200).json(data);
        }

      case 'POST': {
        const { data, error } = await supabase
          .from('sessions').insert([req.body]).select().single();
        if (error) throw error;
        return res.status(201).json(data);
      }

      case 'PUT': {
        if (!id) return res.status(400).json({ message: 'PUT requires an id' });
        const { data, error } = await supabase
          .from('sessions').update(req.body).eq('id', id).select().single();
        if (error) throw error;
        if (!data) return res.status(404).json({ message: `Session ${id} not found` });
        return res.status(200).json(data);
      }

      case 'DELETE': {
        if (!id) return res.status(400).json({ message: 'DELETE requires an id' });
        const { error } = await supabase.from('sessions').delete().eq('id', id);
        if (error) throw error;
        return res.status(200).json({ message: `Session ${id} removed` });
      }

      default:
        return res.status(405).json({ message: 'Method not allowed' });
    }
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: 'Server error', details: error.message });
  }
};
