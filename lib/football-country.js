'use strict';
const ALIASES={'the netherlands':'Netherlands','holland':'Netherlands','united states of america':'USA','united states':'USA',
  'usa':'USA','türkiye':'Turkey','turkiye':'Turkey','czechia':'Czech Republic','republic of ireland':'Ireland',
  'korea republic':'South Korea','republic of korea':'South Korea'};
function footballCountry(value) {
  if(!value)return null;
  const text=String(value).trim();return ALIASES[text.toLowerCase()] || text;
}
module.exports={footballCountry};
