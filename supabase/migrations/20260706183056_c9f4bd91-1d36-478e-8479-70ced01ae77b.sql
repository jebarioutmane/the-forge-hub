ALTER TABLE public.resource_library
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'General',
  ADD COLUMN IF NOT EXISTS resource_type TEXT NOT NULL DEFAULT 'link',
  ADD COLUMN IF NOT EXISTS tag_ids UUID[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- Backfill: seed category from module_name for existing rows that don't carry a category yet.
UPDATE public.resource_library
   SET category = module_name
 WHERE category = 'General' AND module_name IS NOT NULL AND module_name <> '' AND module_name <> 'All';

CREATE INDEX IF NOT EXISTS resource_library_category_idx ON public.resource_library(category);
CREATE INDEX IF NOT EXISTS resource_library_is_archived_idx ON public.resource_library(is_archived);