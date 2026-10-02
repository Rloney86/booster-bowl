"""Offline regression tests: python -m unittest discover -s scripts -p 'test_*.py'."""
import contextlib
import io
import unittest
from datetime import date, datetime, timezone
from unittest.mock import Mock, patch

import sync_vhsl_schedule as sync
import reconcile_vhsl_schedule as reconciliation


class FixedDateTime(datetime):
    @classmethod
    def now(cls, tz=None):
        return cls(2026, 10, 2, 9, 0, tzinfo=timezone.utc)


def listing(d, away, home, listed_by=None):
    return dict(date=d, week=sync.week_for_date(date.fromisoformat(d)),
                away_team=away, home_team=home, listed_by=listed_by or away)


def verify(games):
    teams={sync.team_key(t): (4, 'B') for g in games for t in (g['away_team'], g['home_team'])}
    return sync.verify_schedule(games, teams)


class ReviewedScheduleTests(unittest.TestCase):
    def setUp(self):
        self.stack=contextlib.ExitStack()
        self.addCleanup(self.stack.close)
        self.stack.enter_context(contextlib.redirect_stdout(io.StringIO()))
        self.stack.enter_context(contextlib.redirect_stderr(io.StringIO()))
        self.stack.enter_context(patch.object(sync, 'datetime', FixedDateTime))

    def test_all_25_flagged_entries_have_a_decision(self):
        raw=[listing(d, r['away_team'], r['home_team'])
             for r in sync.REVIEWS['decisions'] for d in r['source_dates']]
        self.assertEqual(len(raw), 25)
        rows, held=verify(raw)
        self.assertEqual(len(rows), 16)
        self.assertEqual(len(held), 6)  # Four held matchups, two with duplicate dates.
        self.assertEqual(len({r['source_game_id'] for r in rows}), 16)
        self.assertFalse(sync.varsity_conflicts(rows))

    def test_date_variants_collapse_and_preserve_early_kickoff(self):
        rows, held=verify([listing(d,'Lightridge','Riverside') for d in ('2026-10-29','2026-10-30')])
        self.assertFalse(held)
        self.assertEqual(len(rows),1)
        self.assertEqual(rows[0]['kickoff_at'],'2026-10-29T18:00:00-04:00')

    def test_live_source_spelling_variants_collapse_only_for_reviewed_fixture(self):
        for decision in sync.REVIEWS['decisions']:
            for alias,canonical in decision.get('team_aliases',{}).items():
                original=listing(decision['date'],decision['away_team'],decision['home_team'])
                variant=dict(original)
                for k in ('away_team','home_team'):
                    if variant[k]==canonical:variant[k]=alias
                rows,held=verify([original,variant])
                self.assertEqual(len(rows),1)
                self.assertFalse(held)
                old=dict(variant,id=123,source=sync.SOURCE,kickoff_at=decision['date']+'T19:00:00-04:00')
                planned=sync.plan_sync(rows,[old])
                self.assertEqual(planned[0][1]['id'],123)
                self.assertIn(alias,(planned[0][0]['away_team'],planned[0][0]['home_team']))
                variant['date']='2026-11-05'
                self.assertIsNone(sync.reviewed_decision(variant))

    def test_review_reverses_conflicting_venue(self):
        rows,held=verify([listing('2026-10-16','Stone Bridge','Riverside'),
                          listing('2026-10-16','Riverside','Stone Bridge')])
        self.assertFalse(held)
        self.assertEqual((rows[0]['away_team'],rows[0]['home_team']),('Riverside','Stone Bridge'))

    def test_no_injection_when_source_has_no_game(self):
        self.assertEqual(verify([]),([],[]))

    def test_unreviewed_dates_and_seasons_do_not_inherit_approval(self):
        raw=[listing('2026-10-28','Lightridge','Riverside')]
        self.assertEqual(len(verify(raw)[1]),1)
        with patch.object(sync,'SEASON',2027):
            self.assertIsNone(sync.reviewed_decision(listing('2026-10-29','Lightridge','Riverside')))

    def test_unreviewed_reciprocal_and_venue_rules_remain(self):
        self.assertEqual(len(verify([listing('2026-10-09','Alpha','Beta')])[1]),1)
        rows,held=verify([listing('2026-10-09','Alpha','Beta'),listing('2026-10-09','Beta','Alpha')])
        self.assertFalse(rows)
        self.assertIn('home/away',held[0][0])

    def test_holds_survive_reciprocal_agreement(self):
        for decision in sync.REVIEWS['decisions']:
            if decision['action']!='hold':continue
            raw=[listing(decision['source_dates'][0],decision['away_team'],decision['home_team'],t)
                 for t in (decision['away_team'],decision['home_team'])]
            self.assertFalse(verify(raw)[0])

    def test_multi_game_exception_rejects_extra_game_and_duplicate(self):
        games=[listing('2026-10-13','Highland Springs','Petersburg'),
               listing('2026-10-16','Petersburg','Meadowbrook')]
        self.assertTrue(sync.approved_multi_game_week(8,'Petersburg',games))
        self.assertFalse(sync.approved_multi_game_week(8,'Petersburg',games+[games[0]]))
        third=listing('2026-10-15','Petersburg','Alpha')
        self.assertFalse(sync.approved_multi_game_week(8,'Petersburg',games+[third]))
        rows,held=verify(games+[third,dict(third,listed_by='Alpha')])
        self.assertFalse(rows)
        self.assertEqual(len(held),3)

    def test_importer_still_recognizes_bird_mclean_and_month_periods(self):
        self.assertTrue(sync.looks_like_team_heading('L.C. BIRD'))
        self.assertTrue(sync.looks_like_team_heading('McLEAN'))
        html='<article>CLASS 4:<br>REGION 4B<br>ALPHA<br>Oct. 9, at Beta<br>BETA<br>Oct 9, Alpha</article>'
        with patch.object(sync.requests,'get',return_value=Mock(text=html)):
            rows,held=sync.parse_schedule()
        self.assertEqual(len(rows),1)
        self.assertFalse(held)

    def reviewed_row(self):
        return verify([listing('2026-10-30','Lightridge','Riverside')])[0][0]

    def old_row(self, id=42, d='2026-10-30', **extra):
        return dict(id=id,source=sync.SOURCE,season=2026,week=10,
                    away_team='Lightridge',home_team='Riverside',
                    kickoff_at=d+'T19:00:00-04:00',
                    source_game_id=sync.stable_source_id(d,'Lightridge','Riverside'),**extra)

    def test_date_correction_reuses_existing_id(self):
        plan=sync.plan_sync([self.reviewed_row()],[self.old_row()])
        self.assertEqual(plan[0][1]['id'],42)

    def test_exact_quarantined_row_is_reactivated_instead_of_recreated(self):
        row=self.reviewed_row()
        old=self.old_row(d='2026-10-29',sync_status='quarantined')
        old['source_game_id']=row['source_game_id']
        plan=sync.plan_sync([row],[old])
        self.assertEqual(plan[0][1]['id'],42)
        self.assertEqual(plan[0][0]['sync_status'],'scheduled')

    def test_source_id_owner_wins_over_active_date_match(self):
        row=self.reviewed_row()
        owner=self.old_row(id=44,d='2026-10-29',sync_status='quarantined')
        owner['source_game_id']=row['source_game_id']
        active=self.old_row(id=43,d='2026-10-29')
        plan=sync.plan_sync([row],[active,owner])
        self.assertEqual(plan[0][1]['id'],44)
        self.assertEqual(sync.choose_duplicate_keeper(row,[active,owner])['id'],44)

    def test_venue_repair_preserves_saved_team_spelling(self):
        row=verify([listing('2026-10-09','Powhatan','Richmond School For The Arts')])[0][0]
        old=dict(id=51,source=sync.SOURCE,away_team='Powhatan',home_team='Richmond School for the Arts',
                 kickoff_at='2026-10-09T19:00:00-04:00')
        plan=sync.plan_sync([row],[old])
        self.assertEqual(plan[0][0]['away_team'],'Richmond School for the Arts')
        self.assertEqual(plan[0][0]['home_team'],'Powhatan')
        self.assertEqual(plan[0][1]['id'],51)

    def test_zero_pick_duplicates_quarantine_extra_and_reuse_verified_row(self):
        response=Mock(ok=True)
        response.json.return_value=[self.old_row(),self.old_row(id=43,d='2026-10-29')]
        empty=Mock(ok=True);empty.json.return_value=[]
        no_picks=Mock(ok=True);no_picks.json.return_value=[]
        write=Mock(return_value=Mock(ok=True))
        with patch.dict(sync.os.environ,SUPABASE_URL='https://example.invalid',SUPABASE_SERVICE_ROLE_KEY='test'), \
             patch.object(sync.requests,'get',side_effect=[response,empty,no_picks]), \
             patch.object(sync.requests,'patch',write),patch.object(sync.requests,'post') as create:
            self.assertEqual(sync.sync([self.reviewed_row()]),(0,1,0))
        create.assert_not_called()
        self.assertEqual(write.call_count,2)
        self.assertTrue(write.call_args_list[0].args[0].endswith('games?id=eq.42'))
        self.assertEqual(write.call_args_list[0].kwargs['json'],{'sync_status':'quarantined'})
        self.assertTrue(write.call_args_list[1].args[0].endswith('games?id=eq.43'))

    def test_duplicate_with_saved_pick_fails_before_any_write(self):
        response=Mock(ok=True)
        response.json.return_value=[self.old_row(),self.old_row(id=43,d='2026-10-29')]
        empty=Mock(ok=True);empty.json.return_value=[]
        picks=Mock(ok=True);picks.json.return_value=[{'game_id':42}]
        with patch.dict(sync.os.environ,SUPABASE_URL='https://example.invalid',SUPABASE_SERVICE_ROLE_KEY='test'), \
             patch.object(sync.requests,'get',side_effect=[response,empty,picks]), \
             patch.object(sync.requests,'patch') as write,patch.object(sync.requests,'post') as create:
            with self.assertRaisesRegex(RuntimeError,'have saved picks'):
                sync.sync([self.reviewed_row()])
        write.assert_not_called();create.assert_not_called()

    def test_final_game_untouched_and_date_repair_updates_same_id(self):
        for final in (True,False):
            response=Mock(ok=True);response.json.return_value=[self.old_row(is_final=final)]
            empty=Mock(ok=True);empty.json.return_value=[]
            with patch.dict(sync.os.environ,SUPABASE_URL='https://example.invalid',SUPABASE_SERVICE_ROLE_KEY='test'), \
                 patch.object(sync.requests,'get',side_effect=[response,empty]), \
                 patch.object(sync.requests,'patch',return_value=Mock(ok=True)) as write, \
                 patch.object(sync.requests,'post') as create:
                self.assertEqual(sync.sync([self.reviewed_row()]),(0,int(not final),int(final)))
                create.assert_not_called()
                if final:write.assert_not_called()
                else:self.assertTrue(write.call_args.args[0].endswith('games?id=eq.42'))

    def test_manual_and_already_started_reviewed_games_untouched(self):
        old=self.old_row();old['source']='Manual'
        self.assertFalse(sync.plan_sync([self.reviewed_row()],[old]))
        row=verify([listing('2026-10-02','Caroline','James Monroe')])[0][0]
        later=FixedDateTime(2026,10,3,tzinfo=timezone.utc)
        with patch.object(sync,'datetime') as clock:
            clock.fromisoformat=datetime.fromisoformat;clock.now.return_value=later
            self.assertFalse(sync.plan_sync([row],[]))

    def test_reconciliation_preserves_final_manual_and_pick_records(self):
        stale=dict(id=1,source=sync.SOURCE,source_game_id='stale',week=6,away_team='A',home_team='B')
        response=Mock(ok=True);response.json.return_value=[stale,dict(stale,id=2,is_final=True),dict(stale,id=3,source='Manual')]
        with patch.dict(sync.os.environ,SUPABASE_URL='https://example.invalid',SUPABASE_SERVICE_ROLE_KEY='test'), \
             patch.object(reconciliation,'parse_schedule',return_value=([{'source_game_id':'current'}],[])), \
             patch.object(reconciliation,'validate'),patch.object(reconciliation.requests,'get',return_value=response), \
             patch.object(reconciliation.requests,'patch',return_value=Mock(ok=True)) as write:
            reconciliation.reconcile()
        write.assert_called_once()
        self.assertTrue(write.call_args.args[0].endswith('games?id=eq.1'))
        self.assertEqual(write.call_args.kwargs['json'],{'sync_status':'quarantined'})


if __name__=='__main__':
    unittest.main()
