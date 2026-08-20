# Migrations

Applied in filename order. `00001`–`00014` were authored here first.
`00015`–`00019` were applied straight to the remote project and backfilled into git
on 2026-08-20; their SQL is byte-identical to `supabase_migrations.schema_migrations`
on the remote (verified by md5).

| File | Remote `version` | Remote `name` |
|------|------------------|---------------|
| `00015_course_spots_remaining.sql` | `20260807100932` | `course_spots_remaining` |
| `00016_sport_default_photo.sql` | `20260810095021` | `sport_default_photo` |
| `00017_course_availability.sql` | `20260810133637` | `00015_course_availability` |
| `00018_course_availability_via_spots_remaining.sql` | `20260810133739` | `00015_course_availability` |
| `00019_announcement_views.sql` | `20260811091856` | `00016_announcement_views` |

`00017` and `00018` are both kept on purpose: `00018` replaced `00017` in production
62 seconds after it was applied, and the ledger records what actually ran.

**Next migration number = highest existing + 1.** Check with
`git ls-files supabase/migrations | tail -1` before creating one — do not trust a
number written down elsewhere.

To confirm git and the remote still agree:

```bash
npx supabase link --project-ref ehdzafadshbaaghzdzdo
npx supabase migration list
```
