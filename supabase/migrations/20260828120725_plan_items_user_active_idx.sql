-- Menu snapshot lists active plan items by owner.
-- Without this index, RLS `user_id = auth.uid()` seq-scans numa.plan_items
-- (painful for a newly invited user on a shared staging project).
-- numa-schema only. Does not change RLS.

create index if not exists numa_plan_items_user_active_idx
  on numa.plan_items (user_id)
  where is_active = true;
