ALTER TABLE profiles ADD COLUMN username text UNIQUE;

ALTER TABLE profiles ADD CONSTRAINT profiles_username_format
  CHECK (username ~ '^[a-z0-9]{3,20}$');
