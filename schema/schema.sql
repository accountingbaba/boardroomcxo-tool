-- BoardroomCXO Content Tool — D1 Database Schema
-- Run with: npm run db:init

-- Posts: every piece of content created in the tool
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  profile TEXT NOT NULL,
  -- 'boardroomcxo' = company page, 'ketul' = personal profile
  content_type TEXT NOT NULL,
  -- 'leadership' or 'industry'
  subject TEXT,
  -- leader name or article headline
  source_url TEXT,
  -- source article URL if industry type
  linkedin_post TEXT,
  instagram_post TEXT,
  whatsapp_post TEXT,
  blog_post TEXT,
  image_prompt TEXT,
  status TEXT DEFAULT 'draft',
  -- draft, review, approved, published
  image_url TEXT,
  scheduled_date TEXT,
  virality_score INTEGER,
  seo_score INTEGER,
  aeo_score INTEGER,
  persona_panel_score INTEGER,
  created_at TEXT DEFAULT (datetime('now')),
  published_at TEXT
);

-- Preferences: every selection the user makes — feeds the learning engine
CREATE TABLE IF NOT EXISTS preferences (
  id TEXT PRIMARY KEY,
  profile TEXT NOT NULL,
  content_type TEXT NOT NULL,
  options_json TEXT NOT NULL,
  -- full JSON array of all options presented
  selected_index INTEGER NOT NULL,
  selected_subject TEXT NOT NULL,
  selected_score INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Exclusions: leaders already published + source URLs already used
CREATE TABLE IF NOT EXISTS exclusions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  -- 'leader' or 'source_url'
  value TEXT NOT NULL UNIQUE,
  profile TEXT,
  reason TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Performance log: manual entry of post metrics after publishing
CREATE TABLE IF NOT EXISTS performance_log (
  id TEXT PRIMARY KEY,
  post_id TEXT REFERENCES posts(id),
  platform TEXT DEFAULT 'linkedin',
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  reposts INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  notes TEXT,
  logged_at TEXT DEFAULT (datetime('now'))
);

-- Settings: all prompts and keywords — editable from the UI
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  label TEXT,
  -- human-readable label shown in settings panel
  category TEXT,
  -- 'prompt' or 'keyword'
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Blacklist: topics the user never wants suggested
CREATE TABLE IF NOT EXISTS blacklist (
  id TEXT PRIMARY KEY,
  term TEXT NOT NULL UNIQUE,
  profile TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
