'use strict';

const { resolveTeam, requestFootballResource } = require('./bsd-history');
const { sameTeam } = require('./match-integrity');

function player(row) {
  const id = row?.player_id ?? row?.player?.id ?? row?.id;
  const name = row?.name ?? row?.player_name ?? row?.player?.name;
  if (!Number.isSafeInteger(id) || id <= 0 || typeof name !== 'string' || !name.trim()) return null;
  return {id, name:name.trim().slice(0,100), position:String(row.position ?? row.pos ?? '').slice(0,20),
    captain:row.captain === true};
}

function lineupSide(raw) {
  const rows = raw?.starting_xi ?? raw?.starting_lineup ?? raw?.starting ?? raw?.players;
  if (!Array.isArray(rows)) return null;
  const players = rows.map(player).filter(Boolean);
  if (players.length !== 11 || new Set(players.map(p=>p.id)).size !== 11) return null;
  return {formation: typeof raw.formation === 'string' ? raw.formation.slice(0,20) : null, players};
}

function normalizeLineups(payload, eventId) {
  if (Number(payload?.event_id) !== eventId) return {status:'invalid_identity', confirmed:false};
  const status = ['confirmed','predicted','unavailable'].includes(payload.lineup_status) ? payload.lineup_status : 'unavailable';
  // Predicted teamsheets are identified, never copied into a confirmed XI.
  if (status !== 'confirmed' || payload.beta === true) return {status, confirmed:false, updatedAt:payload.updated_at || null};
  const home = lineupSide(payload.lineups?.home), away = lineupSide(payload.lineups?.away);
  return {status:home && away ? 'confirmed' : 'incomplete', confirmed:Boolean(home && away), home, away,
    updatedAt:payload.updated_at || null, source:'BSD', injuryCoverage:'partial_or_unknown'};
}

function exactFixture(rows, teams, existingDate, now = Date.now()) {
  const existing = Date.parse(existingDate);
  const hits = rows.filter(row => Number.isSafeInteger(row.id) && row.replaced_by == null && row.status === 'upcoming' &&
    row.home_team_id === teams[0].id && row.away_team_id === teams[1].id &&
    sameTeam(row.home_team, teams[0].name) && sameTeam(row.away_team, teams[1].name) &&
    Date.parse(row.event_date) > now && Date.parse(row.event_date) <= now + 21 * 864e5 &&
    (!Number.isFinite(existing) || Math.abs(Date.parse(row.event_date) - existing) < 3 * 36e5))
    .sort((a,b)=>Date.parse(a.event_date)-Date.parse(b.event_date));
  return hits[0] || null;
}

async function enrichMatchContext(analysis) {
  const checkedAt = new Date().toISOString();
  analysis.matchContext = {checkedAt, lineups:{status:'unavailable',confirmed:false}, referee:null};
  try {
    const teams = await Promise.all(['home','away'].map(async side=>{
      const t=analysis.teams[side];
      return t.bsdId ? {...t,id:t.bsdId} : resolveTeam(t);
    }));
    if (teams.some(t=>!t) || teams[0].id === teams[1].id) { analysis.matchContext.status='teams_unavailable'; return analysis; }
    teams.forEach((t,i)=>{ analysis.teams[i?'away':'home'].bsdId=t.id; });
    const list = await requestFootballResource('events',{team_id:String(teams[0].id),status:'upcoming',
      date_from:checkedAt.slice(0,10),date_to:new Date(Date.now()+21*864e5).toISOString().slice(0,10),limit:'200',offset:'0'},120);
    const fixture = list.next ? null : exactFixture(list.results || [],teams,analysis.fixture?.date);
    if (!fixture) { analysis.matchContext.status='fixture_unconfirmed'; return analysis; }
    analysis.fixture = {...analysis.fixture,date:fixture.event_date,bsdId:fixture.id,bsdLeagueId:fixture.league_id,
      source:analysis.fixture?.source || 'BSD verified fixture'};
    const [details, sheet] = await Promise.allSettled([
      requestFootballResource(`events/${fixture.id}`,{},120),
      requestFootballResource(`events/${fixture.id}/lineups`,{},120)
    ]);
    if (sheet.status === 'fulfilled') analysis.matchContext.lineups=normalizeLineups(sheet.value,fixture.id);
    else analysis.matchContext.lineups={status:'temporarily_unavailable',confirmed:false};
    if (details.status === 'fulfilled') {
      const d=details.value;
      if(d.home_team_id === teams[0].id && d.away_team_id === teams[1].id) {
        analysis.fixture.neutralGround=d.is_neutral_ground === true;
        analysis.fixture.venue ||= typeof d.venue === 'string' ? d.venue : d.venue_name || null;
        const id=d.referee_id ?? d.referee?.id;
        const name=d.referee_name ?? (typeof d.referee === 'string' ? d.referee : d.referee?.name);
        if(Number.isSafeInteger(id) && name) analysis.matchContext.referee={id,name:String(name).slice(0,100),source:'BSD',appliedToModel:false};
      }
    }
    analysis.matchContext.status='checked';
    analysis.matchContext.refreshAfter=new Date(Date.now()+5*60e3).toISOString();
    analysis.squad={...(analysis.squad || {}),structured:analysis.matchContext.lineups.confirmed};
  } catch(error) {
    analysis.matchContext.status=['not_configured','quota_exhausted','access_denied'].includes(error.message)?error.message:'temporarily_unavailable';
  }
  return analysis;
}

module.exports={enrichMatchContext,normalizeLineups,exactFixture,lineupSide};
