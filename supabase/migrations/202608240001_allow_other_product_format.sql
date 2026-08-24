alter table public.products drop constraint if exists products_format_check;

alter table public.products
  add constraint products_format_check
  check (format in ('bar', 'cookie', 'truffle', 'puree', 'other'));
