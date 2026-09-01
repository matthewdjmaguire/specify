-- why a global profile setting, not a per-quiz toggle: Jamie reported
-- seeing the same plants repeatedly — an expected consequence of SPEC-017's
-- priority-weight spaced repetition (a plant she keeps missing can reach up
-- to 10x the selection weight of one she's mastered), but not always what
-- she wants. "priority" preserves today's behaviour for every existing
-- profile; "random" makes selectQuizPlants ignore priority_weight entirely
-- and sample uniformly.
alter table public.profiles
  add column quiz_plant_selection text not null default 'priority'
    check (quiz_plant_selection in ('priority', 'random'));
