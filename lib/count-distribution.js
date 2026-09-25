'use strict';
function countOver(mean,line,dispersion=null) {
  if(!Number.isFinite(mean)||mean<0||!Number.isFinite(line)||line<0) return null;
  const k=Number.isFinite(dispersion)&&dispersion>0?dispersion:null;
  let p=k?Math.pow(k/(k+mean),k):Math.exp(-mean),cdf=p;
  for(let n=1;n<=Math.floor(line);n++) {
    p*=k?((n-1+k)/n)*(mean/(k+mean)):mean/n;cdf+=p;
  }
  return Math.max(0,Math.min(1,1-cdf));
}
module.exports={countOver};
