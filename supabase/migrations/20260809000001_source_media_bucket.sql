-- Optional: create private storage bucket for screenshots/receipts.
-- Prefer creating via Supabase dashboard or storage API.
-- Policies below assume bucket id = 'source-media'.

insert into storage.buckets (id, name, public)
values ('source-media', 'source-media', false)
on conflict (id) do nothing;

create policy "source_media_select_own"
on storage.objects for select
using (
  bucket_id = 'source-media'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "source_media_insert_own"
on storage.objects for insert
with check (
  bucket_id = 'source-media'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "source_media_update_own"
on storage.objects for update
using (
  bucket_id = 'source-media'
  and auth.uid()::text = (storage.foldername(name))[1]
);

create policy "source_media_delete_own"
on storage.objects for delete
using (
  bucket_id = 'source-media'
  and auth.uid()::text = (storage.foldername(name))[1]
);
