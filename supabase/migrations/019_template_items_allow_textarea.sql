begin;

alter table public.template_items
drop constraint if exists template_items_item_type_check;

alter table public.template_items
add constraint template_items_item_type_check
check (item_type = any (array['checkbox'::text, 'number'::text, 'text'::text, 'textarea'::text]));

commit;
