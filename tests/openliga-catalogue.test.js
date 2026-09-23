'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {resolveOpenLigaClubs}=require('../lib/openligadb-history');

test('current OpenLiga catalogue recovers lower-league identities, crests and fixtures despite old or absent metadata',async()=>{
  const old=global.fetch;
  const clubs=['SV Wehen Wiesbaden','Alemannia Aachen','TSG 1899 Hoffenheim II','SV Meppen'].map((teamName,i)=>({teamName,teamId:i+1,teamIconUrl:`https://example.com/club-${i}.png`}));
  const rows=[0,2].map((offset,i)=>({matchID:100+i,team1:clubs[offset],team2:clubs[offset+1],matchIsFinished:false,matchDateTimeUTC:new Date(Date.now()+864e5).toISOString()}));
  rows.push({matchID:103,team1:{teamName:'Later Home',teamId:5},team2:{teamName:'Later Away',teamId:6},matchIsFinished:false,matchDateTimeUTC:new Date(Date.now()+180*864e5).toISOString()});
  global.fetch=async url=>({ok:true,json:async()=>String(url).includes('/bl3/')?rows:[]});
  try{
    for(const [home,away] of [['Wehen Wiesbaden','Alemannia Aachen'],['Hoffenheim II','SV Meppen']]){
      const input={teams:{home:{name:home},away:{name:away}},fixture:{league:'German Bundesliga'},form:{home:{played:0},away:{played:0}}};
      const result=await resolveOpenLigaClubs(input);
      assert.equal(result.teams.home.country,'Germany');assert.equal(result.teams.away.resolved,true);
      assert.ok(result.teams.home.badge);assert.ok(result.teams.away.badge);
      assert.equal(result.fixture.league,'German 3. Liga');assert.equal(result.fixture.source,'OpenLigaDB');
      assert.ok(Date.parse(result.fixture.date)>Date.now());
    }
    const distant=await resolveOpenLigaClubs({teams:{home:{name:'Later Home'},away:{name:'Later Away'}},fixture:{},form:{}});
    assert.equal(distant.teams.home.resolved,true);assert.equal(distant.fixture.date,undefined);
  }finally{global.fetch=old;}
});
