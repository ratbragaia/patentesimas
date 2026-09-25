-- Machine-translation flag: when the English abstract is a machine translation (BigQuery research
-- dataset or an office MT), the newsletter must say so (research 03 §6.4 gate 4).
alter table rf.patent_publications add column if not exists abstract_is_mt boolean not null default false;
alter table rf.patent_publications add column if not exists source_id_raw text;
create index if not exists patent_publications_first_seen on rf.patent_publications (first_seen_at desc);
