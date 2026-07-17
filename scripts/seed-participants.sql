-- scripts/seed-participants.sql
-- Seeds real team members and maps them as accepted members to the showcase public trips

-- 1. Insert showcase team members
INSERT INTO user_schema.users (id, email, password_hash, display_name, avatar_url, role, plan, email_verified)
VALUES
  ('c1a5b89a-0001-4c12-9852-6defd348a001', 'elena.rostova@trippy.app', '$2a$10$CHANGE_ME_STRONG_PASSWORD_123!', 'Elena Rostova', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop', 'USER', 'FREE', true),
  ('c1a5b89a-0002-4c12-9852-6defd348a002', 'marco.silva@trippy.app', '$2a$10$CHANGE_ME_STRONG_PASSWORD_123!', 'Marco Silva', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop', 'USER', 'FREE', true),
  ('c1a5b89a-0003-4c12-9852-6defd348a003', 'anna.mueller@trippy.app', '$2a$10$CHANGE_ME_STRONG_PASSWORD_123!', 'Anna Müller', 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop', 'USER', 'FREE', true),
  ('c1a5b89a-0004-4c12-9852-6defd348a004', 'david.chen@trippy.app', '$2a$10$CHANGE_ME_STRONG_PASSWORD_123!', 'David Chen', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop', 'USER', 'FREE', true),
  ('c1a5b89a-0005-4c12-9852-6defd348a005', 'sophie.dubois@trippy.app', '$2a$10$CHANGE_ME_STRONG_PASSWORD_123!', 'Sophie Dubois', 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop', 'USER', 'FREE', true),
  ('c1a5b89a-0006-4c12-9852-6defd348a006', 'clara.schmidt@trippy.app', '$2a$10$CHANGE_ME_STRONG_PASSWORD_123!', 'Clara Schmidt', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop', 'USER', 'FREE', true)
ON CONFLICT (email) DO UPDATE SET 
  display_name = EXCLUDED.display_name,
  avatar_url = EXCLUDED.avatar_url;

-- 2. Link showcase team members to Trip 1: Santorini (8ff742ad-591a-4d40-926f-8d1413ce3cfd)
INSERT INTO trip_schema.participants (id, trip_id, user_id, role, status, joined_at)
VALUES
  (gen_random_uuid(), '8ff742ad-591a-4d40-926f-8d1413ce3cfd', 'c1a5b89a-0001-4c12-9852-6defd348a001', 'MEMBER', 'ACCEPTED', CURRENT_TIMESTAMP),
  (gen_random_uuid(), '8ff742ad-591a-4d40-926f-8d1413ce3cfd', 'c1a5b89a-0002-4c12-9852-6defd348a002', 'MEMBER', 'ACCEPTED', CURRENT_TIMESTAMP),
  (gen_random_uuid(), '8ff742ad-591a-4d40-926f-8d1413ce3cfd', 'c1a5b89a-0003-4c12-9852-6defd348a003', 'MEMBER', 'ACCEPTED', CURRENT_TIMESTAMP),
  (gen_random_uuid(), '8ff742ad-591a-4d40-926f-8d1413ce3cfd', 'c1a5b89a-0004-4c12-9852-6defd348a004', 'MEMBER', 'ACCEPTED', CURRENT_TIMESTAMP)
ON CONFLICT (trip_id, user_id) DO NOTHING;

-- 3. Link showcase team members to Trip 2: Barcelona (7adb516b-9822-42b2-97f9-1a9328d410d4)
INSERT INTO trip_schema.participants (id, trip_id, user_id, role, status, joined_at)
VALUES
  (gen_random_uuid(), '7adb516b-9822-42b2-97f9-1a9328d410d4', 'c1a5b89a-0002-4c12-9852-6defd348a002', 'MEMBER', 'ACCEPTED', CURRENT_TIMESTAMP),
  (gen_random_uuid(), '7adb516b-9822-42b2-97f9-1a9328d410d4', 'c1a5b89a-0005-4c12-9852-6defd348a005', 'MEMBER', 'ACCEPTED', CURRENT_TIMESTAMP),
  (gen_random_uuid(), '7adb516b-9822-42b2-97f9-1a9328d410d4', 'c1a5b89a-0006-4c12-9852-6defd348a006', 'MEMBER', 'ACCEPTED', CURRENT_TIMESTAMP)
ON CONFLICT (trip_id, user_id) DO NOTHING;

-- 4. Link showcase team members to Trip 3: Swiss Alps (a17ff35b-3c8f-4534-9a41-2cf59ca96aa0)
INSERT INTO trip_schema.participants (id, trip_id, user_id, role, status, joined_at)
VALUES
  (gen_random_uuid(), 'a17ff35b-3c8f-4534-9a41-2cf59ca96aa0', 'c1a5b89a-0001-4c12-9852-6defd348a001', 'MEMBER', 'ACCEPTED', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'a17ff35b-3c8f-4534-9a41-2cf59ca96aa0', 'c1a5b89a-0002-4c12-9852-6defd348a002', 'MEMBER', 'ACCEPTED', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'a17ff35b-3c8f-4534-9a41-2cf59ca96aa0', 'c1a5b89a-0003-4c12-9852-6defd348a003', 'MEMBER', 'ACCEPTED', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'a17ff35b-3c8f-4534-9a41-2cf59ca96aa0', 'c1a5b89a-0004-4c12-9852-6defd348a004', 'MEMBER', 'ACCEPTED', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'a17ff35b-3c8f-4534-9a41-2cf59ca96aa0', 'c1a5b89a-0005-4c12-9852-6defd348a005', 'MEMBER', 'ACCEPTED', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'a17ff35b-3c8f-4534-9a41-2cf59ca96aa0', 'c1a5b89a-0006-4c12-9852-6defd348a006', 'MEMBER', 'ACCEPTED', CURRENT_TIMESTAMP)
ON CONFLICT (trip_id, user_id) DO NOTHING;
