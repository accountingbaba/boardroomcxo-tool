-- BoardroomCXO Content Tool — Seed Data
-- Run with: npm run db:seed

-- Confirmed published leaders (exclusion list)
INSERT OR IGNORE INTO exclusions (id, type, value, profile, reason) VALUES
  ('excl-001', 'leader', 'Vijayakumar C', 'boardroomcxo', 'Published — HCLTech post'),
  ('excl-002', 'leader', 'Suresh Narayanan', 'boardroomcxo', 'Published — Nestle India post'),
  ('excl-003', 'leader', 'Mithun Sacheti', 'boardroomcxo', 'Published — CaratLane post');

-- Default tone preferences
INSERT OR IGNORE INTO settings (key, value, label, category) VALUES
  ('tone_boardroomcxo', 'executive', 'Tone — BoardroomCXO page', 'preference'),
  ('tone_ketul', 'conversational', 'Tone — Ketul profile', 'preference');

-- Keywords
INSERT OR IGNORE INTO settings (key, value, label, category) VALUES
  ('kw_01', 'executive search India', 'executive search India', 'keyword'),
  ('kw_02', 'CXO hiring India', 'CXO hiring India', 'keyword'),
  ('kw_03', 'D2C leadership', 'D2C leadership', 'keyword'),
  ('kw_04', 'jewellery brands India', 'jewellery brands India', 'keyword'),
  ('kw_05', 'consumer brand talent', 'consumer brand talent', 'keyword'),
  ('kw_06', 'UAE executive roles', 'UAE executive roles', 'keyword'),
  ('kw_07', 'fashion leadership India', 'fashion leadership India', 'keyword'),
  ('kw_08', 'FMCG CXO', 'FMCG CXO', 'keyword'),
  ('kw_09', 'luxury brand India', 'luxury brand India', 'keyword'),
  ('kw_10', 'founder-led brands', 'founder-led brands', 'keyword'),
  ('kw_11', 'senior leadership D2C', 'senior leadership D2C', 'keyword'),
  ('kw_12', 'Indian consumer brands', 'Indian consumer brands', 'keyword'),
  ('kw_13', 'D2C India', 'D2C India', 'keyword'),
  ('kw_14', 'jewellery sector India', 'jewellery sector India', 'keyword'),
  ('kw_15', 'fashion retail India', 'fashion retail India', 'keyword'),
  ('kw_16', 'executive search UAE', 'executive search UAE', 'keyword'),
  ('kw_17', 'consumer brand hiring', 'consumer brand hiring', 'keyword'),
  ('kw_18', 'CHRO India', 'CHRO India', 'keyword'),
  ('kw_19', 'CMO hiring India', 'CMO hiring India', 'keyword'),
  ('kw_20', 'brand transformation India', 'brand transformation India', 'keyword'),
  ('kw_21', 'retail leadership', 'retail leadership', 'keyword'),
  ('kw_22', 'CEO hiring consumer brand', 'CEO hiring consumer brand', 'keyword'),
  ('kw_23', 'BoardroomCXO', 'BoardroomCXO', 'keyword');

-- Blacklist
INSERT OR IGNORE INTO blacklist (id, term) VALUES
  ('bl-001', 'cryptocurrency'),
  ('bl-002', 'metaverse'),
  ('bl-003', 'NFT'),
  ('bl-004', 'Web3'),
  ('bl-005', 'political commentary'),
  ('bl-006', 'Vijayakumar C'),
  ('bl-007', 'Suresh Narayanan'),
  ('bl-008', 'Mithun Sacheti'),
  ('bl-009', 'controversial leaders'),
  ('bl-010', 'sports leadership');
