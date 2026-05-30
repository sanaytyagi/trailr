-- Fix foreign key constraints to cascade on profile deletion
-- Ensures account deletion works without FK violations

ALTER TABLE counselor_college_notes DROP CONSTRAINT counselor_college_notes_counselor_id_fkey;
ALTER TABLE counselor_college_notes ADD CONSTRAINT counselor_college_notes_counselor_id_fkey FOREIGN KEY (counselor_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE counselor_college_notes DROP CONSTRAINT counselor_college_notes_student_id_fkey;
ALTER TABLE counselor_college_notes ADD CONSTRAINT counselor_college_notes_student_id_fkey FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE activity_feed DROP CONSTRAINT activity_feed_student_id_fkey;
ALTER TABLE activity_feed ADD CONSTRAINT activity_feed_student_id_fkey FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE activity_feed DROP CONSTRAINT activity_feed_counselor_id_fkey;
ALTER TABLE activity_feed ADD CONSTRAINT activity_feed_counselor_id_fkey FOREIGN KEY (counselor_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE essay_comments DROP CONSTRAINT essay_comments_counselor_id_fkey;
ALTER TABLE essay_comments ADD CONSTRAINT essay_comments_counselor_id_fkey FOREIGN KEY (counselor_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE essay_notes DROP CONSTRAINT essay_notes_user_id_fkey;
ALTER TABLE essay_notes ADD CONSTRAINT essay_notes_user_id_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE profiles DROP CONSTRAINT profiles_counselor_id_fkey;
ALTER TABLE profiles ADD CONSTRAINT profiles_counselor_id_fkey FOREIGN KEY (counselor_id) REFERENCES profiles(id) ON DELETE SET NULL;
