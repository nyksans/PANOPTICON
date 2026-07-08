// dot env removed
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://dxprwhsiktlxgvfoihvz.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4cHJ3aHNpa3RseGd2Zm9paHZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0MDM1MjUsImV4cCI6MjA5ODk3OTUyNX0.Eg3l4tmgrcb0YiluwOHznJ37nunLpuj_OZ_s1bZGcRQ';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const cases = [
  {
    case_number: 'CASE-2026-0001',
    title: 'Operation Blue Star - Financial Fraud',
    description: 'A massive multi-state money laundering scheme operating through shell companies in Mumbai and Delhi.',
    status: 'open',
    priority: 'critical',
    tags: ['financial', 'fraud', 'mumbai', 'delhi'],
  },
  {
    case_number: 'CASE-2026-0002',
    title: 'Cyber Attack on National Power Grid',
    description: 'Investigation into the recent ransomware attack targeting the northern power grid infrastructure.',
    status: 'open',
    priority: 'critical',
    tags: ['cyber', 'ransomware', 'infrastructure'],
  },
  {
    case_number: 'CASE-2026-0003',
    title: 'Illegal Wildlife Trafficking - Kaziranga',
    description: 'Poaching ring smuggling rhino horns across the international border in the northeast.',
    status: 'open',
    priority: 'high',
    tags: ['wildlife', 'poaching', 'assam'],
  },
  {
    case_number: 'CASE-2026-0004',
    title: 'The Great Indian Artifact Heist',
    description: 'Stolen Chola bronze statues from a temple in Tamil Nadu traced to an international auction house.',
    status: 'closed',
    priority: 'medium',
    tags: ['artifacts', 'smuggling', 'tamilnadu'],
  },
  {
    case_number: 'CASE-2026-0005',
    title: 'Hawala Network Crackdown - Gujarat',
    description: 'Uncovering a major hawala network operating out of Surat diamond markets.',
    status: 'open',
    priority: 'high',
    tags: ['hawala', 'money-laundering', 'gujarat'],
  },
  {
    case_number: 'CASE-2026-0006',
    title: 'Fake Call Center Scam - Kolkata',
    description: 'Busting a massive fake IRS call center targeting foreign nationals.',
    status: 'closed',
    priority: 'medium',
    tags: ['scam', 'cybercrime', 'kolkata'],
  },
  {
    case_number: 'CASE-2026-0007',
    title: 'Narcotics Seizure at Mundra Port',
    description: 'Investigation of a large shipment of contraband disguised as talcum powder.',
    status: 'open',
    priority: 'critical',
    tags: ['narcotics', 'smuggling', 'gujarat'],
  },
  {
    case_number: 'CASE-2026-0008',
    title: 'Human Trafficking Ring - Indo-Nepal Border',
    description: 'Joint task force operation to rescue trafficked individuals across the porous border.',
    status: 'open',
    priority: 'high',
    tags: ['human-trafficking', 'border', 'up'],
  },
  {
    case_number: 'CASE-2026-0009',
    title: 'Cryptocurrency Ponzi Scheme - Bangalore',
    description: 'A multi-crore crypto scam promising unrealistic returns to tech professionals.',
    status: 'archived',
    priority: 'low',
    tags: ['crypto', 'fraud', 'bangalore'],
  },
  {
    case_number: 'CASE-2026-0010',
    title: 'Corporate Espionage at Pharma Giant',
    description: 'Investigating the theft of intellectual property related to a new vaccine in Hyderabad.',
    status: 'open',
    priority: 'high',
    tags: ['espionage', 'corporate', 'hyderabad'],
  },
  {
    case_number: 'CASE-2026-0011',
    title: 'Illegal Sand Mining Mafia',
    description: 'Cracking down on the sand mafia operating along the riverbeds in Madhya Pradesh.',
    status: 'open',
    priority: 'medium',
    tags: ['mining', 'mafia', 'mp'],
  },
  {
    case_number: 'CASE-2026-0012',
    title: 'Counterfeit Currency Operations',
    description: 'Tracking the source of high-quality fake notes circulating in border towns.',
    status: 'open',
    priority: 'high',
    tags: ['counterfeit', 'currency', 'punjab'],
  },
  {
    case_number: 'CASE-2026-0013',
    title: 'Online Extortion via Loan Apps',
    description: 'Investigation into predatory lending apps using aggressive extortion tactics.',
    status: 'closed',
    priority: 'medium',
    tags: ['cyber', 'extortion', 'pan-india'],
  },
  {
    case_number: 'CASE-2026-0014',
    title: 'Poisonous Liquor Tragedy Investigation',
    description: 'Finding the source and distributors of illicit liquor that caused multiple casualties in Bihar.',
    status: 'open',
    priority: 'critical',
    tags: ['liquor', 'tragedy', 'bihar'],
  },
  {
    case_number: 'CASE-2026-0015',
    title: 'Defense Procurement Kickbacks',
    description: 'Probing allegations of bribery in a recent defense equipment acquisition deal.',
    status: 'open',
    priority: 'critical',
    tags: ['corruption', 'defense', 'delhi'],
  },
  {
    case_number: 'CASE-2026-0016',
    title: 'Real Estate Land Grabbing',
    description: 'Investigation into forged documents used to illegally acquire prime real estate in Noida.',
    status: 'archived',
    priority: 'low',
    tags: ['real-estate', 'fraud', 'noida'],
  },
  {
    case_number: 'CASE-2026-0017',
    title: 'Gold Smuggling via Diplomatic Baggage',
    description: 'High-profile gold smuggling case utilizing diplomatic immunity channels in Kerala.',
    status: 'open',
    priority: 'high',
    tags: ['gold', 'smuggling', 'kerala'],
  },
  {
    case_number: 'CASE-2026-0018',
    title: 'Data Breach at Major E-commerce Platform',
    description: 'Investigating the leak of millions of user records from a prominent Indian e-commerce site.',
    status: 'open',
    priority: 'high',
    tags: ['cyber', 'data-breach', 'bangalore'],
  },
  {
    case_number: 'CASE-2026-0019',
    title: 'Agri-Loan Scam Investigation',
    description: 'Exposing a racket where fake farmers were used to siphon off agricultural loan subsidies.',
    status: 'closed',
    priority: 'medium',
    tags: ['fraud', 'agriculture', 'maharashtra'],
  },
  {
    case_number: 'CASE-2026-0020',
    title: 'VIP Security Protocol Breach',
    description: 'Analyzing the recent security lapse during a high-profile political rally.',
    status: 'archived',
    priority: 'medium',
    tags: ['security', 'vip', 'punjab'],
  }
];

async function seed() {
  console.log('Seeding database with 20 Indian cases...');
  
  const casesWithDefaults = cases.map(c => ({
    ...c,
    incident_date: new Date().toISOString(),
    category: 'investigation',
    location: 'India',
    assigned_to: []
  }));

  const { data, error } = await supabase.from('cases').insert(casesWithDefaults).select();
  if (error) {
    console.error('Error seeding cases:', error);
  } else {
    console.log(`Successfully inserted ${data.length} cases!`);
  }
}

seed();
